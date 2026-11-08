import { MAX_TRANSCRIPT_BYTES } from "./layout";

export type Sentiment = "positive" | "mixed" | "negative";

export type NpsBand = "promoter" | "passive" | "detractor";

export type TranscriptScore = {
  file: string;
  sentiment: Sentiment;
  mix: { positive: number; neutral: number; negative: number };
  nps: number | null;
  npsBand: NpsBand | null;
  reason: string | null;
  evidence: string | null;
  company: string | null;
};

type Spoken = { speaker: string | null; text: string };

type Parsed = {
  company: string | null;
  score: number | null;
  lines: Spoken[];
  fromCall: boolean;
};

const THEMES: { reason: string; pattern: RegExp }[] = [
  { reason: "They wanted to cancel", pattern: /\bcancel/i },
  { reason: "The price of the cover", pattern: /premium|too expensive|can't afford|cannot afford/i },
  { reason: "A claim or payout", pattern: /\bclaim\b|payout|pay out/i },
  { reason: "A refund that is missing or short", pattern: /refund|money back|short of the full/i },
  {
    reason: "A bill, fee, or charge that should not be there",
    pattern: /\bbill\b|extra fee|\bcharged\b|\bcharge\b|demand for payment|too late to pay/i,
  },
  {
    reason: "Delivery was late, broken, or the wrong item",
    pattern: /arrived late|days late|\blate\b|broken|wrong item|parcel|delivery/i,
  },
  {
    reason: "A long wait, a missed callback, or being passed around",
    pattern: /on hold|callback|transferred|passed around|forty minutes/i,
  },
  {
    reason: "The account was locked, closed, or a complaint was ignored",
    pattern: /locked out|\blocked\b|no warning|complaint|ignored|no one came back|account (?:was )?closed/i,
  },
];

const NEGATIVE = [
  /\btoo late to pay\b/i,
  /\bdemand for payment\b/i,
  /\barrived late\b/i,
  /\bdays late\b/i,
  /\bbroken\b/i,
  /\bstill waiting\b/i,
  /\brefund\b/i,
  /\bextra fee\b/i,
  /\bweren't told\b/i,
  /\bwere not told\b/i,
  /\bon hold\b/i,
  /\bforty minutes\b/i,
  /\bwrong item\b/i,
  /\blocked out\b/i,
  /\bcharged\b/i,
  /\bcallback\b/i,
  /\btransferred\b/i,
  /\bcancell?ed\b/i,
  /\bcomplaint\b/i,
  /\bno one came back\b/i,
  /\bignored\b/i,
  /\bangry\b/i,
  /\bfurious\b/i,
  /\bdisappointed\b/i,
  /\bfrustrat/i,
  /\bterrible\b/i,
  /\bawful\b/i,
  /\bhorrible\b/i,
  /\bunacceptable\b/i,
  /\bunhappy\b/i,
  /\bnot happy\b/i,
  /\bappalling\b/i,
  /\bwaste of time\b/i,
  /\bnever arrived\b/i,
  /\bcancel/i,
  /\btoo expensive\b/i,
  /\bcan't afford\b/i,
  /\bcannot afford\b/i,
  /\bnot interested\b/i,
  /\bdenied\b/i,
  /\bmisleading\b/i,
  /\bpressured\b/i,
];

const POSITIVE = [
  /\breally pleased\b/i,
  /\bpleased\b/i,
  /\bexcellent\b/i,
  /\bwent smoothly\b/i,
  /\bsmoothly\b/i,
  /\bwill shop again\b/i,
  /\bspot on\b/i,
  /\bvery happy\b/i,
  /\bhappy\b/i,
  /\bthat was easy\b/i,
  /\bthank you\b/i,
  /\bthanks\b/i,
  /\bappreciate\b/i,
  /\bwonderful\b/i,
  /\bperfect\b/i,
  /\bhelpful\b/i,
  /\bbrilliant\b/i,
  /\bdelighted\b/i,
  /\bresolved\b/i,
  /\bgreat\b/i,
  /\bgo ahead\b/i,
  /\bsounds good\b/i,
  /\bi'll take it\b/i,
  /\bhappy to proceed\b/i,
];

const MILD = [/still cautious/i, /waiting to see/i, /think about it/i, /not sure/i, /maybe later/i, /still deciding/i];

const DRIVERS: { reason: string; pattern: RegExp }[] = [
  { reason: "They were ready to go ahead", pattern: /go ahead|i'll take it|happy to proceed|sounds good/i },
  { reason: "They were pleased with the call", pattern: /pleased|thank you|excellent|helpful|great/i },
  { reason: "They were still deciding", pattern: /think about it|not sure|maybe later|still deciding|still cautious|waiting to see/i },
];

const SCORE_LINE = /^\s*(?:nps|score)(?:\s*[:=]\s*|\s+)(\d{1,2})(?:\s*\/\s*10)?\s*$/i;
const COMPANY_LINE = /^\s*company\s*:\s*(.+?)\s*$/i;
const SPEAKER_LINE = /^\s*(customer|agent|advisor|caller)\s*:\s*(.*)$/i;

export function scoreTranscript(file: string, bytes: Buffer): TranscriptScore {
  if (bytes.length > MAX_TRANSCRIPT_BYTES) throw new Error("File is too large to score.");
  if (bytes.includes(0)) throw new Error("File is not text.");
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("Transcript is empty.");
  return scoreParsed(file, parseTranscript(text));
}

export function npsBand(nps: number): NpsBand {
  if (nps >= 9) return "promoter";
  if (nps >= 7) return "passive";
  return "detractor";
}

function scoreParsed(file: string, parsed: Parsed): TranscriptScore {
  const lines = linesToScore(parsed.lines);
  if (!lines.length) throw new Error("Transcript is empty.");
  const sentiment = sentimentOf(lines);
  const corpus = lines.map((line) => line.text).join("\n");
  if (parsed.fromCall) {
    const band = bandFromLanguage(sentiment);
    const reason = reasonFor(band, corpus);
    return {
      file,
      sentiment,
      mix: mixFor(sentiment),
      nps: null,
      npsBand: band,
      reason,
      evidence: quoteFrom(corpus, band, reason),
      company: parsed.company,
    };
  }
  const nps = parsed.score;
  const band = nps == null ? null : npsBand(nps);
  const reason = band === "detractor" ? detractorReason(corpus) : null;
  return {
    file,
    sentiment,
    mix: mixFor(sentiment),
    nps,
    npsBand: band,
    reason,
    evidence: evidenceFor(lines, sentiment, reason),
    company: parsed.company,
  };
}

function bandFromLanguage(sentiment: Sentiment): NpsBand {
  if (sentiment === "negative") return "detractor";
  if (sentiment === "positive") return "promoter";
  return "passive";
}

function reasonFor(band: NpsBand, text: string): string {
  if (band === "detractor") return detractorReason(text);
  for (const driver of DRIVERS) {
    if (driver.pattern.test(text)) return driver.reason;
  }
  return band === "promoter" ? "They were pleased with the call" : "They were still deciding";
}

function quoteFrom(text: string, band: NpsBand, reason: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const sentences = parts.length ? parts : [text.trim()];
  const theme = [...THEMES, ...DRIVERS].find((item) => item.reason === reason);
  const matched = theme ? sentences.find((part) => theme.pattern.test(part)) : undefined;
  if (matched) return clipQuote(text, matched);
  const ranked = sentences.map((part) => ({ part, ...lineSignal(part) }));
  const best =
    band === "detractor"
      ? [...ranked].sort((a, b) => b.negative - a.negative || a.part.length - b.part.length)[0]
      : band === "promoter"
        ? [...ranked].sort((a, b) => b.positive - a.positive || a.part.length - b.part.length)[0]
        : (ranked.find((part) => part.negative > 0 && part.positive > 0) ?? ranked[0]);
  return clipQuote(text, best?.part ?? text.trim());
}

function clipQuote(source: string, quote: string): string {
  const found = source.includes(quote) ? quote : source.trim();
  if (found.length <= 280) return found;
  const slice = found.slice(0, 280);
  const space = slice.lastIndexOf(" ");
  const cut = (space > 200 ? slice.slice(0, space) : slice).trimEnd();
  return source.includes(cut) ? cut : source.slice(0, 280);
}

function mixFor(sentiment: Sentiment): TranscriptScore["mix"] {
  if (sentiment === "positive") return { positive: 100, neutral: 0, negative: 0 };
  if (sentiment === "negative") return { positive: 0, neutral: 0, negative: 100 };
  return { positive: 0, neutral: 100, negative: 0 };
}

function linesToScore(lines: Spoken[]): Spoken[] {
  const tagged = lines.filter((line) => line.speaker);
  if (!tagged.length) return lines;
  const customers = lines.filter((line) => line.speaker?.toLowerCase() === "customer");
  return customers.length ? customers : lines;
}

function sentimentOf(lines: Spoken[]): Sentiment {
  let negative = 0;
  let positive = 0;
  let mild = 0;
  for (const line of lines) {
    const signal = lineSignal(line.text);
    negative += signal.negative;
    positive += signal.positive;
    mild += signal.mild;
  }
  if (negative > 0 && positive > 0) return "mixed";
  if (negative > 0) return "negative";
  if (mild > 0) return "mixed";
  if (positive > 0) return "positive";
  return "mixed";
}

function lineSignal(text: string): { negative: number; positive: number; mild: number } {
  let positive = count(text, POSITIVE);
  let negative = count(text, NEGATIVE);
  if (/\bnot happy\b/i.test(text)) {
    positive = Math.max(0, positive - 1);
    negative += 1;
  }
  return { negative, positive, mild: count(text, MILD) };
}

function count(text: string, patterns: RegExp[]): number {
  return patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
}

function detractorReason(text: string): string {
  for (const theme of THEMES) {
    if (theme.pattern.test(text)) return theme.reason;
  }
  return "Something else went wrong";
}

function evidenceFor(lines: Spoken[], sentiment: Sentiment, reason: string | null): string {
  const theme = reason ? THEMES.find((item) => item.reason === reason) : undefined;
  if (theme) {
    const matched = lines.find((line) => theme.pattern.test(line.text));
    if (matched) return oneLine(matched.text);
  }
  const ranked = lines.map((line) => ({ text: line.text, ...lineSignal(line.text) }));
  if (sentiment === "negative") {
    const best = [...ranked].sort((a, b) => b.negative - a.negative || a.text.length - b.text.length)[0];
    if (best && best.negative > 0) return oneLine(best.text);
  }
  if (sentiment === "positive") {
    const best = [...ranked].sort((a, b) => b.positive - a.positive || a.text.length - b.text.length)[0];
    if (best && best.positive > 0) return oneLine(best.text);
  }
  const mixed = ranked.find((line) => line.negative > 0 && line.positive > 0) ?? ranked.find((line) => line.negative > 0) ?? ranked[0];
  return oneLine(mixed.text);
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 280) return flat;
  const cut = flat.slice(0, 277);
  const space = cut.lastIndexOf(" ");
  const shortened = (space > 200 ? cut.slice(0, space) : cut).trimEnd();
  return `${shortened}…`;
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
  if (Array.isArray(data)) {
    const lines = readLines(data);
    if (!lines.length) throw new Error("Transcript is empty.");
    return { company: null, score: null, lines, fromCall: false };
  }
  if (!data || typeof data !== "object") throw new Error("File is not a transcript.");
  const record = data as Record<string, unknown>;
  if (isAsrCall(record)) {
    return { company: null, score: null, fromCall: true, lines: [{ speaker: null, text: record.text.trim() }] };
  }
  const company = stringField(record.company);
  const score = readScore(record);
  const lines = Array.isArray(record.lines) ? readLines(record.lines) : [];
  if (lines.length) return { company, score, lines, fromCall: false };
  const body = typeof record.text === "string" ? record.text : typeof record.transcript === "string" ? record.transcript : "";
  if (!body.trim()) throw new Error("Transcript is empty.");
  const plain = parsePlain(body);
  if (score != null && plain.score != null && score !== plain.score) throw new Error("The file has more than one score.");
  return { company: company ?? plain.company, score: score ?? plain.score, lines: plain.lines, fromCall: false };
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
    const speaker = stringField((item as { speaker?: unknown }).speaker);
    lines.push({ speaker, text });
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
  let score: number | null = null;
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
      if (score != null && score !== value) throw new Error("The file has more than one score.");
      score = value;
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
  if (!lines.length) throw new Error("Transcript is empty.");
  return { company, score, lines, fromCall: false };
}
