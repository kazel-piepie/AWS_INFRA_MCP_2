resource "aws_ecs_cluster" "main" {
  name = "${local.name}-infra-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = merge(local.tags, {
    Name = "${local.name}-infra-cluster"
  })
}

resource "aws_cloudwatch_log_group" "mcp" {
  name              = "/ecs/${local.name}"
  retention_in_days = 7

  tags = local.tags
}

resource "aws_ecs_task_definition" "mcp" {
  family                   = "${local.name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "mcp-server"
      image     = "${aws_ecr_repository.mcp.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV",    value = "production" },
        { name = "PORT",        value = "3000" },
        { name = "AWS_REGION",  value = "us-east-1" },
        { name = "MCP_ENV",     value = local.env },
        { name = "AWS_PAGER",   value = "" },
      ]

      secrets = [
        { name = "MCP_SECRET_JSON",    valueFrom = aws_secretsmanager_secret.mcp.arn },
        { name = "CLAUDE_SECRET_JSON", valueFrom = aws_secretsmanager_secret.claude.arn },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.mcp.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "mcp" {
  name            = "${local.name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.mcp.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.mcp.arn
    container_name   = "mcp-server"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.task_execution,
  ]

  tags = local.tags

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}
