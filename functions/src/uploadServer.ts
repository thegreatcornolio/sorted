import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openStores } from "./azure";
import { CONNECTION_SETTING } from "./layout";
import { loadLocalSettings } from "./settings";
import { uploadFiles, watchTranscript, type TranscriptProgress, type UploadFile, type UploadReceipt } from "./uploadFiles";

export const UPLOAD_HOST = "127.0.0.1";
export const UPLOAD_PORT = 8787;
const MAX_BODY = 8 * 1024 * 1024;

const pagePath = resolve(__dirname, "../upload/index.html");

if (require.main === module) {
  loadLocalSettings();
  const server = createServer((request, response) => {
    void respond(request, response);
  });
  server.listen(UPLOAD_PORT, UPLOAD_HOST, () => {
    console.log(`Upload page at http://${UPLOAD_HOST}:${UPLOAD_PORT}/`);
  });
}

async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const raw = request.method === "POST" ? await readBody(request) : Buffer.alloc(0);
    const result = await handleUpload(request.method ?? "GET", request.url ?? "/", raw, {
      page: readFileSync(pagePath, "utf8"),
      upload: uploadFromEnv,
      status: statusFromEnv,
    });
    response.writeHead(result.status, {
      "content-type": result.contentType,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    response.end(result.body);
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Upload failed.";
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end(message);
  }
}

export async function handleUpload(
  method: string,
  url: string,
  rawBody: Buffer,
  options: {
    page: string;
    upload: (files: UploadFile[]) => Promise<UploadReceipt>;
    status: (name: string) => Promise<TranscriptProgress>;
  },
): Promise<{ status: number; contentType: string; body: string }> {
  const path = url.split("?")[0] ?? "/";
  if (method === "GET" && (path === "/" || path === "/index.html")) {
    return { status: 200, contentType: "text/html; charset=utf-8", body: options.page };
  }
  if (method === "GET" && path === "/status") {
    const name = new URL(url, "http://127.0.0.1").searchParams.get("name") ?? "";
    const progress = await options.status(name);
    return { status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(progress) };
  }
  if (method === "POST" && path === "/upload") {
    const files = filesFromBody(rawBody);
    const summary = await options.upload(files);
    return { status: 200, contentType: "application/json; charset=utf-8", body: JSON.stringify(summary) };
  }
  return { status: 404, contentType: "text/plain; charset=utf-8", body: "Not found" };
}

export function filesFromBody(rawBody: Buffer): UploadFile[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("Upload was not understood.");
  }
  const files = parsed && typeof parsed === "object" ? (parsed as { files?: unknown }).files : undefined;
  if (!Array.isArray(files) || files.length === 0) throw new Error("Choose at least one transcript.");
  return files.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Upload was not understood.");
    const record = item as { name?: unknown; contentType?: unknown; body?: unknown };
    if (typeof record.name !== "string" || typeof record.body !== "string") throw new Error("Upload was not understood.");
    const contentType = typeof record.contentType === "string" ? record.contentType : "";
    return { name: record.name, contentType, bytes: Buffer.from(record.body, "base64") };
  });
}

async function uploadFromEnv(files: UploadFile[]): Promise<UploadReceipt> {
  const { incoming } = await openStores(requiredConnection());
  return uploadFiles(incoming, files);
}

async function statusFromEnv(name: string): Promise<TranscriptProgress> {
  const { incoming, processed } = await openStores(requiredConnection());
  return watchTranscript(incoming, processed, name);
}

function requiredConnection(): string {
  const connection = process.env[CONNECTION_SETTING]?.trim();
  if (!connection) throw new Error(`${CONNECTION_SETTING} is not set.`);
  return connection;
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Upload is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}
