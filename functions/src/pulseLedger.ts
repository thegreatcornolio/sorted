import type { ScoredRecord } from "./run";

export type PulseLedger = {
  /** null means the store has never been written. */
  read(): Promise<unknown[] | null>;
  write(calls: unknown[]): Promise<void>;
};

export async function rememberScore(ledger: PulseLedger, record: ScoredRecord): Promise<void> {
  const current = (await ledger.read()) ?? [];
  const next = current.filter((item) => !sameFile(item, record.file));
  next.push(record);
  next.sort(byArrival);
  await ledger.write(next);
}

export async function loadScores(ledger: PulseLedger): Promise<unknown[]> {
  return (await ledger.read()) ?? [];
}

export async function reconcilePulse(
  ledger: PulseLedger,
  hasResults: boolean,
  loadRecords: () => Promise<unknown[]>,
): Promise<void> {
  if (!hasResults) {
    const current = await ledger.read();
    if (current == null || current.length > 0) await ledger.write([]);
    return;
  }
  if ((await ledger.read()) != null) return;
  await seedScores(ledger, await loadRecords());
}

export async function seedScores(ledger: PulseLedger, records: unknown[]): Promise<void> {
  if ((await ledger.read()) != null) return;
  const next = records.filter((item) => item && typeof item === "object");
  next.sort(byArrival);
  await ledger.write(next);
}

function sameFile(item: unknown, file: string): boolean {
  return !!item && typeof item === "object" && "file" in item && (item as { file?: unknown }).file === file;
}

function byArrival(a: unknown, b: unknown): number {
  const left = stamp(a);
  const right = stamp(b);
  return left.scoredAt.localeCompare(right.scoredAt) || left.file.localeCompare(right.file);
}

function stamp(value: unknown): { file: string; scoredAt: string } {
  if (!value || typeof value !== "object") return { file: "", scoredAt: "" };
  const record = value as { file?: unknown; scoredAt?: unknown };
  return {
    file: typeof record.file === "string" ? record.file : "",
    scoredAt: typeof record.scoredAt === "string" ? record.scoredAt : "",
  };
}
