import { OPENAI_API_KEY, OPENAI_API_VERSION, OPENAI_DEPLOYMENT, OPENAI_ENDPOINT } from "./layout";

type Sentiment = "positive" | "mixed" | "negative";

type NpsBand = "promoter" | "passive" | "detractor";

export const JUDGMENT_FIELDS = [
  "predicted_nps",
  "nps_category",
  "sentiment_start",
  "sentiment_end",
  "resolved",
  "csat",
  "primary_reason",
  "evidence",
  "summary",
] as const;

export const MODEL_CHARS = 100_000;

export const SCORE_INSTRUCTIONS = [
  "You score one customer-service transcript for a contact center. Reply with the JSON object only.",
  "Judge the whole call, and weigh the ending more than any single line.",
  "A complaint, a high price, or a long wait does not make the call a detractor if the caller then books, pays, and closes.",
  "A booked, paid close is not a detractor.",
  "When they book and pay but still dislike the price or the wait, predicted_nps is 9, nps_category is promoter, and csat is 4.",
  "Use predicted_nps 10 and csat 5 only when the close is clearly pleased and nothing material is left unresolved.",
  "An unresolved complaint, a refusal, a cancellation, no fix, or an angry ending is a detractor: predicted_nps 0 to 6 and csat 1 or 2.",
  "A caller who is genuinely undecided is passive: predicted_nps 7 or 8 and csat 3.",
  "A clearly pleased close is a promoter: predicted_nps 9 or 10 and csat 4 or 5.",
  "predicted_nps is an integer from 0 to 10.",
  "nps_category must be promoter for 9 to 10, passive for 7 to 8, and detractor for 0 to 6.",
  "sentiment_start and sentiment_end are each positive, mixed, or negative.",
  "sentiment_end is how the call finishes.",
  "resolved is true only when the caller's request was completed, including a booked and paid appointment.",
  "primary_reason is one short sentence.",
  "evidence is one verbatim sentence copied from the transcript, at least four words, at most 280 characters.",
  'Never use a fragment such as "O.", "Yes.", or "Okay.".',
  "summary is one or two sentences on the outcome.",
  "Polite agent phrases are not the caller's verdict.",
  "Speech-recognition confidence, redaction tokens, and any score written in the file are not a survey answer.",
  "Do not invent a quote or a score.",
].join(" ");

export type CallJudgment = {
  predicted_nps: number;
  nps_category: NpsBand;
  sentiment_start: Sentiment;
  sentiment_end: Sentiment;
  resolved: boolean;
  csat: number;
  primary_reason: string;
  evidence: string;
  summary: string;
};

export type TranscriptJudge = (transcript: string) => Promise<CallJudgment>;

export type OpenAISettings = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

const SENTIMENTS = new Set<Sentiment>(["positive", "mixed", "negative"]);
const BANDS = new Set<NpsBand>(["promoter", "passive", "detractor"]);

export function judgmentSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [...JUDGMENT_FIELDS],
    properties: {
      predicted_nps: { type: "integer" },
      nps_category: { type: "string", enum: ["promoter", "passive", "detractor"] },
      sentiment_start: { type: "string", enum: ["positive", "mixed", "negative"] },
      sentiment_end: { type: "string", enum: ["positive", "mixed", "negative"] },
      resolved: { type: "boolean" },
      csat: { type: "integer" },
      primary_reason: { type: "string" },
      evidence: { type: "string" },
      summary: { type: "string" },
    },
  };
}

export function chatBody(transcript: string): {
  messages: { role: "system" | "user"; content: string }[];
  response_format: {
    type: "json_schema";
    json_schema: { name: string; strict: true; schema: Record<string, unknown> };
  };
} {
  return {
    messages: [
      { role: "system", content: SCORE_INSTRUCTIONS },
      { role: "user", content: transcript },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "call_score", strict: true, schema: judgmentSchema() },
    },
  };
}

export function clipForModel(text: string): string {
  if (text.length <= MODEL_CHARS) return text;
  const note = "\n\n[The middle of the call is omitted. Judge the opening above and the ending below.]\n\n";
  const tail = MODEL_CHARS - 20_000 - note.length;
  return `${text.slice(0, 20_000)}${note}${text.slice(text.length - tail)}`;
}

export function openAISettings(env: NodeJS.ProcessEnv = process.env): OpenAISettings {
  const endpoint = requiredUrl(required(env, OPENAI_ENDPOINT));
  const apiKey = required(env, OPENAI_API_KEY);
  const deployment = required(env, OPENAI_DEPLOYMENT);
  const apiVersion = required(env, OPENAI_API_VERSION);
  if (endpoint.includes(apiKey)) throw new Error(`${OPENAI_ENDPOINT} is not a URL.`);
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(deployment)) throw new Error(`${OPENAI_DEPLOYMENT} is not a deployment name.`);
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(apiVersion)) throw new Error(`${OPENAI_API_VERSION} is not an API version.`);
  return { endpoint, apiKey, deployment, apiVersion };
}

export function chatUrl(settings: OpenAISettings): string {
  return `${settings.endpoint}/openai/deployments/${encodeURIComponent(settings.deployment)}/chat/completions?api-version=${encodeURIComponent(settings.apiVersion)}`;
}

