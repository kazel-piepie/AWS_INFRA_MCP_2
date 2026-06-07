=====================================
공통 규칙 (MCP 서버 및 생성하는 코드 모두 적용)
===============================================

1. MCP Server 및 MCP Server가 생성한 RORR 프로젝트 인프라는 반드시 이름 앞에 ai prefix를 붙인다
2. aws 리전은 반드시 us-east-1 사용
3. develop, staging, prod 브랜치는 미리 생성하고 환경변수도 각 브랜치에 맞게 구성

   1. staging, prod는 직접 push 금지이지만, 빈 커밋(또는 develop에서 분기)으로 브랜치 자체는 반드시 먼저 생성해야 한다
   2. 이유: GitHub Environments에서 "해당 브랜치에서만 배포 허용" 규칙을 설정하려면 대상 브랜치가 GitHub에 존재해야만 선택할 수 있음
   3. 각 브랜치의 GitHub Environment에는 해당 환경 전용 AWS 계정 자격증명을 등록한다
      - develop Environment: develop AWS 계정 키
      - staging Environment: staging AWS 계정 키
      - prod Environment: prod AWS 계정 키
4. 최종 단계인 PR 생성까지만 자동 승인. PR 이후 단계는 자동 승인하지 마. 특히 PR 머지는 자동으로 하지 마
5. 외부 DNS 관련 작업은 사용자가 직접 관리
6. 프로젝트의 내용이 추가, 변경, 삭제되면 항상 PR까지 생성
7. Secrets Manager 용량 및 특성

   1. 최대 용량: 64KB (SSM Parameter Store Advanced 8KB 대비 8배)
   2. credentials 및 비밀값은 압축 없이 JSON 원문 그대로 저장한다
   3. 시크릿 삭제 시 기본 7일 복구 유예기간 존재

      - 즉시 삭제가 필요할 경우 --force-delete-without-recovery 옵션 사용
   4. 비용: 시크릿 4개 고정 사용 → $0.40 × 4 = $1.60/월 + API 호출료

      시크릿 구성 (역할별 분리):

      - ai/claude/{env}: Claude 인증 정보 전용 (claude auth login으로 생성되는 credentials.json)
      - ai/mcp/{env}: MCP 서버 인프라 생성에 필요한 참조 정보 (GitHub PAT, VPC, ECR, ECS 등)
      - ai/rorr/{env}: RORR 서비스 인프라 사용에 필요한 접속 정보 (DB, Redis, MSK 등)
      - ai/service/account/{env}: RORR 서비스 배포에 사용하는 AWS 계정 자격증명 (Access Key, Secret Key)

      분리 이유:

      - Claude 인증 정보는 갱신 빈도가 높아 별도 시크릿으로 관리해야 불필요한 전체 시크릿 덮어쓰기를 방지한다
      - RORR 컴포넌트는 접속 정보(ai/rorr/{env})만 읽으면 되므로 인프라 생성 정보(ai/mcp/{env})와
        Claude 인증 정보(ai/claude/{env})에 접근 권한을 줄 필요가 없다
      - AWS 계정 자격증명(ai/service/account/{env})은 MCP server subprocess가 RORR 인프라 작업 시에만 사용하며
        ai/mcp/{env}와 분리하여 접근 범위를 명확히 구분한다
      - IAM 권한을 역할에 맞게 최소화할 수 있다
   5. SSM Parameter Store 사용 금지 — 반드시 Secrets Manager 사용
8. 인프라 사이즈

   1. 스펙은 develop, staging, prod에 따라 정의
   2. develop은 테스트에 필요한 최소 사항으로 정의
   3. 인프라 스펙은 명시적으로 구성
   4. x86 프로세서를 사용
   5. 동일한 스펙일 경우 비용이 낮은 타입으로 구성 (예: t3.small 보다는 t3a.small)
