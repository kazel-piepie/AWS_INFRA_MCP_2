import { spawn } from 'child_process';

const TIMEOUT_MS = 3_900_000; // 65 minutes — within ALB 4000s hard limit

export interface RunClaudeOptions {
  prompt: string;
  allowedTools?: string[];
  env?: NodeJS.ProcessEnv;
}

export async function runClaude(opts: RunClaudeOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', opts.prompt,
      '--dangerously-skip-permissions',
      '--output-format', 'text',
    ];

    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AWS_PAGER: '',
        ...(opts.env ?? {}),
      },
    });

    child.stdin.end();

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${TIMEOUT_MS} milliseconds`));
    }, TIMEOUT_MS);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
