import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { putClaudeSecret } from './secrets-manager';

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');
const POLL_INTERVAL_MS = 5000;

let lastModified: number | null = null;
let lastClaudeSuccess = false;

function isLocalCredentialValid(): boolean {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const creds = JSON.parse(content);
    const exp = creds?.claudeAiOauth?.expiresAt;
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

export async function restoreCredentials(): Promise<void> {
  // 1. Local credentials exist and are valid — use as-is
  if (isLocalCredentialValid()) {
    try {
      lastModified = fs.statSync(CREDENTIALS_PATH).mtimeMs;
    } catch {
      lastModified = null;
    }
    console.log('[credential-sync] Local credentials are valid, skipping Secrets Manager restore');
    return;
  }

  // 2. Local missing or expired — pull from Secrets Manager
  await restoreFromSecret();
}

export async function restoreFromSecret(): Promise<boolean> {
  const { getClaudeSecret } = await import('./secrets-manager');
  const secret = await getClaudeSecret();
  if (!secret.claude_credentials) {
    console.log('[credential-sync] No credentials in Secrets Manager, skipping restore');
    return false;
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
  return true;
}

export function notifyClaudeSuccess(): void {
  lastClaudeSuccess = true;
}

export function startCredentialSync(): void {
  setInterval(async () => {
    // Only upload when Claude subprocess has run successfully at least once.
    // Prevents overwriting Secrets Manager with a stale/expired local token.
    if (!lastClaudeSuccess) {
      return;
    }

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
