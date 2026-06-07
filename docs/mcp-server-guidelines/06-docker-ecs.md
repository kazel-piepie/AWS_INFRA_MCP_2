# 06. Docker 및 ECS 규칙

## Docker 베이스 이미지 및 패키지 규칙

### Node.js 베이스 이미지

- `node:24-slim`을 사용한다 (Node 20은 2026년 4월 EOL, Node 24가 현재 Active LTS)

### ca-certificates 필수 설치

- `apt-get install`에 `ca-certificates`를 반드시 포함한다
- `-slim` 계열 이미지에는 `ca-certificates`가 포함되어 있지 않아 curl HTTPS 연결이 실패함 (exit code 77)
- Node.js 버전과 무관하게 `*-slim` 계열 이미지는 모두 동일한 문제가 발생한다

```dockerfile
FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip git less jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

### Claude CLI 설치 방법

- **반드시 `npm install -g @anthropic-ai/claude-code`로 설치한다**
- `curl`을 이용한 바이너리 직접 다운로드 방식은 **절대 사용 금지**

**이유**: 바이너리 직접 다운로드 URL(예: `storage.googleapis.com/anthropic-claude-cli/...`)은 실제로 존재하지 않아 curl 404 오류 발생 → Docker 빌드 실패

**이점**: `node:24-slim` 베이스 이미지에 npm이 이미 포함되어 있으므로 별도 설치 없이 바로 사용 가능

```dockerfile
# ❌ 금지 — 404 오류 발생
RUN curl -fsSL "https://storage.googleapis.com/anthropic-claude-cli/latest/linux-amd64/claude" \
    -o /usr/local/bin/claude && chmod +x /usr/local/bin/claude

