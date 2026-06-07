# 01. 프로젝트 개요 및 선행 작업

## 프로젝트 목적

RORR 프로젝트를 서비스하기 위한 전용 AWS 인프라를 생성하는 MCP 서버를 만드는 프로젝트입니다.

## MCP 서버 코드 생성 전 선행 작업 체크리스트

코드 파일을 **단 하나라도 작성하기 전에** 아래 항목을 모두 완료해야 합니다.
완료되지 않은 상태에서 코드 생성을 시작하는 것은 금지합니다.

- [ ] 1. GitHub에 `develop`, `staging`, `prod` 브랜치 생성
- [ ] 2. `develop`, `staging`, `prod` 브랜치 보호 규칙 설정
- [ ] 3. GitHub Environments(`develop`/`staging`/`prod`) secrets 등록
- [ ] 4. Terraform apply로 인프라 직접 생성 (ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend)
- [ ] 5. `ai/mcp/{env}` 초기화 — terraform output 추출 후 `github_classic_pat`, `github_pat` 실제 값으로 교체 + 인프라 참조값 저장
- [ ] 6. `ai/claude/{env}` 초기화 — 빈 JSON(`{}`)으로 시크릿 생성 (실제 credentials는 사용자 `claude auth login` 후 자동 업로드)
- [ ] 7. `ai/rorr/{env}` 사전 생성 — 빈 JSON(`{}`) 또는 placeholder (RORR Terraform `data` 소스 참조용으로 코드 생성 전 반드시 AWS에 존재해야 함)
- [ ] 8. `ai/service/account/{env}` 초기화 — `.env`의 `RORR_DEV_AWS_ACCESS_KEY_ID`, `RORR_DEV_AWS_SECRET_ACCESS_KEY` 값 저장 (MCP server subprocess가 RORR 인프라 작업 시 사용, CI/CD는 GitHub Environments secrets를 사용)

### 실행 방법

- `gh` CLI와 `.env`의 `CLASSIC_PAT`를 사용해 Claude가 직접 수행
- `gh` CLI 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정
- `.env`가 없거나 필요한 토큰이 없으면 사용자에게 요청 후 수행
- `git init` 여부와 무관하게 `gh` CLI로 원격 저장소 작업 수행 가능

## 문서 폴더 구조

```
docs/
├── mcp-server-guidelines/     # 이 프로젝트 관련 문서 (주제별 파일 분리)
│   ├── 01-project-overview.md
│   ├── 02-common-rules.md
│   ├── 03-git-github-rules.md
│   ├── 04-secrets-manager.md
│   ├── 05-mcp-server-code.md
│   ├── 06-docker-ecs.md
│   └── 07-iam-cicd.md
├── projects-guidelines/       # MCP 서버가 생성할 서비스(RORR) 관련 지침
│   ├── 01-rorr-overview.md
│   ├── 02-rorr-infra-rules.md
│   ├── 03-rorr-secrets.md
│   └── 04-rorr-specs.md
└── infra-information/         # MCP 서버 인프라 정보
    └── .env.sample
```

### 문서 관리 원칙

- `docs/` 문서를 생성·수정할 때는 루트의 `CLAUDE.md`와 `README.md`를 반드시 함께 생성 또는 업데이트
- 상세 내용은 `docs/` 하위 파일로 분리하고, 두 파일에서 `docs/` 문서 목록을 링크로 제공
- `user_inits/user_init.md` 참고 시 반드시 `docs/` 폴더에 **별도 신규 파일**로 생성 (`user_init.md` 자체 수정 금지)

## 작업 기록 (workspaces/)

- 매번 작업 시 `workspaces/` 폴더에 이번 작업 내용, 실제 작업한 내용, 테스트 사항을 문서로 정리
- **기존 문서에 추가하지 않고 매번 새로 생성** (버전 관리)
