import type { ScoredRecord } from "./run";

export type PulseLedger = {
  /** null means the store has never been written. An empty array is a written pulse. */
  read(): Promise<unknown[] | null>;
  write(calls: unknown[]): Promise<void>;
  update(change: (current: unknown[] | null) => unknown[] | Promise<unknown[]>): Promise<void>;
};

export async function rememberScore(ledger: PulseLedger, record: ScoredRecord): Promise<void> {
  await ledger.update((current) => {
    const next = (current ?? []).filter((item) => !sameFile(item, record.file));
    next.push(record);
    next.sort(byArrival);
    return next;
  });
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
    await ledger.update((current) => (current == null || current.length > 0 ? [] : current));
    return;
  }
  if ((await ledger.read()) != null) return;
  await seedScores(ledger, await loadRecords());
}

export async function seedScores(ledger: PulseLedger, records: unknown[]): Promise<void> {
  await ledger.update((current) => {
    if (current != null) return current;
    const next = records.filter((item) => item && typeof item === "object");
    next.sort(byArrival);
    return next;
  });
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
