resource "aws_secretsmanager_secret" "mcp" {
  name                    = "ai/mcp/develop"
  description             = "MCP server infra references - ai-mcp-develop"
  recovery_window_in_days = 0

  tags = merge(local.tags, {
    Name = "ai/mcp/develop"
  })
}

resource "aws_secretsmanager_secret_version" "mcp" {
  secret_id     = aws_secretsmanager_secret.mcp.id
  secret_string = jsonencode({
    github_classic_pat = ""
    github_pat         = ""
    external_url       = "https://mcp-dev-aws.rorr.club/mcp"
    vpc_id             = ""
    public_subnet_ids  = ""
    private_subnet_ids = ""
    ecs_cluster_name   = ""
    ecs_service_name   = ""
    ecr_repository_url = ""
    alb_arn            = ""
    alb_dns            = ""
    security_group_id  = ""
    aws_region         = "us-east-1"
    aws_account_id     = ""
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "claude" {
  name                    = "ai/claude/develop"
  description             = "Claude CLI credentials - ai-mcp-develop"
  recovery_window_in_days = 0

  tags = merge(local.tags, {
    Name = "ai/claude/develop"
  })
}

resource "aws_secretsmanager_secret_version" "claude" {
  secret_id     = aws_secretsmanager_secret.claude.id
  secret_string = jsonencode({})

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "rorr" {
  name                    = "ai/rorr/develop"
  description             = "RORR service connection info - ai-mcp-develop"
  recovery_window_in_days = 0

  tags = merge(local.tags, {
    Name = "ai/rorr/develop"
  })
}

resource "aws_secretsmanager_secret_version" "rorr" {
  secret_id     = aws_secretsmanager_secret.rorr.id
  secret_string = jsonencode({})

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "service_account" {
  name                    = "ai/service/account/develop"
  description             = "RORR service deploy AWS credentials - ai-mcp-develop"
  recovery_window_in_days = 0

  tags = merge(local.tags, {
    Name = "ai/service/account/develop"
  })
}

resource "aws_secretsmanager_secret_version" "service_account" {
  secret_id     = aws_secretsmanager_secret.service_account.id
  secret_string = jsonencode({
    aws_access_key_id     = ""
    aws_secret_access_key = ""
    aws_region            = "us-east-1"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
