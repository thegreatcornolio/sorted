import { readFileSync } from "node:fs";
import {
  overviewFromPulse,
  readPulseAggregate,
  SENTIMENT_PULSE_BASE_URL_PLACEHOLDER,
  sentimentPulseUrl,
} from "../src/lib/live-pulse";

const failures: string[] = [];

function expect(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const configText = readFileSync(new URL("../public/sentiment-pulse-config.json", import.meta.url), "utf8");
const config = JSON.parse(configText) as { baseUrl?: string };
expect(config.baseUrl === SENTIMENT_PULSE_BASE_URL_PLACEHOLDER, "pulse config must keep the named placeholder");
expect(sentimentPulseUrl(config.baseUrl ?? "") === null, "placeholder must not become a request");
expect(!/accountkey|sharedaccesssignature|sorted_storage_connection_string/i.test(configText), "pulse config must not contain a storage key");

expect(sentimentPulseUrl("") === null, "blank base");
expect(sentimentPulseUrl("not a url") === null, "invalid base");
expect(
  sentimentPulseUrl("https://func.example.net") === "https://func.example.net/api/pulse",
  "origin gains /api/pulse",
);
expect(
  sentimentPulseUrl("https://func.example.net/") === "https://func.example.net/api/pulse",
  "trailing slash",
);
expect(
  sentimentPulseUrl("https://func.example.net/other?sig=secret") === null,
  "query secrets are refused",
);
expect(
  sentimentPulseUrl("https://user:pass@func.example.net") === null,
  "credentials are refused",
);
expect(
  sentimentPulseUrl("http://127.0.0.1:7071/api/pulse") === "http://127.0.0.1:7071/api/pulse",
  "local origin still uses /api/pulse",
);

const sample = {
  total: 3,
  mix: { positive: 33, neutral: 0, negative: 67 },
  promoters: 1,
  detractors: 2,
  nps: 10,
  channel: "whatsapp",
  reasons: [{ label: "They wanted to cancel", count: 2 }],
  evidence: { quote: "Please cancel the cover.", file: "again.json" },
  movement: [
    { file: "first.json", scoredAt: "2026-11-08T11:00:00.000Z", positive: 100, negative: 0 },
    { file: "again.json", scoredAt: "2026-11-08T13:00:00.000Z", positive: 33, negative: 67 },
  ],
};

const aggregate = readPulseAggregate(sample);
expect(aggregate?.total === 3, "aggregate total");
expect(aggregate != null && !("nps" in aggregate), "survey nps is not kept");
expect(aggregate != null && !("channel" in aggregate), "channel is not kept");

if (aggregate) {
  const overview = overviewFromPulse(aggregate);
  expect(overview.nps === -33, `company nps from bands, got ${overview.nps}`);
  expect(overview.promoters === 1 && overview.passives === 0 && overview.detractors === 2, "bands");
  expect(overview.reasons[0]?.label === "They wanted to cancel", "reason");
  expect(overview.pulse.evidence?.quote === "Please cancel the cover.", "quote");
  expect(overview.pulse.evidence?.company === "", "no invented company");
  expect(overview.pulse.mix.negative === 67, "mix");
  expect(overview.pulse.drivers[0]?.share === 100, "driver share");
  expect(overview.pulse.series[0]?.time.includes("11:00"), `movement label ${overview.pulse.series[0]?.time}`);
  expect(!JSON.stringify(overview).includes("whatsapp"), "overview has no channel");
  expect(!JSON.stringify(overview).includes("\"nps\":10"), "survey score is not copied");
}

expect(readPulseAggregate({ total: 1, mix: { positive: 0, neutral: 100, negative: 0 }, promoters: 1, detractors: 1, reasons: [], evidence: null, movement: [] }) === null, "bands cannot exceed total");
const empty = readPulseAggregate({
  total: 0,
  mix: { positive: 0, neutral: 0, negative: 0 },
  promoters: 0,
  detractors: 0,
  reasons: [],
  evidence: null,
  movement: [],
});
expect(empty != null && overviewFromPulse(empty).nps === null, "empty pulse has no nps");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("live pulse ok");
