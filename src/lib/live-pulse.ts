import type { PulseView } from "./pulse";

/** Public placeholder until the Function App host is published. Not a storage key. */
export const SENTIMENT_PULSE_BASE_URL_PLACEHOLDER = "SENTIMENT_PULSE_BASE_URL";

/** Anonymous aggregate of processedtranscripts. The host comes from config; this path is fixed. */
export const SENTIMENT_PULSE_PATH = "/api/pulse";

export type PulseReason = { label: string; count: number };

export type PulseAggregate = {
  total: number;
  mix: { positive: number; neutral: number; negative: number };
  promoters: number;
  detractors: number;
  reasons: PulseReason[];
  evidence: { quote: string; file: string } | null;
  movement: { file: string; scoredAt: string; positive: number; negative: number }[];
};

export type LiveOverview = {
  total: number;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  reasons: PulseReason[];
  pulse: PulseView;
};

const SECRET = /accountkey|sharedaccesssignature|sig=|sorted_storage_connection_string/i;

export function sentimentPulseUrl(baseUrl: string): string | null {
  const raw = baseUrl.trim();
  if (!raw || raw === SENTIMENT_PULSE_BASE_URL_PLACEHOLDER || SECRET.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || !url.hostname) return null;
  url.pathname = SENTIMENT_PULSE_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function loadSentimentPulseUrl(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return sentimentPulseUrl(fromEnv);
  try {
    const response = await fetchImpl("/sentiment-pulse-config.json", { cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const base =
      body && typeof body === "object" && "baseUrl" in body && typeof body.baseUrl === "string" ? body.baseUrl : "";
    return sentimentPulseUrl(base);
  } catch {
    return null;
  }
}

export function readPulseAggregate(value: unknown): PulseAggregate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const total = count(record.total);
  const promoters = count(record.promoters);
  const detractors = count(record.detractors);
  const mix = readMix(record.mix);
  const reasons = readReasons(record.reasons);
  const evidence = readEvidence(record.evidence);
  const movement = readMovement(record.movement);
  if (
    total == null ||
    promoters == null ||
    detractors == null ||
    !mix ||
    !reasons ||
    evidence === undefined ||
    !movement ||
    promoters + detractors > total
  ) {
    return null;
  }
  return { total, mix, promoters, detractors, reasons, evidence, movement };
}

export function overviewFromPulse(pulse: PulseAggregate): LiveOverview {
  const passives = pulse.total - pulse.promoters - pulse.detractors;
  const ranked = [...pulse.reasons].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const leader = ranked[0]?.count ?? 0;
  return {
    total: pulse.total,
    nps: pulse.total ? Math.round(((pulse.promoters - pulse.detractors) / pulse.total) * 100) : null,
    promoters: pulse.promoters,
    passives,
    detractors: pulse.detractors,
    reasons: ranked.slice(0, 5),
    pulse: {
      total: pulse.total,
      mix: pulse.mix,
      promoters: pulse.promoters,
      detractors: pulse.detractors,
      topics: ranked.slice(0, 2).map((topic) => ({
        label: topic.label,
        count: topic.count,
        width: leader ? Math.round((topic.count / leader) * 100) : 0,
      })),
      evidence: pulse.evidence ? { quote: pulse.evidence.quote, company: "", id: pulse.evidence.file } : null,
      series: pulse.movement.map((point) => ({
        time: movementLabel(point.scoredAt),
        positive: point.positive,
        negative: point.negative,
      })),
      drivers: ranked.slice(0, 3).map((topic) => ({
        label: topic.label,
        share: pulse.detractors ? Math.min(100, Math.round((topic.count / pulse.detractors) * 100)) : 0,
      })),
    },
  };
}

export function movementLabel(scoredAt: string): string {
  const date = new Date(scoredAt);
  if (Number.isNaN(date.getTime())) return scoredAt.trim() || "—";
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${day} ${time}`;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readMix(value: unknown): PulseAggregate["mix"] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const positive = share(record.positive);
  const neutral = share(record.neutral);
  const negative = share(record.negative);
  if (positive == null || neutral == null || negative == null) return null;
  return { positive, neutral, negative };
}

function share(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function readReasons(value: unknown): PulseReason[] | null {
  if (!Array.isArray(value)) return null;
  const reasons: PulseReason[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const reasonCount = count(record.count);
    if (!label || reasonCount == null) return null;
    reasons.push({ label, count: reasonCount });
  }
  return reasons;
}

function readEvidence(value: unknown): PulseAggregate["evidence"] | undefined {
  if (value == null) return null;
  if (typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const quote = typeof record.quote === "string" ? record.quote.trim() : "";
  const file = typeof record.file === "string" ? record.file.trim() : "";
  if (!quote || !file) return undefined;
  return { quote, file };
}

function readMovement(value: unknown): PulseAggregate["movement"] | null {
  if (!Array.isArray(value)) return null;
  const movement: PulseAggregate["movement"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const file = typeof record.file === "string" ? record.file : "";
    const scoredAt = typeof record.scoredAt === "string" ? record.scoredAt : "";
    const positive = share(record.positive);
    const negative = share(record.negative);
    if (!file || positive == null || negative == null) return null;
    movement.push({ file, scoredAt, positive, negative });
  }
  return movement;
}
