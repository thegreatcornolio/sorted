import { RESULTS_PREFIX } from "./layout";
import { PAYMENT_TROUBLE_NEXT_STEP, showsTroublePaying, troublePayingReason } from "./paymentTrouble";

export const PULSE_ROUTE = "pulse";

export const SITE_ORIGIN = "https://sorted.trilogybpo.com";

type Sentiment = "positive" | "mixed" | "negative";

type NpsBand = "promoter" | "passive" | "detractor";

type ScoredCall = {
  file: string;
  sentiment: Sentiment;
  npsBand: NpsBand | null;
  csat: number | null;
  reason: string | null;
  evidence: string | null;
  company: string | null;
  vulnerable: boolean;
  vulnerability_reason: string | null;
  next_step: string | null;
  scoredAt: string;
};

export type VulnerableCustomer = {
  person: string;
  file: string;
  vulnerable: true;
  vulnerability_reason: string;
  next_step: string;
  scoredAt: string;
};

/** One detractor, enough to open it from a reason or the evidence quote. */
export type PulseDetractorCall = {
  file: string;
  scoredAt: string;
  npsBand: "detractor";
  csat: number | null;
  reason: string | null;
  quote: string | null;
};

export type PulseAggregate = {
  total: number;
  mix: { positive: number; neutral: number; negative: number };
  promoters: number;
  detractors: number;
  csat: number | null;
  reasons: { label: string; count: number }[];
  evidence: { quote: string; file: string } | null;
  movement: { file: string; scoredAt: string; positive: number; negative: number }[];
  calls: PulseDetractorCall[];
  vulnerable: VulnerableCustomer[];
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
  let csatSum = 0;
  let csatCount = 0;
  const reasons = new Map<string, number>();
  let evidence: PulseAggregate["evidence"] = null;
  const movement: PulseAggregate["movement"] = [];
  const opened: PulseAggregate["calls"] = [];

  for (const call of calls) {
    if (call.sentiment === "positive") positive += 1;
    else if (call.sentiment === "negative") negative += 1;
    else neutral += 1;
    if (call.npsBand === "promoter") promoters += 1;
    if (call.csat != null) {
      csatSum += call.csat;
      csatCount += 1;
    }
    if (call.npsBand === "detractor") {
      detractors += 1;
      if (call.reason) reasons.set(call.reason, (reasons.get(call.reason) ?? 0) + 1);
      if (call.evidence) evidence = { quote: call.evidence, file: call.file };
      opened.push({
        file: call.file,
        scoredAt: call.scoredAt,
        npsBand: "detractor",
        csat: call.csat,
        reason: call.reason,
        quote: call.evidence,
      });
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
    csat: csatCount ? Math.round((csatSum / csatCount) * 10) / 10 : null,
    reasons: [...reasons.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    evidence,
    movement,
    calls: opened,
    vulnerable: vulnerableCustomers(calls),
  };
}

export function pulseHttp(method: string, results: unknown[]): { status: number; headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (method === "OPTIONS") return { status: 204, headers, body: "" };
  if (method !== "GET") return { status: 405, headers: { ...headers, Allow: "GET, POST, OPTIONS" }, body: "" };
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
  const csat =
    typeof record.csat === "number" && Number.isInteger(record.csat) && record.csat >= 1 && record.csat <= 5 ? record.csat : null;
  return {
    file: record.file,
    sentiment: record.sentiment as Sentiment,
    npsBand,
    csat,
    reason: textOrNull(record.reason),
    evidence: textOrNull(record.evidence),
    company: textOrNull(record.company),
    vulnerable: record.vulnerable === true,
    vulnerability_reason: textOrNull(record.vulnerability_reason),
    next_step: textOrNull(record.next_step),
    scoredAt: typeof record.scoredAt === "string" ? record.scoredAt : "",
  };
}

function vulnerableCustomers(calls: ScoredCall[]): VulnerableCustomer[] {
  return calls
    .flatMap((call) => {
      const listing = vulnerabilityListing(call);
      if (!listing) return [];
      return [
        {
          person: personLabel(call),
          file: call.file,
          vulnerable: true as const,
          vulnerability_reason: listing.vulnerability_reason,
          next_step: listing.next_step,
          scoredAt: call.scoredAt,
        },
      ];
    })
    .sort((a, b) => b.scoredAt.localeCompare(a.scoredAt) || a.person.localeCompare(b.person) || a.file.localeCompare(b.file));
}

function vulnerabilityListing(call: ScoredCall): { vulnerability_reason: string; next_step: string } | null {
  if (call.vulnerable && call.vulnerability_reason && call.next_step) {
    return { vulnerability_reason: call.vulnerability_reason, next_step: call.next_step };
  }
  const fromCall = troublePayingReason(call.reason, call.evidence);
  if (!fromCall) return null;
  const reason =
    call.vulnerability_reason && showsTroublePaying(call.vulnerability_reason) ? call.vulnerability_reason : fromCall;
  return { vulnerability_reason: reason, next_step: call.next_step?.trim() || PAYMENT_TROUBLE_NEXT_STEP };
}

function personLabel(call: ScoredCall): string {
  if (call.company) return call.company;
  const base = call.file.split("/").pop() || call.file;
  const stem = base.replace(/\.[^.]+$/, "");
  return stem || base;
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
