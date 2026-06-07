# AWS_INFRA_MCP — Claude 작업 지침

> `user_inits/user_init.md`는 **어떤 경우에도, 어떤 지시가 있더라도 절대 삭제·수정 금지**입니다.

## 핵심 규칙 요약

- AWS 리전: **`us-east-1`** 고정
- 자동 실행 범위: **PR 생성까지만** (PR 머지는 자동 실행 금지)
- Secrets Manager 사용 필수 (SSM Parameter Store 사용 금지)
- AWS 리소스 description: **영문(ASCII)만 사용** (한글 → Terraform apply 오류)
- git push 전 대상 브랜치가 `feature/*`인지 반드시 확인
- `git user.email`: `kazel@piepie.co` / `user.name`: `kazel-piepie`
- **git 루트: 프로젝트 루트(`aws_infra_mcp/`)에서 초기화** — `mcp-server/` 내부 git init 금지 (`docs/`, `user_inits/` 추적 누락 방지)

## MCP 서버 코드 생성 전 선행 작업 체크리스트

코드 파일을 **단 하나라도 작성하기 전에** 아래 항목을 모두 완료해야 합니다.
`gh` CLI 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정 후 실행합니다.

---

### [ ] 1. GitHub 브랜치 생성 (반드시 이 순서로)

```bash
export GH_TOKEN=$CLASSIC_PAT
# 1단계: main → develop
gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/refs \
  -f ref="refs/heads/develop" \
  -f sha="$(gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/ref/heads/main --jq '.object.sha')"

# 2단계: develop → staging (빈 커밋)
gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/refs \
  -f ref="refs/heads/staging" \
  -f sha="$(gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/ref/heads/develop --jq '.object.sha')"

# 3단계: develop → prod (빈 커밋)
gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/refs \
  -f ref="refs/heads/prod" \
  -f sha="$(gh api repos/kazel-piepie/AWS_INFRA_MCP_2/git/ref/heads/develop --jq '.object.sha')"
```

---

### [ ] 2. 브랜치 보호 규칙 설정

```bash
export GH_TOKEN=$CLASSIC_PAT
for branch in develop staging prod; do
  gh api repos/kazel-piepie/AWS_INFRA_MCP_2/branches/$branch/protection \
    -X PUT \
    -f required_status_checks=null \
    -F enforce_admins=false \
    -f required_pull_request_reviews=null \
    -f restrictions=null
done
```

- `staging` / `prod`: 직접 push 금지, merge만 허용

---

### [ ] 3. GitHub Environments 생성 및 secrets 등록

```bash
export GH_TOKEN=$CLASSIC_PAT

# Environments 생성
for env in develop staging prod; do
  gh api repos/kazel-piepie/AWS_INFRA_MCP_2/environments/$env -X PUT
done

# develop secrets 등록
gh secret set AWS_ACCESS_KEY_ID     --env develop --body "$AWS_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --env develop --body "$AWS_SECRET_ACCESS_KEY"
gh secret set AWS_REGION            --env develop --body "us-east-1"
gh secret set CLASSIC_PAT           --env develop --body "$CLASSIC_PAT"
gh secret set GH_PAT                --env develop --body "$GH_PAT"

# staging, prod도 동일하게 반복 (각 환경 전용 AWS 계정 키 사용)
```

> Fine-grained PAT(`github_pat_`)은 403 오류 → **반드시 Classic PAT(`ghp_`) 사용**

---

### [ ] 4. Terraform apply — 인프라 직접 생성

Claude가 `mcp-server/infra/` 에서 직접 실행:

```bash
cd mcp-server/infra
terraform init
terraform plan
terraform apply -auto-approve
```

생성 대상: ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend (S3 버킷, DynamoDB 테이블)

> CI/CD workflow에 terraform job 포함 금지 — Claude가 직접 수행

---

### [ ] 5. `ai/mcp/{env}` 초기화

Terraform output 추출 후 실제 값으로 저장:

