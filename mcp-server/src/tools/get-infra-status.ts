import { getMcpSecret } from '../secrets-manager';
import { runClaude } from '../claude-runner';

export interface GetInfraStatusParams {
  target: string;
}

export async function getInfraStatus({ target }: GetInfraStatusParams): Promise<string> {
  const mcpSecret = await getMcpSecret();

  const prompt = `You are an AWS infrastructure engineer. Check the status of the following AWS resources and provide a clear summary.

## AWS Credentials
The environment already has AWS credentials configured (us-east-1 region).

## MCP Server Infrastructure Info
- ECS Cluster: ${mcpSecret.ecs_cluster_name}
- ECS Service: ${mcpSecret.ecs_service_name}
- ALB DNS: ${mcpSecret.alb_dns}
- VPC ID: ${mcpSecret.vpc_id}

## Task
Check the status of: ${target}

Use AWS CLI commands to gather information. Provide a concise summary of:
- Current state of the requested resources
- Any issues or warnings
- Relevant metrics or counts

Important: Use --no-cli-pager for all AWS CLI calls.`;

  return runClaude({
    prompt,
    env: {
      AWS_PAGER: '',
      AWS_DEFAULT_REGION: 'us-east-1',
    },
  });
}
