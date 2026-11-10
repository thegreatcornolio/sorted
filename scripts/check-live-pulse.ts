import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loadPulseAggregate,
  clearResultsUrl,
  clearTranscriptsUrl,
  interactionsFromPulse,
  overviewFromPulse,
  PULSE_FETCH_TIMEOUT_MS,
  readPulseAggregate,
  SENTIMENT_PULSE_BASE_URL_PLACEHOLDER,
  sentimentPulseUrl,
} from "../src/lib/live-pulse";

const failures: string[] = [];

function expect(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const PUBLISHED_PULSE_ORIGIN = "https://sorted-pulse.thankfulflower-819372b8.westus3.azurecontainerapps.io";
const configText = readFileSync(new URL("../public/sentiment-pulse-config.json", import.meta.url), "utf8");
const config = JSON.parse(configText) as { baseUrl?: string };
expect(config.baseUrl === PUBLISHED_PULSE_ORIGIN, "pulse config must use the published host");
expect(
  sentimentPulseUrl(config.baseUrl ?? "") === `${PUBLISHED_PULSE_ORIGIN}/api/pulse`,
  "published host requests /api/pulse",
);
expect(sentimentPulseUrl(SENTIMENT_PULSE_BASE_URL_PLACEHOLDER) === null, "placeholder must not become a request");
expect(!/accountkey|sharedaccesssignature|sorted_storage_connection_string/i.test(configText), "pulse config must not contain a storage key");
expect(PULSE_FETCH_TIMEOUT_MS >= 2_000 && PULSE_FETCH_TIMEOUT_MS <= 5_000, "pulse fetch times out after a few seconds");

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
expect(aggregate?.csat === null, "a missing csat stays blank");
expect(aggregate != null && !("nps" in aggregate), "survey nps is not kept");
expect(aggregate != null && !("channel" in aggregate), "channel is not kept");
expect(aggregate?.vulnerable.length === 0, "a pulse without the field lists nobody");

if (aggregate) {
  const overview = overviewFromPulse(aggregate);
  expect(overview.nps === -33, `company nps from bands, got ${overview.nps}`);
  expect(overview.csat === null, "overview csat stays blank when the pulse has none");
  expect(overview.promoters === 1 && overview.passives === 0 && overview.detractors === 2, "bands");
  expect(overview.reasons[0]?.label === "They wanted to cancel", "reason");
  expect(overview.pulse.evidence?.quote === "Please cancel the cover.", "quote");
  expect(overview.pulse.evidence?.company === "", "no invented company");
  expect(overview.pulse.mix.negative === 67, "mix");
  expect(overview.pulse.drivers[0]?.share === 100, "driver share");
  expect(overview.pulse.series[0]?.time.includes("11:00"), `movement label ${overview.pulse.series[0]?.time}`);
  expect(!JSON.stringify(overview).includes("whatsapp"), "overview has no channel");
  expect(!JSON.stringify(overview).includes("\"nps\":10"), "survey score is not copied");
  const listed = interactionsFromPulse(aggregate);
  expect(listed.map((item) => item.file).join(",") === "again.json,first.json", "newest scored file is first");
  expect(listed[0]?.quote === "Please cancel the cover.", "the quote stays on its file");
  expect(listed[1]?.quote === null, "other files do not borrow the quote");
  expect(listed[1]?.positive === 100 && listed[1]?.negative === 0, "the mix stays the pulse record");
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
expect(empty != null && overviewFromPulse(empty).csat === null, "empty pulse has no csat");
expect(empty != null && interactionsFromPulse(empty).length === 0, "an empty pulse lists no interactions");
expect(empty != null && empty.vulnerable.length === 0, "an empty pulse lists no vulnerable customers");
const listedVulnerable = readPulseAggregate({
  ...sample,
  vulnerable: [
    {
      person: "North Clinic",
      file: "older.txt",
      vulnerable: true,
      vulnerability_reason: "Their hours were cut, so they cannot pay.",
      next_step: "Arrange a short payment hold.",
      scoredAt: "2026-11-08T11:00:00.000Z",
    },
    {
      person: "Price Clinic",
      file: "price.json",
      vulnerable: false,
      vulnerability_reason: "They disliked the price.",
      next_step: "Apologise for the price.",
    },
  ],
});
expect(listedVulnerable?.vulnerable.length === 1, "only a supported vulnerable row is kept");
expect(listedVulnerable?.vulnerable[0]?.person === "North Clinic", "the person stays on the pulse row");
expect(listedVulnerable?.vulnerable[0]?.next_step === "Arrange a short payment hold.", "the next step stays on the pulse row");
const rated = readPulseAggregate({ ...sample, csat: 2.44 });
expect(rated?.csat === 2.4, "csat is kept to one decimal");
expect(rated != null && overviewFromPulse(rated).csat === 2.4, "live overview uses average csat");
expect(
  clearResultsUrl(`${PUBLISHED_PULSE_ORIGIN}/api/pulse`) === `${PUBLISHED_PULSE_ORIGIN}/api/clear-results`,
  "clear results uses the pulse host",
);
expect(
  clearTranscriptsUrl(`${PUBLISHED_PULSE_ORIGIN}/api/pulse`) === `${PUBLISHED_PULSE_ORIGIN}/api/clear-transcripts`,
  "clear transcripts uses the pulse host",
);

const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const livePage = readFileSync(new URL("../src/app/live/page.tsx", import.meta.url), "utf8");
const demoPage = readFileSync(new URL("../src/app/demo/page.tsx", import.meta.url), "utf8");
const liveInteractionsPage = readFileSync(new URL("../src/app/live/interactions/page.tsx", import.meta.url), "utf8");
const liveInteractions = readFileSync(new URL("../src/components/LiveInteractions.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../src/components/Overview.tsx", import.meta.url), "utf8");
const liveOverview = readFileSync(new URL("../src/components/LiveOverview.tsx", import.meta.url), "utf8");
const desk = readFileSync(new URL("../src/components/TranscriptDesk.tsx", import.meta.url), "utf8");
expect(home.includes("<LiveOverview") && !home.includes("<Overview"), "the main page is the live overview");
expect(livePage.includes("<LiveOverview"), "/live is the scored pulse");
expect(demoPage.includes("<Overview") && !demoPage.includes("LiveOverview"), "the demo keeps its overview");
expect(existsSync(fileURLToPath(new URL("../src/app/demo/interactions/page.tsx", import.meta.url))), "the demo keeps its interactions page");
expect(liveInteractionsPage.includes("<LiveInteractions"), "live interactions is its own page");
expect(liveInteractions.includes("loadPulseAggregate") && liveInteractions.includes("interactionsFromPulse"), "live interactions reads the pulse");
expect(!liveInteractions.includes("allRows") && !/whatsapp|gl-1004|Harper/i.test(liveInteractions), "live interactions does not invent demo calls");
expect(liveInteractions.includes('data-testid="live-interactions-empty"'), "live interactions has an empty state");
const header = readFileSync(new URL("../src/components/SiteHeader.tsx", import.meta.url), "utf8");
expect(header.includes('href: "/", label: "Live"'), "the live menu links Live to home");
expect(header.includes('href: "/live/interactions", label: "Interactions"'), "the live menu links to live interactions");
expect(header.includes('href: "/live/vulnerable", label: "Vulnerable Customers"'), "the live menu links to vulnerable customers");
const vulnerablePage = readFileSync(new URL("../src/app/live/vulnerable/page.tsx", import.meta.url), "utf8");
const vulnerableCustomers = readFileSync(new URL("../src/components/VulnerableCustomers.tsx", import.meta.url), "utf8");
expect(vulnerablePage.includes("<VulnerableCustomers"), "vulnerable customers is its own page");
expect(vulnerableCustomers.includes("loadPulseAggregate"), "the vulnerable page reads the pulse");
expect(vulnerableCustomers.includes('label="NPS"') && vulnerableCustomers.includes('label="CSAT"'), "NPS and CSAT stay on the vulnerable page");
expect(vulnerableCustomers.includes('data-testid="vulnerable-customer"'), "each vulnerable person is a row");
expect(vulnerableCustomers.includes('data-testid="vulnerable-reason"'), "each row shows why they were categorised");
expect(vulnerableCustomers.includes('data-testid="vulnerable-next-step"'), "each row shows a next step");
expect(!/listBlobs|incomingtranscripts|processedtranscripts/.test(vulnerableCustomers), "the vulnerable page does not scan blobs");
expect(header.includes('href: "/demo", label: "Demo"'), "demo is a separate link");
expect(header.includes('href: "/scoring", label: "Score model"'), "score model stays with the demo");
expect(header.includes("const links = demo"), "score model is not on the live menu");
expect(overview.includes('href="/"') && overview.includes("Open live scores"), "the demo links to live scores");
expect(overview.includes('"/demo/interactions"'), "demo reasons open the demo interactions");
expect(desk.includes('href="/demo"') && desk.includes('href="/demo/interactions"'), "the demo desk stays on demo paths");
expect(liveOverview.includes('href="/demo"') && liveOverview.includes("Open the demo"), "the live page links to the demo");
expect(liveOverview.includes("loadPulseAggregate"), "the live page loads through the timed helper");
expect(liveOverview.includes('data-testid="pulse-waiting"'), "the live page has a waiting state");
expect(liveOverview.includes('data-testid="retry-pulse"'), "the live page has a visible retry");
expect(liveOverview.includes('label="CSAT"'), "the live page shows the CSAT dial");
expect(liveOverview.includes('data-testid="kpi-csat"'), "the live page shows the CSAT average");
expect(liveOverview.includes("Clear results"), "the live page has Clear results");
expect(liveOverview.includes("clearPulseResults"), "Clear results calls the pulse host");
expect(liveOverview.includes("Clear transcripts"), "the live page has Clear transcripts");
expect(liveOverview.includes('data-testid="ask-clear-transcripts"'), "Clear transcripts asks before it runs");
expect(liveOverview.includes('data-testid="confirm-clear-transcripts"'), "Clear transcripts has a confirm button");
expect(liveOverview.includes("clearStoredTranscripts"), "confirming Clear transcripts calls the pulse host");
expect(liveOverview.includes("incomingtranscripts"), "Clear transcripts says the inbox is left in place");
expect(
  liveOverview.indexOf('data-testid="clear-results"') < liveOverview.indexOf('data-testid="clear-transcripts"') &&
    liveOverview.indexOf("Top 5 reasons for bad NPS") < liveOverview.indexOf('data-testid="clear-transcripts"'),
  "Clear transcripts sits below the scores and reasons",
);
expect(!liveOverview.includes("is-single"), "CSAT sits beside NPS");
expect(!/genii/i.test(liveOverview + livePage), "the live page does not mention Genii");
expect(!/sample/i.test(liveOverview + livePage), "the live page has no sample disclaimer");
expect(!/pulse-disclaimer|pulse-sample/.test(liveOverview + livePage), "the live page does not use the sample disclaimer");

function abortError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

function hangingFetch(onAbort: () => void): typeof fetch {
  return ((_input: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) {
        onAbort();
        reject(abortError());
        return;
      }
      init?.signal?.addEventListener("abort", () => {
        onAbort();
        reject(abortError());
      });
    })) as typeof fetch;
}

