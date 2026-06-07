# 02. 공통 규칙

MCP 서버 및 MCP 서버가 생성하는 코드 모두에 적용되는 규칙입니다.

## 1. 네이밍 규칙

| 대상 | 규칙 |
|------|------|
| MCP Server 및 MCP Server가 생성한 RORR 인프라 | 이름 앞에 `ai` prefix 필수 |
| MCP Server 구동에 필요한 인프라 | 이름에 `mcp` 포함 |
| 이 프로젝트에서 MCP 서버를 구동할 ECS | 이름에 `infra` 포함 (추후 여러 ECS 생성 가능) |

## 2. AWS 리전

- AWS 리전은 반드시 `us-east-1` 사용

## 3. 자동 실행 범위

- **최종 단계는 PR 생성까지만 자동 승인**
- PR 이후 단계는 자동 승인 금지
- **PR 머지는 자동으로 하지 않음**

## 4. 외부 DNS

- 외부 DNS 관련 작업은 **사용자가 직접 관리**

## 5. 변경 시 PR 생성

- 프로젝트 내용이 추가·변경·삭제되면 **항상 PR까지 생성**

## 6. 인프라 사이즈

| 항목 | 원칙 |
|------|------|
| 환경 구분 | develop, staging, prod에 따라 스펙 정의 |
| develop | 테스트에 필요한 **최소 사항**으로 정의 |
| 스펙 구성 | 명시적으로 구성 |
| 프로세서 | x86 사용 |
| 타입 선택 | 동일 스펙이면 비용이 낮은 타입 선택 (예: `t3.small` → `t3a.small`) |

## 7. AWS 리소스 description 규칙

- description 필드에는 반드시 **영문(ASCII)만 사용** (한글 입력 시 Terraform apply 오류 발생)
- 허용 문자: `0-9 A-Z a-z _ . : / ( ) # , @ [ ] + = & ; { } ! $ * -`
- **금지**: 한글, 일본어, 중국어 등 멀티바이트 문자
- 적용 범위: `aws_security_group`, `aws_iam_policy`, `aws_iam_role`, `aws_lb_target_group` 등 모든 AWS 리소스의 description 속성
- **Terraform HCL 속성 구분에 `;` 사용 금지** (배열 원소 사이 `,`는 HCL 필수 문법이므로 반드시 포함)

## 8. Terraform S3 백엔드 설정 규칙

`backend "s3"` 블록에 `dynamodb_table` 파라미터를 사용하지 않는다 — deprecated 파라미터이며 `terraform output` stdout에 경고 메시지를 출력해 캡처 값을 오염시킨다.

DynamoDB 상태 잠금이 필요할 경우 `use_lockfile = true`를 사용한다.

```hcl
backend "s3" {
  bucket       = "ai-mcp-tfstate-develop"
  key          = "mcp-server/develop/terraform.tfstate"
  region       = "us-east-1"
  use_lockfile = true
  encrypt      = true
}
```

## 9. GitHub Actions Workflow 검증

workflow 파일 생성·수정 후 반드시 로컬에서 YAML 문법 검증:

```bash
# actionlint 사용 (권장)
actionlint .github/workflows/deploy.yml

# 또는 yamllint 사용
yamllint .github/workflows/deploy.yml
```

- 검증 없이 push·PR 생성 **금지**
- **금지 패턴**: 동일 step 내 같은 키(`env:`, `with:` 등) 중복 선언
- 각 job에 `environment:` 키 **필수**:

```yaml
jobs:
  terraform:
    environment: ${{ needs.setup.outputs.environment }}  # 이 줄 필수
```

> `environment:` 키가 없으면 Environment secrets를 참조하지 않음
