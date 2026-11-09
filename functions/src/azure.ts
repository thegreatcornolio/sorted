import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { CONNECTION_SETTING, INCOMING_CONTAINER, PROCESSED_CONTAINER } from "./layout";
import { isResultBlob } from "./pulse";
import { loadScores, rememberScore, seedScores, type PulseLedger } from "./pulseLedger";
import { tableLedger } from "./pulseTable";
import { scoreIncoming, scoreOne, type ScoreSummary } from "./run";
import type { TranscriptStore } from "./store";

let ledger: PulseLedger | null = null;

export async function scoreIncomingFromEnv(): Promise<ScoreSummary> {
  const connection = requiredConnection();
  const { incoming, processed } = await openStores(connection);
  const store = pulseStore(connection);
  await seedStore(store, processed);
  return scoreIncoming(incoming, processed, () => new Date(), (record) => rememberScore(store, record));
}

export async function scoreDroppedBlob(name: string, bytes: Buffer): Promise<void> {
  const connection = requiredConnection();
  const { incoming, processed } = await openStores(connection);
  const store = pulseStore(connection);
  await seedStore(store, processed);
  await scoreOne(incoming, processed, name, bytes, () => new Date(), (record) => rememberScore(store, record));
}

export async function readStoredScores(): Promise<unknown[]> {
  return loadScores(pulseStore(requiredConnection()));
}

function pulseStore(connection: string): PulseLedger {
  ledger ??= tableLedger(connection);
  return ledger;
}

async function seedStore(store: PulseLedger, processed: TranscriptStore): Promise<void> {
  if ((await store.read()) != null) return;
  await seedScores(store, await listResultRecords(processed));
}

async function listResultRecords(processed: TranscriptStore): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const blob of await processed.list()) {
    if (!isResultBlob(blob.name)) continue;
    try {
      results.push(JSON.parse((await processed.read(blob.name)).toString("utf8")) as unknown);
    } catch {
      continue;
    }
  }
  return results;
}

function requiredConnection(): string {
  const connection = process.env[CONNECTION_SETTING]?.trim();
  if (!connection) throw new Error(`${CONNECTION_SETTING} is not set.`);
  return connection;
}

export async function openStores(connectionString: string): Promise<{ incoming: TranscriptStore; processed: TranscriptStore }> {
  let service: BlobServiceClient;
  try {
    service = BlobServiceClient.fromConnectionString(connectionString);
  } catch {
    throw new Error(`${CONNECTION_SETTING} is not a storage connection string.`);
  }
  const incoming = service.getContainerClient(INCOMING_CONTAINER);
  const processed = service.getContainerClient(PROCESSED_CONTAINER);
  try {
    if (!(await incoming.exists())) throw new Error(`Blob container ${INCOMING_CONTAINER} does not exist.`);
    if (!(await processed.exists())) throw new Error(`Blob container ${PROCESSED_CONTAINER} does not exist.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Blob container ")) throw error;
    const message = error instanceof Error && error.message.trim() ? error.message.trim() : "Storage could not be reached.";
    throw new Error(message);
  }
  return { incoming: bindContainer(incoming), processed: bindContainer(processed) };
}

function bindContainer(container: ContainerClient): TranscriptStore {
  return {
    async list() {
      const names: { name: string }[] = [];
      for await (const blob of container.listBlobsFlat()) {
        if (!blob.name.endsWith("/")) names.push({ name: blob.name });
      }
      return names;
    },
    async read(name) {
      return container.getBlobClient(name).downloadToBuffer();
    },
    async write(name, body, contentType) {
      await container.getBlockBlobClient(name).upload(body, body.length, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
    },
    async remove(name) {
      await container.getBlobClient(name).deleteIfExists();
    },
  };
}
