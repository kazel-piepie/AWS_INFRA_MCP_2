import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { putClaudeSecret } from './secrets-manager';

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');
const POLL_INTERVAL_MS = 5000;
const PULL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let lastModified: number | null = null;

export async function restoreCredentials(): Promise<void> {
  const { getClaudeSecret } = await import('./secrets-manager');
  const secret = await getClaudeSecret();
  if (!secret.claude_credentials) {
    console.log('[credential-sync] No credentials in Secrets Manager, skipping restore');
    return;
  }

  const dir = path.dirname(CREDENTIALS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(CREDENTIALS_PATH, secret.claude_credentials, { mode: 0o600 });
  console.log('[credential-sync] Credentials restored from Secrets Manager');

  try {
    lastModified = fs.statSync(CREDENTIALS_PATH).mtimeMs;
  } catch {
    lastModified = null;
  }
}

export function startCredentialSync(): void {
  setInterval(async () => {
    try {
      const stat = fs.statSync(CREDENTIALS_PATH);
      const currentMtime = stat.mtimeMs;

      if (lastModified !== null && currentMtime === lastModified) {
        return;
      }

      const credentials = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      await putClaudeSecret(credentials);
      lastModified = currentMtime;
      console.log('[credential-sync] Credentials uploaded to Secrets Manager');
    } catch {
      // file not found or Secrets Manager error — silently continue
    }
  }, POLL_INTERVAL_MS);
}

// Pull fresh credentials from Secrets Manager every 5 minutes.
// Allows credentials uploaded from an external machine to be picked up
// without requiring a container restart.
export function startCredentialPull(): void {
  setInterval(async () => {
    try {
      const { getClaudeSecret } = await import('./secrets-manager');
      const secret = await getClaudeSecret();
      if (!secret.claude_credentials) return;

      let localContent: string | null = null;
      try {
        if (fs.existsSync(CREDENTIALS_PATH)) {
          localContent = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
        }
      } catch { /* ignore */ }

      if (localContent === secret.claude_credentials) return;

      const dir = path.dirname(CREDENTIALS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(CREDENTIALS_PATH, secret.claude_credentials, { mode: 0o600 });
      lastModified = fs.statSync(CREDENTIALS_PATH).mtimeMs;
      console.log('[credential-sync] Credentials refreshed from Secrets Manager');
    } catch {
      // silently continue
    }
  }, PULL_INTERVAL_MS);
}