const pulseBody = JSON.stringify(sample);

void (async () => {
  const started = Date.now();
  let aborted = false;
  await loadPulseAggregate(
    40,
    (async (input: string, init?: RequestInit) => {
      if (String(input).includes("sentiment-pulse-config.json")) {
        return new Response(JSON.stringify({ baseUrl: "https://func.example.net" }), { status: 200 });
      }
      return hangingFetch(() => {
        aborted = true;
      })(input, init);
    }) as typeof fetch,
  ).then(
    () => failures.push("a hanging pulse must reject"),
    () => {},
  );
  expect(aborted, "a hanging pulse is aborted");
  expect(Date.now() - started < 1_000, "a hanging pulse does not block past its deadline");

  let configAborted = false;
  await loadPulseAggregate(40, hangingFetch(() => {
    configAborted = true;
  })).then(
    () => failures.push("a hanging config read must reject"),
    () => {},
  );
  expect(configAborted, "a hanging config read is aborted");

  const controller = new AbortController();
  const pending = loadPulseAggregate(5_000, hangingFetch(() => {}), controller.signal);
  controller.abort();
  const early = Date.now();
  await pending.then(
    () => failures.push("an aborted pulse must reject"),
    () => {},
  );
  expect(Date.now() - early < 500, "aborting the pulse does not wait for the deadline");

  const loaded = await loadPulseAggregate(
    1_000,
    (async (input: string) => {
      if (String(input).includes("sentiment-pulse-config.json")) {
        return new Response(JSON.stringify({ baseUrl: "https://func.example.net" }), { status: 200 });
      }
      return new Response(pulseBody, { status: 200 });
    }) as typeof fetch,
  );
  expect(loaded.total === 3 && loaded.promoters === 1, "a fast pulse returns the aggregate");

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }

  console.log("live pulse ok");
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
