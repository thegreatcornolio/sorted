import { PAYMENT_TROUBLE_NEXT_STEP, troublePayingReason } from "./payment-trouble";
import type { PulseView } from "./pulse";

/** Public placeholder until the Function App host is published. Not a storage key. */
export const SENTIMENT_PULSE_BASE_URL_PLACEHOLDER = "SENTIMENT_PULSE_BASE_URL";

/** Anonymous aggregate of processedtranscripts. The host comes from config; this path is fixed. */
export const SENTIMENT_PULSE_PATH = "/api/pulse";

export const CLEAR_RESULTS_PATH = "/api/clear-results";

export const CLEAR_TRANSCRIPTS_PATH = "/api/clear-transcripts";

/** Deleting a full processed container can take longer than one pulse read. */
export const CLEAR_TRANSCRIPTS_TIMEOUT_MS = 120_000;

/** Stop waiting on GET /api/pulse after a few seconds so the page can offer a retry. */
export const PULSE_FETCH_TIMEOUT_MS = 4_000;

export type PulseReason = { label: string; count: number };

export type VulnerableCustomer = {
  person: string;
  file: string;
  vulnerable: true;
  vulnerability_reason: string;
  next_step: string;
  scoredAt: string;
};

/** A detractor the live page can open. Absent on a pulse that predates this field. */
export type PulseCall = {
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
  reasons: PulseReason[];
  evidence: { quote: string; file: string } | null;
  movement: { file: string; scoredAt: string; positive: number; negative: number }[];
  calls: PulseCall[];
  vulnerable: VulnerableCustomer[];
};

