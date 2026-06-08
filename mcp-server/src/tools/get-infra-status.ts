import { getMcpSecret, getServiceAccountSecret } from '../secrets-manager';
import { runClaude } from '../claude-runner';

export interface GetInfraStatusParams {
  target: string;
}

export async function getInfraStatus({ target }: GetInfraStatusParams): Promise<string> {
  const mcpSecret = await getMcpSecret();
  const serviceAccount = await getServiceAccountSecret();

  const prompt = `You are an AWS infrastructure engineer. Check the status of the following AWS resources and provide a clear summary.

## AWS Credentials
Use the RORR account credentials provided in the environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
These credentials belong to the RORR develop AWS account — NOT the MCP server account.

## MCP Server Infrastructure Info (for reference only, different account)
- ECS Cluster: ${mcpSecret.ecs_cluster_name}
- ECS Service: ${mcpSecret.ecs_service_name}
- ALB DNS: ${mcpSecret.alb_dns}

## Task
Check the status of: ${target}

Use AWS CLI commands with the provided RORR account credentials to gather information. Provide a concise summary of:
- Current state of the requested resources
- Any issues or warnings
- Relevant metrics or counts

Important: Use --no-cli-pager for all AWS CLI calls.`;

  return runClaude({
    prompt,
    env: {
      AWS_ACCESS_KEY_ID: serviceAccount.aws_access_key_id,
      AWS_SECRET_ACCESS_KEY: serviceAccount.aws_secret_access_key,
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_PAGER: '',
    },
  });
}
