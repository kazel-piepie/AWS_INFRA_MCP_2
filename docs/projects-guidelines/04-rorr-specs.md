# 04. RORR 환경별 인프라 스펙

## 스펙 원칙

- develop, staging, prod에 따라 스펙 정의
- develop은 테스트에 필요한 **최소 사항**으로 정의
- 인프라 스펙은 명시적으로 구성
- x86 프로세서 사용
- 동일한 스펙일 경우 비용이 낮은 타입 선택 (예: `t3.small` → `t3a.small`)

## 환경별 스펙 테이블

| 컴포넌트 | develop | staging | prod |
|----------|---------|---------|------|
| DataCenter Collector | t3a.small | t3a.medium | t3a.large |
| LOL Data Collector | t3a.small | t3a.medium | t3a.large |
| DataCenter Live Events | t3a.small | t3a.medium | m6a.large |
| LOL Live Events | t3a.small | t3a.medium | m6a.large |
| LoL AI | t3a.medium | t3a.large | m6a.large |
| Redis (ElastiCache) | cache.t3.micro | cache.t3.small | 클러스터 |
| Kafka UI | t3a.small | t3a.small | t3a.medium |
| Main DB | t3a.medium / 50GB | t3a.large / 100GB | m6a.xlarge / 500GB+ |
| MSK 브로커 수 | **2** | 2 | 3+ |

> MSK develop 브로커 수가 **2**인 이유: Amazon MSK provisioned는 `client_subnets` 수의 배수로 브로커를 지정해야 한다. 최소 2개 서브넷(AZ)을 사용하므로 브로커 수도 최소 2개 필요 — 1개 지정 시 `terraform apply` 오류 발생

## Git 저장소 (AWS_INFRA_2)

- **저장소**: `https://github.com/kazel-piepie/AWS_INFRA_2.git`

| Environment | AWS 계정 |
|-------------|----------|
| develop | develop AWS 계정 키 |
| staging | staging AWS 계정 키 |
| prod | prod AWS 계정 키 |

- merge 대상은 항상 `develop`만 머지 가능하게 설정
- `develop → staging → prod` 순으로 담당자가 수동으로 머지 진행
- 인프라 생성 시 3가지 환경에 따라 스펙이 변경되게 구성
- CI/CD 워크플로우가 없으면 RORR 인프라 코드 생성 시 함께 생성
- 실제 배포가 끝나면 생성 정보를 별도 문서에 정리