export type LiveOverview = {
  total: number;
  nps: number | null;
  csat: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  reasons: (PulseReason & { calls: PulseCall[] })[];
  evidenceCall: PulseCall | null;
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

export function clearResultsUrl(pulseUrl: string): string | null {
  return pulseActionUrl(pulseUrl, CLEAR_RESULTS_PATH);
}

export function clearTranscriptsUrl(pulseUrl: string): string | null {
  return pulseActionUrl(pulseUrl, CLEAR_TRANSCRIPTS_PATH);
}

function pulseActionUrl(pulseUrl: string, path: string): string | null {
  let url: URL;
  try {
    url = new URL(pulseUrl);
  } catch {
    return null;
  }
  if (url.pathname !== SENTIMENT_PULSE_PATH) return null;
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function loadSentimentPulseUrl(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_SENTIMENT_PULSE_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return sentimentPulseUrl(fromEnv);
  try {
    const response = await fetchImpl("/sentiment-pulse-config.json", { cache: "no-store", signal });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const base =
      body && typeof body === "object" && "baseUrl" in body && typeof body.baseUrl === "string" ? body.baseUrl : "";
    return sentimentPulseUrl(base);
  } catch {
    return null;
  }
}

export async function loadPulseAggregate(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PulseAggregate> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([readAggregate(fetchImpl, controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function clearPulseResults(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PulseAggregate> {
  return postPulseAction(CLEAR_RESULTS_PATH, timeoutMs, fetchImpl, signal);
}

export async function clearStoredTranscripts(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<PulseAggregate> {
  return postPulseAction(CLEAR_TRANSCRIPTS_PATH, timeoutMs, fetchImpl, signal);
}

async function postPulseAction(
  path: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<PulseAggregate> {
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([postClear(path, fetchImpl, controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function postClear(path: string, fetchImpl: typeof fetch, signal: AbortSignal): Promise<PulseAggregate> {
  const pulseUrl = await loadSentimentPulseUrl(fetchImpl, signal);
  const url = pulseUrl ? pulseActionUrl(pulseUrl, path) : null;
  if (!url) throw new Error("config");
  const response = await fetchImpl(url, { method: "POST", cache: "no-store", signal });
  if (!response.ok) throw new Error(String(response.status));
  const aggregate = readPulseAggregate(await response.json());
  if (!aggregate) throw new Error("shape");
  return aggregate;
}

async function readAggregate(fetchImpl: typeof fetch, signal: AbortSignal): Promise<PulseAggregate> {
  const url = await loadSentimentPulseUrl(fetchImpl, signal);
  if (!url) throw new Error("config");
  const response = await fetchImpl(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(String(response.status));
  const aggregate = readPulseAggregate(await response.json());
  if (!aggregate) throw new Error("shape");
  return aggregate;
}

function abortError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
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
  const calls = readCalls(record.calls);
  const vulnerable = readVulnerable(record.vulnerable);
  if (
    total == null ||
    promoters == null ||
    detractors == null ||
    !mix ||
    !reasons ||
    evidence === undefined ||
    !movement ||
    !calls ||
    promoters + detractors > total
  ) {
    return null;
  }
  return {
    total,
    mix,
    promoters,
    detractors,
    csat: readCsat(record.csat),
    reasons,
    evidence,
    movement,
    calls,
    vulnerable: withTroublePayingCalls(vulnerable, calls),
  };
}

function withTroublePayingCalls(rows: VulnerableCustomer[], calls: PulseCall[]): VulnerableCustomer[] {
  const seen = new Set(rows.map((row) => row.file));
  const extra: VulnerableCustomer[] = [];
  for (const call of calls) {
    if (seen.has(call.file)) continue;
    const reason = troublePayingReason(call.reason, call.quote);
    if (!reason) continue;
    seen.add(call.file);
    extra.push({
      person: personFromFile(call.file),
      file: call.file,
      vulnerable: true,
      vulnerability_reason: reason,
      next_step: PAYMENT_TROUBLE_NEXT_STEP,
      scoredAt: call.scoredAt,
    });
  }
  if (extra.length === 0) return rows;
  return [...rows, ...extra].sort(
    (a, b) => b.scoredAt.localeCompare(a.scoredAt) || a.person.localeCompare(b.person) || a.file.localeCompare(b.file),
  );
}

function personFromFile(file: string): string {
  const base = file.split("/").pop() || file;
  const stem = base.replace(/\.[^.]+$/, "");
  return stem || base;
}

export function overviewFromPulse(pulse: PulseAggregate): LiveOverview {
  const passives = pulse.total - pulse.promoters - pulse.detractors;
  const ranked = [...pulse.reasons].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const leader = ranked[0]?.count ?? 0;
  return {
    total: pulse.total,
    nps: pulse.total ? Math.round(((pulse.promoters - pulse.detractors) / pulse.total) * 100) : null,
    csat: pulse.csat,
    promoters: pulse.promoters,
    passives,
    detractors: pulse.detractors,
    reasons: ranked.slice(0, 5).map((reason) => ({
      ...reason,
      calls: pulse.calls.filter((call) => call.reason === reason.label),
    })),
    evidenceCall: pulse.evidence ? (pulse.calls.find((call) => call.file === pulse.evidence?.file) ?? null) : null,
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

export type LiveInteractionRecord = {
  file: string;
  scoredAt: string;
  when: string;
  positive: number;
  negative: number;
  quote: string | null;
};

/** Newest detractor with this reason first. */
export function callsForReason(pulse: PulseAggregate, reason: string): PulseCall[] {
  return pulse.calls.filter((call) => call.reason === reason).reverse();
}

export function callByFile(pulse: PulseAggregate, file: string): PulseCall | null {
  return pulse.calls.find((call) => call.file === file) ?? null;
}

/** Newest scored file first. Uses only the pulse records the live page already loaded. */
export function interactionsFromPulse(pulse: PulseAggregate): LiveInteractionRecord[] {
  return [...pulse.movement].reverse().map((point) => ({
    file: point.file,
    scoredAt: point.scoredAt,
    when: movementLabel(point.scoredAt),
    positive: point.positive,
    negative: point.negative,
    quote: pulse.evidence?.file === point.file ? pulse.evidence.quote : null,
  }));
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

function readCsat(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) return null;
  return Math.round(value * 10) / 10;
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

function readCalls(value: unknown): PulseCall[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const calls: PulseCall[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const file = typeof record.file === "string" ? record.file.trim() : "";
    if (!file || record.npsBand !== "detractor") return null;
    const csat = record.csat == null ? null : count(record.csat);
    if (record.csat != null && (csat == null || csat < 1 || csat > 5)) return null;
    calls.push({
      file,
      scoredAt: typeof record.scoredAt === "string" ? record.scoredAt : "",
      npsBand: "detractor",
      csat,
      reason: textOrNull(record.reason),
      quote: textOrNull(record.quote),
    });
  }
  return calls;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function readVulnerable(value: unknown): VulnerableCustomer[] {
  if (!Array.isArray(value)) return [];
  const rows: VulnerableCustomer[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.vulnerable !== true) continue;
    const person = typeof record.person === "string" ? record.person.trim() : "";
    const file = typeof record.file === "string" ? record.file.trim() : "";
    const reason = typeof record.vulnerability_reason === "string" ? record.vulnerability_reason.trim() : "";
    const next = typeof record.next_step === "string" ? record.next_step.trim() : "";
    if (!person || !file || !reason || !next) continue;
    rows.push({
      person,
      file,
      vulnerable: true,
      vulnerability_reason: reason,
      next_step: next,
      scoredAt: typeof record.scoredAt === "string" ? record.scoredAt : "",
    });
  }
  return rows;
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
