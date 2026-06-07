terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "ai-mcp-tfstate-develop"
    key          = "mcp-server/develop/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  env    = "develop"
  prefix = "ai-mcp"
  name   = "${local.prefix}-${local.env}"

  tags = {
    Project     = "ai-mcp"
    Environment = local.env
    ManagedBy   = "terraform"
  }
}
