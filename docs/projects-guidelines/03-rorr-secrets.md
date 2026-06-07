# 03. RORR 서비스 Secrets Manager

## 시크릿 이름

`ai/rorr/{env}` (예: `ai/rorr/develop`)

## JSON 구조

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

## 저장 및 사용 규칙

| 항목 | 내용 |
|------|------|
| 저장 시점 | Terraform apply 완료 후 terraform output으로 추출해 CI/CD에서 자동 저장 |
| IAM 권한 | 각 RORR 컴포넌트 IAM Role: `ai/rorr/{env}` ARN만 읽기 허용 (전체 허용 금지) |
| 민감 output | 패스워드, 키 등은 반드시 `sensitive = true` 설정 |
| EC2 컴포넌트 | 시작 시 `aws secretsmanager get-secret-value` 1회 호출 후 `jq`로 파싱하여 환경변수 export |
| ECS 컴포넌트 | Task Definition secrets 블록에서 ARN 전체를 `RORR_SECRET_JSON`으로 주입 후 코드에서 파싱 |

## Terraform에서 참조 방법

**`ai/rorr/{env}`는 MCP 서버 선행 작업에서 이미 생성된 시크릿입니다.**
생성된 Terraform 코드에서 `resource` 블록으로 새로 만들지 않고, 반드시 `data` 소스로 기존 시크릿을 참조합니다:

```hcl
data "aws_secretsmanager_secret" "rorr" {
  name = "ai/rorr/${var.env}"
}
```

**이 방식의 이점**:
- `data.aws_secretsmanager_secret.rorr.arn`이 정확한 ARN을 반환 (랜덤 6자 suffix 포함)
- IAM policy Resource에 와일드카드(`*`) 없이 정확한 ARN 지정 가능
- `user_data` 스크립트의 `--secret-id`에 `data.aws_secretsmanager_secret.rorr.name` 사용 가능

### IAM policy 올바른 작성법

```hcl
resource "aws_iam_policy" "rorr_secret_read" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = data.aws_secretsmanager_secret.rorr.arn   # 정확한 ARN, 와일드카드 불필요
    }]
  })
}
```

### user_data 스크립트 올바른 작성법

```bash
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "${data.aws_secretsmanager_secret.rorr.name}" \  # name 사용, ARN 사용 금지
  --query SecretString --output text --no-cli-pager)
```

### 금지 패턴

```hcl
# 와일드카드 ARN 생성 금지
rorr_secret_arn = "arn:aws:secretsmanager:...:secret:ai/rorr/${local.env}-*"

# 와일드카드가 포함된 ARN을 --secret-id로 전달 금지
--secret-id "$RORR_SECRET_ARN"
```
