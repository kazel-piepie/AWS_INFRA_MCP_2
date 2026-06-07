# 02. RORR 인프라 생성 규칙

## 역할 분리

### 최초 생성 시 (AWS_INFRA_2 레포 최초 셋업)

Claude subprocess가 사용자 확인 없이 끝까지 수행:

1. AWS_INFRA_2 repo에 `develop`, `staging`, `prod` 브랜치 생성
2. `develop`, `staging`, `prod` 브랜치 보호 규칙 설정
3. GitHub Environments(`develop`/`staging`/`prod`) secrets 등록 (`.env`의 `RORR_DEV_AWS_*` 키 값 사용)
4. Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)

> **완료되지 않은 상태에서 Terraform 코드 생성 시작 금지**

- `terraform apply`는 PR 머지 후 **CI/CD가 수행** (최초 생성 시에도 동일)
- 프로그램 설치는 Terraform user_data에 포함 → EC2 시작 시 cloud-init으로 자동 설치

### 이후 인프라 변경 시

- MCP 서버 역할: Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)
- terraform apply: PR 머지 후 CI/CD(GitHub Actions)가 담당

## RORR 최초 생성 선행 작업

### GitHub Environments secrets 등록

```bash
export GH_TOKEN=$CLASSIC_PAT

# ai/service/account/develop 에서 RORR AWS 자격증명 읽기
RORR_AWS_CREDS=$(aws secretsmanager get-secret-value \
  --secret-id "ai/service/account/develop" \
  --query SecretString --output text)
RORR_AWS_KEY=$(echo "$RORR_AWS_CREDS" | jq -r '.aws_access_key_id')
RORR_AWS_SECRET=$(echo "$RORR_AWS_CREDS" | jq -r '.aws_secret_access_key')

gh secret set AWS_ACCESS_KEY_ID     --env develop --body "$RORR_AWS_KEY"
gh secret set AWS_SECRET_ACCESS_KEY --env develop --body "$RORR_AWS_SECRET"
gh secret set AWS_REGION            --env develop --body "us-east-1"
gh secret set CLASSIC_PAT           --env develop --body "$CLASSIC_PAT"
gh secret set GH_PAT                --env develop --body "$GH_PAT"
# staging, prod는 각 환경 담당자가 별도 수행
# 또는 ai/service/account/staging, ai/service/account/prod 에서 읽어 동일하게 수행
```

> `ai/service/account/{env}` 값과 GitHub Environments secrets 값은 동일한 RORR AWS 자격증명이지만 접근 주체가 다르다 — MCP server subprocess는 Secrets Manager에서, CI/CD는 GitHub에서 읽는다

### 실행 방법

- `gh` CLI와 `.env`의 `CLASSIC_PAT`, `GH_PAT`를 사용해 Claude subprocess가 직접 수행
- `gh` CLI 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

## CI/CD 워크플로우 생성 규칙

RORR 인프라 코드 생성 시, AWS_INFRA_2 repo에 CI/CD 워크플로우가 없으면 **함께 생성**

- 워크플로우는 `develop` / `staging` / `prod` 브랜치 push 시 트리거
- 각 job에 `environment:` 키를 포함해 해당 브랜치의 GitHub Environment secrets를 참조
- `terraform init → plan → apply` 자동 수행 후, apply 완료 후 접속 정보를 `ai/rorr/{env}`에 저장

## 브랜치별 AWS 계정 분리

| 브랜치 머지 | GitHub Environment | 배포 계정 |
|-------------|-------------------|-----------|
| develop | 'develop' | develop AWS 계정 |
| staging | 'staging' | staging AWS 계정 |
| prod | 'prod' | prod AWS 계정 |

## Claude 자율 실행 권한 (AWS_INFRA_2)

**자동 실행 대상**:
- AWS CLI 명령 실행
- GitHub API / gh CLI 실행 (GH_PAT 사용)
- git push, 브랜치 생성, PR 생성
- Terraform 코드 생성 → feature 브랜치 push → PR 생성
- `gh secret set` (반드시 `export GH_TOKEN=$CLASSIC_PAT` 먼저 실행)

**자동 실행 제외 대상**:
- **Git 머지** — 자동 실행 대상 아님
- **terraform 직접 apply** — Claude subprocess는 직접 apply하지 않음 (CI/CD만 수행)

## CI/CD 역할 범위 (AWS_INFRA_2)

**CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포, terraform apply를 수행합니다.**

- Terraform 코드 생성 및 feature 브랜치 push, PR 생성은 Claude(MCP 서버)가 수행
- CI/CD workflow에 terraform job을 반드시 포함
- terraform apply는 최초 생성·이후 변경 모두 CI/CD만 수행 — Claude subprocess 직접 apply 금지