export function bandForNps(nps: number): NpsBand {
  if (nps >= 9) return "promoter";
  if (nps >= 7) return "passive";
  return "detractor";
}

export function acceptJudgment(value: unknown, transcript: string): CallJudgment {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Azure OpenAI did not return strict JSON.");
  const record = value as Record<string, unknown>;
  const fields = new Set<string>(JUDGMENT_FIELDS);
  if (Object.keys(record).some((key) => !fields.has(key)) || JUDGMENT_FIELDS.some((key) => !(key in record))) {
    throw new Error("Azure OpenAI returned an unexpected field.");
  }
  const predicted = record.predicted_nps;
  if (typeof predicted !== "number" || !Number.isInteger(predicted) || predicted < 0 || predicted > 10) {
    throw new Error("predicted_nps must be a whole number from 0 to 10.");
  }
  const category = record.nps_category;
  if (typeof category !== "string" || !BANDS.has(category as NpsBand)) throw new Error("The score does not match its NPS band.");
  const band = category as NpsBand;
  if (band !== bandForNps(predicted)) throw new Error("The score does not match its NPS band.");
  const sentimentStart = sentimentField(record.sentiment_start);
  const sentimentEnd = sentimentField(record.sentiment_end);
  if (typeof record.resolved !== "boolean") throw new Error("resolved must be true or false.");
  const csat = record.csat;
  if (typeof csat !== "number" || !Number.isInteger(csat) || csat < 1 || csat > 5 || !csatMatches(band, csat)) {
    throw new Error("The CSAT does not match the NPS band.");
  }
  const reason = shortText(record.primary_reason, 180);
  if (!reason) throw new Error("The score is missing a reason.");
  const summary = shortText(record.summary, 600);
  if (!summary) throw new Error("The score is missing a summary.");
  const evidence = evidenceQuote(record.evidence, transcript);
  return {
    predicted_nps: predicted,
    nps_category: band,
    sentiment_start: sentimentStart,
    sentiment_end: sentimentEnd,
    resolved: record.resolved,
    csat,
    primary_reason: reason,
    evidence,
    summary,
  };
}

export function evidenceQuote(value: unknown, transcript: string): string {
  if (typeof value !== "string") throw new Error("Evidence is not a sentence from the transcript.");
  const quote = value.trim();
  const words = quote
    .replace(/\[[A-Za-z0-9_]+\]/g, " ")
    .replace(/[^A-Za-z']+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  if (!transcript.includes(quote) || quote.length > 280 || quote.includes("\n") || words.length < 4) {
    throw new Error("Evidence is not a sentence from the transcript.");
  }
  return quote;
}

export async function judgeTranscript(
  transcript: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<CallJudgment> {
  const settings = openAISettings(env);
  try {
    const response = await fetchImpl(chatUrl(settings), {
      method: "POST",
      headers: { "api-key": settings.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(chatBody(transcript)),
      signal: AbortSignal.timeout(45_000),
    });
    const raw = await response.text();
    if (!response.ok || raw.length > 100_000) throw new Error(`Azure OpenAI scoring failed (${response.status}).`);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("Azure OpenAI did not return JSON.");
    }
    return acceptJudgment(JSON.parse(readContent(payload)), transcript);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new Error("Azure OpenAI scoring timed out.");
    }
    if (error instanceof SyntaxError) throw new Error("Azure OpenAI did not return strict JSON.");
    throw guard(error, settings.apiKey);
  }
}

export function safeErrorMessage(error: unknown, secretFallback = "Scoring failed."): string {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : secretFallback;
  if (/accountkey|sharedaccesssignature|defaultendpointsprotocol|sig=|api-key\s*[:=]/i.test(message)) return secretFallback;
  return message;
}

function readContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("Azure OpenAI did not return a score.");
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") throw new Error("Azure OpenAI did not return a score.");
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") throw new Error("Azure OpenAI did not return a score.");
  const refusal = (message as { refusal?: unknown }).refusal;
  if (typeof refusal === "string" && refusal.trim()) throw new Error("Azure OpenAI refused to score the transcript.");
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Azure OpenAI did not return a score.");
  return content.trim();
}

function sentimentField(value: unknown): Sentiment {
  if (typeof value !== "string" || !SENTIMENTS.has(value as Sentiment)) throw new Error("Sentiment must be positive, mixed, or negative.");
  return value as Sentiment;
}

function csatMatches(band: NpsBand, csat: number): boolean {
  if (band === "promoter") return csat >= 4;
  if (band === "passive") return csat === 3;
  return csat <= 2;
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function requiredUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${OPENAI_ENDPOINT} is not a URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error(`${OPENAI_ENDPOINT} is not a URL.`);
  }
  return url.origin;
}

function guard(error: unknown, apiKey: string): Error {
  if (!(error instanceof Error) || !error.message.trim()) return new Error("Azure OpenAI scoring failed.");
  if (apiKey && error.message.includes(apiKey)) return new Error("Azure OpenAI scoring failed.");
  return error;
}
