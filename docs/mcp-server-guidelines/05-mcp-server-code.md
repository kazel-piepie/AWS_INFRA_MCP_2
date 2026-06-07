# 05. MCP 서버 코드 규칙

## 폴더 구조

```
mcp-server/
├── src/              # MCP 서버 코드
├── infra/            # ECS 배포를 위한 Terraform 코드
├── docs/
│   └── projects-guidelines/  # 빌드 전 반드시 존재 (docs/projects-guidelines에서 복사)
├── CLAUDE.md         # Claude CLI 인프라 생성 작업 시 참고 지침 파일
└── connect-mcp.sh    # ECS Exec 접속 스크립트
```

- `mcp-server` 폴더 생성 시 `docs/projects-guidelines/` 폴더를 `mcp-server` 폴더에 복사

## MCP 서버 핵심 스펙

| 항목 | 내용 |
|------|------|
| Claude 호출 방식 | `claude` CLI를 subprocess로 실행 (SDK/API 직접 import 금지) |
| 배포 방식 | Docker 이미지 → ECS 서버 배포 |
| 외부 URL | `https://mcp-dev-aws.rorr.club/mcp` |
| SSL 인증서 | `rorr.club` 인증서 사용 |
| ALB idle_timeout | **4,000초** (AWS ALB 하드 최대값) |
| claude-runner.ts timeout | **3,900,000ms (65분)** — ALB 4,000초 한도 내 여유 확보 |

## Claude 호출 방법 및 인증

### 호출 방식

- MCP 서버에서 Claude 호출 시 반드시 `claude` **CLI를 subprocess로 실행**
- `@anthropic-ai/sdk`, `@anthropic-ai/claude-code` SDK를 서버 코드에서 직접 import **금지**
- 인증은 `claude auth login`으로 생성된 `~/.claude/.credentials.json` 사용 (API Key 환경변수 사용 금지)

### Claude 인증 파일 경로

- **실제 경로**: `~/.claude/.credentials.json`
- `watchFile`, 백업/복원 로직 모두 `~/.claude/.credentials.json` 대상으로 작성

### Claude.ai 인증 흐름

1. 사용자가 터미널로 MCP 서버에 접속해 최초 1회 `claude auth login` 수행 (브라우저 인터랙션 필요 → 사용자 직접 수행)
2. 인증 정보가 업데이트되면 `credential-sync`가 5초 폴링으로 감지 → Secrets Manager에 자동 업로드
3. MCP 서버 재배포 시 Secrets Manager에서 인증 정보를 로컬에 동기화

### subprocess 실행 방법 — spawn 필수

`claude` CLI를 subprocess로 실행할 때 반드시 `child_process.spawn`을 사용한다. `execFile`은 stdin을 파이프할 수 없어 `no stdin data received` 오류(exit code 1)가 발생한다.

```typescript
import { spawn } from 'child_process';

const child = spawn('claude', args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

child.stdin.write(stdinData);
child.stdin.end();

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stderr.on('data', (chunk) => { stderr += chunk; });

child.on('close', (code) => {
  if (code !== 0) throw new Error(stderr);
  resolve(stdout);
});
```

- `execFile`로 교체하면 stdin 파이프가 불가능하여 즉시 오류 발생 — **금지**

## claude-runner.ts 타임아웃

### 타임아웃 제약 구조

| 항목 | 값 | 비고 |
|------|----|----|
| ALB idle_timeout | **4,000초** | AWS ALB 하드 최대값 — 실질적인 상한선 |
| claude-runner.ts timeout | **3,900,000ms (65분)** 권장 | ALB 4,000초 한도 내 여유 확보 |

- `claude-runner.ts` timeout은 반드시 **4,000,000ms 미만**으로 설정

### 발생 오류 패턴

```
Command timed out after 300000 milliseconds
```

원인: 기본 타임아웃이 300,000ms(5분)이지만, RORR 인프라 생성 툴의 실제 작업(레포 clone → Terraform 코드 생성 → init/validate → git push → PR 생성)이 5분을 초과함

