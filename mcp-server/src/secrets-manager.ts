import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface McpSecret {
  github_classic_pat: string;
  github_pat: string;
  external_url: string;
  vpc_id: string;
  public_subnet_ids: string;
  private_subnet_ids: string;
  ecs_cluster_name: string;
  ecs_service_name: string;
  ecr_repository_url: string;
  alb_arn: string;
  alb_dns: string;
  security_group_id: string;
  aws_region: string;
  aws_account_id: string;
}

export interface ClaudeSecret {
  claude_credentials?: string;
}

export interface ServiceAccountSecret {
  aws_access_key_id: string;
  aws_secret_access_key: string;
  aws_region: string;
}

const client = new SecretsManagerClient({ region: 'us-east-1' });
const env = process.env.MCP_ENV ?? 'develop';

async function getSecret(secretId: string): Promise<Record<string, string>> {
  const cmd = new GetSecretValueCommand({ SecretId: secretId });
  const res = await client.send(cmd);
  return JSON.parse(res.SecretString ?? '{}');
}

export async function getMcpSecret(): Promise<McpSecret> {
  if (process.env.MCP_SECRET_JSON) {
    return JSON.parse(process.env.MCP_SECRET_JSON) as McpSecret;
  }

  // .env 폴백
  return {
    github_classic_pat:  process.env.CLASSIC_PAT ?? '',
    github_pat:          process.env.GH_PAT ?? '',
    external_url:        `https://mcp-dev-aws.rorr.club/mcp`,
    vpc_id:              '',
    public_subnet_ids:   '',
    private_subnet_ids:  '',
    ecs_cluster_name:    '',
    ecs_service_name:    '',
    ecr_repository_url:  '',
    alb_arn:             '',
    alb_dns:             '',
    security_group_id:   '',
    aws_region:          'us-east-1',
    aws_account_id:      '',
  };
}

export async function getClaudeSecret(): Promise<ClaudeSecret> {
  if (process.env.CLAUDE_SECRET_JSON) {
    return JSON.parse(process.env.CLAUDE_SECRET_JSON) as ClaudeSecret;
  }
  try {
    return await getSecret(`ai/claude/${env}`) as unknown as ClaudeSecret;
  } catch {
    return {};
  }
}

export async function getServiceAccountSecret(): Promise<ServiceAccountSecret> {
  try {
    return await getSecret(`ai/service/account/${env}`) as unknown as ServiceAccountSecret;
  } catch {
    return {
      aws_access_key_id:     process.env.RORR_DEV_AWS_ACCESS_KEY_ID ?? '',
      aws_secret_access_key: process.env.RORR_DEV_AWS_SECRET_ACCESS_KEY ?? '',
      aws_region:            'us-east-1',
    };
  }
}

export async function putClaudeSecret(credentials: string): Promise<void> {
  const { SecretsManagerClient: SMClient, PutSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  const smClient = new SMClient({ region: 'us-east-1' });
  await smClient.send(new PutSecretValueCommand({
    SecretId: `ai/claude/${env}`,
    SecretString: JSON.stringify({ claude_credentials: credentials }),
  }));
}
