# MCP Server — Claude Infrastructure Instructions

## Core Rules

- AWS Region: **us-east-1** (fixed)
- Secrets Manager only (no SSM Parameter Store)
- AWS resource descriptions: **ASCII only** (no Korean/CJK characters)
- git user.email: `kazel@piepie.co` / user.name: `kazel-piepie`
- Automation ends at PR creation — never merge PRs

## Naming Conventions

| Target | Rule |
|--------|------|
| All resources managed here | `ai` prefix required |
| MCP server infrastructure | include `mcp` in name |
| ECS cluster for this project | include `infra` in name |

## Secrets Structure

| Secret | Content |
|--------|---------|
| `ai/mcp/{env}` | GitHub PATs, VPC, ECR, ECS, ALB references |
| `ai/claude/{env}` | `claude_credentials` from `claude auth login` |
| `ai/rorr/{env}` | RORR service DB, Redis, MSK, LoL API |
| `ai/service/account/{env}` | RORR AWS deploy credentials |

## ECS Task Definition secrets rule

Use full ARN in `valueFrom` — never `ARN#key` format:

```hcl
secrets = [
  { name = "MCP_SECRET_JSON",    valueFrom = aws_secretsmanager_secret.mcp.arn },
  { name = "CLAUDE_SECRET_JSON", valueFrom = aws_secretsmanager_secret.claude.arn },
]
```

## Terraform S3 Backend

Use `use_lockfile = true`, NOT `dynamodb_table` (deprecated — pollutes stdout):

```hcl
backend "s3" {
  bucket       = "ai-mcp-tfstate-develop"
  key          = "mcp-server/develop/terraform.tfstate"
  region       = "us-east-1"
  use_lockfile = true
  encrypt      = true
}
```

## GitHub CLI Authentication Order

1. `export GH_TOKEN=$CLASSIC_PAT` — for `gh secret set`
2. `export GH_TOKEN=$GH_PAT` — for PR creation and general API
3. `https://${GH_PAT}@github.com/...` — for git push remote URL

## Claude Subprocess Rule

Use `child_process.spawn` with `stdio: ['pipe', 'pipe', 'pipe']` — never `execFile`.

## Terraform output extraction

```bash
terraform output -raw -no-color vpc_id
```

## RORR Infrastructure Repository

- Repo: `https://github.com/kazel-piepie/AWS_INFRA_2.git`
- Branches: `develop` → `staging` → `prod`
- terraform apply: CI/CD only (never run directly for RORR)

## RORR Service Architecture

See `docs/projects-guidelines/` for full details.

### Components

| Component | Infrastructure | Role |
|-----------|---------------|------|
| Client | S3 + CloudFront | Static assets |
| DataCenter Collector | EC2 | LoL API basic data collection |
| LOL Data Collector | EC2 | LoL-specific data processing |
| DataCenter Live Events | EC2 | Real-time match data collection |
| LOL Live Events | EC2 | LoL live data processing |
| LoL AI | EC2 | Bedrock Sonnet 4.6, Redis cache |
| Kafka UI | EC2 | Kafka monitoring |
| Main DB | EC2 | PostgreSQL + TimescaleDB |
| MSK | Managed | Kafka message bus |
| ElastiCache | Managed | Redis |

### Develop Environment Specs

| Component | Instance |
|-----------|----------|
| DataCenter Collector | t3a.small |
| LOL Data Collector | t3a.small |
| DataCenter Live Events | t3a.small |
| LOL Live Events | t3a.small |
| LoL AI | t3a.medium |
| Redis | cache.t3.micro |
| Kafka UI | t3a.small |
| Main DB | t3a.medium / 50GB |
| MSK brokers | 2 (must match subnet count) |

### ai/rorr/{env} Secret Reference

Always use `data` source, never `resource`:

```hcl
data "aws_secretsmanager_secret" "rorr" {
  name = "ai/rorr/${var.env}"
}
```
