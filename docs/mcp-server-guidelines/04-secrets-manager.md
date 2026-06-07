# 04. Secrets Manager 규칙

## 기본 원칙

**SSM Parameter Store 사용 금지 — 반드시 Secrets Manager 사용**

코드에서 `SSMClient` 대신 `SecretsManagerClient` 사용

## 용량 및 특성

| 항목 | 내용 |
|------|------|
| 최대 용량 | 64KB (SSM Parameter Store Advanced 8KB 대비 8배) |
| 저장 방식 | credentials 및 비밀값을 압축 없이 JSON 원문 그대로 저장 |
| 삭제 유예기간 | 기본 7일 (즉시 삭제 필요 시 `--force-delete-without-recovery`) |
| 비용 | 시크릿 4개 고정 → `$0.40 × 4 = $1.60/월` + API 호출료 |

## 4-secret 구조 (역할별 분리)

| 시크릿 이름 | 역할 | 저장 정보 |
|-------------|------|-----------|
| `ai/claude/{env}` | Claude 인증 정보 전용 | `claude_credentials` (auth login 생성) |
| `ai/mcp/{env}` | MCP 서버 인프라 참조 정보 | GitHub PAT, VPC, ECR, ECS 등 |
| `ai/rorr/{env}` | RORR 서비스 접속 정보 | DB, Redis, MSK 등 |
| `ai/service/account/{env}` | RORR 서비스 배포용 AWS 자격증명 | Access Key, Secret Key |

**분리 이유**:
- Claude 인증 정보는 갱신 빈도가 높아 별도 시크릿으로 관리
- RORR 컴포넌트는 `ai/rorr/{env}`만 읽으면 되므로 인프라·Claude 인증 정보에 접근 불필요
- AWS 계정 자격증명(`ai/service/account/{env}`)은 MCP server subprocess 전용으로 분리하여 접근 범위 명확화
- IAM 권한을 역할에 맞게 최소화 가능

## 시크릿 1 — `ai/claude/{env}`: Claude 인증 정보 전용

```json
{
  "claude_credentials": "{ ...~/.claude/.credentials.json 전체 내용... }"
}
```

- `credential-sync`가 5초 폴링으로 감지하여 이 시크릿만 업데이트
- ECS Task Definition에서 `CLAUDE_SECRET_JSON` 환경변수로 주입

## 시크릿 2 — `ai/mcp/{env}`: MCP 서버 인프라 참조 정보

```json
{
  "github_classic_pat":  "ghp_xxxx",
  "github_pat":          "github_pat_xxxx",
  "external_url":        "https://mcp-dev-aws.rorr.club/mcp",
  "vpc_id":              "vpc-0abc1234def56789",
  "public_subnet_ids":   "subnet-aaa,subnet-bbb",
  "private_subnet_ids":  "subnet-ccc,subnet-ddd",
  "ecs_cluster_name":    "ai-mcp-dev-cluster",
  "ecs_service_name":    "ai-mcp-dev-service",
  "ecr_repository_url":  "239460481239.dkr.ecr.us-east-1.amazonaws.com/ai-mcp-dev",
  "alb_arn":             "arn:aws:elasticloadbalancing:...",
  "alb_dns":             "ai-mcp-dev-alb-xxxx.us-east-1.elb.amazonaws.com",
  "security_group_id":   "sg-0abc123456",
  "aws_region":          "us-east-1",
  "aws_account_id":      "239460481239"
}
```

- `github_classic_pat`, `github_pat`: MCP 서버가 RORR 코드 생성 시 GitHub 인증에 사용
- 인프라 참조 정보: Terraform apply 후 output에서 추출해 **Claude가 직접 저장**
- **`claude_credentials`는 이 시크릿에 저장하지 않음** (`ai/claude/{env}` 전용)
- ECS Task Definition에서 `MCP_SECRET_JSON` 환경변수로 주입

## 시크릿 3 — `ai/rorr/{env}`: RORR 서비스 접속 정보

