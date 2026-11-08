import { RESULTS_PREFIX } from "./layout";

export const PULSE_ROUTE = "pulse";

export const SITE_ORIGIN = "https://sorted.trilogybpo.com";

type Sentiment = "positive" | "mixed" | "negative";

type NpsBand = "promoter" | "passive" | "detractor";

type ScoredCall = {
  file: string;
  sentiment: Sentiment;
  npsBand: NpsBand | null;
  reason: string | null;
  evidence: string | null;
  scoredAt: string;
};

export type PulseAggregate = {
  total: number;
  mix: { positive: number; neutral: number; negative: number };
  promoters: number;
  detractors: number;
  reasons: { label: string; count: number }[];
  evidence: { quote: string; file: string } | null;
  movement: { file: string; scoredAt: string; positive: number; negative: number }[];
};

const SENTIMENTS = new Set<Sentiment>(["positive", "mixed", "negative"]);
const BANDS = new Set<NpsBand>(["promoter", "passive", "detractor"]);

export function isResultBlob(name: string): boolean {
  return name.startsWith(RESULTS_PREFIX) && name.endsWith(".json") && !name.endsWith(".error.json");
}

export function aggregatePulse(values: unknown[]): PulseAggregate {
  const calls = values.flatMap((value) => {
    const call = readCall(value);
    return call ? [call] : [];
  });
  calls.sort((a, b) => a.scoredAt.localeCompare(b.scoredAt) || a.file.localeCompare(b.file));

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let promoters = 0;
  let detractors = 0;
  const reasons = new Map<string, number>();
  let evidence: PulseAggregate["evidence"] = null;
  const movement: PulseAggregate["movement"] = [];

  for (const call of calls) {
    if (call.sentiment === "positive") positive += 1;
    else if (call.sentiment === "negative") negative += 1;
    else neutral += 1;
    if (call.npsBand === "promoter") promoters += 1;
    if (call.npsBand === "detractor") {
      detractors += 1;
      if (call.reason) reasons.set(call.reason, (reasons.get(call.reason) ?? 0) + 1);
      if (call.evidence) evidence = { quote: call.evidence, file: call.file };
    }
    const shares = wholeShares([positive, neutral, negative]);
    movement.push({ file: call.file, scoredAt: call.scoredAt, positive: shares[0], negative: shares[2] });
  }

  const mixShares = calls.length ? wholeShares([positive, neutral, negative]) : [0, 0, 0];
  return {
    total: calls.length,
    mix: { positive: mixShares[0], neutral: mixShares[1], negative: mixShares[2] },
    promoters,
    detractors,
    reasons: [...reasons.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    evidence,
    movement,
  };
}

export function pulseHttp(method: string, results: unknown[]): { status: number; headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (method === "OPTIONS") return { status: 204, headers, body: "" };
  if (method !== "GET") return { status: 405, headers: { ...headers, Allow: "GET, OPTIONS" }, body: "" };
  return {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: `${JSON.stringify(aggregatePulse(results))}\n`,
  };
}

function readCall(value: unknown): ScoredCall | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.file !== "string" || !record.file.trim()) return null;
  if (typeof record.sentiment !== "string" || !SENTIMENTS.has(record.sentiment as Sentiment)) return null;
  let npsBand: NpsBand | null = null;
  if (record.npsBand != null) {
    if (typeof record.npsBand !== "string" || !BANDS.has(record.npsBand as NpsBand)) return null;
    npsBand = record.npsBand as NpsBand;
  }
  return {
    file: record.file,
    sentiment: record.sentiment as Sentiment,
    npsBand,
    reason: textOrNull(record.reason),
    evidence: textOrNull(record.evidence),
    scoredAt: typeof record.scoredAt === "string" ? record.scoredAt : "",
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wholeShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let leftover = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const item of order) {
    if (leftover <= 0) break;
    floors[item.index] += 1;
    leftover -= 1;
  }
  return floors;
}
