output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (comma-separated)"
  value       = join(",", aws_subnet.public[*].id)
}

output "private_subnet_ids" {
  description = "Private subnet IDs (comma-separated)"
  value       = join(",", aws_subnet.private[*].id)
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.mcp.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.mcp.name
}

output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_dns" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "security_group_id" {
  description = "ECS security group ID"
  value       = aws_security_group.ecs.id
}

output "mcp_secret_arn" {
  description = "ai/mcp/develop secret ARN"
  value       = aws_secretsmanager_secret.mcp.arn
}

output "claude_secret_arn" {
  description = "ai/claude/develop secret ARN"
  value       = aws_secretsmanager_secret.claude.arn
}