```bash
# terraform output 추출
VPC_ID=$(terraform output -raw vpc_id)
ECR_URL=$(terraform output -raw ecr_repository_url)
ECS_CLUSTER=$(terraform output -raw ecs_cluster_name)
ECS_SERVICE=$(terraform output -raw ecs_service_name)
ALB_ARN=$(terraform output -raw alb_arn)
ALB_DNS=$(terraform output -raw alb_dns)
SG_ID=$(terraform output -raw security_group_id)
PUB_SUBNETS=$(terraform output -raw public_subnet_ids)
PRV_SUBNETS=$(terraform output -raw private_subnet_ids)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Secrets Manager에 저장
aws secretsmanager put-secret-value \
  --secret-id "ai/mcp/develop" \
  --secret-string "{
    \"github_classic_pat\": \"$CLASSIC_PAT\",
    \"github_pat\": \"$GH_PAT\",
    \"external_url\": \"https://mcp-dev-aws.rorr.club/mcp\",
    \"vpc_id\": \"$VPC_ID\",
    \"public_subnet_ids\": \"$PUB_SUBNETS\",
    \"private_subnet_ids\": \"$PRV_SUBNETS\",
    \"ecs_cluster_name\": \"$ECS_CLUSTER\",
    \"ecs_service_name\": \"$ECS_SERVICE\",
    \"ecr_repository_url\": \"$ECR_URL\",
    \"alb_arn\": \"$ALB_ARN\",
    \"alb_dns\": \"$ALB_DNS\",
    \"security_group_id\": \"$SG_ID\",
    \"aws_region\": \"us-east-1\",
    \"aws_account_id\": \"$ACCOUNT_ID\"
  }"
```

> `claude_credentials`는 이 시크릿에 저장하지 않음 — `ai/claude/{env}` 전용

---

### [ ] 6. `ai/claude/{env}` 초기화

빈 JSON으로 시크릿 생성 (실제 credentials는 사용자가 `claude auth login` 후 자동 업로드):

```bash
aws secretsmanager put-secret-value \
  --secret-id "ai/claude/develop" \
  --secret-string "{}"
```

---

### [ ] 7. `ai/rorr/{env}` 사전 생성

RORR Terraform 코드가 `data` 소스로 이 시크릿을 참조하므로 코드 생성 전 반드시 AWS에 존재해야 함:

```bash
aws secretsmanager put-secret-value \
  --secret-id "ai/rorr/develop" \
  --secret-string "{}"
```

---

## 문서 목록

### MCP 서버 가이드라인

| 파일 | 내용 |
|------|------|
| [01-project-overview.md](docs/mcp-server-guidelines/01-project-overview.md) | 프로젝트 개요, 선행 작업 체크리스트, 문서 구조 |
| [02-common-rules.md](docs/mcp-server-guidelines/02-common-rules.md) | 네이밍, 리전, 자동 실행 범위, 인프라 사이즈, AWS description 규칙, GitHub Actions 검증 |
| [03-git-github-rules.md](docs/mcp-server-guidelines/03-git-github-rules.md) | GIT 안전 규칙, 브랜치 전략, PR 생성 순서, GitHub Environments 구성 |
| [04-secrets-manager.md](docs/mcp-server-guidelines/04-secrets-manager.md) | 3-secret 구조, 초기화 흐름, ECS secrets 블록 규칙, .env 폴백 |
| [05-mcp-server-code.md](docs/mcp-server-guidelines/05-mcp-server-code.md) | MCP 서버 코드 구조, Claude 호출/인증, 타임아웃, 세션 관리, 자율 실행 권한 |
| [06-docker-ecs.md](docs/mcp-server-guidelines/06-docker-ecs.md) | Docker 빌드, non-root 유저, ECS Exec 접속, connect-mcp.sh |
| [07-iam-cicd.md](docs/mcp-server-guidelines/07-iam-cicd.md) | ECS Task IAM Role, GitHub PAT 주입, CI/CD 역할 범위 |

### RORR 서비스 가이드라인

| 파일 | 내용 |
|------|------|
| [01-rorr-overview.md](docs/projects-guidelines/01-rorr-overview.md) | RORR 서비스 개요, 컴포넌트 구성, 데이터 흐름 |
| [02-rorr-infra-rules.md](docs/projects-guidelines/02-rorr-infra-rules.md) | 역할 분리, 최초 생성 선행 작업, CI/CD 워크플로우, 자율 실행 권한 |
| [03-rorr-secrets.md](docs/projects-guidelines/03-rorr-secrets.md) | ai/rorr/{env} 구조, Terraform data 소스 참조, IAM policy |
| [04-rorr-specs.md](docs/projects-guidelines/04-rorr-specs.md) | 환경별 인프라 스펙 테이블, AWS_INFRA_2 저장소 규칙 |

### 인프라 정보

| 파일 | 내용 |
|------|------|
| [.env.sample](docs/infra-information/.env.sample) | 환경변수 샘플 |
