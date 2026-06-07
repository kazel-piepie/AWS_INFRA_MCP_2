# AWS_INFRA_MCP 프로젝트 규칙 및 가이드

> **주의**: 이 파일은 user_init.md를 마크다운 형식으로 정리한 파일입니다.
> `user_init.md` 파일은 절대 삭제 및 수정 금지입니다.

## 목차

**공통 규칙**

1. [네이밍 규칙](#1-네이밍-규칙)
2. [AWS 리전](#2-aws-리전)
3. [브랜치 구성 및 환경별 AWS 계정](#3-브랜치-구성-및-환경별-aws-계정)
4. [자동 실행 범위](#4-자동-실행-범위)
5. [외부 DNS](#5-외부-dns)
6. [변경 시 PR 생성](#6-변경-시-pr-생성)
7. [Secrets Manager 규칙](#7-secrets-manager-규칙)
8. [인프라 사이즈](#8-인프라-사이즈)
9. [GIT 안전 규칙](#9-git-안전-규칙)
10. [AWS 리소스 description 규칙](#10-aws-리소스-description-규칙)
11. [GitHub Actions Workflow 검증](#11-github-actions-workflow-검증)
12. [CI/CD 배포 후 Secrets Manager 저장](#12-cicd-배포-후-secrets-manager-저장)

**MCP 서버 규칙**

13. [프로젝트 목적 및 문서 관리](#13-프로젝트-목적-및-문서-관리)
14. [user_init.md 보호](#14-user_initmd-보호)
15. [MCP 서버 코드 및 인프라 구조](#15-mcp-서버-코드-및-인프라-구조)
16. [Claude 호출 방법 및 인증](#16-claude-호출-방법-및-인증)
17. [Claude 인증 Secrets Manager 저장 방식](#17-claude-인증-secrets-manager-저장-방식)
18. [Git 관리 — MCP 서버 저장소](#18-git-관리--mcp-서버-저장소)
19. [Docker 빌드 규칙](#19-docker-빌드-규칙)
20. [ECS Exec 접속 — connect-mcp.sh](#20-ecs-exec-접속--connect-mcpsh)
21. [MCP 세션 관리](#21-mcp-세션-관리)
22. [mcp-server/CLAUDE.md 규칙](#22-mcp-serverclaudemd-규칙)
23. [Docker non-root 유저 (mcpuser)](#23-docker-non-root-유저-mcpuser)
24. [mcpuser 권한 범위](#24-mcpuser-권한-범위)
25. [ECS 환경변수 — GitHub PAT 주입](#25-ecs-환경변수--github-pat-주입)
26. [ECS Task Definition secrets 블록 규칙](#26-ecs-task-definition-secrets-블록-규칙)
27. [ECS Task IAM Role](#27-ecs-task-iam-role)
28. [최초 Secrets Manager 초기화](#28-최초-secrets-manager-초기화)
29. [claude-runner.ts 타임아웃](#29-claude-runnerts-타임아웃)
30. [server.tool() 콜백 파라미터 타입 명시 필수](#30-servertool-콜백-파라미터-타입-명시-필수)
31. [Claude 자율 실행 권한 (AWS_INFRA_MCP_2)](#31-claude-자율-실행-권한-aws_infra_mcp_2)
32. [terraform output 실행 및 Secrets Manager 저장 규칙](#39-terraform-output-실행-및-secrets-manager-저장-규칙)
33. [Terraform S3 백엔드 설정 규칙](#40-terraform-s3-백엔드-설정-규칙)
34. [Docker 베이스 이미지 및 패키지 규칙](#41-docker-베이스-이미지-및-패키지-규칙)
35. [MCP 서버 코드 생성 후 로컬 빌드 검증](#42-mcp-서버-코드-생성-후-로컬-빌드-검증)
36. [@modelcontextprotocol/sdk 버전 고정](#43-modelcontextprotocol-sdk-버전-고정)
37. [AWS 자격증명 접근 분리 원칙](#44-aws-자격증명-접근-분리-원칙)

**MCP 서버가 생성하는 코드 규칙**

32. [RORR 인프라 생성 역할 분리](#32-rorr-인프라-생성-역할-분리)
33. [RORR 최초 생성 선행 작업](#33-rorr-최초-생성-선행-작업)
34. [Git 관리 — 서비스 저장소 (AWS_INFRA_2)](#34-git-관리--서비스-저장소-aws_infra_2)
35. [RORR 서비스 Secrets Manager](#35-rorr-서비스-secrets-manager)
36. [RORR 서비스 아키텍처](#36-rorr-서비스-아키텍처)
37. [환경별 인프라 스펙](#37-환경별-인프라-스펙)
38. [Claude 자율 실행 권한 (AWS_INFRA_2)](#38-claude-자율-실행-권한-aws_infra_2)

---

# 공통 규칙

MCP 서버 및 MCP 서버가 생성하는 코드 모두에 적용되는 규칙입니다.

---

## 1. 네이밍 규칙

| 대상                                          | 규칙                         |
| --------------------------------------------- | ---------------------------- |
| MCP Server 및 MCP Server가 생성한 RORR 인프라 | 이름 앞에 `ai` prefix 필수 |
| MCP Server 구동에 필요한 인프라               | 이름에 `mcp` 포함          |
| 이 프로젝트에서 MCP 서버를 구동할 ECS        | 이름에 `infra` 포함 (추후 여러 ECS 생성 가능) |

---

## 2. AWS 리전

- AWS 리전은 반드시 `us-east-1` 사용

---

## 3. 브랜치 구성 및 환경별 AWS 계정

`develop`, `staging`, `prod` 브랜치는 미리 생성하고 환경변수도 각 브랜치에 맞게 구성합니다.

### 3-1. 브랜치 선행 생성 이유

- `staging`, `prod`는 직접 push 금지이지만, **빈 커밋으로 브랜치 자체는 반드시 먼저 생성**
- 이유: GitHub Environments에서 "해당 브랜치에서만 배포 허용" 규칙을 설정하려면 대상 브랜치가 GitHub에 존재해야 선택 가능

### 3-2. 환경별 AWS 계정 분리

각 브랜치의 GitHub Environment에 해당 환경 전용 AWS 계정 자격증명을 등록합니다.

| Environment | AWS 계정            |
| ----------- | ------------------- |
| develop     | develop AWS 계정 키 |
| staging     | staging AWS 계정 키 |
| prod        | prod AWS 계정 키    |

---

## 4. 자동 실행 범위

- **최종 단계는 PR 생성까지만 자동 승인**
- PR 이후 단계는 자동 승인 금지
- **PR 머지는 자동으로 하지 않음**

---

## 5. 외부 DNS

- 외부 DNS 관련 작업은 **사용자가 직접 관리**

---

## 6. 변경 시 PR 생성

- **프로젝트의 내용이 추가·변경·삭제되면 항상 PR까지 생성**

---

## 7. Secrets Manager 규칙

### 7-1. 용량 및 특성

| 항목          | 내용                                                             |
| ------------- | ---------------------------------------------------------------- |
| 최대 용량     | 64KB (SSM Parameter Store Advanced 8KB 대비 8배)                 |
| 저장 방식     | credentials 및 비밀값을 압축 없이 JSON 원문 그대로 저장          |
| 삭제 유예기간 | 기본 7일 (즉시 삭제 필요 시 `--force-delete-without-recovery`) |
| 비용          | 시크릿 4개 고정 → `$0.40 × 4 = $1.60/월` + API 호출료         |

### 7-2. 4-secret 구조 (역할별 분리)

| 시크릿 이름                    | 역할                          | 저장 정보                                |
| ------------------------------ | ----------------------------- | ---------------------------------------- |
| `ai/claude/{env}`            | Claude 인증 정보 전용         | `claude_credentials` (auth login 생성) |
| `ai/mcp/{env}`               | MCP 서버 인프라 참조 정보     | GitHub PAT, VPC, ECR, ECS 등             |
| `ai/rorr/{env}`              | RORR 서비스 접속 정보         | DB, Redis, MSK 등                        |
| `ai/service/account/{env}`   | RORR 서비스 배포용 AWS 자격증명 | Access Key, Secret Key                 |

**분리 이유:**

- Claude 인증 정보는 갱신 빈도가 높아 별도 시크릿으로 관리해야 불필요한 전체 시크릿 덮어쓰기를 방지
- RORR 컴포넌트는 접속 정보(`ai/rorr/{env}`)만 읽으면 되므로 인프라 생성 정보와 Claude 인증 정보에 접근 권한을 줄 필요가 없음
- AWS 계정 자격증명(`ai/service/account/{env}`)은 MCP server subprocess가 RORR 인프라 작업 시에만 사용하며 `ai/mcp/{env}`와 분리하여 접근 범위를 명확히 구분
- IAM 권한을 역할에 맞게 최소화 가능

### 7-3. SSM Parameter Store 사용 금지

- **SSM Parameter Store 사용 금지 — 반드시 Secrets Manager 사용**

---

## 8. 인프라 사이즈

| 항목      | 원칙                                                                   |
| --------- | ---------------------------------------------------------------------- |
| 환경 구분 | develop, staging, prod에 따라 스펙 정의                                |
| develop   | 테스트에 필요한 **최소 사항**으로 정의                            |
| 스펙 구성 | 명시적으로 구성                                                        |
| 프로세서  | x86 사용                                                               |
| 타입 선택 | 동일 스펙이면 비용이 낮은 타입 선택 (예: `t3.small` → `t3a.small`) |

---

## 9. GIT 안전 규칙

### 9-1. 기본 규칙

- **git은 `mcp-server/` 내부가 아닌 프로젝트 루트(`aws_infra_mcp/`)에서 초기화한다**
  - 추적 범위: `mcp-server/`, `docs/`, `user_inits/`, `CLAUDE.md`, `README.md` 등 전체
  - `mcp-server/` 내부에서 `git init` 금지 — `docs/`, `user_inits/` 등이 추적에서 누락됨
- git 브랜치 작업 전 반드시 **모든 파일을 먼저 커밋**
- `user_init.md` 파일은 **최초 커밋에 반드시 포함**
- `staging` / `prod` 브랜치에 직접 push 금지 → 반드시 **merge로만 코드 이동**
- git push 실행 전 대상 브랜치가 `feature/*`인지 반드시 확인
- `.env`는 git에 동기화하지 않음
- `git user.email`: `kazel@piepie.co` / `user.name`: `kazel-piepie`

### 9-2. 브랜치 생성 순서 (반드시 이 순서 준수)

```
1단계: origin/main에서 develop 분기 → push
2단계: develop에서 staging 분기 → 빈 커밋 → push
3단계: develop에서 prod 분기 → 빈 커밋 → push
4단계: develop에서 feature/* 분기 → 파일 추가/수정 → push → PR
```

> **금지**: `feature/*`에 파일을 커밋한 뒤 거기서 `develop`/`staging`/`prod`를 분기하면 모든 파일이 세 브랜치에 그대로 포함됨
>
> **핵심 원칙**: `develop`/`staging`/`prod`는 반드시 `origin/main` 기반으로 생성. `feature/*`는 그 이후 `develop`에서 분기

---

## 10. AWS 리소스 description 규칙

- description 필드에는 반드시 **영문(ASCII)만 사용** (한글 입력 시 Terraform apply 오류 발생)
- **허용 문자**: `0-9 A-Z a-z _ . : / ( ) # , @ [ ] + = & ; { } ! $ * -`
- **금지**: 한글, 일본어, 중국어 등 멀티바이트 문자
- **적용 범위**: `aws_security_group`, `aws_iam_policy`, `aws_iam_role`, `aws_lb_target_group` 등 모든 AWS 리소스의 description 속성
- **Terraform HCL 속성 구분에 `;` 사용 금지** (배열 원소 사이 `,`는 HCL 필수 문법이므로 반드시 포함)

---

## 11. GitHub Actions Workflow 검증

1. workflow 파일 생성·수정 후 반드시 **로컬에서 YAML 문법 검증**

   ```bash
   # actionlint 사용 (권장)
   actionlint .github/workflows/deploy.yml

   # 또는 yamllint 사용
   yamllint .github/workflows/deploy.yml
   ```
2. 검증 없이 push·PR 생성 **금지**
3. **금지 패턴**: 동일 step 내 같은 키(`env:`, `with:` 등) 중복 선언
4. 각 job에 `environment:` 키 **필수**

   ```yaml
   jobs:
     terraform:
       environment: ${{ needs.setup.outputs.environment }}  # ← 이 줄 필수
   ```

   > `environment:` 키가 없으면 Environment secrets를 참조하지 않음

---

## 12. CI/CD 배포 후 Secrets Manager 저장

### 12-1. 원칙

Terraform apply 완료 후 생성된 인프라의 접속 정보(호스트, 포트, 패스워드, ARN 등)는 반드시 Secrets Manager에 저장합니다.

### 12-2. 저장 흐름

**RORR 인프라 — CI/CD 저장 흐름** (MCP 서버가 생성하는 RORR 인프라에 적용):

```
GitHub Actions workflow
  → Terraform apply 완료
    → terraform output으로 접속 정보 추출
      → aws secretsmanager put-secret-value로 Secrets Manager에 저장
        → 각 서비스(EC2/ECS)가 시작 시 읽어서 사용
```

**MCP 서버 인프라 — Claude 직접 수행** (CI/CD가 아닌 Claude가 직접 처리):

```
Claude가 이 프로젝트에서 Terraform apply 직접 수행
  → terraform output으로 접속 정보 추출
    → aws secretsmanager put-secret-value로 Secrets Manager에 저장
      → CI/CD docker job에서 Secrets Manager를 읽어 ECR push 및 ECS 배포
```

### 12-3. Terraform output 민감 정보 처리

- 패스워드, 키 등 민감한 output은 반드시 `sensitive = true` 설정
- 이유: `sensitive = true` 없으면 로그에 평문 노출

### 12-4. IAM 권한 원칙

| IAM Role                  | 허용 범위                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| MCP 서버 Task Role        | `ai/mcp/{env}`, `ai/claude/{env}`, `ai/service/account/{env}` ARN 읽기 허용              |
| MCP 서버 Task Role        | `ai/claude/{env}` ARN 쓰기(PutSecretValue) 허용 — credential-sync 업로드용                 |
| RORR 각 컴포넌트 IAM Role | `ai/rorr/{env}` ARN만 읽기 허용 (mcp·claude·service/account 시크릿 접근 불가)             |

- 전체 허용(`Resource: "*"`) 금지, ARN 단위로 제한

### 12-5. GitHub Environments 구성 규칙

1. GitHub repo Settings → Environments에서 `develop`, `staging`, `prod` 각각 생성
2. 각 Environment에 브랜치 배포 규칙 설정

   | Environment | 허용 브랜치                    |
   | ----------- | ------------------------------ |
   | develop     | develop 브랜치에서만 배포 허용 |
   | staging     | staging 브랜치에서만 배포 허용 |
   | prod        | prod 브랜치에서만 배포 허용    |

3. 환경별 secrets는 `--env <environment>` 옵션으로 Environment secrets 등록 (**repository-level secrets 사용 금지**)
4. `prod` Environment에는 **Required reviewer 설정 권장** (담당자 승인 없이 배포 차단)
5. `gh secret set` 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

> **등록 불필요 항목 — 이유**
>
> | 항목                    | 이유                                                                                                                                                               |
> | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
> | `ACM_CERTIFICATE_ARN` | Terraform `data "aws_acm_certificate"`로 `*.rorr.club` 인증서를 AWS에서 자동 조회 — AWS에 이미 존재하므로 Secret 등록 불필요                                  |
> | `MCP_SECRET_ARN`      | Terraform이 `ai/mcp/{env}` 시크릿을 직접 생성하고 내부에서 ARN 참조 — 배포 전 존재하지 않아 사전 등록 불가, `terraform output mcp_secret_arn`으로 추출해 사용 |

---

# MCP 서버 규칙

AWS_INFRA_MCP_2 프로젝트 전용 규칙입니다.

---

## 13. 프로젝트 목적 및 문서 관리

### 13-1. 프로젝트 목적

RORR 프로젝트를 서비스하기 위한 전용 AWS 인프라를 생성하는 MCP 서버를 만드는 프로젝트

### 13-2. 문서 폴더 구조

```
docs/
├── mcp-server-guidelines/     # 이 프로젝트 관련 문서 — 주제별로 파일 분리
│   ├── 01-project-overview.md
│   ├── 02-mcp-server.md
│   └── ...
├── projects-guidelines/       # MCP 서버가 생성할 서비스 관련 지침
└── infra-information/         # MCP 서버 인프라 정보 (.env.sample 포함)
```

### 13-3. 문서 관리 원칙

- `docs/` 문서를 생성·수정할 때는 루트의 `CLAUDE.md`와 `README.md`를 반드시 함께 생성 또는 업데이트
- 상세 내용은 `docs/` 하위 파일로 분리하고, 두 파일에서 `docs/` 문서 목록을 링크로 제공

### 13-4. MCP 서버 코드 생성 전 Claude가 반드시 직접 수행해야 하는 선행 작업

이 항목들은 코드 파일을 단 하나라도 작성하기 전에 완료해야 한다.
완료되지 않은 상태에서 코드 생성을 시작하는 것은 금지한다.

1. GitHub에 develop, staging, prod 브랜치 생성
2. develop, staging, prod 브랜치 보호 규칙 설정
3. GitHub Environments(develop/staging/prod) secrets 등록
4. Terraform apply로 인프라 직접 생성 (ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등)
5. Secrets Manager(`ai/mcp/{env}`) 초기화 — Terraform output 추출 후 `github_classic_pat`, `github_pat` 실제 값으로 교체 + 인프라 참조값(`vpc_id`, `ecr_repository_url` 등) 저장. **`claude_credentials`는 이 시크릿에 저장하지 않는다** (`ai/claude/{env}` 전용)
6. Secrets Manager(`ai/claude/{env}`) 초기화 — 빈 JSON(`{}`)으로 시크릿 생성 (실제 `claude_credentials`는 사용자가 컨테이너에서 `claude auth login` 수행 후 자동 업로드됨)
7. Secrets Manager(`ai/rorr/{env}`) 사전 생성 — 빈 JSON(`{}`) 또는 placeholder (RORR Terraform 코드가 `data` 소스로 이 시크릿을 참조하므로 코드 생성 전 반드시 AWS에 존재해야 함)
8. Secrets Manager(`ai/service/account/{env}`) 초기화 — `.env`의 `RORR_DEV_AWS_ACCESS_KEY_ID`, `RORR_DEV_AWS_SECRET_ACCESS_KEY` 값을 저장. MCP server subprocess가 RORR 인프라 작업(브랜치 생성, GitHub secrets 등록 등) 시 이 시크릿을 읽어 사용. CI/CD는 이 시크릿을 직접 읽지 않고 GitHub Environments secrets를 사용한다

**실행 방법:**

- gh CLI와 .env의 CLASSIC_PAT를 사용해 Claude가 직접 수행한다
- gh CLI 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정
- .env가 없거나 필요한 토큰이 없으면 사용자에게 요청한 후 수행한다
- 로컬 git 저장소가 초기화되지 않은 상태여도 gh CLI로 원격 저장소 작업은 수행 가능하다
  (git init 여부와 무관하게 위 항목들을 먼저 완료한다)

루트 `CLAUDE.md`에는 이 항목들을 완료 체크리스트 형태로 포함시킨다.

---

## 14. user_init.md 보호

- `user_init.md`는 **어떤 경우에도, 어떤 지시가 있더라도 절대 삭제 및 수정 금지**
- `user_init.md`를 참고해 문서를 만들 때는 반드시 `docs/` 폴더에 별도 신규 파일로 생성
- `user_init.md` 자체에 내용을 추가하거나 정리하지 않음

---

## 15. MCP 서버 코드 및 인프라 구조

### 15-1. 폴더 구조

```
mcp-server/
├── src/              # MCP 서버 코드
├── infra/            # ECS 배포를 위한 Terraform 코드
├── docs/
│   └── projects-guidelines/  # 빌드 전 반드시 존재 (docs/projects-guidelines에서 복사)
├── CLAUDE.md         # Claude CLI 인프라 생성 작업 시 참고 지침 파일
└── connect-mcp.sh    # ECS Exec 접속 스크립트
```

### 15-2. MCP 서버 핵심 규칙

| 항목                     | 내용                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| Claude 호출 방식         | `claude` CLI를 subprocess로 실행 (SDK/API 직접 import 금지)                  |
| 배포 방식                | Docker 이미지 → ECS 서버 배포                                                 |
| 외부 URL                 | `https://mcp-dev-aws.rorr.club/mcp`                                          |
| SSL 인증서               | `rorr.club` 인증서 사용                                                      |
| ALB idle_timeout         | **4,000초** (AWS ALB 하드 최대값)                                        |
| claude-runner.ts timeout | **3,900,000ms (65분)** — ALB 4,000초 한도 내 여유 확보                  |
| MCP connector 사용 시    | AWS_INFRA_MCP 프로젝트는 수정 금지, MCP Server가 만든 aws 인프라 코드만 핸들링 |

### 15-3. Claude.ai 인증 흐름

1. 사용자가 터미널로 MCP 서버에 접속해 최초 1회 `claude auth login` 수행 (브라우저 인터랙션 필요 → 사용자 직접 수행)
2. 인증 정보가 업데이트되면 Secrets Manager에 자동 업로드 (credential-sync 5초 폴링)
3. MCP 서버 재배포 시 Secrets Manager에서 인증 정보를 로컬에 동기화

### 15-4. Docker 내부 설치 항목

- AWS CLI
- claude CLI — **반드시 `npm install -g @anthropic-ai/claude-code`로 설치** (바이너리 직접 다운로드 금지)
- `less` (AWS CLI pager 오류 방지)
- git secret 등록에 필요한 프로그램

### 15-5. 기타 규칙

- **workspaces** 폴더에 매번 작업 기록 문서 생성 (기존 문서에 추가 금지, 매번 새로 생성)
- MCP 서버 관련 정보는 `docs/infra-information/` 폴더에 MD 파일 및 `.env.sample`로 정리
- **담당자가 PR 머지 시 Docker 이미지가 빌드되어 ECS에 자동 배포되게 CI/CD 구성.
  인프라(ECR, ECS 클러스터, VPC, ALB 등)는 CI/CD가 아닌 Claude가 이 프로젝트에서 직접 생성**
- `mcp-server` 폴더 생성 시 `docs/projects-guidelines` 폴더를 `mcp-server` 폴더에 복사
- `.env`의 AWS 자격증명은 MCP 서버 자체 인프라(develop 계정) 관리용
- RORR 서비스 인프라 배포는 CI/CD가 각 환경의 GitHub Environment Secrets를 사용해 처리

---

## 16. Claude 호출 방법 및 인증

### 16-1. 호출 방식

- MCP 서버에서 Claude 호출 시 **반드시 `claude` CLI를 subprocess로 실행**
- `@anthropic-ai/sdk`, `@anthropic-ai/claude-code` SDK를 서버 코드에서 직접 import **금지**
- 인증은 `claude auth login`으로 생성된 `~/.claude/.credentials.json` 사용 (API Key 환경 변수 사용 금지)

### 16-2. Claude 인증 파일 경로

- **실제 경로**: `~/.claude/.credentials.json`
- `watchFile`, 백업/복원 로직 모두 `~/.claude/.credentials.json` 대상으로 작성

### 16-3. subprocess 실행 방법 — spawn 필수

- `child_process.spawn`을 사용하며 프롬프트는 **stdin으로 전달**한다 (`execFile` 금지)
- spawn으로 claude 프로세스를 시작한 뒤 `child.stdin.write(prompt)` → `child.stdin.end()` 순서로 전달
- `stdio: ['pipe', 'pipe', 'pipe']` 설정 필수 — stdin/stdout/stderr 모두 pipe로 연결해야 한다

  > **이유**: `execFile`은 stdin piping이 불가능하여 최신 Claude CLI에서 'no stdin data received' 경고와 함께 exit code 1로 실패한다

  **올바른 예시:**

  ```typescript
  const child = spawn('claude', ['--dangerously-skip-permissions', '--output-format', 'text'], {
    cwd: opts.cwd ?? '/tmp',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.write(prompt);
  child.stdin.end();
  ```

---

## 17. Claude 인증 Secrets Manager 저장 방식

### 17-1. 저장 원칙

| 항목                | 내용                                                               |
| ------------------- | ------------------------------------------------------------------ |
| 저장 대상           | `~/.claude/.credentials.json` 전체                               |
| 복원 방식           | `~/.claude/.credentials.json` 전체 덮어쓰기                      |
| watchFile 폴링 간격 | **5초** (10초는 너무 느림)                                   |
| 저장소              | **AWS Secrets Manager** 사용 (SSM Parameter Store 사용 금지) |
| 코드                | `SSMClient` 대신 `SecretsManagerClient` 사용                   |

### 17-2. 시크릿 1 — `ai/claude/{env}`: Claude 인증 정보 전용

```json
{
  "claude_credentials": "{ ...~/.claude/.credentials.json 전체 내용... }"
}
```

- `credential-sync`가 5초 폴링으로 감지하여 이 시크릿만 업데이트
- ECS Task Definition에서 `CLAUDE_SECRET_JSON` 환경변수로 주입

### 17-3. 시크릿 2 — `ai/mcp/{env}`: MCP 서버 인프라 참조 정보

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
- `external_url`, `vpc_id` 등 인프라 참조 정보: Terraform apply 후 output에서 추출해 **Claude가 직접 저장**
- **`claude_credentials`는 이 시크릿에 저장하지 않는다** (`ai/claude/{env}` 전용)
- ECS Task Definition에서 `MCP_SECRET_JSON` 환경변수로 주입

### 17-4. 시크릿 3 — `ai/rorr/{env}`: RORR 서비스 접속 정보

- JSON 구조: `db_host`, `db_password`, `redis_host`, `msk_bootstrap_servers` 등 (34항 참조)
- CI/CD가 Terraform apply 완료 후 terraform output으로 추출하여 저장
- RORR 각 컴포넌트가 시작 시 이 시크릿만 읽어 접속 정보를 얻는다

### 17-5. 시크릿 4 — `ai/service/account/{env}`: RORR 서비스 배포용 AWS 자격증명

```json
{
  "aws_access_key_id":     "AKIAXXXXXX",
  "aws_secret_access_key": "xxxxxx",
  "aws_region":            "us-east-1"
}
```

- `.env`의 `RORR_DEV_AWS_*` 값을 MCP 서버 초기 설정 시 저장한다
- MCP server subprocess가 RORR 인프라 작업 시 이 시크릿을 읽어 AWS API 호출 및 GitHub secrets 등록에 사용한다
- CI/CD(GitHub Actions)는 이 시크릿을 직접 읽지 않는다 — GitHub Environments secrets에서 별도로 읽는다
- **ECS Task Definition secrets 블록에 포함하지 않는다** — 런타임에 AWS SDK로 직접 조회한다

> **주의**: `ai/mcp/{env}`와 `ai/claude/{env}`는 별도 시크릿이므로 IAM 권한을 역할에 맞게 최소화할 수 있다

---

## 18. Git 관리 — MCP 서버 저장소

- **저장소**: `https://github.com/kazel-piepie/AWS_INFRA_MCP_2.git`
- **git user.email**: `kazel@piepie.co` / **user.name**: `kazel-piepie`
- `.env`는 git에 동기화하지 않음

### 18-1. 브랜치 전략

| 브랜치        | Push 규칙                      |
| ------------- | ------------------------------ |
| `develop`   | PR merge만 허용                |
| `staging`   | 직접 push 금지 → merge만 허용 |
| `prod`      | 직접 push 금지 → merge만 허용 |
| `feature/*` | git push 실행 전 반드시 확인   |

- merge 대상은 항상 `develop`만 머지 가능하게 설정

### 18-2. PR 생성 순서

```
1. 신규 파일 작성
2. git add . (user_init.md 포함 전체 스테이징)
3. git commit (현재 브랜치에서)
4. git push origin <feature-branch>
5. GitHub API 또는 gh CLI로 PR 생성 (develop 대상)
```

> `git add .`는 **프로젝트 루트(`aws_infra_mcp/`)에서 실행**한다.
> `mcp-server/` 안에서 실행하면 `docs/`, `user_inits/` 등이 누락된다.

- `git checkout -f`는 기존 파일이 있는 상태에서 **절대 사용 금지**

---

## 19. Docker 빌드 규칙

### 19-1. 빌드 원칙

- `package.json`이 없을 때도 빌드되도록 처리
- `npm ci`는 `package-lock.json`이 없으면 실패 → **`npm install` 사용**
- 빌더 스테이지와 런타임 스테이지를 **반드시 분리**

| 스테이지 | 명령                       | 이유                                            |
| -------- | -------------------------- | ----------------------------------------------- |
| 빌더     | `npm install`            | devDependencies 포함 (TypeScript 컴파일에 필요) |
| 런타임   | `npm install --omit=dev` | prod 의존성만 포함                              |

### 19-2. CI/CD 작업 순서

```
docker job → Docker 빌드 → ECR push → ECS 서비스 업데이트
```

> **ECR 저장소는 CI/CD 실행 전 Claude가 직접 생성해야 한다. CI/CD에 terraform job을 포함하지 않는다.**

### 19-3. AWS CLI pager 오류 방지

Docker 컨테이너 내부에서 AWS CLI 실행 시 `less`가 없으면 pager를 찾지 못해 실패합니다.

**해결 방법 (택일)**:

1. Dockerfile에 `less` 설치 추가
2. AWS CLI 호출 시 `--no-cli-pager` 옵션 추가
3. 환경변수 `AWS_PAGER=""` 설정

> Node.js subprocess로 AWS CLI를 호출할 때는 env에 `AWS_PAGER: ''` 반드시 포함

### 19-4. 빌드 전 사전 조건

- `/docs/projects-guidelines/` 폴더가 `mcp-server`에 반드시 존재해야 함

### 19-5. CI/CD job 간 인프라 참조값 전달 규칙

`docker` job에서 ECR URL 등 인프라 참조값이 필요할 때는 **Secrets Manager(`ai/mcp/{env}`)에서 직접 조회**한다.

```yaml
- name: Get ECR URL from Secrets Manager
  id: get_ecr
  run: |
    ECR_URL=$(aws secretsmanager get-secret-value \
      --secret-id "ai/mcp/${{ needs.setup.outputs.environment }}" \
      --query SecretString --output text | jq -r '.ecr_repository_url')
    echo "ecr_url=$ECR_URL" >> "$GITHUB_OUTPUT"
```

- Claude가 직접 수행한 Terraform apply + Secrets Manager 초기화 완료 시점에 `ecr_repository_url`이 이미 저장되어 있음
- `ecs_cluster_name`, `ecs_service_name` 등 단순 이름값은 job output 전달 가능

---

## 20. ECS Exec 접속 — connect-mcp.sh

### 20-1. 사전 요구사항

- `aws ecs execute-command` 실행 시 `session-manager-plugin` 필수

**WSL 설치 방법**:

```bash
curl -fsSL https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb -o /tmp/ssm.deb
dpkg -x /tmp/ssm.deb /tmp/ssm-plugin
cp /tmp/ssm-plugin/usr/local/sessionmanagerplugin/bin/session-manager-plugin ~/bin/
export PATH="$HOME/bin:$PATH"
```

### 20-2. connect-mcp.sh 파일 규칙

- **위치**: `mcp-server/connect-mcp.sh`
- MCP 서버 코드 생성 시 **반드시 생성**

**포함 기능**:

| 기능                        | 설명                                          |
| --------------------------- | --------------------------------------------- |
| ECS Task ARN 자동 조회      | `aws ecs list-tasks` 실행                   |
| ECS execute-command 실행    | cluster, task, container 자동 지정            |
| session-manager-plugin 검사 | 미설치 시 설치 안내 출력                      |
| `.env` 자동 로드          | 상위 디렉토리에서 `.env` 탐색 및 `source` |

- `.env`가 없으면 "AWS credentials not found in .env" 경고 출력 후 기존 환경변수로 계속 진행

### 20-3. Claude 인증 — mcpuser로 전환 후 수행

> ⚠️ **ECS Exec은 항상 root로 접속됩니다.**
> SSM 에이전트가 root로 실행되므로 Dockerfile의 `USER mcpuser`를 무시합니다.
> root에서 그대로 `claude auth login`하면 `/root/.claude/.credentials.json`에 저장되지만,
> MCP 서버(mcpuser)는 `/home/mcpuser/.claude/.credentials.json`을 바라보므로
> credential-sync가 변경을 감지하지 못해 Secrets Manager에 업로드되지 않습니다.

**정상 방법 — mcpuser로 전환 후 인증:**

```bash
# connect-mcp.sh 접속 직후 (root 상태)
su -s /bin/bash mcpuser    # mcpuser로 전환
claude auth login           # /home/mcpuser/.claude/.credentials.json 에 저장
                            # credential-sync 5초 폴링으로 감지 → Secrets Manager 자동 업로드
```

**su 실패 시 대안 — root에서 인증 후 수동 복사:**

```bash
claude auth login
cp /root/.claude/.credentials.json /home/mcpuser/.claude/.credentials.json
chown mcpuser:mcpuser /home/mcpuser/.claude/.credentials.json
chmod 600 /home/mcpuser/.claude/.credentials.json
# credential-sync가 파일 변경 감지 후 Secrets Manager 자동 업로드
```

---

## 21. MCP 세션 관리

- `StreamableHTTPServerTransport`의 `sessionId`는 `handleRequest` 실행 중에 할당됨
- `sessions.set()`은 반드시 `handleRequest` **이후**에 호출
  - 이전에 호출하면 `sessionId`가 `null`이어서 세션이 저장되지 않음

---

## 22. mcp-server/CLAUDE.md 규칙

- MCP 서버 코드 생성 또는 수정 시 반드시 `mcp-server/CLAUDE.md`를 함께 생성/업데이트
- `mcp-server/CLAUDE.md`는 Claude CLI가 인프라 생성 작업 시 참고하는 지침 파일

**포함 내용**:

1. 인프라 규칙
2. RORR 서비스 아키텍처 전체 (RORR 관련 내용 반드시 포함)

- Dockerfile에 반드시 포함: `COPY CLAUDE.md ./`

---

## 23. Docker non-root 유저 (mcpuser)

### 23-1. 발생 오류

ECS Fargate 컨테이너가 root 유저로 실행될 경우 Claude CLI의 `--dangerously-skip-permissions` 플래그 사용이 차단됩니다.

```
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
```

**원인**: MCP 서버가 내부적으로 `claude -p '...' --dangerously-skip-permissions`를 subprocess로 실행하는데, 컨테이너가 root로 동작하면 Claude CLI가 이를 거부합니다.

### 23-2. 해결 방법 — Dockerfile non-root 유저 설정

```dockerfile
RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser
RUN mkdir -p /home/mcpuser/.claude && chown -R mcpuser:mcpuser /app /home/mcpuser
ENV HOME=/home/mcpuser
USER mcpuser
```

- **적용 위치**: Dockerfile의 런타임 스테이지 마지막 부분 (CMD 또는 ENTRYPOINT 바로 위)
- **HOME 환경변수 명시 필수**: `ENV HOME=/home/mcpuser` 설정해야 `~/.claude/.credentials.json` 경로가 올바르게 해석됨
- ECS Task Definition의 `user` 필드를 별도 설정하지 않아도 Dockerfile의 `USER` 지시어만으로 충분

---

## 24. mcpuser 권한 범위

### 24-1. sudo/어드민 권한 절대 부여 금지

- **이유**: Claude CLI는 root 또는 sudo 권한을 감지하면 `--dangerously-skip-permissions` 플래그를 하드코딩으로 차단
- `mcpuser + sudo` = root와 동일한 오류 재발생
- 반드시 **순수 non-root 유저**로만 운영

### 24-2. mcpuser 필요 권한 범위

| 경로                                                    | 권한                        | 이유                                                                  |
| ------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `/app` 전체                                           | 읽기 + 실행                 | Node.js 앱 실행, CLAUDE.md / docs 파일 읽기                           |
| `/home/mcpuser` 전체                                  | 읽기 + 쓰기                 | credentials.json 저장/복원, claude CLI가 ~/.config 등 생성            |
| `/home/mcpuser/.claude/`                              | 읽기 + 쓰기 + 디렉토리 생성 | Secrets Manager 복원 시 mkdirSync, writeFileSync, 5초 폴링 statSync   |
| `/tmp`                                                | 읽기 + 쓰기 + 실행          | git clone, terraform init 임시 작업공간 (기본 1777, 별도 조치 불필요) |
| 글로벌 바이너리 (claude, aws, terraform, git, gh, node) | 실행                        | root로 설치 시 기본 755, 별도 조치 불필요                             |

### 24-3. Dockerfile 소유권 설정

```dockerfile
RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser
RUN chown -R mcpuser:mcpuser /app /home/mcpuser
ENV HOME=/home/mcpuser
USER mcpuser
```

> mcpuser로 전환한 뒤 실행되는 claude subprocess는 mcpuser 권한 그대로 동작합니다.
> 외부 서비스(GitHub, AWS)에 대한 인증은 환경변수(`AWS_ACCESS_KEY_ID`, `GH_TOKEN` 등)로 처리되므로 OS 권한과 무관합니다.

---

## 25. ECS 환경변수 — GitHub PAT 주입

### 25-1. 발생 오류

RORR 인프라 생성 툴 호출 시 git push 및 PR 생성 단계에서 GitHub 인증 실패:

```
could not read Username for 'https://github.com' — CLASSIC_PAT / GH_TOKEN 미설정
```

**원인**: ECS Task Definition 환경변수에 GitHub PAT가 포함되지 않음. 통합 시크릿 `ai/mcp/{env}` 안에 `github_classic_pat`, `github_pat` 속성이 있지만 컨테이너 환경변수로 주입되지 않은 상태.

### 25-2. 해결 방법

통합 시크릿 전체를 `MCP_SECRET_JSON` 환경변수로 주입 후 애플리케이션 코드에서 JSON 파싱하여 추출합니다.

- **ARN#key 방식 사용 금지** — ValidationException(400) 발생 (26번 항목 참고)
- `valueFrom`에 시크릿 ARN만 지정 → `MCP_SECRET_JSON` 환경변수로 전체 JSON 수신
- 코드에서 `JSON.parse(process.env.MCP_SECRET_JSON)` 후 `github_classic_pat`, `github_pat` 추출

### 25-3. MCP_SECRET_JSON 미존재 시 .env 폴백 규칙

ECS 컨테이너 최초 배포 또는 로컬 개발 환경에서 `MCP_SECRET_JSON` 환경변수가 없을 수 있다.
이 경우 애플리케이션 코드는 `.env` 파일의 값을 폴백으로 사용한다.

| 조건                     | 동작                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `MCP_SECRET_JSON` 있음 | JSON 파싱 후 사용 (ECS 운영 환경 — 정상 경로)                                                     |
| `MCP_SECRET_JSON` 없음 | `.env`의 `AWS_ACCESS_KEY_ID`, `CLASSIC_PAT`, `GH_PAT` 등 직접 로드 (초기 배포 / 로컬 개발) |

적용 대상:

- `secrets-manager.ts` — `getMcpSecret()`: `MCP_SECRET_JSON` 없으면 `.env` 값으로 구성한 객체 반환
- `credential-sync.ts` — `restoreCredentials()`: `claude_credentials` 없으면 복원 건너뜀 (정상)
- `create-rorr-infra.ts` — `github_pat` 없으면 `.env`의 `GH_PAT` 사용

### 25-4. claude subprocess 내부 gh CLI 인증 순서

| 순서 | 명령                                 | 용도                                           |
| ---- | ------------------------------------ | ---------------------------------------------- |
| 1    | `export GH_TOKEN=$CLASSIC_PAT`     | Environment secrets 등록용 (`gh secret set`) |
| 2    | `export GH_TOKEN=$GH_PAT`          | PR 생성 등 일반 GitHub API용                   |
| 3    | `https://${GH_PAT}@github.com/...` | git push 시 remote URL에 PAT 포함              |

- 적용 범위: develop / staging / prod 모든 환경에 동일하게 적용

---

## 26. ECS Task Definition secrets 블록 규칙

### 26-1. 발생 오류

ECS 태스크가 시작 전 즉시 `TaskFailedToStart`로 실패:

```
ValidationException: Invalid name. Must be a valid name containing alphanumeric characters,
or any of the following: -/_+=.@!
```

**원인**: ECS secrets 블록 `valueFrom`에 `ARN#json_key` 형식을 사용했을 때 발생.

### 26-2. 올바른 방법

시크릿 전체를 단일 환경변수로 주입 후 애플리케이션 코드에서 JSON 파싱합니다.

**Terraform `ecs.tf`**:

```hcl
secrets = [
  { name = "MCP_SECRET_JSON",    valueFrom = aws_secretsmanager_secret.mcp.arn    },
  { name = "CLAUDE_SECRET_JSON", valueFrom = aws_secretsmanager_secret.claude.arn },
]
```

**애플리케이션 코드 (Node.js)**:

```typescript
const mcpSecret    = JSON.parse(process.env.MCP_SECRET_JSON    ?? '{}');
const claudeSecret = JSON.parse(process.env.CLAUDE_SECRET_JSON ?? '{}');
const classicPat   = mcpSecret.github_classic_pat;
const ghPat        = mcpSecret.github_pat;
const claudeCreds  = claudeSecret.claude_credentials;
```

> **ECS secrets 블록 `valueFrom`에 `#key` 또는 `:key::` 형식 절대 사용 금지**

### 26-3. ai/service/account/{env} 주입 규칙

- `ai/service/account/{env}`는 **ECS Task Definition secrets 블록에 포함하지 않는다**
- 컨테이너 시작 시 주입하지 않고 `create_rorr_infra` 툴 실행 시 AWS SDK로 직접 조회한다

---

## 27. ECS Task IAM Role

### 27-1. 발생 오류

`get_infra_status` 툴 호출 시 모든 AWS 리소스 조회가 IAM 권한 오류로 차단:

```
UnauthorizedOperation (ec2:DescribeInstances), AccessDeniedException (ecs:ListClusters 등)
```

**원인**: ECS Task Role에 RORR 인프라 리소스를 조회할 수 있는 IAM 정책이 부여되지 않음.

### 27-2. Task Role 최소 읽기 권한

RORR 인프라 **생성** 권한은 불필요 — apply는 CI/CD가 담당.

```
ec2:DescribeInstances
ecs:ListClusters / DescribeClusters / ListServices / DescribeServices
kafka:ListClusters / DescribeCluster
elasticache:DescribeCacheClusters
elasticloadbalancing:DescribeLoadBalancers / DescribeTargetGroups
s3:ListBucket
cloudfront:ListDistributions
```

**Secrets Manager 읽기 권한** (ARN 단위 제한):

```
secretsmanager:GetSecretValue
  → ai/mcp/{env}, ai/claude/{env}, ai/service/account/{env} ARN으로만 제한
```

**Secrets Manager 쓰기 권한** (`ai/claude/{env}` ARN으로만 제한):

```
secretsmanager:PutSecretValue → ai/claude/{env} ARN으로만 제한
```

> **이유**: `credential-sync`가 `claude auth login` 후 인증 정보를 `ai/claude/{env}`에 업로드하려면 반드시 필요하다.
> 이 권한이 없으면 `AccessDeniedException: not authorized to perform: secretsmanager:PutSecretValue` 오류 발생.

- `ai/rorr/*` 접근은 RORR 컴포넌트 Role 전용이므로 MCP Task Role에 부여하지 않는다
- 적용 방법: Terraform `iam.tf`의 Task Role에 inline policy 또는 별도 IAM Policy로 추가

### 27-3. Task Execution Role vs Task Role 구분

| Role                | 사용 주체                | 주요 권한                                                                                                                                   |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Task Execution Role | ECS 에이전트             | ECR pull, CloudWatch Logs + Secrets Manager 주입용 `GetSecretValue` (`ai/mcp/{env}`, `ai/claude/{env}` — 컨테이너 기동 시 필요) |
| Task Role           | 컨테이너 내 애플리케이션 | RORR 인프라 조회 + `ai/mcp/{env}`, `ai/claude/{env}` GetSecretValue + PutSecretValue, `ai/service/account/{env}` GetSecretValue |

---

## 28. 최초 Secrets Manager 초기화

### 28-1. 올바른 최초 생성 흐름

```
1단계: GitHub Actions Environments에 CLASSIC_PAT, GH_PAT 등록 (gh secret set) — Claude 직접 수행
2단계: Claude가 이 프로젝트에서 Terraform apply 직접 수행
       → ECR, ECS 클러스터, VPC, ALB 등 모든 인프라 생성
       → ai/mcp/{env}, ai/claude/{env}, ai/rorr/{env}, ai/service/account/{env} 시크릿이
         이 단계에서 Terraform에 의해 처음 생성됨
3단계: Secrets Manager 초기화 — Claude가 직접 수행 (Terraform 완료 직후)
       ai/mcp/{env}: github_classic_pat, github_pat 실제 값으로 교체 + terraform output 인프라 참조값 저장
       ai/claude/{env}: 빈 JSON({}) 유지 (claude_credentials는 사용자가 auth login 후 자동 업로드)
       ai/rorr/{env}: 빈 JSON({}) 또는 placeholder 유지 (CI/CD가 apply 후 채워 넣음)
       ai/service/account/{env}: .env의 RORR_DEV_AWS_ACCESS_KEY_ID, RORR_DEV_AWS_SECRET_ACCESS_KEY 값 저장
4단계: CI/CD workflow trigger — Docker 빌드 → ECR push → ECS 서비스 업데이트 (자동)
5단계: ECS 컨테이너 시작 시 MCP_SECRET_JSON에 실제 PAT 포함되어 정상 동작
```

### 28-2. GitHub Actions Secrets 등록 대상 (최초 생성 전 필수)

```bash
export GH_TOKEN=$CLASSIC_PAT
gh secret set AWS_ACCESS_KEY_ID     --env develop --body "$AWS_ACCESS_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --env develop --body "$AWS_SECRET_ACCESS_KEY"
gh secret set AWS_REGION            --env develop --body "us-east-1"
gh secret set CLASSIC_PAT           --env develop --body "$CLASSIC_PAT"
gh secret set GH_PAT                --env develop --body "$GH_PAT"
# staging, prod도 동일하게 반복 (각 환경 전용 AWS 계정 키 사용)
```

> `claude auth login`으로 생성되는 `claude_credentials`는 최초 배포 후 사용자가 직접 컨테이너에 접속하여 수행 (자동화 불가)

### 28-3. CI/CD docker job에서 인프라 참조값 사용 방법

`ecr_repository_url` 등 Terraform output 값은 job output 대신 **Secrets Manager에서 직접 조회**한다.
Claude가 직접 수행한 3단계(Secrets Manager 초기화) 완료 시점에 해당 값들이 `ai/mcp/{env}`에 이미 저장되어 있으므로 직접 조회 가능.

---

## 29. claude-runner.ts 타임아웃

### 29-1. 발생 오류

RORR 인프라 생성 툴 호출 시 타임아웃 발생:

```
Command timed out after 300000 milliseconds
```

**원인**: `claude-runner.ts` 기본 타임아웃이 300,000ms(5분)이지만, RORR 인프라 생성 툴의 실제 작업(레포 clone → Terraform 코드 생성 → init/validate → git push → PR 생성)이 5분을 초과합니다.

### 29-2. 타임아웃 제약 구조

| 항목                     | 값                                | 비고                                   |
| ------------------------ | --------------------------------- | -------------------------------------- |
| ALB idle_timeout         | **4,000초**                 | AWS ALB 하드 최대값 — 실질적인 상한선 |
| claude-runner.ts timeout | **3,900,000ms (65분)** 권장 | ALB 4,000초 한도 내 여유 확보          |

- `claude-runner.ts` timeout은 반드시 4,000,000ms 미만으로 설정

---

## 30. server.tool() 콜백 파라미터 타입 명시 필수

```typescript
// ❌ 금지
server.tool('name', '...', { key: z.string() }, async ({ key }) => { ... })

// ✅ 올바른 방법
server.tool('name', '...', { key: z.string() }, async ({ key }: { key: string }) => { ... })
```

---

## 31. Claude 자율 실행 권한 (AWS_INFRA_MCP_2)

이 프로젝트(AWS_INFRA_MCP_2)의 규칙을 따르는 작업은 사용자의 별도 확인 없이 자동으로 끝까지 완료한다.

### 31-1. 자동 실행 대상

| 항목                                      | 설명                                 |
| ----------------------------------------- | ------------------------------------ |
| AWS CLI 명령 실행                         | `.env`의 자격증명 사용             |
| GitHub API / gh CLI 실행                  | GH_PAT 사용                          |
| git push, 브랜치 생성, PR 생성            | —                                   |
| Terraform 명령 실행 (init / plan / apply) | MCP 서버 인프라는 Claude가 직접 수행 |
| Docker 빌드 및 ECR push                   | —                                   |

### 31-2. 자동 실행 제외 대상

- **Git 머지** — 자동 실행 대상 아님

### 31-3. Terraform apply 규칙

- MCP 서버 인프라(ECR, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등)는 **Claude가 이 프로젝트에서 직접 terraform apply를 수행한다**
- CI/CD workflow에 terraform job을 포함하지 않는다

### 31-4. GitHub Actions Secrets 자동 등록 규칙

1. GitHub Actions workflow 생성·수정 시 → 해당 workflow에서 참조하는 **모든 secrets를 즉시** `gh secret set`으로 등록
2. 배포에 필요한 전제 조건(버킷, secrets, 파라미터 등)은 확인 없이 한 번에 완료
3. `gh secret set` 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

   > **이유**: Fine-grained PAT(`github_pat_` 접두사)은 GitHub Environment secrets API 미지원 → 403 오류 발생. Classic PAT(`ghp_` 접두사)만 사용 가능

### 31-5. CI/CD 역할 범위

**CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포만 수행한다.**
ECR 저장소, ECS 클러스터, VPC, ALB, 보안 그룹, Terraform state backend 등 인프라 전제 조건은 **Claude가 이 프로젝트에서 직접 생성**한다.
CI/CD workflow에 인프라 생성 로직(terraform job 등)을 포함하지 않는다.

---

## 39. terraform output 실행 및 Secrets Manager 저장 규칙

### 39-1. --no-color 플래그 필수

`terraform output -raw` 명령 실행 시 반드시 `--no-color` 플래그를 포함한다.

```bash
terraform output -raw ecr_repository_url --no-color
```

Python subprocess로 실행할 때도 동일하게 적용한다.

```python
subprocess.run(['terraform', 'output', '-raw', key, '--no-color'], capture_output=True, ...)
```

### 39-2. 저장 전 값 검증 필수

Secrets Manager에 저장하기 전 stdout 값에 줄바꿈 문자(`\n`) 또는 ANSI 이스케이프 코드가 포함되지 않았는지 반드시 확인한다.

- 검증 조건: `len(value.splitlines()) == 1` 이어야 한다
- 줄바꿈이 포함된 값은 저장하지 않고 오류로 처리한다

---

## 40. Terraform S3 백엔드 설정 규칙

`backend "s3"` 블록에 `dynamodb_table` 파라미터를 사용하지 않는다 — deprecated 파라미터이며 `terraform output` stdout에 경고 메시지를 출력해 캡처 값을 오염시킨다.

DynamoDB 상태 잠금이 필요할 경우 `use_lockfile = true`를 사용한다.

---

## 41. Docker 베이스 이미지 및 패키지 규칙

### 41-1. Node.js 베이스 이미지

- `node:24-slim`을 사용한다 (Node 20은 2026년 4월 EOL, Node 24가 현재 Active LTS)

### 41-2. ca-certificates 필수 설치

- `apt-get install`에 `ca-certificates`를 반드시 포함한다
- `-slim` 계열 이미지에는 `ca-certificates`가 포함되어 있지 않아 curl HTTPS 연결이 실패함 (exit code 77)
- Node.js 버전과 무관하게 `*-slim` 계열 이미지는 모두 동일한 문제가 발생한다

### 41-3. 적용 방법

```dockerfile
FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip git less jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

### 41-4. Claude CLI 설치 방법

- **반드시 `npm install -g @anthropic-ai/claude-code`로 설치한다**
- `curl`을 이용한 바이너리 직접 다운로드 방식은 **절대 사용 금지**

**이유**: 바이너리 직접 다운로드 URL(예: `storage.googleapis.com/anthropic-claude-cli/...`)은 실제로 존재하지 않아 curl 404 오류 발생 → Docker 빌드 실패

**이점**: `node:24-slim` 베이스 이미지에 npm이 이미 포함되어 있으므로 별도 설치 없이 바로 사용 가능

```dockerfile
# ❌ 금지 — 404 오류 발생
RUN curl -fsSL "https://storage.googleapis.com/anthropic-claude-cli/latest/linux-amd64/claude" \
    -o /usr/local/bin/claude && chmod +x /usr/local/bin/claude

# ✅ 올바른 방법
RUN npm install -g @anthropic-ai/claude-code
```

---

## 42. MCP 서버 코드 생성 후 로컬 빌드 검증

### 42-1. 규칙

- MCP 서버 코드를 생성하거나 수정한 후 **git push 및 PR 생성 전에** 반드시 로컬에서 빌드를 실행한다
- TypeScript 컴파일 오류가 없을 때만 push/PR 생성을 진행한다

### 42-2. 이유

Docker 빌드에서 TypeScript 오류가 발견되면 수정 후 CI/CD를 재실행해야 하므로 시간이 많이 소요된다.
로컬에서 `npm run build`는 수초 내에 완료되므로 CI/CD 이전에 반드시 확인한다.

### 42-3. 실행 방법

```bash
cd mcp-server && npm install && npm run build
```

---

## 43. @modelcontextprotocol/sdk 버전 고정 규칙

### 43-1. 버전 고정 원칙

- `@modelcontextprotocol/sdk` 버전은 반드시 **exact pin**으로 고정한다 (`^` 범위 지정 금지)
- `package-lock.json`을 반드시 커밋한다 — 없으면 `npm install` 시 최신 버전으로 드리프트 발생

### 43-2. 고정 버전: 1.22.0

| 버전 범위 | 문제 |
| --------- | ---- |
| `1.0.4` 이하 | `McpServer`, `StreamableHTTPServerTransport` 모듈 없음 → TS2307 발생 |
| **`1.22.0`** | 두 모듈 모두 존재 + `ZodRawShapeCompat` 없음 → **정상 빌드** ✅ |
| `1.23.0` 이상 | `ZodRawShapeCompat` 타입 도입 → `server.tool()` 호출 시 TS2589 (type instantiation excessively deep) 발생 |

### 43-3. package.json 작성 예시

```json
"dependencies": {
  "@modelcontextprotocol/sdk": "1.22.0"
}
```

---

## 44. AWS 자격증명 접근 분리 원칙

MCP server와 CI/CD는 RORR AWS 자격증명을 서로 다른 저장소에서 읽는다.

| 주체                  | RORR AWS 키 출처                              |
| --------------------- | --------------------------------------------- |
| MCP server subprocess | `ai/service/account/{env}` (Secrets Manager) |
| GitHub Actions CI/CD  | GitHub Environments secrets                   |

### 44-1. MCP server 자격증명 사용 규칙

- MCP server subprocess가 RORR AWS API를 호출하거나 GitHub Environments secrets를 등록할 때
  반드시 `ai/service/account/{env}`에서 자격증명을 읽는다

### 44-2. CI/CD 자격증명 사용 규칙

- CI/CD(GitHub Actions)는 GitHub Environments secrets에 등록된 `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`를 사용하며 Secrets Manager를 직접 읽지 않는다

### 44-3. 두 저장소의 관계

- 두 저장소는 같은 값을 갖되 접근 주체가 완전히 분리된다
- 최초 구동 시 MCP server subprocess가 `ai/service/account/{env}`에서 자격증명을 읽어
  AWS_INFRA_2 GitHub Environments secrets에 등록한다 — 이후 CI/CD는 GitHub에서 자율적으로 사용

---

# MCP 서버가 생성하는 코드 규칙

AWS_INFRA_2 저장소 전용 규칙입니다.

---

## 32. RORR 인프라 생성 역할 분리

### 32-1. RORR 인프라 생성 기능의 동작 범위

(MCP 서버가 제공하는 RORR 인프라 생성 기능 — 정확한 툴 명칭은 MCP 서버 구현에 따라 결정)

**최초 생성 시 (AWS_INFRA_2 레포 최초 셋업):**

- Claude subprocess가 브랜치 생성, 보호 규칙, GitHub Environments secrets 등록까지 직접 수행 (33항 참조)
  GitHub Environments secrets 값(AWS_ACCESS_KEY_ID 등)은 **`ai/service/account/{env}`에서 읽어 등록한다**
- Terraform 코드 생성 → feature 브랜치 push → PR 생성
- terraform apply는 PR 머지 후 CI/CD가 수행한다 (최초 생성 시에도 동일)
- 프로그램 설치는 Terraform user_data에 포함 → EC2 시작 시 cloud-init으로 자동 설치

**이후 인프라 변경 시:**

- MCP 서버 역할: Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)
- terraform apply는 PR 머지 후 CI/CD(GitHub Actions)가 담당

### 32-2. RORR 인프라 CI/CD 워크플로우 생성 규칙

- RORR 인프라 코드 생성 시, AWS_INFRA_2 repo에 CI/CD 워크플로우가 없으면 **함께 생성**
- 워크플로우는 `develop` / `staging` / `prod` 브랜치 push 시 트리거
- 각 job에 `environment:` 키를 포함해 해당 브랜치의 GitHub Environment secrets를 참조
- `terraform init → plan → apply` 자동 수행 후, apply 완료 후 접속 정보를 Secrets Manager에 저장

### 32-3. 브랜치별 AWS 계정 분리

| 브랜치 머지 | GitHub Environment | 배포 계정        |
| ----------- | ------------------ | ---------------- |
| develop     | 'develop'          | develop AWS 계정 |
| staging     | 'staging'          | staging AWS 계정 |
| prod        | 'prod'             | prod AWS 계정    |

- 최초·이후 모두: CI/CD가 해당 환경 GitHub Environment secrets를 사용해 terraform apply 수행

---

## 33. RORR 최초 생성 선행 작업

AWS_INFRA_2 레포 최초 셋업 시 Claude subprocess가 직접 수행하는 작업입니다.
MCP 서버를 만들 때와 동일하게 Claude subprocess가 사용자 확인 없이 끝까지 수행한다.
완료되지 않은 상태에서 Terraform 코드 생성을 시작하는 것은 금지한다.

### 33-1. 선행 작업 목록

1. AWS_INFRA_2 repo에 `develop`, `staging`, `prod` 브랜치 생성
2. `develop`, `staging`, `prod` 브랜치 보호 규칙 설정
3. GitHub Environments(`develop`/`staging`/`prod`) secrets 등록

   | Secret 이름               | 값                                                             |
   | ------------------------- | -------------------------------------------------------------- |
   | `AWS_ACCESS_KEY_ID`     | `ai/service/account/{env}.aws_access_key_id` 값 사용        |
   | `AWS_SECRET_ACCESS_KEY` | `ai/service/account/{env}.aws_secret_access_key` 값 사용    |
   | `AWS_REGION`            | `ai/service/account/{env}.aws_region` 값 사용 (us-east-1)   |
   | `CLASSIC_PAT`           | `ai/mcp/{env}.github_classic_pat` 값 사용                   |
   | `GH_PAT`                | `ai/mcp/{env}.github_pat` 값 사용                           |

   > `gh secret set` 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

4. Terraform 코드 생성 → feature 브랜치 push → PR 생성 (develop 대상)

   - 3번에서 GitHub Environments secrets에 `ai/service/account/{env}` 값이 이미 등록돼 있으므로
     PR 머지 시 CI/CD가 해당 계정으로 즉시 terraform apply를 수행한다
   - **terraform apply는 Claude subprocess가 직접 수행하지 않는다**
   - 프로그램 설치는 Terraform user_data(cloud-init)에 포함 → EC2 시작 시 자동 설치
   - CI/CD apply 완료 후 접속 정보를 `ai/rorr/develop`에 자동 저장

### 33-2. 실행 방법

- `gh` CLI와 `ai/mcp/{env}`의 `github_classic_pat`, `github_pat` 값을 사용해 Claude subprocess가 직접 수행
- GitHub Environments secrets 등록 시 `ai/service/account/{env}` 값을 읽어 `AWS_ACCESS_KEY_ID` 등으로 매핑
- `gh` CLI 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정
- `staging`, `prod` 환경은 각 환경 담당자가 별도 수행하거나
  `ai/service/account/staging`, `ai/service/account/prod` 시크릿 추가 후 Claude가 동일하게 수행 가능

---

## 34. Git 관리 — 서비스 저장소 (AWS_INFRA_2)

- **저장소**: `https://github.com/kazel-piepie/AWS_INFRA_2.git`
- 브랜치 전략 및 PR 생성 규칙은 [18. Git 관리 — MCP 서버 저장소](#18-git-관리--mcp-서버-저장소)와 동일

### 34-1. 환경별 AWS 계정 키 등록

각 환경 전용 AWS 계정 키를 해당 GitHub Environment secrets에 등록합니다.

| Environment | AWS 계정            |
| ----------- | ------------------- |
| develop     | develop AWS 계정 키 |
| staging     | staging AWS 계정 키 |
| prod        | prod AWS 계정 키    |

### 34-2. 기타 규칙

- merge 대상은 항상 `develop`만 머지 가능하게 설정
- 생성되는 인프라는 [36. RORR 서비스 아키텍처](#36-rorr-서비스-아키텍처) 참고
- `develop → staging → prod` 순으로 담당자가 수동으로 머지 진행
- 인프라 생성 시 3가지 환경에 따라 스펙이 변경되게 구성
- 실제 배포가 끝나면 생성 정보를 별도 문서에 정리
- CI/CD 워크플로우가 없으면 RORR 인프라 코드 생성 시 함께 생성

---

## 35. RORR 서비스 Secrets Manager

### 35-1. 시크릿 이름

`ai/rorr/{env}` (예: `ai/rorr/develop`)

### 35-2. JSON 구조

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

### 35-3. 저장 및 사용 규칙

| 항목         | 내용                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| 저장 시점    | Terraform apply 완료 후 terraform output으로 추출해 CI/CD에서 자동 저장                       |
| IAM 권한     | 각 RORR 컴포넌트 IAM Role: `ai/rorr/{env}` ARN만 읽기 허용 (전체 허용 금지)                |
| 민감 output  | 패스워드, 키 등은 반드시 `sensitive = true` 설정                                            |
| EC2 컴포넌트 | 시작 시 `aws secretsmanager get-secret-value` 1회 호출 후 `jq`로 파싱하여 환경변수 export |
| ECS 컴포넌트 | Task Definition secrets 블록에서 ARN 전체를 `RORR_SECRET_JSON`으로 주입 후 코드에서 파싱    |

### 35-4. Terraform 참조 규칙 (핵심)

`ai/rorr/{env}`는 MCP 서버 선행 작업(13-4항 7번)에서 이미 생성된 시크릿이다.
생성된 Terraform 코드에서 `resource` 블록으로 새로 만들지 않는다.
반드시 `data` 소스로 기존 시크릿을 참조한다.

```hcl
data "aws_secretsmanager_secret" "rorr" {
  name = "ai/rorr/${var.env}"
}
```

**이 방식의 이점:**

- `data.aws_secretsmanager_secret.rorr.arn`이 정확한 ARN을 반환 (랜덤 6자 suffix 포함)
- IAM policy Resource에 와일드카드(`*`) 없이 정확한 ARN 지정 가능
- `user_data` 스크립트의 `--secret-id`에 `data.aws_secretsmanager_secret.rorr.name` 사용 가능

**IAM policy 올바른 작성법:**

```hcl
resource "aws_iam_policy" "rorr_secret_read" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = data.aws_secretsmanager_secret.rorr.arn
    }]
  })
}
```

**금지 패턴:**

```hcl
# 와일드카드 ARN 생성 금지
rorr_secret_arn = "arn:aws:secretsmanager:...:secret:ai/rorr/${local.env}-*"
# 와일드카드가 포함된 ARN을 --secret-id로 전달 금지
--secret-id "$RORR_SECRET_ARN"
```

---

## 36. RORR 서비스 아키텍처

### 36-1. 서비스 개요

RORR는 e-sports(LoL) 실시간 경기 통계 및 AI 컴패니언 서비스입니다.

**클라이언트 접속**: Chrome Extension, Web, Mobile

**클라이언트 주요 기능**:

- 경기 일정, 팀, 선수 정보 확인
- e-sports 실시간 경기 stat 확인
- AI 컴패니언을 통한 채팅 및 경기 응원
- 스트릭 방식의 퀴즈

**통신 방법**:

| 데이터              | 방식            |
| ------------------- | --------------- |
| 스케줄 등 일반 정보 | REST API        |
| 실시간 stat         | WebSocket       |
| 정적 에셋           | S3 + CloudFront |

### 36-2. 컴포넌트 상세

| 컴포넌트               | 인프라          | 역할                                                                                    |
| ---------------------- | --------------- | --------------------------------------------------------------------------------------- |
| Client                 | S3 + CloudFront | 정적 리소스 서빙                                                                        |
| DataCenter Collector   | EC2             | lol api 기초 정보(스케줄, 팀, 선수) 수집 → Raw Data DB 저장 (타 게임/스포츠 확장 가능) |
| LOL Data Collector     | EC2             | DataCenter에서 lol data만 수집, 가공 후 저장                                            |
| DataCenter Live Events | EC2             | 실시간 경기 정보 수집 → Raw Data DB 저장, MSK로 전달 (타 게임/스포츠 확장 가능)        |
| LOL Live Events        | EC2             | DataCenter Live Events에서 LoL data만 수집, 가공 후 저장                                |
| LoL AI                 | EC2             | 경기 맥락 분석 → 모든 client에 동일 정보 제공, Bedrock Sonnet 4.6, Redis 캐시          |
| Kafka UI               | EC2             | Kafka 정보 모니터링 UI                                                                  |
| 메인 DB 서버           | EC2             | PostgreSQL + TimescaleDB                                                                |

### 36-3. 데이터 흐름

- **lol API 접속**: lol api URL 및 인증 키 필요
- **시스템 간 데이터 전달**: MSK(Kafka) 내부 사용
- **모든 프로그램**: Kafka 또는 메인 DB를 사용해 데이터 저장 및 전달
- **AI**: Bedrock Sonnet 4.6, 토큰 비용 고려 → 경기 흐름 관련 정보 제공, 모든 client 동일 수신, Redis 캐시 활용

---

## 37. 환경별 인프라 스펙

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
| MSK 브로커 수          | **2**             | 2                 | 3+                  |

> MSK develop 브로커 수: **최소 2개 필수** — Amazon MSK는 `client_subnets`가 2개 이상일 때 브로커 수가 subnet 수의 배수여야 하므로 1은 유효하지 않다

---

## 38. Claude 자율 실행 권한 (AWS_INFRA_2)

이 섹션(AWS_INFRA_2)의 규칙을 따르는 작업은 사용자의 별도 확인 없이 자동으로 끝까지 완료한다.

### 38-1. 자동 실행 대상

| 항목                                                  | 설명                     |
| ----------------------------------------------------- | ------------------------ |
| AWS CLI 명령 실행                                     | `.env`의 자격증명 사용 |
| GitHub API / gh CLI 실행                              | GH_PAT 사용              |
| git push, 브랜치 생성, PR 생성                        | —                       |
| Terraform 코드 생성 → feature 브랜치 push → PR 생성 | Claude(MCP 서버)가 수행  |
| Docker 빌드 및 ECR push                               | CI/CD가 수행             |

### 38-2. 자동 실행 제외 대상

- **Git 머지** — 자동 실행 대상 아님
- **terraform 직접 apply** — Claude subprocess는 직접 apply하지 않는다

### 38-3. Terraform apply 규칙

- terraform apply는 **최초 생성·이후 변경 모두 CI/CD만 수행한다** — Claude subprocess는 직접 apply하지 않는다
- 최초 생성 시 GitHub Environments secrets에 `ai/service/account/{env}` 값이 등록돼 있으므로
  PR 머지 즉시 CI/CD가 해당 AWS 계정으로 terraform apply를 수행한다
- PR 머지 후 **CI/CD(GitHub Actions)가 terraform init / plan / apply를 자동 수행한다**
- CI/CD workflow에 terraform job을 반드시 포함한다

### 38-4. GitHub Actions Secrets 자동 등록 규칙

1. GitHub Actions workflow 생성·수정 시 → 해당 workflow에서 참조하는 **모든 secrets를 즉시** `gh secret set`으로 등록
2. 배포에 필요한 전제 조건(버킷, secrets, 파라미터 등)은 확인 없이 한 번에 완료
3. `gh secret set` 실행 전 반드시 `export GH_TOKEN=$CLASSIC_PAT` 설정

   > **이유**: Fine-grained PAT(`github_pat_` 접두사)은 GitHub Environment secrets API 미지원 → 403 오류 발생. Classic PAT(`ghp_` 접두사)만 사용 가능

### 38-5. CI/CD 역할 범위

**CI/CD는 Docker 이미지 빌드 및 ECR push, ECS 배포, terraform apply를 수행한다.**
Terraform 코드 생성 및 feature 브랜치 push, PR 생성은 Claude(MCP 서버)가 수행한다.
CI/CD workflow에 terraform job을 반드시 포함한다.
terraform apply는 최초 생성·이후 변경 모두 CI/CD만 수행한다 — Claude subprocess는 직접 apply하지 않는다.
