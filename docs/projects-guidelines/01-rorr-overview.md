# 01. RORR 서비스 개요

## 서비스 소개

RORR는 e-sports(LoL) 실시간 경기 통계 및 AI 컴패니언 서비스입니다.

**클라이언트 접속**: Chrome Extension, Web, Mobile

**클라이언트 주요 기능**:
- 경기 일정, 팀, 선수 정보 확인
- e-sports 실시간 경기 stat 확인
- AI 컴패니언을 통한 채팅 및 경기 응원
- 스트릭 방식의 퀴즈

**통신 방법**:

| 데이터 | 방식 |
|--------|------|
| 스케줄 등 일반 정보 | REST API |
| 실시간 stat | WebSocket |
| 정적 에셋 | S3 + CloudFront |

## 시스템 구성 요소

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                               │
│  Chrome Extension / Web / Mobile                            │
│  - 정적 리소스: S3 + CloudFront                              │
│  - 스케줄 등 일반 정보: REST API                              │
│  - 실시간 stat: WebSocket                                    │
└─────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  DataCenter  │ │  LOL Data    │ │  DataCenter  │
│  Collector   │ │  Collector   │ │  Live Events │
│  (EC2)       │ │  (EC2)       │ │  (EC2)       │
└──────────────┘ └──────────────┘ └──────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
                ┌──────────────┐ ┌──────────────┐
                │  LOL Live    │ │   MSK        │
                │  Events      │ │   (Kafka)    │
                │  (EC2)       │ └──────────────┘
                └──────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   메인 DB    │ │   LoL AI     │ │  Kafka UI    │
│   서버 (EC2) │ │   (EC2)      │ │  (EC2)       │
│ PostgreSQL + │ │ Bedrock      │ └──────────────┘
│ TimescaleDB  │ │ Sonnet 4.6   │
└──────────────┘ │ Redis 캐시   │
                 └──────────────┘
```

## 컴포넌트 상세

| 컴포넌트 | 인프라 | 역할 |
|----------|--------|------|
| Client | S3 + CloudFront | 정적 리소스 서빙 |
| DataCenter Collector | EC2 | lol api 기초 정보(스케줄, 팀, 선수) 수집 → Raw Data DB 저장 (타 게임/스포츠 확장 가능) |
| LOL Data Collector | EC2 | DataCenter에서 lol data만 수집, 가공 후 저장 |
| DataCenter Live Events | EC2 | 실시간 경기 정보 수집 → Raw Data DB 저장, MSK로 전달 (타 게임/스포츠 확장 가능) |
| LOL Live Events | EC2 | DataCenter Live Events에서 LoL data만 수집, 가공 후 저장 |
| LoL AI | EC2 | 경기 맥락 분석 → 모든 client에 동일 정보 제공, Bedrock Sonnet 4.6, Redis 캐시 |
| Kafka UI | EC2 | Kafka 정보 모니터링 UI |
| 메인 DB 서버 | EC2 | PostgreSQL + TimescaleDB |

## 데이터 흐름

- **lol API 접속**: lol api URL 및 인증 키 필요
- **시스템 간 데이터 전달**: MSK(Kafka) 내부 사용
- **모든 프로그램**: Kafka 또는 메인 DB를 사용해 데이터 저장 및 전달
- **AI**: Bedrock Sonnet 4.6, 토큰 비용 고려 → 경기 흐름 관련 정보 제공, 모든 client 동일 수신, Redis 캐시 활용
