import { spawn } from 'child_process';
import { restoreFromSecret, notifyClaudeSuccess } from './credential-sync';

const TIMEOUT_MS = 3_900_000; // 65 minutes — within ALB 4000s hard limit

// Patterns that indicate an OAuth/auth failure in Claude's stderr output
const AUTH_ERROR_PATTERNS = ['401', 'authentication', 'unauthorized', 'oauth', 'token', 'login'];

export interface RunClaudeOptions {
  prompt: string;
  allowedTools?: string[];
  env?: NodeJS.ProcessEnv;
}

function isAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return AUTH_ERROR_PATTERNS.some(p => lower.includes(p));
}

async function _runClaude(opts: RunClaudeOptions): Promise<string> {
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

export async function runClaude(opts: RunClaudeOptions): Promise<string> {
  try {
    const result = await _runClaude(opts);
    notifyClaudeSuccess();
    return result;
  } catch (err: any) {
    const msg: string = err.message ?? '';
    if (isAuthError(msg)) {
      console.log('[claude-runner] Auth error detected, refreshing credentials from Secrets Manager...');
      const restored = await restoreFromSecret();
      if (restored) {
        console.log('[claude-runner] Retrying with refreshed credentials...');
        const result = await _runClaude(opts);
        notifyClaudeSuccess();
        return result;
      }
    }
    throw err;
  }
}