9. GIT 안전 규칙

   1. git은 mcp-server/ 내부가 아닌 프로젝트 루트(aws_infra_mcp/)에서 초기화한다
      - 추적 범위: mcp-server/, docs/, user_inits/, CLAUDE.md, README.md 등 전체
      - mcp-server/ 내부에서 git init 금지 — docs/, user_inits/ 등이 추적에서 누락됨
   2. git 브랜치 작업 전 반드시 모든 파일을 먼저 커밋
   3. user_init.md 파일은 최초 커밋에 반드시 포함
   4. staging / prod 브랜치에 직접 push 금지 → 반드시 merge로만 코드 이동
   5. git push 실행 전 대상 브랜치가 feature/*인지 반드시 확인
   6. .env는 git에 동기화하지 않는다
   7. git user.email은 kazel@piepie.co, user.name은 kazel-piepie를 사용
   8. 브랜치 생성 순서 (반드시 이 순서 준수)

      1. 1단계: origin/main에서 develop 분기 후 push
      2. 2단계: develop에서 staging 분기 → 빈 커밋 → push
      3. 3단계: develop에서 prod 분기 → 빈 커밋 → push
      4. 4단계: develop에서 feature/* 분기 → 파일 추가/수정 → push → PR
      5. 금지: feature/*에 파일을 커밋한 뒤 거기서 develop/staging/prod를 분기하면 모든 파일이 세 브랜치에 그대로 포함된다
      6. 핵심 원칙: develop/staging/prod는 반드시 origin/main 기반으로 만들고, feature/*는 그 이후 develop에서 분기한다
10. AWS 리소스 description 필드 작성 규칙

    1. AWS 리소스(Security Group, IAM 등)의 description 필드에는 반드시 영문(ASCII)만 사용한다. 한글 입력 시 Terraform apply 오류 발생
    2. 허용 문자: 0-9 A-Z a-z _ . : / ( ) # , @ [ ] + = & ; { } ! $ * -
    3. 금지: 한글, 일본어, 중국어 등 멀티바이트 문자
    4. 적용 범위: aws_security_group, aws_iam_policy, aws_iam_role, aws_lb_target_group 등 AWS 리소스의 description 속성 전체
    5. Terraform HCL 속성 구분에 ; 사용 금지 (배열 원소 사이 ,는 HCL 필수 문법이므로 반드시 포함)
11. GitHub Actions Workflow 검증 규칙

    1. GitHub Actions workflow 파일을 생성하거나 수정한 후 반드시 로컬에서 YAML 문법을 검증한다
    2. 검증 방법: actionlint 사용 (권장) actionlint .github/workflows/deploy.yml 또는 yamllint 사용 yamllint .github/workflows/deploy.yml
    3. 검증 없이 push/PR 생성 금지
    4. 금지 패턴: 동일 step 내 같은 키(env:, with: 등) 중복 선언 — YAML은 같은 레벨에서 동일 키를 두 번 허용하지 않는다
    5. GitHub Actions workflow에 environment: 키 필수화
       - workflow의 각 job에 environment: 키가 없으면 Environment secrets를 참조하지 않음
       - 반드시 아래 형태로 구성해야 한다
         jobs: terraform: environment: ${{ needs.setup.outputs.environment }}  # 이 줄 필수
12. CI/CD 배포 후 인프라 접속 정보 Secrets Manager 저장 규칙

    1. 원칙: Terraform apply 완료 후 생성된 인프라의 접속 정보(호스트, 포트, 패스워드, ARN 등)는 반드시 Secrets Manager에 저장한다
    2. CI/CD 저장 흐름

       GitHub Actions workflow
       → Docker 빌드 및 ECR push
       → ECS 서비스 업데이트
       → 각 서비스(EC2/ECS)가 시작 시 Secrets Manager에서 읽어서 사용

       인프라 접속 정보 저장 흐름 (Claude 직접 수행)
       → Terraform apply 완료
       → terraform output으로 접속 정보 추출
       → aws secretsmanager put-secret-value로 Secrets Manager에 저장
    3. Terraform output 민감 정보 처리 규칙

       - 패스워드, 키 등 민감한 output은 반드시 sensitive = true 설정
       - 이유: sensitive = true 없으면 터미널 로그에 평문으로 노출됨
    4. IAM 권한 원칙

       - MCP 서버 Task Role: ai/mcp/{env}, ai/claude/{env}, ai/service/account/{env} 읽기 허용
       - MCP 서버 Task Role: ai/claude/{env} 쓰기(PutSecretValue) 허용 — credential-sync 업로드용
       - RORR 각 컴포넌트 IAM Role: ai/rorr/{env}만 읽기 허용 (mcp·claude·service/account 시크릿 접근 불가)
       - 전체 허용(Resource: "*") 금지, ARN 단위로 제한
    5. GitHub Environments 구성 규칙

       1. GitHub repo Settings → Environments에서 develop, staging, prod를 각각 생성
       2. 각 Environment에 브랜치 배포 규칙 설정: develop은 develop 브랜치에서만, staging은 staging 브랜치에서만, prod는 prod 브랜치에서만 배포 허용
       3. 환경별 secrets는 --env `<environment>` 옵션을 붙여 Environment secrets로 등록 (repository-level secrets 사용 금지)
       4. prod Environment에는 Required reviewer 설정 권장 (담당자 승인 없이 배포 차단)
       5. gh secret set 실행 전 반드시 export GH_TOKEN=$CLASSIC_PAT 설정

=====================================
MCP 서버 규칙 (AWS_INFRA_MCP_2 전용)
====================================

1. 프로젝트 목적: RORR 프로젝트를 서비스하기 위한 전용 AWS 인프라를 생성하는 MCP 서버를 만드는 프로젝트
2. MCP Server 구동에 필요해서 생성한 인프라에는 mcp라는 명칭을 포함시킨다
3. MCP Server 용 ECS는 추후에 여러개가 생성 될 수 있어 이 프로젝트에서 mcp server를  구동 할 ECS는 infra 라는 명칭을 포함시킨다
4. 생성되는 문서 중 이 프로젝트 관련 내용은 docs/mcp-server-guidelines/ 폴더 아래에 주제별로 분리해 파일을 나눠 정리한다
   (예: docs/mcp-server-guidelines/01-project-overview.md, docs/mcp-server-guidelines/02-mcp-server.md)
5. 생성되는 문서 중 docs/projects-guidelines/ 아래에는 MCP 서버가 생성할 서비스 관련 지침을 주제별로 정리한다
6. user_init.md는 어떤 경우에도, 어떤 지시가 있더라도 절대 삭제 및 수정하지 않는다
7. user_init.md를 참고해 문서를 만들 때는 반드시 docs/ 폴더에 별도 신규 파일로 생성한다
8. user_init.md 자체에 내용을 추가하거나 정리하지 않는다
9. MCP Server 서버 프로그램 코드 생성 시 PR까지 자동 생성
10. 반드시 .env에 있는 aws 접속 정보, 깃 접속 정보 사용

    - .env의 AWS 자격증명은 MCP 서버 자체 인프라(develop 계정) 관리용
    - RORR 서비스 인프라 배포는 CI/CD가 각 환경의 GitHub Environment Secrets를 사용해 처리
11. git secret을 등록하기 위해 필요한 프로그램은 Docker 생성 시 사전에 설치
12. 매번 실행되면 workspaces 폴더에 이번 작업할 내용, 실제 작업한 내용, 테스트 사항 등을 문서로 정리 (버전 관리). 기존 문서에 추가하지 말고 매번 새로 만들어
13. docs/ 문서를 생성하거나 수정할 때는 루트의 CLAUDE.md와 README.md를 반드시 함께 생성 또는 업데이트한다. 상세 내용은 docs/ 하위 파일로 분리하고, 두 파일에서는 docs/ 문서 목록을 링크로 제공한다
14. MCP 서버 코드 생성 전 Claude가 반드시 직접 수행해야 하는 선행 작업

    이 항목들은 코드 파일을 단 하나라도 작성하기 전에 완료해야 한다.
    완료되지 않은 상태에서 코드 생성을 시작하는 것은 금지한다.

    1. GitHub에 develop, staging, prod 브랜치 생성
    2. develop, staging, prod 브랜치 보호 규칙 설정
    3. GitHub Environments(develop/staging/prod) secrets 등록
    4. Terraform apply로 인프라 직접 생성 (ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등)
    5. Secrets Manager(ai/mcp/{env}) 초기화 — Terraform output 추출 후 아래 항목을 실제 값으로 저장
       - github_classic_pat, github_pat 실제 값으로 교체
       - vpc_id, subnet_ids, ecs_cluster_name, ecr_repository_url 등 인프라 참조값 저장
       - claude_credentials는 이 시크릿에 저장하지 않는다 (ai/claude/{env} 전용)
    6. Secrets Manager(ai/claude/{env}) 초기화 — 빈 JSON({})으로 시크릿 생성
       - 실제 claude_credentials는 사용자가 컨테이너에 접속해 claude auth login 수행 후 자동 업로드됨
       - credential-sync가 ~/.claude/.credentials.json 변경을 감지하면 이 시크릿에 자동 저장
    7. Secrets Manager(ai/rorr/{env}) 사전 생성 — 빈 JSON({}) 또는 placeholder로 시크릿 생성
       - RORR 서비스 접속 정보(DB, Redis, MSK 등)는 CI/CD가 Terraform apply 완료 후 채워 넣음
       - 사전 생성 이유: 생성된 RORR Terraform 코드가 data 소스로 이 시크릿을 참조하므로
         코드 생성 전에 반드시 AWS에 존재해야 한다
    8. Secrets Manager(ai/service/account/{env}) 초기화 — RORR 서비스 배포용 AWS 자격증명 저장
       - .env의 RORR_DEV_AWS_ACCESS_KEY_ID, RORR_DEV_AWS_SECRET_ACCESS_KEY 값을 저장
       - MCP server subprocess가 RORR 인프라 작업(브랜치 생성, GitHub secrets 등록 등) 시 이 시크릿을 읽어 사용
       - CI/CD는 이 시크릿을 직접 읽지 않고 GitHub Environments secrets를 사용한다

    실행 방법:

    - gh CLI와 .env의 CLASSIC_PAT를 사용해 Claude가 직접 수행한다
    - gh CLI 실행 전 반드시 export GH_TOKEN=$CLASSIC_PAT 설정
    - .env가 없거나 필요한 토큰이 없으면 사용자에게 요청한 후 수행한다
    - 로컬 git 저장소가 초기화되지 않은 상태여도 gh CLI로 원격 저장소 작업은 수행 가능하다
      (git init 여부와 무관하게 위 항목들을 먼저 완료한다)

    root 폴더 CLAUDE.md에는 이 항목들을 완료 체크리스트 형태로 포함시킨다.
15. claude 호출 방법 및 인증 파일 경로

    1. MCP 서버에서 Claude 호출 시 반드시 claude CLI를 subprocess로 실행한다
    2. @anthropic-ai/sdk, @anthropic-ai/claude-code SDK를 서버 코드에서 직접 import 금지
    3. 인증은 claude auth login으로 생성된 ~/.claude/.credentials.json 사용 (API Key 환경변수 사용 금지)
    4. Claude CLI 인증 파일 실제 경로는 ~/.claude/.credentials.json 이다
    5. watchFile, 백업/복원 로직 모두 ~/.claude/.credentials.json을 대상으로 작성할 것
    6. subprocess 실행 방법: child_process.spawn을 사용하며 프롬프트는 stdin으로 전달한다 (execFile 금지)
       - spawn으로 claude 프로세스를 시작한 뒤 child.stdin.write(prompt) → child.stdin.end() 순서로 전달한다
       - stdio: ['pipe', 'pipe', 'pipe'] 설정 필수 — stdin/stdout/stderr 모두 pipe로 연결해야 한다
       - 이유: execFile은 stdin piping이 불가능하여 최신 Claude CLI에서 'no stdin data received' 경고와 함께 exit code 1로 실패한다
       - 올바른 예시:
         const child = spawn('claude', ['--dangerously-skip-permissions', '--output-format', 'text'], {
           cwd: opts.cwd ?? '/tmp',
           env,
           stdio: ['pipe', 'pipe', 'pipe'],
         });
         child.stdin.write(prompt);
         child.stdin.end();
16. Claude 인증 정보 Secrets Manager 저장 방식

    1. ~/.claude/.credentials.json 전체를 저장한다
    2. 복원 시 ~/.claude/.credentials.json 전체 덮어쓰기
    3. watchFile 폴링 간격은 5초로 설정 (10초는 너무 느림)
    4. 저장소: AWS Secrets Manager 사용 (SSM Parameter Store 사용 금지)
    5. 코드에서 SSMClient 대신 SecretsManagerClient를 사용한다
    6. 시크릿 분리 구조 (4개 시크릿)

       시크릿 1 — ai/claude/{env}: Claude 인증 정보 전용

       - 시크릿 이름: ai/claude/{env}  (예: ai/claude/develop)
       - JSON 구조:
         {
         "claude_credentials": "{ ...~/.claude/.credentials.json 전체 내용... }"
         }
       - claude_credentials 속성값은 ~/.claude/.credentials.json 파일 내용 전체를 문자열로 저장
       - credential-sync가 5초 폴링으로 감지하여 이 시크릿만 업데이트한다
       - ECS Task Definition에서 CLAUDE_SECRET_JSON 환경변수로 주입

       시크릿 2 — ai/mcp/{env}: MCP 서버 인프라 생성 참조 정보

       - 시크릿 이름: ai/mcp/{env}  (예: ai/mcp/develop)
       - JSON 구조:
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
       - github_classic_pat, github_pat: MCP 서버가 RORR 코드 생성 시 GitHub 인증에 사용
       - external_url, vpc_id 등 인프라 참조 정보: Terraform apply 후 output에서 추출해 Claude가 직접 저장
       - RORR 컴포넌트가 ECS 추가 생성 시 이 시크릿을 읽어 vpc_id, subnet, sg 등을 참조할 수 있다
       - 코드에서 시크릿 1회 조회 후 JSON 파싱하여 각 속성값을 사용한다
       - ECS Task Definition에서 MCP_SECRET_JSON 환경변수로 주입

       시크릿 3 — ai/rorr/{env}: RORR 서비스 인프라 사용 접속 정보

       - 시크릿 이름: ai/rorr/{env}  (예: ai/rorr/develop)
       - JSON 구조: db_host, db_password, redis_host, msk_bootstrap_servers 등 (생성 코드 규칙 3항 참조)
       - CI/CD가 Terraform apply 완료 후 terraform output으로 추출하여 저장
       - RORR 각 컴포넌트가 시작 시 이 시크릿만 읽어 접속 정보를 얻는다
       - MCP 서버(ai/mcp/{env}, ai/claude/{env})와 완전히 분리되어 IAM 권한 최소화 가능

       시크릿 4 — ai/service/account/{env}: RORR 서비스 배포용 AWS 계정 자격증명

       - 시크릿 이름: ai/service/account/{env}  (예: ai/service/account/develop)
       - JSON 구조:
         {
         "aws_access_key_id":     "AKIAXXXXXX",
         "aws_secret_access_key": "xxxxxx",
         "aws_region":            "us-east-1"
         }
       - .env의 RORR_DEV_AWS_* 값을 MCP 서버 초기 설정 시 저장한다
       - MCP server subprocess가 RORR 인프라 작업 시 이 시크릿을 읽어 AWS API 호출 및 GitHub secrets 등록에 사용한다
       - CI/CD(GitHub Actions)는 이 시크릿을 직접 읽지 않는다 — GitHub Environments secrets에서 별도로 읽는다
       - ECS Task Definition secrets 블록에 포함하지 않는다 — 런타임에 AWS SDK로 직접 조회한다
17. MCP 서버 코드는 이 프로젝트에 존재

    1. 별도의 MCP Server 하위에 src 폴더를 만들어 하위에 MCP Server 코드를 생성
    2. MCP Server를 AWS 배포하기 위한 ECS 생성 테라폼 코드는 mcp-server 하위에 infra 폴더를 생성 후 하위에 생성
    3. 반드시 claude CLI를 사용, SDK나 API는 사용 금지
    4. 내부에 Claude.ai를 MCP 서버에서 사용해야 함
    5. claude.ai 인증은 mcp 서버에 사용자가 터미널로 접속해 최초 1회 계정 정보를 입력해 로그인 수행
    6. mcp 서버에 접속 가능하게 접속용 쉘 스크립트도 별도로 반드시 생성한다
    7. MCP 서버에서 계속 인증을 사용하기 위해 claude.ai가 인증 정보를 업데이트하면 ai/claude/{env}에 업로드
    8. MCP 서버 재배포 시 ai/claude/{env}에서 claude.ai 인증 정보를 로컬에 동기화
    9. MCP 서버는 Docker 형태로 이미지화해 ECS 서버에 배포
    10. Docker 생성 시 AWS CLI와 claude CLI를 사용 가능하게 관련 기능 포함 설치
        - claude CLI 설치 방법: npm install -g @anthropic-ai/claude-code 사용 (바이너리 직접 다운로드 방식 금지)
        - 이유: 바이너리 직접 다운로드 URL은 실제로 존재하지 않아 404 오류 발생
        - node:24-slim 베이스 이미지에 npm이 이미 포함되어 있으므로 별도 설치 없이 바로 사용 가능
        - Dockerfile 예시: RUN npm install -g @anthropic-ai/claude-code
    11. MCP connector를 이용해서 호출할 때는 AWS_INFRA_MCP 프로젝트는 수정하지 않고 MCP Server에서 만든 aws 인프라 코드만 핸들링 한다
    12. MCP Server 외부 url은 https://mcp-dev-aws.rorr.club/mcp 를 사용한다
    13. MCP 서버가 배포된 ECS에 연결된 alb는 idle_timeout을 4,000초(AWS 하드 최대값)로 설정한다
    14. claude-runner.ts 기본 timeout은 3,900,000ms(65분)으로 설정한다 — ALB 4,000초 한도 내 여유 확보
    15. 내부적으로 claude CLI를 사용하기에 부족하지 않은 스펙을 설정한다
    16. CI/CD는 Docker 이미지 빌드 → ECR push → ECS 서비스 업데이트만 수행한다.
        담당자가 PR 머지 시 자동으로 Docker 이미지가 빌드되어 ECS에 배포된다.
        인프라(ECR, ECS 클러스터, VPC, ALB, 보안 그룹 등)는 CI/CD가 아닌 Claude가 이 프로젝트에서 직접 생성한다.
    17. 이 프로젝트에 생성한 MCP 서버 관련 정보는 docs/infra-information 폴더에 별도의 MD과 .env.sample 파일로 항상 정리한다
    18. ssl 인증서는 rorr.club 인증서를 사용한다
    19. mcp-server 폴더를 생성할 때 docs/projects-guidelines폴더를 mcp-server 폴더에 복사한다
18. 이 프로젝트 git 관리 (AWS_INFRA_MCP_2)

    1. 깃 저장소는 https://github.com/kazel-piepie/AWS_INFRA_MCP_2.git 를 사용
    2. prod, staging, develop로 분리해서 관리
    3. 각 브랜치마다 시크릿 설정 변수, 일반 설정 변수 구성 — .env 참고
    4. aws 접속 정보는 .env를 참고해 github Actions secrets에 등록한다
    5. 프로젝트 생성, 변경 시 PR을 생성하고 merge 대상은 항상 develop만 머지 할 수 있게 설정
    6. git 저장소는 프로젝트 루트(aws_infra_mcp/)에서 초기화한다 (mcp-server/ 내부에서 git init 금지)
    7. PR 생성 순서

       1. 신규 파일 작성
       2. git add . (user_init.md 포함 전체 스테이징) — 반드시 프로젝트 루트(aws_infra_mcp/)에서 실행 (mcp-server/ 안에서 실행 시 docs/, user_inits/ 누락)
       3. git commit (현재 브랜치에서)
       4. git push origin `<feature-branch>`
       5. GitHub API 또는 gh CLI로 PR 생성 (develop 대상)
       6. 기존 파일이 있는 상태에서 git checkout -f 절대 사용 금지
19. Docker 생성 규칙

    1. package.json이 없을 때도 빌드 되도록 처리
    2. CI/CD는 docker job만 포함한다 — Docker 빌드 → ECR push → ECS 서비스 업데이트.
       ECR 저장소는 CI/CD 실행 전 Claude가 직접 생성해야 한다. CI/CD에 terraform job을 포함하지 않는다.
    3. npm ci는 package-lock.json이 없으면 실패하므로 npm install을 사용한다
    4. 빌더 스테이지: npm install (devDependencies 포함 — TypeScript 컴파일에 필요)
    5. 런타임 스테이지: npm install --omit=dev (prod 의존성만)
    6. 빌더와 런타임 스테이지를 반드시 분리할 것
    7. Docker 컨테이너 내부에서 AWS CLI 실행 시 pager 오류가 발생할 수 있음
       - 원인: 컨테이너에 less가 없으면 AWS CLI 출력 시 pager를 찾지 못해 실패
       - 해결 방법 1: Dockerfile에 less 설치 추가
       - 해결 방법 2: AWS CLI 호출 시 --no-cli-pager 옵션 추가
       - 해결 방법 3: 환경변수 AWS_PAGER="" 설정
       - Node.js subprocess로 AWS CLI를 호출할 때는 env에 AWS_PAGER: ''를 반드시 포함할 것
    8. 빌드 전 /docs/projects-guidelines/ 폴더는 mcp-server에 존재해야 한다
    9. docker job에서 ECR URL 등 인프라 참조값은 Secrets Manager(ai/mcp/{env})에서 직접 조회한다
       ECR_URL=$(aws secretsmanager get-secret-value --secret-id "ai/mcp/$ENVIRONMENT" --query SecretString --output text | jq -r '.ecr_repository_url')
       - Claude가 직접 Terraform apply + Secrets Manager 초기화를 완료한 시점에 ecr_repository_url이 이미 저장되어 있음
       - ecs_cluster_name, ecs_service_name 등 단순 이름값은 job output 전달 가능
20. ECS Exec 접속 (connect-mcp.sh)

    1. aws ecs execute-command 실행 시 session-manager-plugin 필수
    2. WSL 설치 방법:
       curl -fsSL https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb -o /tmp/ssm.deb
       dpkg -x /tmp/ssm.deb /tmp/ssm-plugin
       cp /tmp/ssm-plugin/usr/local/sessionmanagerplugin/bin/session-manager-plugin ~/bin/
    3. PATH에 ~/bin 포함 필요: export PATH="$HOME/bin:$PATH"
    4. claude auth login은 브라우저 인터랙션이 필요하므로 반드시 사용자가 직접 수행
    5. MCP 서버 코드 생성 시 반드시 connect-mcp.sh 파일을 mcp-server/connect-mcp.sh 경로에 생성한다
    6. connect-mcp.sh는 아래 기능을 포함해야 한다

       1. 실행 중인 ECS Task ARN 자동 조회 (aws ecs list-tasks)
       2. aws ecs execute-command 실행 (cluster, task, container 자동 지정)
       3. session-manager-plugin 미설치 시 설치 안내 출력
       4. 스크립트 실행 전 프로젝트 루트의 .env 파일을 자동으로 로드한다
          1. connect-mcp.sh 위치 기준으로 상위 디렉토리에서 .env를 탐색
          2. .env가 존재하면 source하여 AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY 등을 환경변수로 설정
          3. .env가 없으면 "AWS credentials not found in .env" 경고 출력 후 기존 환경변수로 계속 진행
    7. ECS Exec 접속 후 반드시 mcpuser로 전환 후 claude 인증 수행

       - 이유: ECS Exec(connect-mcp.sh)은 SSM 에이전트가 root로 실행되므로 항상 root로 접속됨
         Dockerfile의 USER mcpuser 지시어를 무시하고 root 셸이 열림
       - root에서 claude auth login 시 /root/.claude/.credentials.json에 저장됨
       - MCP 서버(mcpuser)는 /home/mcpuser/.claude/.credentials.json을 바라봄
       - 두 경로가 달라 credential-sync가 감지하지 못하고 ai/claude/{env} 업로드가 이루어지지 않음
       - 반드시 아래 순서로 수행한다:

         # connect-mcp.sh 접속 후 (root 상태)

         su -s /bin/bash mcpuser   # mcpuser로 전환
         claude auth login          # /home/mcpuser/.claude/.credentials.json에 저장됨

         # credential-sync가 5초 폴링으로 감지 → ai/claude/에 자동 업로드
       - su -s /bin/bash가 실패할 경우 대안 (root에서 수행 후 수동 복사):

         claude auth login
         cp /root/.claude/.credentials.json /home/mcpuser/.claude/.credentials.json
         chown mcpuser:mcpuser /home/mcpuser/.claude/.credentials.json
         chmod 600 /home/mcpuser/.claude/.credentials.json

         # credential-sync가 파일 변경 감지 후 ai/claude/에 자동 업로드
21. MCP 세션 관리

    1. StreamableHTTPServerTransport의 sessionId는 handleRequest 실행 중에 할당된다
    2. sessions.set()은 반드시 handleRequest 이후에 호출해야 한다
       (이전에 호출하면 sessionId가 null이어서 세션이 저장되지 않음)
22. RORR 관련 내용을 mcp-server/CLAUDE.md에도 포함시켜라
23. mcp-server/CLAUDE.md 생성 규칙

    1. MCP 서버 코드 생성 또는 수정 시 반드시 mcp-server/CLAUDE.md를 함께 생성/업데이트한다
    2. mcp-server/CLAUDE.md에 포함할 내용:
       1. 인프라 규칙
       2. RORR 서비스 아키텍처 전체
    3. mcp-server/CLAUDE.md는 Claude CLI가 인프라 생성 작업 시 참고하는 지침 파일이다
    4. Dockerfile에 CLAUDE.md 복사 지시를 반드시 포함한다: COPY CLAUDE.md ./
24. Docker 컨테이너 non-root 유저 규칙

    1. 발생한 오류: ECS Fargate 컨테이너가 root 유저로 실행될 경우 Claude CLI의 --dangerously-skip-permissions 플래그 사용이 보안상 차단된다

       - 오류 메시지: --dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
    2. 원인: MCP 서버는 내부적으로 claude --dangerously-skip-permissions를 subprocess로 실행하는데, 컨테이너가 root로 동작하면 Claude CLI가 이를 거부한다
    3. 해결 방법: Dockerfile에서 반드시 non-root 유저를 생성하고 해당 유저로 전환한 뒤 서버를 실행한다

       RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser
       RUN mkdir -p /home/mcpuser/.claude && chown -R mcpuser:mcpuser /app /home/mcpuser
       ENV HOME=/home/mcpuser
       USER mcpuser
    4. 적용 위치: Dockerfile의 런타임 스테이지 마지막 부분 (CMD 또는 ENTRYPOINT 바로 위)
    5. HOME 환경변수 명시 필요: non-root 유저로 전환 후 ~/.claude/.credentials.json 경로가 올바르게 해석되려면 ENV HOME=/home/mcpuser를 반드시 설정한다
    6. ECS Task Definition의 user 필드를 별도로 설정하지 않아도 Dockerfile의 USER 지시어만으로 충분하다
25. mcpuser 권한 범위 규칙

    1. mcpuser에게 sudo 또는 어드민 권한을 절대 부여하지 않는다

       - 이유: Claude CLI는 root 또는 sudo 권한을 감지하면 --dangerously-skip-permissions 플래그를 하드코딩으로 차단한다
       - mcpuser + sudo = root와 동일한 오류 재발생
       - 반드시 순수 non-root 유저로만 운영해야 한다
    2. mcpuser에게 필요한 권한 범위

       /app 전체: 읽기 + 실행 — Node.js 앱 실행, CLAUDE.md / docs 파일 읽기
       /home/mcpuser 전체: 읽기 + 쓰기 — credentials.json 저장/복원, claude CLI가 ~/.config, ~/.cache 등 추가 디렉토리 생성
       /home/mcpuser/.claude/: 읽기 + 쓰기 + 디렉토리 생성 — SSM 복원 시 mkdirSync, writeFileSync, 5초 폴링 statSync
       /tmp: 읽기 + 쓰기 + 실행 — git clone, terraform init 임시 작업공간 (기본 1777이므로 별도 조치 불필요)
       글로벌 바이너리 (claude, aws, terraform, git, gh, node): 실행 — root로 설치 시 기본 755, 별도 조치 불필요
    3. Dockerfile 소유권 설정 방법

       RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser
       RUN chown -R mcpuser:mcpuser /app /home/mcpuser
       ENV HOME=/home/mcpuser
       USER mcpuser
    4. mcpuser로 전환한 뒤 실행되는 claude subprocess는 mcpuser 권한 그대로 동작한다

       - claude subprocess 내부에서 실행하는 git, gh, aws, terraform도 모두 mcpuser 권한으로 실행됨
       - 외부 서비스(GitHub, AWS)에 대한 인증은 환경변수(AWS_ACCESS_KEY_ID, GH_TOKEN 등)로 처리되므로 OS 권한과 무관하다
26. ECS 컨테이너 환경변수 — GitHub PAT 주입 규칙

    1. 발생한 오류: RORR 인프라 생성 툴 호출 시 git push 및 PR 생성 단계에서 GitHub 인증 실패
       - 오류 내용: could not read Username for 'https://github.com' — CLASSIC_PAT / GH_TOKEN 미설정
    2. 원인: ECS Task Definition 환경변수에 GitHub PAT가 포함되지 않았다
       - ai/mcp/{env} 안에 github_classic_pat, github_pat 속성이 있지만 컨테이너 환경변수로 주입되지 않았다
    3. 해결 방법: 통합 시크릿 전체를 MCP_SECRET_JSON 환경변수로 주입 후 애플리케이션 코드에서 JSON 파싱하여 추출
       - ARN#key 방식 사용 금지 — ValidationException(400) 발생 (27번 항목 참고)
       - valueFrom에 시크릿 ARN만 지정 → MCP_SECRET_JSON 환경변수로 전체 JSON 수신
       - 코드에서 JSON.parse(process.env.MCP_SECRET_JSON) 후 github_classic_pat, github_pat 추출
    4. claude subprocess 내부에서 gh CLI 실행 시 인증 순서
       1. export GH_TOKEN=$CLASSIC_PAT — Environment secrets 등록용 (gh secret set)
       2. export GH_TOKEN=$GH_PAT — PR 생성 등 일반 GitHub API용
       3. git push 시 https://${GH_PAT}@github.com/... 형태로 remote URL에 PAT 포함
    5. 적용 범위: develop / staging / prod 모든 환경에 동일하게 적용
27. ECS Task Definition secrets 블록 — Secrets Manager JSON 키 추출 규칙

    1. 발생한 오류: ECS 태스크가 시작 전 즉시 TaskFailedToStart로 실패

       - 오류 메시지: ValidationException: Invalid name. Must be a valid name containing alphanumeric characters, or any of the following: -/_+=.@!
       - 원인 ARN: arn:aws:secretsmanager:us-east-1:...㊙️ai/mcp/develop-umDO65#github_classic_pat
    2. 원인: ECS secrets 블록 valueFrom에 ARN#json_key 형식을 사용했을 때 발생
    3. 올바른 방법: 시크릿 전체를 단일 환경변수로 주입 후 애플리케이션 코드에서 JSON 파싱

       Terraform ecs.tf:
       secrets = [
       { name = "MCP_SECRET_JSON",    valueFrom = aws_secretsmanager_secret.mcp.arn    },
       { name = "CLAUDE_SECRET_JSON", valueFrom = aws_secretsmanager_secret.claude.arn },
       ]

       애플리케이션 코드 (Node.js):
       const mcpSecret    = JSON.parse(process.env.MCP_SECRET_JSON    ?? '{}');
       const claudeSecret = JSON.parse(process.env.CLAUDE_SECRET_JSON ?? '{}');
       const classicPat   = mcpSecret.github_classic_pat;
       const ghPat        = mcpSecret.github_pat;
       const claudeCreds  = claudeSecret.claude_credentials;
    4. ECS secrets 블록 valueFrom에 #key 또는 :key:: 형식 절대 사용 금지
    5. ai/service/account/{env}는 ECS Task Definition secrets 블록에 포함하지 않는다
       — 컨테이너 시작 시 주입하지 않고 create_rorr_infra 툴 실행 시 AWS SDK로 직접 조회한다
28. ECS Task IAM Role 권한 규칙

    1. 발생한 오류: get_infra_status 툴 호출 시 모든 AWS 리소스 조회가 IAM 권한 오류로 차단됨
       - 오류 내용: UnauthorizedOperation (ec2:DescribeInstances), AccessDeniedException (ecs:ListClusters 등)
    2. 원인: ECS Task Role에 RORR 인프라 리소스를 조회할 수 있는 IAM 정책이 부여되지 않았다
    3. Task Role 권한 목록

       읽기 권한 (RORR 인프라 조회용, Resource: "*"):
       ec2:DescribeInstances
       ecs:ListClusters / DescribeClusters / ListServices / DescribeServices
       kafka:ListClusters / DescribeCluster
       elasticache:DescribeCacheClusters
       elasticloadbalancing:DescribeLoadBalancers / DescribeTargetGroups
       s3:ListBucket
       cloudfront:ListDistributions

       Secrets Manager 읽기 권한 (ARN 단위 제한):
       secretsmanager:GetSecretValue — ai/mcp/{env}, ai/claude/{env}, ai/service/account/{env} ARN으로만 제한

       Secrets Manager 쓰기 권한 (ai/claude/{env} ARN으로만 제한):
       secretsmanager:PutSecretValue — ai/claude/{env} ARN으로만 제한
       이유: credential-sync가 claude auth login 후 인증 정보를 ai/claude/{env}에 업로드하려면 반드시 필요하다
            이 권한이 없으면 'AccessDeniedException: not authorized to perform: secretsmanager:PutSecretValue' 오류 발생

       ECS Exec 권한 (SSM 채널, Resource: "*"):
       ssmmessages:CreateControlChannel / CreateDataChannel / OpenControlChannel / OpenDataChannel

    4. 적용 방법: Terraform iam.tf의 Task Role에 위 정책을 inline policy로 추가
       - GetSecretValue는 ai/mcp/{env}, ai/claude/{env}, ai/service/account/{env} ARN으로 제한
       - PutSecretValue는 ai/claude/{env} ARN으로만 제한
       - ai/rorr/* 접근은 RORR 컴포넌트 Role 전용이므로 MCP Task Role에 부여하지 않는다
    5. 주의: Task Execution Role과 Task Role은 별개다
       - Task Execution Role: ECS 에이전트가 사용 (ECR pull, CloudWatch Logs) — ai/mcp/{env}, ai/claude/{env} GetSecretValue 필요 (컨테이너 기동 시 주입)
       - Task Role: 컨테이너 내 애플리케이션(MCP 서버)이 사용 — ai/mcp/{env}, ai/claude/{env} GetSecretValue + PutSecretValue, ai/service/account/{env} GetSecretValue
29. 최초 MCP 서버 생성 시 Secrets Manager 초기화 규칙

    1. 올바른 최초 생성 흐름

       1단계: GitHub Actions Environments에 CLASSIC_PAT, GH_PAT 등록 (gh secret set) — Claude 직접 수행
       2단계: Terraform apply — Claude가 이 프로젝트에서 직접 수행
       ai/mcp/{env}, ai/claude/{env}, ai/rorr/{env}, ai/service/account/{env} 시크릿이 이 단계에서 Terraform에 의해 처음 생성된다
       ECR, ECS 클러스터, VPC, ALB 등 모든 인프라가 이 단계에서 생성된다
       3단계: Secrets Manager 초기화 — Claude가 직접 수행 (Terraform 완료 직후)
       ai/mcp/{env}: github_classic_pat, github_pat 실제 값으로 교체 + terraform output 인프라 참조값 저장
       ai/claude/{env}: 빈 JSON({}) 유지 (claude_credentials는 사용자가 auth login 후 자동 업로드)
       ai/rorr/{env}: 빈 JSON({}) 또는 placeholder 유지 (CI/CD가 apply 후 채워 넣음)
       ai/service/account/{env}: .env의 RORR_DEV_AWS_ACCESS_KEY_ID, RORR_DEV_AWS_SECRET_ACCESS_KEY 값 저장
       4단계: CI/CD workflow trigger — Docker 빌드 → ECR push → ECS 서비스 업데이트 (자동)
       5단계: ECS 컨테이너 시작 시 MCP_SECRET_JSON에 실제 PAT 포함되어 정상 동작
    2. GitHub Actions Secrets 등록 대상 (최초 생성 전 필수)

       export GH_TOKEN=$CLASSIC_PAT
       gh secret set AWS_ACCESS_KEY_ID     --env develop --body "$AWS_ACCESS_KEY_ID"
       gh secret set AWS_SECRET_ACCESS_KEY --env develop --body "$AWS_SECRET_ACCESS_KEY"
       gh secret set AWS_REGION            --env develop --body "us-east-1"
       gh secret set CLASSIC_PAT           --env develop --body "$CLASSIC_PAT"
       gh secret set GH_PAT               --env develop --body "$GH_PAT"

       # staging, prod도 동일하게 반복 (각 환경 전용 AWS 계정 키 사용)

       등록 불필요 항목:

       - ACM_CERTIFICATE_ARN: Terraform data "aws_acm_certificate"로 *.rorr.club 인증서 자동 조회 — secret 등록 불필요
       - MCP_SECRET_ARN: Terraform이 ai/mcp/{env}를 생성하고 내부에서 ARN 참조 — 배포 전 존재하지 않으므로 사전 등록 불가
    3. claude auth login으로 생성되는 claude_credentials는 최초 배포 후 사용자가 직접 컨테이너에 접속하여 수행 (자동화 불가)
    4. CI/CD docker job에서 ecr_repository_url 등 인프라 참조값은 Secrets Manager(ai/mcp/{env})에서 직접 조회한다

       - 3단계(Claude 직접 Secrets Manager 초기화) 완료 시점에 해당 값들이 이미 저장되어 있음
30. MCP_SECRET_JSON 미존재 시 .env 폴백 규칙

    ECS 컨테이너 최초 배포 또는 로컬 개발 환경에서 MCP_SECRET_JSON 환경변수가 없을 수 있다.
    이 경우 애플리케이션 코드는 .env 파일의 값을 폴백으로 사용한다.

    1. 조건별 동작
       - MCP_SECRET_JSON 있음: JSON 파싱 후 사용 (ECS 운영 환경 — 정상 경로)
       - MCP_SECRET_JSON 없음: .env의 AWS_ACCESS_KEY_ID, CLASSIC_PAT, GH_PAT 등 직접 로드 (초기 배포 / 로컬 개발)
       - CLAUDE_SECRET_JSON 있음: JSON 파싱 후 claude_credentials 추출
       - CLAUDE_SECRET_JSON 없음: credential-sync 복원 건너뜀 (정상)
    2. 적용 대상
       - secrets-manager.ts getMcpSecret(): MCP_SECRET_JSON 없으면 .env 값으로 구성한 객체 반환
       - credential-sync.ts restoreCredentials(): CLAUDE_SECRET_JSON의 claude_credentials 없으면 복원 건너뜀 (정상)
       - create-rorr-infra.ts: github_pat 없으면 .env의 GH_PAT 사용
31. server.tool() 콜백 파라미터 타입 명시 필수

    // ❌ 금지
    server.tool('name', '...', { key: z.string() }, async ({ key }) => { ... })

    // ✅ 올바른 방법
    server.tool('name', '...', { key: z.string() }, async ({ key }: { key: string }) => { ... })
32. claude-runner.ts 타임아웃 설정 규칙

    1. 발생한 오류: RORR 인프라 생성 툴 호출 시 Command timed out after 300000 milliseconds
       - 원인: claude-runner.ts의 기본 타임아웃이 300,000ms (5분)으로 설정되어 있으나
         RORR 인프라 생성 툴의 실제 작업(레포 clone → Terraform 코드 생성 → init/validate → git push → PR 생성)이
         5분을 초과함
    2. 타임아웃 제약 구조
       - ALB idle_timeout: 4,000초 (AWS ALB 하드 최대값) — 실질적인 최대값
       - claude-runner.ts timeout은 반드시 4,000,000ms 미만으로 설정해야 한다
    3. 권장 설정값
       - claude-runner.ts 기본 timeout: 3,900,000ms (65분) — ALB 4,000초 한도에서 여유 확보
       - ALB idle_timeout: 4,000초 유지 (이미 최대치로 설정됨)
33. Claude 자율 실행 권한 (AWS_INFRA_MCP_2 전용)

    이 프로젝트(AWS_INFRA_MCP_2)의 규칙을 따르는 작업은 사용자의 별도 확인 없이 자동으로 끝까지 완료한다.
    아래 작업은 모두 자동 실행 대상이다:

    1. AWS CLI 명령 실행
    2. GitHub API / gh CLI 실행 (GH_PAT 사용)
    3. git push, 브랜치 생성, PR 생성
    4. Terraform 명령 실행 (init / plan / apply)

       - MCP 서버 인프라(ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등)는
         Claude가 이 프로젝트에서 직접 terraform apply를 수행한다
       - CI/CD workflow에 terraform job을 포함하지 않는다
    5. Docker 빌드 및 ECR push
       자동 실행 제외 대상: Git 머지
    6. GitHub Actions Secrets 등록 (gh secret set) | CLASSIC_PAT 사용

       1. GitHub Actions workflow를 생성하거나 수정할 때는 해당 workflow에서 참조하는 모든 secrets를 즉시 gh secret set으로 등록한다
       2. 배포에 필요한 전제 조건(버킷, secrets, 파라미터 등)은 확인 없이 한 번에 완료한다
       3. gh secret set 실행 시 반드시 export GH_TOKEN=$CLASSIC_PAT 설정 후 실행한다
       4. 이유: Fine-grained PAT(github_pat_ 접두사)는 GitHub Environment secrets API를 지원하지 않아 403 오류 발생. Classic PAT(ghp_ 접두사)만 사용 가능
    7. CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포만 수행한다.
       ECR 저장소, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend(S3 버킷, DynamoDB 테이블 등) 등
       인프라 전제 조건은 Claude가 이 프로젝트에서 직접 생성한다.
       CI/CD workflow에 인프라 생성 로직(terraform job 등)을 포함하지 않는다.
34. terraform output 실행 및 Secrets Manager 저장 규칙

    1. terraform output 실행 시 반드시 --no-color 플래그를 포함한다

       terraform output -raw ecr_repository_url --no-color
    2. Python subprocess로 실행할 때도 동일하게 적용한다

       subprocess.run(['terraform', 'output', '-raw', key, '--no-color'], capture_output=True, ...)
    3. 저장 전 값 검증 필수: stdout 값에 줄바꿈 문자(\n) 또는 ANSI 이스케이프 코드가 포함되지 않았는지 확인

       - 검증 조건: len(value.splitlines()) == 1 이어야 한다
       - 줄바꿈이 포함된 값은 저장하지 않고 오류로 처리한다
35. Terraform S3 백엔드 설정 규칙

    backend "s3" 블록에 dynamodb_table 파라미터를 사용하지 않는다 — deprecated 파라미터이며 terraform output stdout에
    경고 메시지를 출력해 캡처 값을 오염시킨다.

    DynamoDB 상태 잠금이 필요할 경우 use_lockfile = true를 사용한다.
36. Docker 베이스 이미지 및 패키지 규칙

    1. Node.js 베이스 이미지는 node:24-slim을 사용한다 (Node 20은 2026년 4월 EOL, Node 24가 현재 Active LTS)
    2. apt-get install에 ca-certificates를 반드시 포함한다
    3. 수정 방법 (apt-get에 ca-certificates 추가):

       FROM node:24-slim
       ...
       RUN apt-get update && apt-get install -y --no-install-recommends
       curl unzip git less jq ca-certificates
       && rm -rf /var/lib/apt/lists/*

    4. Claude CLI 설치 방법: npm install -g @anthropic-ai/claude-code 사용 (바이너리 직접 다운로드 방식 금지)
       - 이유: 바이너리 직접 다운로드 URL(예: storage.googleapis.com/anthropic-claude-cli/...)은
         실제로 존재하지 않아 curl 404 오류 발생 → Docker 빌드 실패
       - node:24-slim 베이스 이미지에 npm이 이미 포함되어 있으므로 별도 설치 없이 바로 사용 가능
       - Dockerfile 적용 예시:
         RUN npm install -g @anthropic-ai/claude-code

37. MCP 서버 코드 생성 후 로컬 빌드 검증 규칙

    1. MCP 서버 코드를 생성하거나 수정한 후 git push 및 PR 생성 전에 반드시 로컬에서 npm run build를 실행한다
    2. TypeScript 컴파일 오류가 없을 때만 push/PR 생성을 진행한다
    3. 이유: Docker 빌드에서 TypeScript 오류가 발견되면 수정까지 CI/CD를 반복 실행해야 하므로 시간이 많이 소요됨
       로컬에서 npm run build는 수초 내에 완료되므로 CI/CD 이전에 반드시 확인한다
    4. 실행 위치: mcp-server/ 폴더

       cd mcp-server && npm install && npm run build

38. @modelcontextprotocol/sdk 버전 고정 규칙

    1. @modelcontextprotocol/sdk 버전은 반드시 exact pin으로 고정한다 (^ 범위 지정 금지)
    2. package-lock.json을 반드시 커밋한다 — 없으면 npm install 시 최신 버전으로 드리프트 발생
    3. 고정 버전: 1.22.0
       - 1.22.0: McpServer, StreamableHTTPServerTransport 모두 존재 + ZodRawShapeCompat 없음 → 정상 빌드
       - 1.23.0 이상: ZodRawShapeCompat 타입 도입 → server.tool() 호출 시 TS2589 (type instantiation excessively deep) 발생
       - 1.0.4 이하: McpServer, StreamableHTTPServerTransport 모듈 없음 → TS2307 발생
    4. package.json 작성 예시:

       "dependencies": {
         "@modelcontextprotocol/sdk": "1.22.0"
       }

39. AWS 자격증명 접근 분리 원칙

    MCP server와 CI/CD는 RORR AWS 자격증명을 서로 다른 저장소에서 읽는다.

    | 주체 | RORR AWS 키 출처 |
    |------|----------------|
    | MCP server subprocess | ai/service/account/{env} (Secrets Manager) |
    | GitHub Actions CI/CD | GitHub Environments secrets |

    1. MCP server subprocess가 RORR AWS API를 호출하거나 GitHub Environments secrets를 등록할 때
       반드시 ai/service/account/{env}에서 자격증명을 읽는다
    2. CI/CD(GitHub Actions)는 GitHub Environments secrets에 등록된 AWS_ACCESS_KEY_ID,
       AWS_SECRET_ACCESS_KEY를 사용하며 Secrets Manager를 직접 읽지 않는다
    3. 두 저장소는 같은 값을 갖되 접근 주체가 완전히 분리된다
    4. 최초 구동 시 MCP server subprocess가 ai/service/account/{env}에서 자격증명을 읽어
       AWS_INFRA_2 GitHub Environments secrets에 등록한다 — 이후 CI/CD는 GitHub에서 자율적으로 사용

=====================================
MCP 서버가 생성하는 코드 규칙 (AWS_INFRA_2 전용)
================================================

1. RORR 인프라 생성 역할 분리

   1. RORR 인프라 생성 기능의 동작 범위
      (MCP 서버가 제공하는 RORR 인프라 생성 기능 — 정확한 툴 명칭은 MCP 서버 구현에 따라 결정)

      최초 생성 시 (AWS_INFRA_2 레포 최초 셋업):

      - Claude subprocess가 브랜치 생성, 보호 규칙, GitHub Environments secrets 등록까지 직접 수행 (항목 2 참조)
        GitHub Environments secrets 값(AWS_ACCESS_KEY_ID 등)은 ai/service/account/{env}에서 읽어 등록한다
      - Terraform 코드 생성 → feature 브랜치 push → PR 생성
      - terraform apply는 PR 머지 후 CI/CD가 수행한다 (최초 생성 시에도 동일)
      - 프로그램 설치는 Terraform user_data에 포함 → EC2 시작 시 cloud-init으로 자동 설치

      이후 인프라 변경 시:

      - MCP 서버 역할: Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)
      - terraform apply는 PR 머지 후 CI/CD(GitHub Actions)가 담당한다
   2. RORR 인프라 CI/CD 워크플로우 생성 규칙

      - RORR 인프라 코드 생성 시, AWS_INFRA_2 repo에 CI/CD 워크플로우가 없으면 함께 생성한다
      - 워크플로우는 develop / staging / prod 브랜치 push 시 트리거되어야 한다
      - 각 job에 environment: 키를 포함해 해당 브랜치의 GitHub Environment secrets를 참조한다
      - terraform init → plan → apply를 자동 수행하고, apply 완료 후 접속 정보를 ai/rorr/{env}에 저장한다
   3. 브랜치별 AWS 계정 분리

      - develop 브랜치 머지 → GitHub Environment 'develop' → develop AWS 계정에 배포
      - staging 브랜치 머지 → GitHub Environment 'staging' → staging AWS 계정에 배포
      - prod 브랜치 머지 → GitHub Environment 'prod' → prod AWS 계정에 배포
      - 최초·이후 모두: CI/CD가 해당 환경 GitHub Environment secrets를 사용해 terraform apply 수행
2. RORR 최초 생성 선행 작업 (AWS_INFRA_2 레포 최초 셋업 시 Claude subprocess가 직접 수행)

   MCP 서버를 만들 때와 동일하게 Claude subprocess가 사용자 확인 없이 끝까지 수행한다.
   이 항목들은 처음으로 RORR 인프라를 생성할 때 완료해야 한다.
   완료되지 않은 상태에서 Terraform 코드 생성을 시작하는 것은 금지한다.

   1. AWS_INFRA_2 repo에 develop, staging, prod 브랜치 생성
   2. develop, staging, prod 브랜치 보호 규칙 설정
   3. GitHub Environments(develop/staging/prod) secrets 등록
      - AWS_ACCESS_KEY_ID: ai/service/account/{env}.aws_access_key_id 값 사용
      - AWS_SECRET_ACCESS_KEY: ai/service/account/{env}.aws_secret_access_key 값 사용
      - AWS_REGION: ai/service/account/{env}.aws_region 값 사용 (us-east-1)
      - CLASSIC_PAT: ai/mcp/{env}.github_classic_pat 값 사용
      - GH_PAT: ai/mcp/{env}.github_pat 값 사용
        ※ gh secret set 전 반드시 export GH_TOKEN=$CLASSIC_PAT 설정
   4. Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)
      - 3번에서 GitHub Environments secrets에 ai/service/account/{env} 값이 이미 등록돼 있으므로
        PR 머지 시 CI/CD가 해당 계정으로 즉시 terraform apply를 수행한다
      - terraform apply는 Claude subprocess가 직접 수행하지 않는다
      - 프로그램 설치는 Terraform user_data(cloud-init)에 포함 → EC2 시작 시 cloud-init으로 자동 설치
      - CI/CD apply 완료 후 접속 정보를 ai/rorr/develop에 자동 저장

   실행 방법:

   - gh CLI와 ai/mcp/{env}의 github_classic_pat, github_pat 값을 사용해 Claude subprocess가 직접 수행한다
   - GitHub Environments secrets 등록 시 ai/service/account/{env} 값을 읽어 AWS_ACCESS_KEY_ID 등으로 매핑
   - gh CLI 실행 전 반드시 export GH_TOKEN=$CLASSIC_PAT 설정
   - staging, prod 환경은 각 환경 담당자가 별도 수행하거나
     ai/service/account/staging, ai/service/account/prod 시크릿 추가 후 Claude가 동일하게 수행 가능
3. MCP 서버에서 만든 서비스 코드 관련 (AWS_INFRA_2)

   1. 별도의 git 저장소 https://github.com/kazel-piepie/AWS_INFRA_2.git 사용
   2. prod, staging, develop로 분리해서 관리
   3. 각 브랜치마다 시크릿 설정 변수, 일반 설정 변수 구성
   4. aws 접속 정보는 각 환경 전용 AWS 계정 키를 해당 GitHub Environment secrets에 등록한다
      - develop Environment: develop AWS 계정 키
      - staging Environment: staging AWS 계정 키
      - prod Environment: prod AWS 계정 키
   5. 프로젝트 생성 변경 시 PR을 생성하고 merge 대상은 항상 develop만 머지 할 수 있게 설정
   6. 생성되는 infra는 프로젝트 가이드라인을 참고해서 생성한다
   7. 담당자가 머지 시 자동으로 프로젝트 관련 aws 인프라가 생성되게 CI/CD를 구성한다
      - CI/CD 워크플로우가 없으면 RORR 인프라 코드 생성 시 함께 생성한다
   8. develop → staging → prod 순으로 담당자가 수동으로 머지를 진행해야 하므로
      인프라 생성 시 3가지 환경에 따라 스펙 등이 변경되게 구성한다
   9. 실제 배포가 끝나면 생성 정보에 대한 내용을 별도의 문서에 정리한다
4. RORR 서비스 Secrets Manager (ai/rorr/{env})

   1. RORR 서비스 전체 공용 시크릿 이름: ai/rorr/{env}  (예: ai/rorr/develop)
   2. JSON 구조 — RORR 서비스 인프라 사용 접속 정보만 저장:
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
   3. 시크릿 사전 생성 및 Terraform 참조 규칙 (핵심)

      ai/rorr/{env}는 MCP 서버 선행 작업(14항 7번)에서 이미 생성된 시크릿이다.
      생성된 Terraform 코드에서 resource 블록으로 새로 만들지 않는다.
      반드시 data 소스로 기존 시크릿을 참조한다:

      data "aws_secretsmanager_secret" "rorr" {
      name = "ai/rorr/${var.env}"
      }

      이 방식의 이점:

      - data.aws_secretsmanager_secret.rorr.arn 이 정확한 ARN을 반환한다 (랜덤 6자 suffix 포함)
      - IAM policy Resource에 와일드카드(*) 없이 정확한 ARN 지정 가능
      - user_data 스크립트의 --secret-id에 data.aws_secretsmanager_secret.rorr.name 사용 가능
        (get-secret-value는 와일드카드 ARN을 지원하지 않으므로 반드시 name 또는 정확한 ARN 사용)

      IAM policy 올바른 작성법:
      resource "aws_iam_policy" "rorr_secret_read" {
      policy = jsonencode({
      Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = data.aws_secretsmanager_secret.rorr.arn
      }]
      })
      }

      user_data 스크립트 올바른 작성법:
      SECRET=$(aws secretsmanager get-secret-value --secret-id "${data.aws_secretsmanager_secret.rorr.name}" \
      --query SecretString --output text --no-cli-pager)

      금지 패턴:
      rorr_secret_arn = "arn:aws:secretsmanager:...:secret:ai/rorr/${local.env}-*"  # 와일드카드 ARN 생성 금지
      --secret-id "$RORR_SECRET_ARN"  # 와일드카드가 포함된 ARN을 --secret-id로 전달 금지
   4. 저장 흐름

      - 최초·이후 모두: CI/CD가 Terraform apply 완료 후 terraform output으로 추출해 ai/rorr/{env}에 자동 저장
   5. 각 RORR 컴포넌트 IAM Role: ai/rorr/{env} ARN만 읽기 허용 (전체 허용 금지)
   6. Terraform output의 패스워드, 키 등 민감한 값은 반드시 sensitive = true 설정
   7. EC2 컴포넌트: 시작 시 aws secretsmanager get-secret-value 1회 호출 후 jq로 파싱하여 환경변수 export
   8. ECS 컴포넌트: Task Definition secrets 블록에서 ARN 전체를 RORR_SECRET_JSON으로 주입 후 코드에서 파싱
5. 프로젝트 가이드라인 (RORR 서비스 아키텍처)

   1. client - 유저
   2. client는 chrome extension과 web, mobile을 통해 접속
      - 경기 일정, 팀, 선수 정보 등 확인 가능
      - e-sports 실시간 경기 stat 확인 가능
      - AI 컴패니언을 통한 채팅 및 경기 응원
      - 스트릭 방식의 퀴즈
      - 통신 방법: 스케줄 정보는 rest api, 실시간 stat 정보는 websocket, 정적 에셋은 S3 + CloudFront
   3. DataCenter Collector
      - lol api에서 스케줄 정보, 팀, 선수 등 기초 정보 수집
      - lol api 접속 시 lol api url 및 인증 키 필요
      - 수집된 정보는 Raw Data 원본 그대로 DB에 저장
      - 실제 Data는 EC2 - PostgreSQL + timescale DB 이용
      - 추후 다른 게임, 다른 스포츠 장르도 수집할 수 있음
      - EC2로 구성
   4. LOL Data Collector
      - datacenter에서 lol data만 수집
      - data를 가공해 필요한 Data만 저장
      - 실제 Data는 EC2 - PostgreSQL + timescale DB 이용
   5. DataCenter live events
      - 실시간 경기 정보 수집
      - 수집된 정보는 Raw Data 원본 그대로 DB에 저장
      - 시스템간 Data 전달 시 내부적으로 MSK를 이용
      - 실제 Data는 EC2 - PostgreSQL + timescale DB를 이용해 저장
      - 추후 다른 게임, 다른 스포츠 장르도 수집할 수 있음
      - EC2로 구성
   6. LOL Live Events
      - DataCenter live events에서 LoL live events Data만 수집
      - data를 가공해 필요한 Data만 저장 및 client에 제공
      - 실제 Data는 EC2 - PostgreSQL + timescale DB 이용해 저장
      - EC2로 구성
   7. LoL AI
      - 경기 맥락을 읽어 고객에게 제공
      - 토큰 비용을 고려해 고객 맞춤형 응답보다는 경기 흐름에 관련된 정보 제공
      - 모든 client가 동일한 정보 수신
      - redis 등 캐시 이용
      - bedrock sonnet 4.6 사용
      - EC2로 구성
   8. Kafka UI
      - kafka 정보를 볼 수 있는 UI가 설치된 서버
      - EC2로 구성
   9. 메인 DB 서버
      - postgreSQL + timescale 설치
      - EC2로 구성
   10. 모든 프로그램들은 kafka or 메인 DB를 사용해서 Data 저장 및 전달
6. 환경별 인프라 스펙

   | 컴포넌트               | develop           | staging           | prod                |
   | ---------------------- | ----------------- | ----------------- | ------------------- |
   | DataCenter Collector   | t3a.small         | t3a.medium        | t3a.large           |
   | LOL Data Collector     | t3a.small         | t3a.medium        | t3a.large           |
   | DataCenter Live Events | t3a.small         | t3a.medium        | m6a.large           |
   | LOL Live Events        | t3a.small         | t3a.medium        | m6a.large           |
   | LoL AI                 | t3a.medium        | t3a.large         | m6a.large           |
   | Redis (ElastiCache)    | cache.t3.micro    | cache.t3.small    | 클러스터            |
   | Kafka UI               | t3a.small         | t3a.small         | t3a.medium          |
   | Main DB                | t3a.medium / 50GB | t3a.large / 100GB | m6a.xlarge / 500GB+ |
   | MSK 브로커 수          | 2                 | 2                 | 3+                  |
   |                        |                   |                   |                     |
7. Claude 자율 실행 권한 (AWS_INFRA_2 전용)

   이 섹션(AWS_INFRA_2)의 규칙을 따르는 작업은 사용자의 별도 확인 없이 자동으로 끝까지 완료한다.
   아래 작업은 모두 자동 실행 대상이다:

   1. AWS CLI 명령 실행
   2. GitHub API / gh CLI 실행 (GH_PAT 사용)
   3. git push, 브랜치 생성, PR 생성
   4. Terraform 실행 규칙

      - Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)
      - terraform apply는 최초 생성·이후 변경 모두 CI/CD만 수행한다 — Claude subprocess는 직접 apply하지 않는다
      - 최초 생성 시 GitHub Environments secrets에 ai/service/account/{env} 값이 등록돼 있으므로
        PR 머지 즉시 CI/CD가 해당 AWS 계정으로 terraform apply를 수행한다
      - CI/CD workflow에 terraform job을 반드시 포함한다
   5. Docker 빌드 및 ECR push (CI/CD가 수행)
      자동 실행 제외 대상: Git 머지, terraform 직접 apply
   6. GitHub Actions Secrets 등록 (gh secret set) | CLASSIC_PAT 사용

      1. GitHub Actions workflow를 생성하거나 수정할 때는 해당 workflow에서 참조하는 모든 secrets를 즉시 gh secret set으로 등록한다
      2. 배포에 필요한 전제 조건(버킷, secrets, 파라미터 등)은 확인 없이 한 번에 완료한다
      3. gh secret set 실행 시 반드시 export GH_TOKEN=$CLASSIC_PAT 설정 후 실행한다
      4. 이유: Fine-grained PAT(github_pat_ 접두사)는 GitHub Environment secrets API를 지원하지 않아 403 오류 발생. Classic PAT(ghp_ 접두사)만 사용 가능
   7. CI/CD 역할 범위
      CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포, terraform apply를 수행한다.
      Terraform 코드 생성 및 feature 브랜치 push, PR 생성은 Claude(MCP 서버)가 수행한다.
      CI/CD workflow에 terraform job을 반드시 포함한다.
      terraform apply는 최초 생성·이후 변경 모두 CI/CD만 수행한다 — Claude subprocess는 직접 apply하지 않는다.
8. terraform output 실행 및 Secrets Manager 저장 규칙

   1. terraform output 실행 시 반드시 --no-color 플래그를 포함한다

      terraform output -raw ecr_repository_url --no-color
   2. Python subprocess로 실행할 때도 동일하게 적용한다

      subprocess.run(['terraform', 'output', '-raw', key, '--no-color'], capture_output=True, ...)
   3. 저장 전 값 검증 필수: stdout 값에 줄바꿈 문자(\n) 또는 ANSI 이스케이프 코드가 포함되지 않았는지 확인

      - 검증 조건: len(value.splitlines()) == 1 이어야 한다
      - 줄바꿈이 포함된 값은 저장하지 않고 오류로 처리한다
9. Terraform S3 백엔드 설정 규칙

   backend "s3" 블록에 dynamodb_table 파라미터를 사용하지 않는다 — deprecated 파라미터이며 terraform output stdout에
   경고 메시지를 출력해 캡처 값을 오염시킨다.

   DynamoDB 상태 잠금이 필요할 경우 use_lockfile = true를 사용한다.

   backend "s3" {
   bucket       = "ai-mcp-tfstate-develop"
   key          = "mcp-server/develop/terraform.tfstate"
   region       = "us-east-1"
   use_lockfile = true
   encrypt      = true
   }
10. Docker 베이스 이미지 및 패키지 규칙

    1. Node.js 베이스 이미지는 node:24-slim을 사용한다 (Node 20은 2026년 4월 EOL, Node 24가 현재 Active LTS)
    2. apt-get install에 ca-certificates를 반드시 포함한다

       - slim 이미지에는 ca-certificates가 포함되어 있지 않아 curl HTTPS 연결이 실패함 (exit code 77)
       - Node.js 버전과 무관하게 *-slim 계열 이미지는 모두 동일한 문제가 발생한다
    3. 수정 방법 (apt-get에 ca-certificates 추가):

       FROM node:24-slim
       ...
       RUN apt-get update && apt-get install -y --no-install-recommends 
       curl unzip git less jq ca-certificates 
       && rm -rf /var/lib/apt/lists/*

    4. Claude CLI 설치 방법: npm install -g @anthropic-ai/claude-code 사용 (바이너리 직접 다운로드 방식 금지)
       - 이유: 바이너리 직접 다운로드 URL(예: storage.googleapis.com/anthropic-claude-cli/...)은
         실제로 존재하지 않아 curl 404 오류 발생 → Docker 빌드 실패
       - node:24-slim 베이스 이미지에 npm이 이미 포함되어 있으므로 별도 설치 없이 바로 사용 가능
       - Dockerfile 적용 예시:
         RUN npm install -g @anthropic-ai/claude-code
