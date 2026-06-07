import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { getMcpSecret, getServiceAccountSecret } from '../secrets-manager';
import { runClaude } from '../claude-runner';

export interface CreateRorrInfraParams {
  request: string;
}

export async function createRorrInfra({ request }: CreateRorrInfraParams): Promise<string> {
  const mcpSecret = await getMcpSecret();
  const serviceAccount = await getServiceAccountSecret();

  const classicPat = mcpSecret.github_classic_pat || process.env.CLASSIC_PAT || '';
  const ghPat = mcpSecret.github_pat || process.env.GH_PAT || '';

  if (!ghPat) {
    throw new Error('GitHub PAT not configured');
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rorr-infra-'));

  try {
    // Clone AWS_INFRA_2 repo
    const repoUrl = `https://${ghPat}@github.com/kazel-piepie/AWS_INFRA_2.git`;
    execSync(`git clone --depth 1 ${repoUrl} ${workDir}`, {
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 60_000,
    });

    execSync('git config user.email "kazel@piepie.co"', { cwd: workDir });
    execSync('git config user.name "kazel-piepie"', { cwd: workDir });

    // Read CLAUDE.md for context
    const claudeMd = fs.existsSync('/app/CLAUDE.md')
      ? fs.readFileSync('/app/CLAUDE.md', 'utf-8')
      : '';

    const projectsGuidelines = loadProjectsGuidelines();

    const prompt = buildPrompt({
      request,
      workDir,
      ghPat,
      classicPat,
      serviceAccountKey: serviceAccount.aws_access_key_id,
      serviceAccountSecret: serviceAccount.aws_secret_access_key,
      claudeMd,
      projectsGuidelines,
    });

    const result = await runClaude({
      prompt,
      env: {
        GH_TOKEN: ghPat,
        CLASSIC_PAT: classicPat,
        GH_PAT: ghPat,
        AWS_ACCESS_KEY_ID: serviceAccount.aws_access_key_id,
        AWS_SECRET_ACCESS_KEY: serviceAccount.aws_secret_access_key,
        AWS_DEFAULT_REGION: 'us-east-1',
        AWS_PAGER: '',
        HOME: os.homedir(),
      },
    });

    return result;
  } finally {
    try {
      execSync(`rm -rf ${workDir}`, { timeout: 30_000 });
    } catch {
      // ignore cleanup errors
    }
  }
}

function loadProjectsGuidelines(): string {
  const guidelinesDir = '/app/docs/projects-guidelines';
  if (!fs.existsSync(guidelinesDir)) return '';

  return fs.readdirSync(guidelinesDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => {
      const content = fs.readFileSync(path.join(guidelinesDir, f), 'utf-8');
      return `## ${f}\n\n${content}`;
    })
    .join('\n\n---\n\n');
}

function buildPrompt(opts: {
  request: string;
  workDir: string;
  ghPat: string;
  classicPat: string;
  serviceAccountKey: string;
  serviceAccountSecret: string;
  claudeMd: string;
  projectsGuidelines: string;
}): string {
  return `You are an AI infrastructure engineer. Your task is to create or modify RORR infrastructure code.

## Working Directory
${opts.workDir} (AWS_INFRA_2 repository has been cloned here)

## Environment Variables (already set)
- GH_TOKEN, GH_PAT, CLASSIC_PAT: GitHub authentication
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: RORR AWS account credentials
- AWS_DEFAULT_REGION: us-east-1

## Rules
${opts.claudeMd}

## RORR Project Guidelines
${opts.projectsGuidelines}

## Task
${opts.request}

## Instructions
1. Work inside ${opts.workDir} (already cloned AWS_INFRA_2 repo)
2. Create a feature branch from develop
3. Make the requested changes (Terraform code, CI/CD workflow, etc.)
4. Commit all changes
5. Push the feature branch
6. Create a PR targeting the develop branch
7. Report what was done and the PR URL

Important:
- export GH_TOKEN=$CLASSIC_PAT before using gh secret set
- export GH_TOKEN=$GH_PAT before PR creation
- Follow all naming conventions (ai prefix, ASCII descriptions only)
- AWS region must be us-east-1
- Do NOT merge the PR
`;
}
