import { extname } from "node:path";
import { MAX_TRANSCRIPT_BYTES, RESULTS_PREFIX } from "./layout";
import { transcriptName } from "./run";
import type { TranscriptStore } from "./store";

const ALLOWED = new Set([".txt", ".text", ".md", ".json", ""]);

export type UploadFile = { name: string; bytes: Buffer; contentType: string };

export type UploadReceipt = {
  uploaded: string[];
  rejected: { file: string; error: string }[];
};

export type TranscriptProgress = {
  file: string;
  state: "processing" | "scored" | "failed";
  error: string | null;
  result: unknown;
};

export async function uploadFiles(incoming: TranscriptStore, files: UploadFile[]): Promise<UploadReceipt> {
  const uploaded: string[] = [];
  const rejected: UploadReceipt["rejected"] = [];
  for (const file of files) {
    try {
      const name = transcriptFileName(file.name);
      if (file.bytes.length > MAX_TRANSCRIPT_BYTES) throw new Error("File is too large to score.");
      await incoming.write(name, file.bytes, contentTypeFor(name, file.contentType));
      uploaded.push(name);
    } catch (error) {
      rejected.push({ file: file.name || "(unnamed)", error: messageOf(error) });
    }
  }
  return { uploaded, rejected };
}

export async function watchTranscript(incoming: TranscriptStore, processed: TranscriptStore, name: string): Promise<TranscriptProgress> {
  const safe = transcriptFileName(name);
  const errorText = await readOptional(processed, `${RESULTS_PREFIX}${safe}.error.json`);
  if (errorText) {
    const parsed = parseJson(errorText);
    const error = parsed && typeof parsed.error === "string" ? parsed.error : "Scoring failed.";
    return { file: safe, state: "failed", error, result: null };
  }
  const resultText = await readOptional(processed, `${RESULTS_PREFIX}${safe}.json`);
  if (resultText) return { file: safe, state: "scored", error: null, result: parseJson(resultText) };
  await readOptional(incoming, safe);
  return { file: safe, state: "processing", error: null, result: null };
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

async function readOptional(store: TranscriptStore, name: string): Promise<string | null> {
  try {
    return (await store.read(name)).toString("utf8");
  } catch {
    return null;
  }
}

function parseJson(text: string): { error?: unknown } | null {
  try {
    const value = JSON.parse(text) as { error?: unknown };
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Upload failed.";
}
