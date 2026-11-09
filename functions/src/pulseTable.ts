import { TableClient } from "@azure/data-tables";
import { CONNECTION_SETTING, PULSE_TABLE } from "./layout";
import type { PulseLedger } from "./pulseLedger";

const PARTITION = "pulse";
const ROW = "current";
const CHUNK = 30_000;
const MAX_BODY = 900_000;
const READ_ERROR = "Scored results could not be read.";

export const PULSE_READ_MS = 2_000;

export function packPulse(body: string): Record<string, string | number> {
  if (body.length > MAX_BODY) throw new Error("Sentiment pulse store is full.");
  const parts = Math.max(1, Math.ceil(body.length / CHUNK));
  const packed: Record<string, string | number> = { parts };
  for (let index = 0; index < parts; index += 1) packed[`p${index}`] = body.slice(index * CHUNK, (index + 1) * CHUNK);
  return packed;
}

export function unpackPulse(entity: Record<string, unknown>): string {
  const parts = entity.parts;
  if (typeof parts !== "number" || !Number.isInteger(parts) || parts < 1) throw new Error("Sentiment pulse store is unreadable.");
  let body = "";
  for (let index = 0; index < parts; index += 1) {
    const piece = entity[`p${index}`];
    if (typeof piece !== "string") throw new Error("Sentiment pulse store is unreadable.");
    body += piece;
  }
  return body;
}

export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(READ_ERROR)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function readPulseRecord(
  connectionString: string,
  read: (signal: AbortSignal) => Promise<Record<string, unknown> | null> = (signal) => readTableEntity(connectionString, signal),
  ms = PULSE_READ_MS,
): Promise<unknown[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const entity = await withDeadline(read(controller.signal), ms);
    if (!entity) return null;
    const parsed: unknown = JSON.parse(unpackPulse(entity));
    if (!Array.isArray(parsed)) throw new Error("Sentiment pulse store is unreadable.");
    return parsed;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw new Error(READ_ERROR);
  } finally {
    clearTimeout(timer);
  }
}

async function readTableEntity(connectionString: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  let table: TableClient;
  try {
    table = TableClient.fromConnectionString(connectionString, PULSE_TABLE, { retryOptions: { maxRetries: 0 } });
  } catch {
    throw new Error(`${CONNECTION_SETTING} is not a storage connection string.`);
  }
  return table.getEntity(PARTITION, ROW, { abortSignal: signal });
}

export function tableLedger(connectionString: string): PulseLedger {
  let chain: Promise<void> = Promise.resolve();
  let opened: Promise<TableClient> | undefined;
  const client = () => {
    opened ??= openTable(connectionString).catch((error: unknown) => {
      opened = undefined;
      throw error;
    });
    return opened;
  };
  const exclusive = async <T>(work: () => Promise<T>): Promise<T> => {
    const previous = chain;
    let release: () => void = () => undefined;
    chain = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
  return {
    async read() {
      return exclusive(async () => readCurrent(await client()));
    },
    async write(calls) {
      await exclusive(async () => {
        await writeCurrent(await client(), calls);
      });
    },
    async update(change) {
      await exclusive(async () => {
        const table = await client();
        const current = await readCurrent(table);
        await writeCurrent(table, await change(current));
      });
    },
  };
}

async function readCurrent(table: TableClient): Promise<unknown[] | null> {
  try {
    const entity = await table.getEntity(PARTITION, ROW);
    const parsed: unknown = JSON.parse(unpackPulse(entity));
    if (!Array.isArray(parsed)) throw new Error("Sentiment pulse store is unreadable.");
    return parsed;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

async function writeCurrent(table: TableClient, calls: unknown[]): Promise<void> {
  const body = JSON.stringify(calls);
  await table.upsertEntity({ partitionKey: PARTITION, rowKey: ROW, ...packPulse(body) }, "Replace");
}

async function openTable(connectionString: string): Promise<TableClient> {
  let table: TableClient;
  try {
    table = TableClient.fromConnectionString(connectionString, PULSE_TABLE);
  } catch {
    throw new Error(`${CONNECTION_SETTING} is not a storage connection string.`);
  }
  try {
    await table.createTable();
  } catch (error) {
    if (statusOf(error) !== 409) throw error;
  }
  return table;
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  const status = (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : undefined;
}