## server.tool() 콜백 파라미터 타입 명시 필수

```typescript
// ❌ 금지
server.tool('name', '...', { key: z.string() }, async ({ key }) => { ... })

// ✅ 올바른 방법
server.tool('name', '...', { key: z.string() }, async ({ key }: { key: string }) => { ... })
```

## MCP 세션 관리

- `StreamableHTTPServerTransport`의 `sessionId`는 `handleRequest` 실행 중에 할당됨
- `sessions.set()`은 반드시 `handleRequest` **이후**에 호출
  - 이전에 호출하면 `sessionId`가 `null`이어서 세션이 저장되지 않음

## mcp-server/CLAUDE.md 규칙

- MCP 서버 코드 생성 또는 수정 시 반드시 `mcp-server/CLAUDE.md`를 함께 생성/업데이트
- `mcp-server/CLAUDE.md`는 Claude CLI가 인프라 생성 작업 시 참고하는 지침 파일

**포함 내용**:
1. 인프라 규칙
2. RORR 서비스 아키텍처 전체 (RORR 관련 내용 반드시 포함)

- Dockerfile에 반드시 포함: `COPY CLAUDE.md ./`

## Docker 내부 설치 항목

- AWS CLI
- claude CLI — **반드시 `npm install -g @anthropic-ai/claude-code`로 설치** (바이너리 직접 다운로드 금지)
- `less` (AWS CLI pager 오류 방지)
- git secret 등록에 필요한 프로그램

## 코드 생성 후 로컬 빌드 검증

MCP 서버 코드를 생성하거나 수정한 후 **git push 및 PR 생성 전에** 반드시 로컬에서 빌드를 실행한다.

```bash
cd mcp-server && npm install && npm run build
```

- TypeScript 컴파일 오류가 없을 때만 push/PR 생성 진행
- Docker 빌드에서 TS 오류가 발견되면 수정 후 CI/CD를 재실행해야 하므로 시간이 많이 소요됨
- 로컬 `npm run build`는 수초 내에 완료되므로 CI/CD 이전에 반드시 확인

## @modelcontextprotocol/sdk 버전 고정 규칙

- `@modelcontextprotocol/sdk` 버전은 반드시 **exact pin**으로 고정한다 (`^` 범위 지정 금지)
- `package-lock.json`을 반드시 커밋한다 — 없으면 `npm install` 시 최신 버전으로 드리프트 발생

| 버전 범위 | 문제 |
|-----------|------|
| `1.0.4` 이하 | `McpServer`, `StreamableHTTPServerTransport` 모듈 없음 → TS2307 발생 |
| **`1.22.0`** | 두 모듈 모두 존재 + `ZodRawShapeCompat` 없음 → **정상 빌드** ✅ |
| `1.23.0` 이상 | `ZodRawShapeCompat` 타입 도입 → `server.tool()` 호출 시 TS2589 발생 |

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "1.22.0"
}
```

## CI/CD 역할 범위 (AWS_INFRA_MCP_2)

**CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포만 수행합니다.**

- ECR 저장소, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등 인프라 전제 조건은 **Claude가 이 프로젝트에서 직접 생성**
- CI/CD workflow에 인프라 생성 로직(terraform job 등)을 포함하지 않음
- 담당자가 PR 머지 시 Docker 이미지가 빌드되어 ECS에 자동 배포

## Claude 자율 실행 권한 (AWS_INFRA_MCP_2)

이 프로젝트의 규칙을 따르는 작업은 **사용자의 별도 확인 없이 자동으로 끝까지 완료**합니다.

**자동 실행 대상**:

| 항목 | 설명 |
|------|------|
| AWS CLI 명령 실행 | `.env`의 자격증명 사용 |
| GitHub API / gh CLI 실행 | GH_PAT 사용 |
| git push, 브랜치 생성, PR 생성 | — |
| Terraform 명령 실행 (init / plan / apply) | MCP 서버 인프라는 Claude가 직접 수행 |
| Docker 빌드 및 ECR push | — |

**자동 실행 제외 대상**:
- **Git 머지** — 자동 실행 대상 아님
