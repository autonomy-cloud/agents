import * as http from 'node:http';
import * as vscode from 'vscode';
import { CopilotClient } from './copilotClient';
import type {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelListEntry,
} from './openaiTypes';

export interface ServerOptions {
  port: number;
  sharedSecret: string;
  modelSelector: vscode.LanguageModelChatSelector;
  client: CopilotClient;
  log: (line: string) => void;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function unauthorized(res: http.ServerResponse): void {
  sendJson(res, 401, { error: { message: 'Invalid or missing bearer token', type: 'invalid_request_error' } });
}

export function startServer(options: ServerOptions): http.Server {
  const { port, sharedSecret, modelSelector, client, log } = options;

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      log(`Unhandled server error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
      if (!res.headersSent) {
        sendJson(res, 500, { error: { message: String(err), type: 'server_error' } });
      }
    });
  });

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (sharedSecret) {
      const auth = req.headers.authorization ?? '';
      if (auth !== `Bearer ${sharedSecret}`) {
        unauthorized(res);
        return;
      }
    }

    if (url.pathname === '/v1/models' && req.method === 'GET') {
      await handleListModels(res);
      return;
    }

    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const body = (await readJsonBody(req)) as ChatCompletionRequest;
      await handleChatCompletion(body, req, res);
      return;
    }

    if (url.pathname === '/healthz' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', model: client.selectedModel?.id ?? null });
      return;
    }

    sendJson(res, 404, { error: { message: `Unknown route ${req.method} ${url.pathname}`, type: 'invalid_request_error' } });
  }

  async function handleListModels(res: http.ServerResponse): Promise<void> {
    const models = await client.listModels(modelSelector);
    const data: ModelListEntry[] = models.map((m) => ({
      id: m.id,
      object: 'model',
      created: 0,
      owned_by: m.vendor,
    }));
    sendJson(res, 200, { object: 'list', data });
  }

  async function handleChatCompletion(
    body: ChatCompletionRequest,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      sendJson(res, 400, { error: { message: '"messages" must be a non-empty array', type: 'invalid_request_error' } });
      return;
    }

    const id = `chatcmpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const created = Math.floor(Date.now() / 1000);
    const modelId = client.selectedModel?.id ?? body.model ?? 'copilot';

    const cts = new vscode.CancellationTokenSource();
    req.on('close', () => cts.cancel());

    log(`chat.completions: ${body.messages.length} message(s), stream=${Boolean(body.stream)}`);

    if (body.stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const writeChunk = (chunk: ChatCompletionChunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };

      try {
        let first = true;
        for await (const fragment of client.streamCompletion(body.messages, modelSelector, cts.token)) {
          writeChunk({
            id,
            object: 'chat.completion.chunk',
            created,
            model: modelId,
            choices: [
              {
                index: 0,
                delta: first ? { role: 'assistant', content: fragment } : { content: fragment },
                finish_reason: null,
              },
            ],
          });
          first = false;
        }
        writeChunk({
          id,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        });
        res.write('data: [DONE]\n\n');
      } catch (err) {
        log(`Streaming completion failed: ${err instanceof Error ? err.message : String(err)}`);
        writeChunk({
          id,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [{ index: 0, delta: { content: `\n[bridge error: ${String(err)}]` }, finish_reason: 'stop' }],
        });
        res.write('data: [DONE]\n\n');
      } finally {
        res.end();
        cts.dispose();
      }
      return;
    }

    try {
      let full = '';
      for await (const fragment of client.streamCompletion(body.messages, modelSelector, cts.token)) {
        full += fragment;
      }
      const response: ChatCompletionResponse = {
        id,
        object: 'chat.completion',
        created,
        model: modelId,
        choices: [{ index: 0, message: { role: 'assistant', content: full }, finish_reason: 'stop' }],
        // The Language Model API doesn't expose token counts.
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
      sendJson(res, 200, response);
    } catch (err) {
      sendJson(res, 502, { error: { message: err instanceof Error ? err.message : String(err), type: 'upstream_error' } });
    } finally {
      cts.dispose();
    }
  }

  server.listen(port, '127.0.0.1', () => {
    log(`Listening on http://127.0.0.1:${port}`);
  });

  return server;
}
