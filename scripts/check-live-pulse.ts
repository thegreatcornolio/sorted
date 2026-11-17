import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loadPulseAggregate,
  clearResultsUrl,
  clearTranscriptsUrl,
  callByFile,
  callsForReason,
  interactionsFromPulse,
  overviewFromPulse,
  PULSE_FETCH_TIMEOUT_MS,
  readPulseAggregate,
  SENTIMENT_PULSE_BASE_URL_PLACEHOLDER,
  sentimentPulseUrl,
  type VulnerableCustomer,
} from "../src/lib/live-pulse";
import {
  completeFollowUp,
  deskCounts,
  deskPeople,
  engage,
  followUpEmail,
  readEngaging,
  setFollowUpOutcome,
  splitDesk,
  writeEngaging,
  ENGAGING_STORAGE_KEY,
} from "../src/lib/vulnerable-desk";

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
expect(aggregate?.calls.length === 0, "a pulse without calls does not invent any");
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
  expect(overview.evidenceCall === null, "evidence does not open a call the pulse did not list");
  expect(overview.reasons[0]?.calls.length === 0, "a reason without calls stays a label");
}

const withCalls = readPulseAggregate({
  ...sample,
  calls: [
    {
      file: "later.json",
      scoredAt: "2026-11-08T12:00:00.000Z",
      npsBand: "detractor",
      csat: 1,
      reason: "They wanted to cancel",
      quote: "I want to cancel.",
    },
    {
      file: "again.json",
      scoredAt: "2026-11-08T13:00:00.000Z",
      npsBand: "detractor",
      csat: 2,
      reason: "They wanted to cancel",
      quote: "Please cancel the cover.",
    },
  ],
});
expect(
  withCalls != null && callsForReason(withCalls, "They wanted to cancel").map((call) => call.file).join(",") === "again.json,later.json",
  "newest detractor for a reason is first",
);
expect(withCalls != null && callByFile(withCalls, "again.json")?.quote === "Please cancel the cover.", "a file opens its own quote");
expect(withCalls != null && callByFile(withCalls, "again.json")?.npsBand === "detractor", "the opened call keeps its NPS band");
expect(withCalls != null && callByFile(withCalls, "again.json")?.csat === 2, "the opened call keeps its CSAT");
expect(withCalls != null && overviewFromPulse(withCalls).evidenceCall?.file === "again.json", "evidence opens the call it quotes");
expect(withCalls != null && callsForReason(withCalls, "Missing").length === 0, "an unknown reason opens nothing");
expect(
  readPulseAggregate({ ...sample, calls: [{ file: "first.json", npsBand: "promoter", csat: 5, reason: null, quote: null }] }) === null,
  "a promoter is not a detractor call",
);

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
const missedAfford = readPulseAggregate({
  ...sample,
  calls: [
    {
      file: "fec084c7b04c47cc869867150aee6943_transcript.json",
      scoredAt: "2026-11-10T19:26:57.878Z",
      npsBand: "detractor",
      csat: 2,
      reason: "Caller could not afford the suggested service.",
      quote: "Oh, I can't afford that. If he can't take mine, I can't afford that.",
    },
    {
      file: "price.json",
      scoredAt: "2026-11-10T19:00:00.000Z",
      npsBand: "detractor",
      csat: 2,
      reason: "They disliked the price",
      quote: "That price is far too high.",
    },
  ],
});
expect(missedAfford?.vulnerable.length === 1, "a caller who cannot afford the service is listed from the call");
expect(
  missedAfford?.vulnerable[0]?.file === "fec084c7b04c47cc869867150aee6943_transcript.json",
  "the missed afford file is the listed person",
);
expect(
  missedAfford?.vulnerable[0]?.vulnerability_reason === "Caller could not afford the suggested service.",
  "the afford reason is kept",
);
expect((missedAfford?.vulnerable[0]?.next_step.length ?? 0) > 0, "the afford call has a next step");
expect(missedAfford?.calls.length === 2, "a price complaint stays a detractor call");
expect(missedAfford?.vulnerable.some((person) => person.file === "price.json") === false, "ordinary price dislike stays off the list");
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
expect(liveInteractions.includes("callsForReason") && liveInteractions.includes("LiveCallDetail"), "a live reason opens its scored calls");
expect(!liveInteractions.includes("allRows"), "the opened call is not a demo row");
expect(liveOverview.includes('pathname: "/live/interactions"') && liveOverview.includes("evidenceHref"), "reasons and the evidence quote open a live call");
const header = readFileSync(new URL("../src/components/SiteHeader.tsx", import.meta.url), "utf8");
expect(header.includes('href: "/", label: "Live"'), "the live menu links Live to home");
expect(header.includes('href: "/live/interactions", label: "Interactions"'), "the live menu links to live interactions");
expect(header.includes('href: "/live/vulnerable", label: "Vulnerable Customers"'), "the live menu links to vulnerable customers");
expect(
  header.includes('href: "/live/vulnerable-customer", label: "Agent desktop"'),
  "the live menu calls the desk Agent desktop",
);
const vulnerablePage = readFileSync(new URL("../src/app/live/vulnerable/page.tsx", import.meta.url), "utf8");
const vulnerableCustomers = readFileSync(new URL("../src/components/VulnerableCustomers.tsx", import.meta.url), "utf8");
expect(vulnerablePage.includes("<VulnerableCustomers"), "vulnerable customers is its own page");
expect(vulnerableCustomers.includes("loadPulseAggregate"), "the vulnerable page reads the pulse");
expect(vulnerableCustomers.includes('label="NPS"') && vulnerableCustomers.includes('label="CSAT"'), "NPS and CSAT stay on the vulnerable page");
expect(vulnerableCustomers.includes('data-testid="vulnerable-customer"'), "each vulnerable person is a row");
expect(vulnerableCustomers.includes('data-testid="vulnerable-reason"'), "each row shows why they were categorised");
expect(vulnerableCustomers.includes('data-testid="vulnerable-next-step"'), "each row shows a next step");
expect(!/listBlobs|incomingtranscripts|processedtranscripts/.test(vulnerableCustomers), "the vulnerable page does not scan blobs");
const vulnerableCustomerPage = readFileSync(new URL("../src/app/live/vulnerable-customer/page.tsx", import.meta.url), "utf8");
const vulnerableCustomerDesk = readFileSync(new URL("../src/components/VulnerableCustomerDesk.tsx", import.meta.url), "utf8");
expect(vulnerableCustomerPage.includes("<VulnerableCustomerDesk"), "the agent desk is its own page");
expect(vulnerableCustomerPage.includes("Agent desktop"), "the agent desk is titled Agent desktop");
expect(vulnerableCustomerDesk.includes("<h1>Agent desktop</h1>"), "the desk heading is Agent desktop");
expect(vulnerableCustomerDesk.includes('testId="count-vulnerable"'), "the desk graphs vulnerable customers");
expect(vulnerableCustomerDesk.includes('testId="count-attention"'), "the desk graphs people needing attention");
expect(vulnerableCustomerDesk.includes('testId="count-engaging"'), "the desk graphs engaging");
expect(vulnerableCustomerDesk.includes('testId="count-completed"'), "the desk graphs completed");
expect(vulnerableCustomerDesk.includes('testId="count-saved"'), "the desk graphs saved");
expect(vulnerableCustomerDesk.includes('testId="count-lost"'), "the desk graphs lost");
expect(vulnerableCustomerDesk.includes('testId="count-no-answer"'), "the desk graphs no answer");
expect(vulnerableCustomerDesk.includes("Mark completed"), "an engaging person can be marked completed");
expect(vulnerableCustomerDesk.includes("loadPulseAggregate"), "the agent desk reads the pulse");
expect(vulnerableCustomerDesk.includes("followUpEmail"), "email is filled from the selected person");
expect(vulnerableCustomerDesk.includes("Click to email"), "email is a desk button");
expect(vulnerableCustomerDesk.includes("Click to call"), "call is a desk button");
expect(vulnerableCustomerDesk.includes("localStorage"), "engaging stays in the browser");
expect(vulnerableCustomerDesk.includes('data-testid="agent-engaging"'), "engaging is on the same desk");
expect(!vulnerableCustomerDesk.includes("not having insurance"), "the draft is not one fixed letter");
expect(!vulnerableCustomerDesk.includes("mailto:"), "email is not sent");
expect(!vulnerableCustomerDesk.includes("tel:"), "a call is not placed");
expect(
  !/clearPulseResults|clearStoredTranscripts|method:\s*"POST"|azure|sorted-score/i.test(vulnerableCustomerDesk),
  "the agent desk does not write to Azure or change scoring",
);
const insurance = followUpEmail({
  label: "Customer 1",
  vulnerability_reason: "The customer mentioned not having insurance and concerns about service fees.",
  next_step: "Provide additional resources about payment options and assistance programs.",
});
const hold = followUpEmail({
  label: "North Clinic",
  vulnerability_reason: "Their hours were cut, so they cannot pay.",
  next_step: "Arrange a short payment hold.",
});
const team = followUpEmail({
  label: "Customer 8",
  vulnerability_reason: "The caller indicates reliance on Medicare/Medicaid and expresses urgency regarding their medical need.",
  next_step: "The team could follow up with the caller to confirm they successfully reached the intended location and offer additional support if needed.",
});
expect(insurance.body.includes("not having insurance and concerns about service fees."), "the draft uses that person's reason");
expect(insurance.body.includes("payment options and assistance programs."), "the draft uses that person's next step");
expect(insurance.body.includes("lower cost and keep close to the same benefits."), "the draft offers lower-cost options with close to the same benefits");
expect(insurance.body.includes("Hello Customer 1,"), "the draft addresses that person");
expect(insurance.body !== hold.body, "each person gets their own letter");
expect(hold.body.includes("Their hours were cut, so they cannot pay."), "another reason stays in that letter");
expect(hold.body.includes("short payment hold."), "another next step stays in that letter");
expect(!team.body.includes("We will the team"), "a full next step is not forced into an imperative");
expect(team.body.includes("follow up with you"), "the next step is written to that person");
expect(team.body.includes("The caller indicates reliance on Medicare/Medicaid"), "the scored reason stays intact");
expect(!team.body.includes("You indicates"), "a reason is not rewritten into bad grammar");
const connect = followUpEmail({
  label: "Customer 4",
  vulnerability_reason: "The caller mentioned job hour reductions and challenges with mortgage and other payments, indicating financial difficulties.",
  next_step: "Offer to connect the caller with financial assistance or counseling services to address their current situation.",
});
expect(connect.body.includes("connect you with financial assistance"), "the next step speaks to that person");
expect(connect.body.includes("your current situation."), "the offer uses your situation");
const deskRows = deskPeople([
  row("North Clinic", "older.txt", "2026-11-08T12:00:00.000Z", "Their hours were cut, so they cannot pay.", "Arrange a short payment hold."),
  row(
    "fec084c7b04c47cc869867150aee6943_transcript",
    "fec084c7b04c47cc869867150aee6943_transcript.json",
    "2026-11-13T08:04:48.741Z",
    "The customer mentioned not having insurance and concerns about service fees.",
    "Provide additional resources about payment options and assistance programs.",
  ),
]);
expect(deskRows[0]?.label === "Customer 1" && deskRows[0]?.email === "customer1@example.com", "a file id is Customer 1");
expect(deskRows[0]?.phone.startsWith("555-010-"), "the phone is a fake 555 number");
expect(deskRows[1]?.label === "North Clinic" && deskRows[1]?.email === "customer2@example.com", "a name already on the list is kept");
expect(!deskRows.some((person) => /jane|john smith|maria/i.test(person.label)), "the desk does not invent a personal name");
const memory = memoryStorage();
const moved = engage([], { file: deskRows[0].file, channel: "email", movedAt: "2026-11-16T15:00:00.000Z" });
expect(writeEngaging(memory, moved), "engaging can be stored");
expect(readEngaging(memory)[0]?.channel === "email", "a refresh reads the same engaging row");
const split = splitDesk(deskRows, readEngaging(memory));
expect(split.queue.length === 1 && split.queue[0]?.label === "North Clinic", "email removes that person from the queue");
expect(split.engaging.length === 1 && split.engaging[0]?.label === "Customer 1", "email shows them in Engaging");
expect(split.completed.length === 0, "a new follow-up is not completed");
const counted = deskCounts(split);
expect(counted.vulnerable === 2 && counted.attention === 1 && counted.engaging === 1 && counted.completed === 0, "the bars count the live list");
expect(counted.saved === 0 && counted.lost === 0 && counted.noAnswer === 0, "a new follow-up has no outcome");
const withSaved = setFollowUpOutcome(readEngaging(memory), deskRows[0].file, "saved");
const savedLists = splitDesk(deskRows, withSaved);
expect(deskCounts(savedLists).saved === 1 && savedLists.engaging.length === 1, "Saved can be set while engaging");
const finished = completeFollowUp(withSaved, deskRows[0].file);
writeEngaging(memory, finished);
const after = splitDesk(deskRows, readEngaging(memory));
expect(after.engaging.length === 0 && after.completed[0]?.label === "Customer 1", "completed leaves Engaging");
expect(after.completed[0]?.outcome === "saved" && deskCounts(after).completed === 1, "completed keeps the outcome");
const lost = setFollowUpOutcome(finished, deskRows[0].file, "lost");
expect(deskCounts(splitDesk(deskRows, lost)).lost === 1 && deskCounts(splitDesk(deskRows, lost)).saved === 0, "the outcome can change");
memory.setItem(
  ENGAGING_STORAGE_KEY,
  JSON.stringify([{ file: deskRows[0].file, channel: "call", movedAt: "2026-11-16T12:00:00.000Z" }]),
);
const legacy = readEngaging(memory);
expect(legacy[0]?.phase === "engaging" && legacy[0]?.outcome === null, "an older engaging record stays engaging");
expect(readEngaging({ getItem: () => "not json" }).length === 0, "a bad engaging record is ignored");
expect(header.includes('href: "/demo", label: "Demo"'), "demo is a separate link");
expect(header.includes('href: "/scoring", label: "Score model"'), "score model stays with the demo");
expect(header.includes("const links = demo"), "score model is not on the live menu");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
expect(css.includes(".site-nav { grid-column: 1 / -1;"), "narrow live links wrap on their own row");
expect(css.includes(".nav-aside { margin-left: 0; justify-self: start;"), "Demo stays separate from the live links");
expect(css.includes(".vulnerable-card h3,") && css.includes("overflow-wrap: anywhere;"), "a long file id wraps inside the card");
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
  liveOverview.indexOf('data-testid="open-demo"') < liveOverview.indexOf("Top 5 reasons for bad NPS") &&
    liveOverview.indexOf("Top 5 reasons for bad NPS") < liveOverview.indexOf('data-testid="clear-results"') &&
    liveOverview.indexOf('data-testid="clear-transcripts"') < liveOverview.indexOf('data-testid="clear-results"') &&
    liveOverview.indexOf('data-testid="clear-results"') < liveOverview.indexOf('data-testid="ask-clear-transcripts"'),
  "Clear results sits in the bottom caution panel, and Open the demo stays at the top",
);
expect(!liveOverview.includes("is-single"), "CSAT sits beside NPS");
expect(!/genii/i.test(liveOverview + livePage), "the live page does not mention Genii");
expect(!/sample/i.test(liveOverview + livePage), "the live page has no sample disclaimer");
expect(!/pulse-disclaimer|pulse-sample/.test(liveOverview + livePage), "the live page does not use the sample disclaimer");

function row(person: string, file: string, scoredAt: string, vulnerability_reason: string, next_step: string): VulnerableCustomer {
  return { person, file, vulnerable: true, vulnerability_reason, next_step, scoredAt };
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

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
