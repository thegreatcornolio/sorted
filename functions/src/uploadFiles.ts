import { extname } from "node:path";
import { scoreIncoming, transcriptName, type ScoreSummary } from "./run";
import type { TranscriptStore } from "./store";

const MAX_BYTES = 1_048_576;
const ALLOWED = new Set([".txt", ".text", ".md", ".json", ""]);

export type UploadFile = { name: string; bytes: Buffer; contentType: string };

export type UploadResult = ScoreSummary & {
  uploaded: string[];
  rejected: { file: string; error: string }[];
};

export async function uploadThenScore(
  incoming: TranscriptStore,
  processed: TranscriptStore,
  files: UploadFile[],
  now: () => Date = () => new Date(),
): Promise<UploadResult> {
  const uploaded: string[] = [];
  const rejected: UploadResult["rejected"] = [];
  for (const file of files) {
    try {
      const name = transcriptFileName(file.name);
      if (file.bytes.length > MAX_BYTES) throw new Error("File is too large to score.");
      await incoming.write(name, file.bytes, contentTypeFor(name, file.contentType));
      uploaded.push(name);
    } catch (error) {
      rejected.push({ file: file.name || "(unnamed)", error: messageOf(error) });
    }
  }
  if (!uploaded.length) return { uploaded, rejected, scored: [], failed: [] };
  const summary = await scoreIncoming(incoming, processed, now);
  return { uploaded, rejected, scored: summary.scored, failed: summary.failed };
}

export function transcriptFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  const extension = extname(base).toLowerCase();
  if (!ALLOWED.has(extension)) throw new Error("Choose a text or JSON transcript.");
  return transcriptName(base);
}

function contentTypeFor(name: string, supplied: string): string {
  const type = supplied.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "text/plain" || type === "text/markdown" || type === "application/json") return `${type}; charset=utf-8`;
  if (name.endsWith(".json")) return "application/json; charset=utf-8";
  if (name.endsWith(".md")) return "text/markdown; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Upload failed.";
}
