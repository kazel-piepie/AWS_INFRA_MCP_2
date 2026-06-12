import cors from 'cors';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { restoreCredentials, startCredentialSync, startCredentialPull } from './credential-sync';
import { createRorrInfra } from './tools/create-rorr-infra';
import { getInfraStatus } from './tools/get-infra-status';

const CORS_ORIGINS = [
  'https://claude.ai',
  'https://app.claude.ai',
  'https://chatgpt.com',
  'https://chat.openai.com',
];

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const sessions = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'ai-mcp-server',
    version: '1.0.0',
  });

  server.tool(
    'create_rorr_infra',
    'Create or modify RORR infrastructure. Clones AWS_INFRA_2 repo, generates Terraform code, pushes to a feature branch, and creates a PR targeting develop.',
    { request: z.string().describe('Describe what infrastructure to create or change') },
    async ({ request }: { request: string }) => {
      try {
        const result = await createRorrInfra({ request });
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_infra_status',
    'Check the status of AWS infrastructure resources (ECS, ALB, ECR, VPC, etc.)',
    { target: z.string().describe('Which resources to check (e.g. "ECS services", "ALB", "all MCP resources")') },
    async ({ target }: { target: string }) => {
      try {
        const result = await getInfraStatus({ target });
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  return server;
}

async function main(): Promise<void> {
  console.log('[mcp-server] Starting...');

  await restoreCredentials();
  startCredentialSync();
  startCredentialPull();

  const app = express();
  app.use(cors({
    origin: CORS_ORIGINS,
    allowedHeaders: ['Content-Type', 'mcp-session-id', 'Accept', 'Authorization'],
    exposedHeaders: ['mcp-session-id'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      sessions.delete(sessionId);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  app.listen(PORT, () => {
    console.log(`[mcp-server] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[mcp-server] Fatal error:', err);
  process.exit(1);
});
