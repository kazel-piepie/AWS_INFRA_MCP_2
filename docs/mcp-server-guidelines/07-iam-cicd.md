# 07. IAM 및 CI/CD 규칙

## ECS Task IAM Role

### 발생 오류 패턴

```
UnauthorizedOperation (ec2:DescribeInstances), AccessDeniedException (ecs:ListClusters 등)
```

**원인**: ECS Task Role에 RORR 인프라 리소스를 조회할 수 있는 IAM 정책이 부여되지 않음

### Task Execution Role vs Task Role 구분

| Role | 사용 주체 | 주요 권한 |
|------|-----------|-----------|
| Task Execution Role | ECS 에이전트 | ECR pull, CloudWatch Logs + Secrets Manager 주입용 `secretsmanager:GetSecretValue` (ai/mcp, ai/claude 2개) |
| Task Role | 컨테이너 내 애플리케이션 | RORR 인프라 조회 + `ai/mcp/{env}`, `ai/claude/{env}`, `ai/service/account/{env}` 읽기 권한 + `ai/claude/{env}` 쓰기 권한 |

### Task Role 최소 읽기 권한

RORR 인프라 **생성** 권한은 불필요 — apply는 CI/CD가 담당

```
ec2:DescribeInstances
ecs:ListClusters / DescribeClusters / ListServices / DescribeServices
kafka:ListClusters / DescribeCluster
elasticache:DescribeCacheClusters
elasticloadbalancing:DescribeLoadBalancers / DescribeTargetGroups
s3:ListBucket
cloudfront:ListDistributions
secretsmanager:GetSecretValue
secretsmanager:PutSecretValue
```

- `secretsmanager:GetSecretValue`는 아래 ARN으로만 제한:
  - `arn:aws:secretsmanager:us-east-1:*:secret:ai/mcp/*`
  - `arn:aws:secretsmanager:us-east-1:*:secret:ai/claude/*`
  - `arn:aws:secretsmanager:us-east-1:*:secret:ai/service/account/*`
- `secretsmanager:PutSecretValue`는 아래 ARN으로만 제한:
  - `arn:aws:secretsmanager:us-east-1:*:secret:ai/claude/*` — credential-sync 업로드 전용
- `ai/rorr/*` 접근은 RORR 컴포넌트 Role 전용이므로 MCP Task Role에 부여하지 않음
- 적용 방법: Terraform `iam.tf`의 Task Role에 inline policy 또는 별도 IAM Policy로 추가

## ECS 환경변수 — GitHub PAT 주입

### 발생 오류 패턴

```
could not read Username for 'https://github.com' — CLASSIC_PAT / GH_TOKEN 미설정
```

**원인**: ECS Task Definition 환경변수에 GitHub PAT가 포함되지 않음. `ai/mcp/{env}` 안에 `github_classic_pat`, `github_pat` 속성이 있지만 컨테이너 환경변수로 주입되지 않은 상태.

### 해결 방법

통합 시크릿 전체를 `MCP_SECRET_JSON` 환경변수로 주입 후 애플리케이션 코드에서 JSON 파싱하여 추출

- **`ARN#key` 방식 사용 금지** — `ValidationException`(400) 발생
- `valueFrom`에 시크릿 ARN만 지정 → `MCP_SECRET_JSON` 환경변수로 전체 JSON 수신
- 코드에서 `JSON.parse(process.env.MCP_SECRET_JSON)` 후 `github_classic_pat`, `github_pat` 추출

## Terraform output 민감 정보 처리

- 패스워드, 키 등 민감한 output은 반드시 `sensitive = true` 설정
- 이유: `sensitive = true` 없으면 터미널 로그에 평문 노출

## IAM 권한 원칙 (전체)

| IAM Role | 허용 범위 |
|----------|-----------|
| MCP 서버 Task Role | `ai/mcp/{env}`, `ai/claude/{env}`, `ai/service/account/{env}` ARN 읽기 허용 |
| MCP 서버 Task Role | `ai/claude/{env}` ARN 쓰기(PutSecretValue) 허용 — credential-sync 업로드 전용 |
| RORR 각 컴포넌트 IAM Role | `ai/rorr/{env}` ARN만 읽기 허용 (mcp·claude·service/account 시크릿 접근 불가) |

- 전체 허용(`Resource: "*"`) 금지, ARN 단위로 제한
