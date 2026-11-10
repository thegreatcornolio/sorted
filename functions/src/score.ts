import { MAX_TRANSCRIPT_BYTES } from "./layout";
import { acceptJudgment, clipForModel, judgeTranscript, type CallJudgment, type TranscriptJudge } from "./openai";

export type { TranscriptJudge };

export type Sentiment = "positive" | "mixed" | "negative";

export type NpsBand = "promoter" | "passive" | "detractor";

export type CsatBand = "positive" | "neutral" | "negative";

export type TranscriptScore = {
  file: string;
  sentiment: Sentiment;
  mix: { positive: number; neutral: number; negative: number };
  nps: number | null;
  predictedNps: number;
  npsBand: NpsBand;
  csat: number;
  csatBand: CsatBand;
  reason: string;
  evidence: string;
  company: string | null;
  sentimentStart: Sentiment;
  sentimentEnd: Sentiment;
  resolved: boolean;
  summary: string;
  vulnerable: boolean;
  vulnerability_reason: string;
  next_step: string;
};

type Spoken = { speaker: string | null; text: string };

type Parsed = {
  company: string | null;
  surveyNps: number | null;
  text: string;
};

const SCORE_LINE = /^\s*(?:nps|score)(?:\s*[:=]\s*|\s+)(\d{1,2})(?:\s*\/\s*10)?\s*$/i;
const COMPANY_LINE = /^\s*company\s*:\s*(.+?)\s*$/i;
const SPEAKER_LINE = /^\s*(customer|agent|advisor|caller)\s*:\s*(.*)$/i;

export async function scoreTranscript(
  file: string,
  bytes: Buffer,
  judge: TranscriptJudge = judgeTranscript,
): Promise<TranscriptScore> {
  if (bytes.length > MAX_TRANSCRIPT_BYTES) throw new Error("File is too large to score.");
  if (bytes.includes(0)) throw new Error("File is not text.");
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("Transcript is empty.");
  const parsed = parseTranscript(text);
  const judgment = acceptJudgment(await judge(clipForModel(parsed.text)), parsed.text);
  return scoreFromJudgment(file, parsed, judgment);
}

function scoreFromJudgment(file: string, parsed: Parsed, judgment: CallJudgment): TranscriptScore {
  const sentiment = judgment.sentiment_end;
  return {
    file,
    sentiment,
    mix: mixFor(sentiment),
    nps: parsed.surveyNps,
    predictedNps: judgment.predicted_nps,
    npsBand: judgment.nps_category,
    csat: judgment.csat,
    csatBand: csatBand(judgment.csat),
    reason: judgment.primary_reason,
    evidence: judgment.evidence,
    company: parsed.company,
    sentimentStart: judgment.sentiment_start,
    sentimentEnd: judgment.sentiment_end,
    resolved: judgment.resolved,
    summary: judgment.summary,
    vulnerable: judgment.vulnerable,
    vulnerability_reason: judgment.vulnerability_reason,
    next_step: judgment.next_step,
  };
}

function csatBand(csat: number): CsatBand {
  if (csat >= 4) return "positive";
  if (csat <= 2) return "negative";
  return "neutral";
}

function mixFor(sentiment: Sentiment): TranscriptScore["mix"] {
  if (sentiment === "positive") return { positive: 100, neutral: 0, negative: 0 };
  if (sentiment === "negative") return { positive: 0, neutral: 0, negative: 100 };
  return { positive: 0, neutral: 100, negative: 0 };
}

function parseTranscript(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJson(trimmed);
  return parsePlain(text);
}

function parseJson(text: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (Array.isArray(data)) return { company: null, surveyNps: null, text: spokenText(readLines(data)) };
  if (!data || typeof data !== "object") throw new Error("File is not a transcript.");
  const record = data as Record<string, unknown>;
  if (isAsrCall(record)) return { company: null, surveyNps: null, text: record.text.trim() };
  const company = stringField(record.company);
  const surveyNps = readScore(record);
  const lines = Array.isArray(record.lines) ? readLines(record.lines) : [];
  if (lines.length) return { company, surveyNps, text: spokenText(lines) };
  const body = typeof record.text === "string" ? record.text : typeof record.transcript === "string" ? record.transcript : "";
  if (!body.trim()) throw new Error("Transcript is empty.");
  const plain = parsePlain(body);
  if (surveyNps != null && plain.surveyNps != null && surveyNps !== plain.surveyNps) throw new Error("The file has more than one score.");
  return { company: company ?? plain.company, surveyNps: surveyNps ?? plain.surveyNps, text: plain.text };
}

function isAsrCall(record: Record<string, unknown>): record is { text: string } {
  return (
    typeof record.text === "string" &&
    record.text.trim().length > 0 &&
    Array.isArray(record.words) &&
    "audio_duration" in record &&
    "confidence" in record &&
    "redacted_pii_policies" in record
  );
}

function readLines(value: unknown[]): Spoken[] {
  const lines: Spoken[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) lines.push({ speaker: null, text });
      continue;
    }
    if (!item || typeof item !== "object" || typeof (item as { text?: unknown }).text !== "string") continue;
    const text = (item as { text: string }).text.trim();
    if (!text) continue;
    lines.push({ speaker: stringField((item as { speaker?: unknown }).speaker), text });
  }
  return lines;
}

function readScore(record: Record<string, unknown>): number | null {
  const keys = ["nps", "NPS", "score", "Score"].filter((key) => record[key] != null && record[key] !== "");
  if (!keys.length) return null;
  const values = keys.map((key) => parseScore(record[key]));
  if (values.some((value) => value == null)) throw new Error("Score must be a whole number from 0 to 10.");
  if (new Set(values).size > 1) throw new Error("The file has more than one score.");
  return values[0] as number;
}

function parseScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10) return value;
  if (typeof value === "string" && /^\d{1,2}$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (parsed <= 10) return parsed;
  }
  return null;
}

function stringField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parsePlain(text: string): Parsed {
  let surveyNps: number | null = null;
  let company: string | null = null;
  const lines: Spoken[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const speaker = raw.match(SPEAKER_LINE);
    if (speaker) {
      const spoken = speaker[2].trim();
      if (spoken) lines.push({ speaker: speaker[1], text: spoken });
      continue;
    }
    const scored = raw.match(SCORE_LINE);
    if (scored) {
      const value = Number(scored[1]);
      if (!Number.isInteger(value) || value > 10) throw new Error("Score must be a whole number from 0 to 10.");
      if (surveyNps != null && surveyNps !== value) throw new Error("The file has more than one score.");
      surveyNps = value;
      continue;
    }
    const named = raw.match(COMPANY_LINE);
    if (named) {
      const value = named[1].trim();
      if (value) company = value;
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed) lines.push({ speaker: null, text: trimmed });
  }
  return { company, surveyNps, text: spokenText(lines) };
}

function spokenText(lines: Spoken[]): string {
  const text = lines
    .map((line) => (line.speaker ? `${line.speaker}: ${line.text}` : line.text))
    .join("\n")
    .trim();
  if (!text) throw new Error("Transcript is empty.");
  return text;
}