# ✅ 올바른 방법
RUN npm install -g @anthropic-ai/claude-code
```

---

## Docker 빌드 규칙

### 빌드 원칙

- `package.json`이 없을 때도 빌드되도록 처리
- `npm ci`는 `package-lock.json`이 없으면 실패 → **`npm install` 사용**
- 빌더 스테이지와 런타임 스테이지를 **반드시 분리**

| 스테이지 | 명령 | 이유 |
|----------|------|------|
| 빌더 | `npm install` | devDependencies 포함 (TypeScript 컴파일에 필요) |
| 런타임 | `npm install --omit=dev` | prod 의존성만 포함 |

### AWS CLI pager 오류 방지

Docker 컨테이너 내부에서 AWS CLI 실행 시 `less`가 없으면 pager를 찾지 못해 실패합니다.

**해결 방법 (택일)**:
1. Dockerfile에 `less` 설치 추가
2. AWS CLI 호출 시 `--no-cli-pager` 옵션 추가
3. 환경변수 `AWS_PAGER=""` 설정

> Node.js subprocess로 AWS CLI를 호출할 때는 env에 `AWS_PAGER: ''` 반드시 포함

### 빌드 전 사전 조건

- `mcp-server/docs/projects-guidelines/` 폴더가 반드시 존재해야 함

### CI/CD 작업 순서

```
docker job → Docker 빌드 → ECR push → ECS 서비스 업데이트
```

> **ECR 저장소는 CI/CD 실행 전 Claude가 직접 생성해야 합니다. CI/CD에 terraform job을 포함하지 않습니다.**

## Docker non-root 유저 (mcpuser)

### 발생 오류

ECS Fargate 컨테이너가 root 유저로 실행될 경우 Claude CLI의 `--dangerously-skip-permissions` 플래그 사용이 차단됩니다:

```
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
```

**원인**: MCP 서버가 내부적으로 `claude -p '...' --dangerously-skip-permissions`를 subprocess로 실행하는데, 컨테이너가 root로 동작하면 Claude CLI가 이를 거부합니다.

### 해결 방법 — Dockerfile non-root 유저 설정

```dockerfile
RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser
RUN mkdir -p /home/mcpuser/.claude && chown -R mcpuser:mcpuser /app /home/mcpuser
ENV HOME=/home/mcpuser
USER mcpuser
```

- **적용 위치**: Dockerfile의 런타임 스테이지 마지막 부분 (CMD 또는 ENTRYPOINT 바로 위)
- **`ENV HOME=/home/mcpuser` 필수**: `~/.claude/.credentials.json` 경로가 올바르게 해석됨
- ECS Task Definition의 `user` 필드를 별도 설정하지 않아도 Dockerfile의 `USER` 지시어만으로 충분

## mcpuser 권한 범위

### sudo/어드민 권한 절대 부여 금지

**이유**: Claude CLI는 root 또는 sudo 권한을 감지하면 `--dangerously-skip-permissions` 플래그를 하드코딩으로 차단

- `mcpuser + sudo` = root와 동일한 오류 재발생
- 반드시 **순수 non-root 유저**로만 운영

### mcpuser 필요 권한 범위

| 경로 | 권한 | 이유 |
|------|------|------|
| `/app` 전체 | 읽기 + 실행 | Node.js 앱 실행, CLAUDE.md / docs 파일 읽기 |
| `/home/mcpuser` 전체 | 읽기 + 쓰기 | credentials.json 저장/복원, claude CLI 추가 디렉토리 생성 |
| `/home/mcpuser/.claude/` | 읽기 + 쓰기 + 디렉토리 생성 | Secrets Manager 복원 시 mkdirSync, writeFileSync, 5초 폴링 statSync |
| `/tmp` | 읽기 + 쓰기 + 실행 | git clone, terraform init 임시 작업공간 (기본 1777, 별도 조치 불필요) |
| 글로벌 바이너리 (claude, aws, terraform, git, gh, node) | 실행 | root로 설치 시 기본 755, 별도 조치 불필요 |

## ECS Exec 접속 (connect-mcp.sh)

### 사전 요구사항

- `aws ecs execute-command` 실행 시 `session-manager-plugin` 필수

**WSL 설치 방법**:
```bash
curl -fsSL https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb -o /tmp/ssm.deb
dpkg -x /tmp/ssm.deb /tmp/ssm-plugin
cp /tmp/ssm-plugin/usr/local/sessionmanagerplugin/bin/session-manager-plugin ~/bin/
export PATH="$HOME/bin:$PATH"
```

### connect-mcp.sh 파일 규칙

- **위치**: `mcp-server/connect-mcp.sh`
- MCP 서버 코드 생성 시 **반드시 생성**

**포함 기능**:

| 기능 | 설명 |
|------|------|
| ECS Task ARN 자동 조회 | `aws ecs list-tasks` 실행 |
| ECS execute-command 실행 | cluster, task, container 자동 지정 |
| session-manager-plugin 검사 | 미설치 시 설치 안내 출력 |
| `.env` 자동 로드 | 상위 디렉토리에서 `.env` 탐색 및 `source` |

- `.env`가 없으면 "AWS credentials not found in .env" 경고 출력 후 기존 환경변수로 계속 진행

### Claude 인증 — mcpuser로 전환 후 수행

> ⚠️ **ECS Exec은 항상 root로 접속됩니다.**
> SSM 에이전트가 root로 실행되므로 Dockerfile의 `USER mcpuser`를 무시합니다.
> root에서 그대로 `claude auth login`하면 `/root/.claude/.credentials.json`에 저장되지만,
> MCP 서버(mcpuser)는 `/home/mcpuser/.claude/.credentials.json`을 바라보므로
> credential-sync가 변경을 감지하지 못해 Secrets Manager에 업로드되지 않습니다.

**정상 방법 — mcpuser로 전환 후 인증**:

```bash
# connect-mcp.sh 접속 직후 (root 상태)
su -s /bin/bash mcpuser    # mcpuser로 전환
claude auth login           # /home/mcpuser/.claude/.credentials.json에 저장
                            # credential-sync 5초 폴링으로 감지 → Secrets Manager 자동 업로드
```

**su 실패 시 대안 — root에서 인증 후 수동 복사**:

```bash
claude auth login
cp /root/.claude/.credentials.json /home/mcpuser/.claude/.credentials.json
chown mcpuser:mcpuser /home/mcpuser/.claude/.credentials.json
chmod 600 /home/mcpuser/.claude/.credentials.json
# credential-sync가 파일 변경 감지 후 Secrets Manager 자동 업로드
```