```json
{
  "db_host":               "ai-db-{env}.xxx.us-east-1.compute.internal",
  "db_port":               "5432",
  "db_user":               "ai",
  "db_password":           "xxxx",
  "redis_host":            "ai-redis-{env}.xxx.cache.amazonaws.com",
  "redis_port":            "6379",
  "redis_password":        "xxxx",
  "msk_bootstrap_servers": "b-1.xxx:9092,b-2.xxx:9092",
  "lol_api_url":           "https://esports-api.lolesports.com",
  "lol_api_key":           "xxxx"
}
```

- CI/CD가 Terraform apply 완료 후 terraform output으로 추출하여 저장
- RORR 각 컴포넌트가 시작 시 이 시크릿만 읽어 접속 정보를 얻음

## 시크릿 4 — `ai/service/account/{env}`: RORR 서비스 배포용 AWS 자격증명

```json
{
  "aws_access_key_id":     "AKIAXXXXXX",
  "aws_secret_access_key": "xxxxxx",
  "aws_region":            "us-east-1"
}
```

- `.env`의 `RORR_DEV_AWS_*` 값을 MCP 서버 초기 설정 시 저장한다
- MCP server subprocess가 RORR 인프라 작업(브랜치 생성, GitHub secrets 등록 등) 시 이 시크릿을 읽어 사용한다
- CI/CD(GitHub Actions)는 이 시크릿을 직접 읽지 않는다 — GitHub Environments secrets에서 별도로 읽는다
- **ECS Task Definition secrets 블록에 포함하지 않는다** — 런타임에 AWS SDK로 직접 조회한다

## AWS 자격증명 접근 분리 원칙

MCP server와 CI/CD는 RORR AWS 자격증명을 서로 다른 저장소에서 읽는다.

| 주체 | RORR AWS 키 출처 |
|------|----------------|
| MCP server subprocess | `ai/service/account/{env}` (Secrets Manager) |
| GitHub Actions CI/CD | GitHub Environments secrets |

- 두 저장소는 같은 값을 갖되 접근 주체가 완전히 분리된다
- 최초 구동 시 MCP server subprocess가 `ai/service/account/{env}`에서 자격증명을 읽어 AWS_INFRA_2 GitHub Environments secrets에 등록한다 — 이후 CI/CD는 GitHub에서 자율적으로 사용

## 최초 Secrets Manager 초기화 흐름

```
1단계: GitHub Actions Environments에 CLASSIC_PAT, GH_PAT 등록 — Claude 직접 수행
2단계: Claude가 Terraform apply 직접 수행
       → ECR, ECS 클러스터, VPC, ALB 등 모든 인프라 생성
       → ai/mcp/{env}, ai/claude/{env}, ai/rorr/{env}, ai/service/account/{env} 시크릿이
         Terraform에 의해 처음 생성됨
3단계: Secrets Manager 초기화 — Claude가 직접 수행 (Terraform 완료 직후)
       ai/mcp/{env}: github_classic_pat, github_pat 실제 값으로 교체 + terraform output 인프라 참조값 저장
       ai/claude/{env}: 빈 JSON({}) 유지
       ai/rorr/{env}: 빈 JSON({}) 또는 placeholder 유지
       ai/service/account/{env}: .env의 RORR_DEV_AWS_ACCESS_KEY_ID, RORR_DEV_AWS_SECRET_ACCESS_KEY 값 저장
4단계: CI/CD workflow trigger — Docker 빌드 → ECR push → ECS 서비스 업데이트
5단계: ECS 컨테이너 시작 시 MCP_SECRET_JSON에 실제 PAT 포함되어 정상 동작
```

> `claude auth login`으로 생성되는 `claude_credentials`는 최초 배포 후 사용자가 직접 컨테이너에 접속하여 수행 (자동화 불가)

## ECS Task Definition secrets 블록 규칙

### 발생 오류 패턴 (금지)

ECS secrets 블록 `valueFrom`에 `ARN#json_key` 형식 사용 시 즉시 `TaskFailedToStart`:
```
ValidationException: Invalid name. Must be a valid name containing alphanumeric characters...
```

### 올바른 방법

**Terraform `ecs.tf`**:
```hcl
secrets = [
  { name = "MCP_SECRET_JSON",    valueFrom = aws_secretsmanager_secret.mcp.arn    },
  { name = "CLAUDE_SECRET_JSON", valueFrom = aws_secretsmanager_secret.claude.arn },
]
```

