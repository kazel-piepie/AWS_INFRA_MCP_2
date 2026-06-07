# AWS_INFRA_MCP

RORR 프로젝트를 서비스하기 위한 전용 AWS 인프라를 생성하는 MCP 서버를 만드는 프로젝트입니다.

## 프로젝트 구조

```
aws_infra_mcp/
├── mcp-server/                   # MCP 서버 코드 (생성 예정)
│   ├── src/                      # MCP 서버 소스코드
│   ├── infra/                    # ECS 배포용 Terraform 코드
│   ├── docs/projects-guidelines/ # RORR 서비스 지침 (복사본)
│   ├── CLAUDE.md                 # Claude CLI 인프라 생성 지침
│   └── connect-mcp.sh            # ECS Exec 접속 스크립트
├── docs/
│   ├── mcp-server-guidelines/    # 이 프로젝트 관련 문서
│   ├── projects-guidelines/      # RORR 서비스 관련 지침
│   └── infra-information/        # 인프라 정보 및 .env.sample
├── workspaces/                   # 작업 기록 (매번 새 파일 생성)
├── user_inits/
│   └── user_init.md              # 원본 프로젝트 규칙 (절대 수정 금지)
├── CLAUDE.md                     # Claude 작업 지침 (문서 인덱스)
└── .env                          # 환경변수 (git 제외)
```

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

## 저장소

| 프로젝트 | 저장소 | 용도 |
|----------|--------|------|
| AWS_INFRA_MCP_2 | https://github.com/kazel-piepie/AWS_INFRA_MCP_2.git | MCP 서버 코드 및 인프라 |
| AWS_INFRA_2 | https://github.com/kazel-piepie/AWS_INFRA_2.git | RORR 서비스 인프라 코드 |
