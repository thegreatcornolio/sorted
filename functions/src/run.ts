import { RESULTS_PREFIX } from "./layout";
import { scoreTranscript, type TranscriptScore } from "./score";
import type { TranscriptStore } from "./store";

export type ScoreSummary = {
  scored: string[];
  failed: { file: string; error: string }[];
};

export async function scoreIncoming(
  incoming: TranscriptStore,
  processed: TranscriptStore,
  now: () => Date = () => new Date(),
): Promise<ScoreSummary> {
  const listed = await incoming.list();
  const summary: ScoreSummary = { scored: [], failed: [] };
  for (const blob of listed) {
    if (blob.name.endsWith("/")) continue;
    let name: string;
    try {
      name = transcriptName(blob.name);
    } catch (error) {
      summary.failed.push({ file: blob.name, error: messageOf(error) });
      continue;
    }
    const resultName = `${RESULTS_PREFIX}${name}.json`;
    const errorName = `${RESULTS_PREFIX}${name}.error.json`;
    try {
      const bytes = await incoming.read(name);
      const score = scoreTranscript(name, bytes);
      await processed.write(resultName, jsonBuffer(resultBody(score, now().toISOString())), "application/json; charset=utf-8");
      try {
        await processed.write(name, bytes, contentType(name));
        await incoming.remove(name);
      } catch (error) {
        await writeError(processed, errorName, name, messageOf(error), now().toISOString());
        summary.failed.push({ file: name, error: messageOf(error) });
        continue;
      }
      await processed.remove(errorName);
      summary.scored.push(name);
    } catch (error) {
      const message = messageOf(error);
      await writeError(processed, errorName, name, message, now().toISOString());
      summary.failed.push({ file: name, error: message });
    }
  }
  return summary;
}

export function transcriptName(name: string): string {
  const parts = name.split("/");
  if (!name || name.endsWith("/") || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Transcript name is not a file.");
  }
  return name;
}

function resultBody(score: TranscriptScore, scoredAt: string) {
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
  try {
    await processed.write(name, jsonBuffer({ file, error, failedAt }), "application/json; charset=utf-8");
  } catch {
    // The source stays in incomingtranscripts. A later pass can write the error.
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Scoring failed.";
}