> `ai/service/account/{env}`는 secrets 블록에 포함하지 않는다 — `create_rorr_infra` 툴 실행 시 AWS SDK로 직접 조회한다

**애플리케이션 코드 (Node.js)**:
```typescript
const mcpSecret    = JSON.parse(process.env.MCP_SECRET_JSON    ?? '{}');
const claudeSecret = JSON.parse(process.env.CLAUDE_SECRET_JSON ?? '{}');
const classicPat   = mcpSecret.github_classic_pat;
const ghPat        = mcpSecret.github_pat;
const claudeCreds  = claudeSecret.claude_credentials;
```

> **ECS secrets 블록 `valueFrom`에 `#key` 또는 `:key::` 형식 절대 사용 금지**

## MCP_SECRET_JSON 미존재 시 .env 폴백 규칙

| 조건 | 동작 |
|------|------|
| `MCP_SECRET_JSON` 있음 | JSON 파싱 후 사용 (ECS 운영 환경 — 정상 경로) |
| `MCP_SECRET_JSON` 없음 | `.env`의 `AWS_ACCESS_KEY_ID`, `CLASSIC_PAT`, `GH_PAT` 등 직접 로드 (초기 배포/로컬 개발) |

적용 대상:
- `secrets-manager.ts` `getMcpSecret()`: `MCP_SECRET_JSON` 없으면 `.env` 값으로 구성한 객체 반환
- `credential-sync.ts` `restoreCredentials()`: `claude_credentials` 없으면 복원 건너뜀 (정상)
- `create-rorr-infra.ts`: `github_pat` 없으면 `.env`의 `GH_PAT` 사용

## CI/CD 배포 후 접속 정보 저장 규칙

**Terraform output 민감 정보 처리**:
- 패스워드, 키 등 민감한 output은 반드시 `sensitive = true` 설정
- 이유: `sensitive = true` 없으면 터미널 로그에 평문 노출

**IAM 권한 원칙**:

| IAM Role | 허용 범위 |
|----------|-----------|
| MCP 서버 Task Role | `ai/mcp/{env}`, `ai/claude/{env}`, `ai/service/account/{env}` ARN 읽기 허용 |
| MCP 서버 Task Role | `ai/claude/{env}` ARN 쓰기(PutSecretValue) 허용 — credential-sync 업로드용 |
| RORR 각 컴포넌트 IAM Role | `ai/rorr/{env}` ARN만 읽기 허용 (mcp·claude·service/account 시크릿 접근 불가) |

- 전체 허용(`Resource: "*"`) 금지, ARN 단위로 제한

## terraform output 실행 및 Secrets Manager 저장 규칙

### --no-color 플래그 필수

`terraform output -raw` 명령 실행 시 반드시 `--no-color` 플래그를 포함한다.

```bash
terraform output -raw ecr_repository_url --no-color
```

Python subprocess로 실행할 때도 동일하게 적용한다.

```python
subprocess.run(['terraform', 'output', '-raw', key, '--no-color'], capture_output=True, ...)
```

### 저장 전 값 검증 필수

Secrets Manager에 저장하기 전 stdout 값에 줄바꿈 문자(`\n`) 또는 ANSI 이스케이프 코드가 포함되지 않았는지 반드시 확인한다.

- 검증 조건: `len(value.splitlines()) == 1` 이어야 한다
- 줄바꿈이 포함된 값은 저장하지 않고 오류로 처리한다

## CI/CD docker job에서 인프라 참조값 사용

`ecr_repository_url` 등 인프라 참조값은 job output 대신 **Secrets Manager에서 직접 조회**:

```yaml
- name: Get ECR URL from Secrets Manager
  id: get_ecr
  run: |
    ECR_URL=$(aws secretsmanager get-secret-value \
      --secret-id "ai/mcp/${{ needs.setup.outputs.environment }}" \
      --query SecretString --output text | jq -r '.ecr_repository_url')
    echo "ecr_url=$ECR_URL" >> "$GITHUB_OUTPUT"
```
