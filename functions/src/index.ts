import { app, type InvocationContext } from "@azure/functions";
import { scoreDroppedBlob } from "./azure";
import { CONNECTION_SETTING, INCOMING_CONTAINER } from "./layout";

export async function scoreIncomingBlob(blob: unknown, context: InvocationContext): Promise<void> {
  const name = blobName(context);
  context.log(`Scoring ${name}`);
  await scoreDroppedBlob(name, toBuffer(blob));
}

app.storageBlob("scoreIncoming", {
  path: `${INCOMING_CONTAINER}/{name}`,
  connection: CONNECTION_SETTING,
  source: "LogsAndContainerScan",
  handler: scoreIncomingBlob,
});

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
