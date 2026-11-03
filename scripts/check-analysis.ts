import { analyzeTranscript, isNegativeScore } from "../src/lib/analyze";
import { transcripts } from "../src/lib/transcripts";

const analyses = transcripts.map((transcript) => ({
  transcript,
  analysis: analyzeTranscript(transcript),
}));

const failures: string[] = [];

if (transcripts.length !== 100) {
  failures.push(`expected 100 transcripts, got ${transcripts.length}`);
}

const ids = new Set(transcripts.map((item) => item.id));
if (ids.size !== transcripts.length) failures.push("duplicate transcript ids");

const sentiments = { positive: 0, mixed: 0, negative: 0 };
const summaries = new Set<string>();

for (const { transcript, analysis } of analyses) {
  sentiments[analysis.sentiment] += 1;
  const customer = transcript.lines.filter((line) => line.speaker === "Customer").map((line) => line.text);
  for (const quote of analysis.quotes) {
    if (!customer.includes(quote)) {
      failures.push(`${transcript.id} quote is not a customer line: ${quote}`);
    }
  }
  if (analysis.quotes.length === 0) failures.push(`${transcript.id} has no quote`);
if (!analysis.reason.includes(analysis.quotes[0] ?? "\u0000")) {
      failures.push(`${transcript.id} reason does not include its quote`);
    }
    if (analysis.reason.includes("undefined")) failures.push(`${transcript.id} reason interpolates undefined`);
  const negative = isNegativeScore(analysis.nps, analysis.csat);
  if (negative && !analysis.nba) failures.push(`${transcript.id} negative score without an action`);
  if (!negative && analysis.nba) failures.push(`${transcript.id} action triggered on a non-negative score`);
  if (analysis.sentiment === "negative" && !analysis.nba) {
    failures.push(`${transcript.id} negative sentiment without an action`);
  }
  if (analysis.nba) summaries.add(analysis.nba.summary);
}

if (sentiments.positive < 12) failures.push(`too few positive calls: ${sentiments.positive}`);
if (sentiments.mixed < 4) failures.push(`too few mixed calls: ${sentiments.mixed}`);
if (sentiments.negative < 5) failures.push(`too few negative calls: ${sentiments.negative}`);
if (summaries.size !== sentiments.negative) {
  failures.push(`expected unique actions, got ${summaries.size} for ${sentiments.negative} negatives`);
}

const harper = analyses.find((item) => item.transcript.company === "Harper Stores");
if (!harper) {
  failures.push("missing Harper Stores late-bill case");
} else {
  const { analysis } = harper;
  const blob = `${analysis.reason} ${analysis.nba?.detail ?? ""} ${analysis.nba?.title ?? ""} ${analysis.nba?.summary ?? ""}`;
  if (analysis.nps > 6 || analysis.csat > 2) failures.push("Harper Stores is not a negative NPS/CSAT");
  if (!/retentions/i.test(blob)) failures.push("Harper Stores action does not name retentions");
  if (!/1% rebate/i.test(blob)) failures.push("Harper Stores action does not offer a 1% rebate");
  if (!/apolog/i.test(blob)) failures.push("Harper Stores action does not apologize");
  if (analysis.nba?.status !== "escalated") failures.push("Harper Stores action is not escalated");
  if (!analysis.quotes.some((quote) => /too late to pay/i.test(quote))) {
    failures.push("Harper Stores quote does not mention the late bill");
  }
  if (!analysis.quotes.some((quote) => /demand for payment/i.test(quote))) {
    failures.push("Harper Stores quote does not mention the payment demand");
  }
  if (harper.transcript.channel !== "voice") failures.push("Harper Stores late-bill case should stay a voice interaction");
}

const homeWifi = transcripts.some((item) =>
  item.lines.some((line) => /home wifi|living room|netflix/i.test(line.text)),
);
if (homeWifi) failures.push("consumer home-wifi language slipped into a transcript");

const channels = { voice: 0, email: 0, whatsapp: 0 };
for (const item of transcripts) {
  if (item.channel !== "voice" && item.channel !== "email" && item.channel !== "whatsapp") {
    failures.push(`${item.id} has no channel`);
  } else {
    channels[item.channel] += 1;
  }
}
if (channels.voice < 25 || channels.email < 25 || channels.whatsapp < 25) {
  failures.push(`expected a real split across voice, email, and WhatsApp, got ${channels.voice}/${channels.email}/${channels.whatsapp}`);
}

const jargon = /\b(DIA|SLA|VLAN|ONT|MRC|RFS|ethernet|wavelength|demarcation|packet loss|truck-roll|provisioning|circuit|fiber|fibre|gridline|broadband)\b/i;
const jargonHit = transcripts.find(
  (item) =>
    jargon.test(item.company) ||
    jargon.test(item.topic) ||
    jargon.test(item.place) ||
    item.lines.some((line) => jargon.test(line.text)),
);
if (jargonHit) failures.push(`${jargonHit.id} still uses fibre-desk language`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `ok ${transcripts.length} interactions · voice ${channels.voice} · email ${channels.email} · whatsapp ${channels.whatsapp} · positive ${sentiments.positive} · mixed ${sentiments.mixed} · negative ${sentiments.negative}`,
);
for (const { transcript, analysis } of analyses) {
  console.log(
    `${transcript.id}  NPS ${analysis.nps}  CSAT ${analysis.csat}  ${analysis.sentiment.padEnd(8)}  ${
      analysis.nba?.statusLabel ?? "—".padEnd(10)
    }  ${transcript.company}`,
  );
}
