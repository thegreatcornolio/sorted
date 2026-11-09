import { RESULTS_PREFIX } from "./layout";
import { scoreTranscript, type TranscriptScore } from "./score";
import type { TranscriptStore } from "./store";

export type ScoreSummary = {
  scored: string[];
  failed: { file: string; error: string }[];
};

export type ScoredRecord = {
  file: string;
  sentiment: TranscriptScore["sentiment"];
  mix: TranscriptScore["mix"];
  nps: number | null;
  npsBand: TranscriptScore["npsBand"];
  reason: string | null;
  evidence: string | null;
  company: string | null;
  scoredAt: string;
};

export async function scoreIncoming(
  incoming: TranscriptStore,
  processed: TranscriptStore,
  now: () => Date = () => new Date(),
  onScored?: (record: ScoredRecord) => Promise<void>,
): Promise<ScoreSummary> {
  const listed = await incoming.list();
  const summary: ScoreSummary = { scored: [], failed: [] };
  for (const blob of listed) {
    if (blob.name.endsWith("/")) continue;
    let bytes: Buffer;
    try {
      bytes = await incoming.read(blob.name);
    } catch (error) {
      summary.failed.push({ file: blob.name, error: messageOf(error) });
      continue;
    }
    const outcome = await scoreOne(incoming, processed, blob.name, bytes, now, onScored);
    if (outcome.status === "scored") summary.scored.push(outcome.file);
    else summary.failed.push({ file: outcome.file, error: outcome.error });
  }
  return summary;
}

export async function scoreOne(
  incoming: TranscriptStore,
  processed: TranscriptStore,
  name: string,
  bytes: Buffer,
  now: () => Date = () => new Date(),
  onScored?: (record: ScoredRecord) => Promise<void>,
): Promise<{ status: "scored"; file: string } | { status: "failed"; file: string; error: string }> {
  let safe: string;
  try {
    safe = transcriptName(name);
  } catch (error) {
    return { status: "failed", file: name, error: messageOf(error) };
  }
  const resultName = `${RESULTS_PREFIX}${safe}.json`;
  const errorName = `${RESULTS_PREFIX}${safe}.error.json`;
  try {
    const score = scoreTranscript(safe, bytes);
    const record = resultBody(score, now().toISOString());
    await processed.write(resultName, jsonBuffer(record), "application/json; charset=utf-8");
    if (onScored) await onScored(record);
    try {
      await processed.write(safe, bytes, contentType(safe));
      await incoming.remove(safe);
    } catch (error) {
      const message = messageOf(error);
      await writeError(processed, errorName, safe, message, now().toISOString());
      return { status: "failed", file: safe, error: message };
    }
    await processed.remove(errorName);
    return { status: "scored", file: safe };
  } catch (error) {
    const message = messageOf(error);
    await writeError(processed, errorName, safe, message, now().toISOString());
    return { status: "failed", file: safe, error: message };
  }
}

export function transcriptName(name: string): string {
  const parts = name.split("/");
  if (!name || name.endsWith("/") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Transcript name is not a file.");
  }
  return name;
}

function resultBody(score: TranscriptScore, scoredAt: string): ScoredRecord {
  return {
    file: score.file,
    sentiment: score.sentiment,
    mix: score.mix,
    nps: score.nps,
    npsBand: score.npsBand,
    reason: score.reason,
    evidence: score.evidence,
    company: score.company,
    scoredAt,
  };
}

function contentType(name: string): string {
  if (name.endsWith(".json")) return "application/json; charset=utf-8";
  if (name.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function jsonBuffer(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function writeError(processed: TranscriptStore, name: string, file: string, error: string, failedAt: string): Promise<void> {
  await processed.write(name, jsonBuffer({ file, error, failedAt }), "application/json; charset=utf-8");
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Scoring failed.";
}
