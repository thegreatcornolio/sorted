import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { clearStoredScores, readStoredScores, scoreIncomingFromEnv } from "./azure";
import { pulseHttp } from "./pulse";

export const PULSE_PATH = "/api/pulse";
export const CLEAR_PATH = "/api/clear-results";
export const POLL_MS = 15_000;
export const CONTAINER_PORT = 8080;

export async function handleContainerRequest(
  method: string,
  url: string,
  readResults: () => Promise<unknown[]>,
  clearResults: () => Promise<void> = async () => undefined,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const path = (url.split("?")[0] ?? "/") || "/";
  if (path === CLEAR_PATH) return clearResponse(method, clearResults);
  if (path !== PULSE_PATH) {
    return { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Not found" };
  }
  if (method === "OPTIONS") return pulseHttp("OPTIONS", []);
  if (method !== "GET") {
    const allowed = pulseHttp("OPTIONS", []);
    return { status: 405, headers: { ...allowed.headers, Allow: "GET, OPTIONS" }, body: "" };
  }
  try {
    return pulseHttp("GET", await readResults());
  } catch {
    const fallback = pulseHttp("GET", []);
    return {
      status: 500,
      headers: fallback.headers,
      body: `${JSON.stringify({ error: "Scored results could not be read." })}\n`,
    };
  }
}

export async function pollOnce(): Promise<void> {
  await scoreIncomingFromEnv();
}

export function pollError(error: unknown): string {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Scoring poll failed.";
  if (/accountkey|sharedaccesssignature|defaultendpointsprotocol|sig=/i.test(message)) return "Scoring poll failed.";
  return message;
}

export function listen(port = portFromEnv()): ReturnType<typeof createServer> {
  const server = createServer((request, response) => {
    void respond(request, response);
  });
  server.listen(port, "0.0.0.0");
  return server;
}

export async function pollForever(sleep: (ms: number) => Promise<void> = delay): Promise<never> {
  for (;;) {
    try {
      await pollOnce();
    } catch (error) {
      console.error(pollError(error));
    }
    await sleep(POLL_MS);
  }
}

async function clearResponse(
  method: string,
  clearResults: () => Promise<void>,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  if (method === "OPTIONS") return pulseHttp("OPTIONS", []);
  if (method !== "POST") {
    const allowed = pulseHttp("OPTIONS", []);
    return { status: 405, headers: { ...allowed.headers, Allow: "POST, OPTIONS" }, body: "" };
  }
  try {
    await clearResults();
    return pulseHttp("GET", []);
  } catch {
    const fallback = pulseHttp("GET", []);
    return {
      status: 500,
      headers: fallback.headers,
      body: `${JSON.stringify({ error: "Scored results could not be cleared." })}\n`,
    };
  }
}

async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const result = await handleContainerRequest(request.method ?? "GET", request.url ?? "/", readStoredScores, clearStoredScores);
  response.writeHead(result.status, result.headers);
  response.end(result.body);
}

function portFromEnv(): number {
  const raw = process.env.PORT?.trim();
  const port = raw ? Number(raw) : CONTAINER_PORT;
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : CONTAINER_PORT;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (require.main === module) {
  listen();
  void pollForever();
}
