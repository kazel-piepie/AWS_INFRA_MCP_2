# 03. Git 및 GitHub 규칙

## 1. GIT 안전 규칙

### 기본 규칙

- **git은 `mcp-server/` 내부가 아닌 프로젝트 루트(`aws_infra_mcp/`)에서 초기화한다**
  - 추적 범위: `mcp-server/`, `docs/`, `user_inits/`, `CLAUDE.md`, `README.md` 등 전체
  - `mcp-server/` 내부에서 `git init` 금지 — `docs/`, `user_inits/` 등이 추적에서 누락됨
- git 브랜치 작업 전 반드시 **모든 파일을 먼저 커밋**
- `user_init.md` 파일은 **최초 커밋에 반드시 포함**
- `staging` / `prod` 브랜치에 직접 push 금지 → 반드시 **merge로만 코드 이동**
- git push 실행 전 대상 브랜치가 `feature/*`인지 반드시 확인
- `.env`는 git에 동기화하지 않음
- `git user.email`: `kazel@piepie.co` / `user.name`: `kazel-piepie`
- `git checkout -f`는 기존 파일이 있는 상태에서 **절대 사용 금지**

### 브랜치 생성 순서 (반드시 이 순서 준수)

```
1단계: origin/main에서 develop 분기 → push
2단계: develop에서 staging 분기 → 빈 커밋 → push
3단계: develop에서 prod 분기 → 빈 커밋 → push
4단계: develop에서 feature/* 분기 → 파일 추가/수정 → push → PR
```

> **금지**: `feature/*`에 파일을 커밋한 뒤 거기서 `develop`/`staging`/`prod`를 분기하면 모든 파일이 세 브랜치에 그대로 포함됨
>
> **핵심 원칙**: `develop`/`staging`/`prod`는 반드시 `origin/main` 기반으로 생성. `feature/*`는 그 이후 `develop`에서 분기

## 2. 브랜치 전략

### MCP 서버 저장소 (AWS_INFRA_MCP_2)

- **저장소**: `https://github.com/kazel-piepie/AWS_INFRA_MCP_2.git`

| 브랜치 | Push 규칙 |
|--------|-----------|
| `develop` | PR merge만 허용 |
| `staging` | 직접 push 금지 → merge만 허용 |
| `prod` | 직접 push 금지 → merge만 허용 |
| `feature/*` | git push 실행 전 반드시 확인 |

- merge 대상은 항상 `develop`만 머지 가능하게 설정

### 서비스 저장소 (AWS_INFRA_2)

- **저장소**: `https://github.com/kazel-piepie/AWS_INFRA_2.git`
- 브랜치 전략은 AWS_INFRA_MCP_2와 동일
- `develop → staging → prod` 순으로 담당자가 수동으로 머지 진행

## 3. PR 생성 순서

```
1. 신규 파일 작성
2. git add . (user_init.md 포함 전체 스테이징)
3. git commit (현재 브랜치에서)
4. git push origin <feature-branch>
5. GitHub API 또는 gh CLI로 PR 생성 (develop 대상)
```

> `git add .`는 **프로젝트 루트(`aws_infra_mcp/`)에서 실행**한다.
> `mcp-server/` 안에서 실행하면 `docs/`, `user_inits/` 등이 누락된다.

## 4. 환경별 AWS 계정 분리

각 브랜치의 GitHub Environment에 해당 환경 전용 AWS 계정 자격증명을 등록합니다.

| Environment | AWS 계정 |
|-------------|----------|
| develop | develop AWS 계정 키 |
| staging | staging AWS 계정 키 |
| prod | prod AWS 계정 키 |

## 5. GitHub Environments 구성 규칙

1. GitHub repo Settings → Environments에서 `develop`, `staging`, `prod` 각각 생성
2. 각 Environment에 브랜치 배포 규칙 설정:

| Environment | 허용 브랜치 |
|-------------|------------|
| develop | develop 브랜치에서만 배포 허용 |
| staging | staging 브랜치에서만 배포 허용 |
| prod | prod 브랜치에서만 배포 허용 |

3. 환경별 secrets는 `--env <environment>` 옵션으로 Environment secrets 등록 (**repository-level secrets 사용 금지**)
4. `prod` Environment에는 **Required reviewer 설정 권장** (담당자 승인 없이 배포 차단)
5. `gh secret set` 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

## 6. GitHub Actions Secrets 자동 등록 규칙

1. GitHub Actions workflow 생성·수정 시 → 해당 workflow에서 참조하는 **모든 secrets를 즉시** `gh secret set`으로 등록
2. 배포에 필요한 전제 조건(버킷, secrets, 파라미터 등)은 확인 없이 한 번에 완료
3. `gh secret set` 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

> **이유**: Fine-grained PAT(`github_pat_` 접두사)은 GitHub Environment secrets API 미지원 → 403 오류 발생. Classic PAT(`ghp_` 접두사)만 사용 가능

## 7. 최초 GitHub Actions Secrets 등록 (MCP 서버)

```bash
export GH_TOKEN=$CLASSIC_PAT
gh secret set AWS_ACCESS_KEY_ID     --env develop --body "$AWS_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --env develop --body "$AWS_SECRET_ACCESS_KEY"
gh secret set AWS_REGION            --env develop --body "us-east-1"
gh secret set CLASSIC_PAT           --env develop --body "$CLASSIC_PAT"
gh secret set GH_PAT                --env develop --body "$GH_PAT"
# staging, prod도 동일하게 반복 (각 환경 전용 AWS 계정 키 사용)
```

**등록 불필요 항목**:

| 항목 | 이유 |
|------|------|
| `ACM_CERTIFICATE_ARN` | Terraform `data "aws_acm_certificate"`로 `*.rorr.club` 인증서 자동 조회 |
| `MCP_SECRET_ARN` | Terraform이 `ai/mcp/{env}`를 직접 생성하고 내부에서 ARN 참조 — 배포 전 존재하지 않아 사전 등록 불가 |

## 8. claude subprocess 내부 gh CLI 인증 순서

| 순서 | 명령 | 용도 |
|------|------|------|
| 1 | `export GH_TOKEN=$CLASSIC_PAT` | Environment secrets 등록용 (`gh secret set`) |
| 2 | `export GH_TOKEN=$GH_PAT` | PR 생성 등 일반 GitHub API용 |
| 3 | `https://${GH_PAT}@github.com/...` | git push 시 remote URL에 PAT 포함 |

- 적용 범위: develop / staging / prod 모든 환경에 동일하게 적용
