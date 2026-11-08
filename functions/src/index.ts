import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { readScoredResults, scoreDroppedBlob } from "./azure";
import { CONNECTION_SETTING, INCOMING_CONTAINER } from "./layout";
import { PULSE_ROUTE, pulseHttp } from "./pulse";

export async function scoreIncomingBlob(blob: unknown, context: InvocationContext): Promise<void> {
  const name = blobName(context);
  context.log(`Scoring ${name}`);
  await scoreDroppedBlob(name, toBuffer(blob));
}

export async function sentimentPulse(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return toResponse(pulseHttp("OPTIONS", []));
  try {
    return toResponse(pulseHttp(request.method, await readScoredResults()));
  } catch (error) {
    context.error(error);
    const fallback = pulseHttp("GET", []);
    return { status: 500, headers: fallback.headers, jsonBody: { error: "Scored results could not be read." } };
  }
}

app.storageBlob("scoreIncoming", {
  path: `${INCOMING_CONTAINER}/{name}`,
  connection: CONNECTION_SETTING,
  source: "LogsAndContainerScan",
  handler: scoreIncomingBlob,
});

app.http("sentimentPulse", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: PULSE_ROUTE,
  handler: sentimentPulse,
});

function toResponse(result: { status: number; headers: Record<string, string>; body: string }): HttpResponseInit {
  return { status: result.status, headers: result.headers, body: result.body };
}

function blobName(context: InvocationContext): string {
  const metadata = context.triggerMetadata ?? {};
  const raw = metadata.name ?? metadata.blobTrigger;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Blob name is missing.");
  const name = raw.trim();
  const prefix = `${INCOMING_CONTAINER}/`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function toBuffer(blob: unknown): Buffer {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  throw new Error("Blob content is missing.");
}
