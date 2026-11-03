import type {
  Analysis,
  CsatBand,
  NbaStatus,
  NextBestAction,
  NpsBand,
  Sentiment,
  Transcript,
} from "./types";

type Rule = {
  id: string;
  all: RegExp[];
  quote: RegExp[];
  nps: number;
  csat: number;
  reason: (quotes: string[]) => string;
  nba: Omit<NextBestAction, "reference"> & { referencePrefix: string };
};

const ISSUES: Rule[] = [
  {
    id: "late_statement_demand",
    all: [/statement/i, /too late to pay/i, /demand for payment/i],
    quote: [/too late to pay/i, /demand for payment/i],
    nps: 1,
    csat: 1,
    reason: (quotes) =>
      `NPS 1 and CSAT 1 because the statement arrived too late to pay, and then a demand for payment followed. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "RET",
      title: "Escalated to the customer retentions team",
      summary: "Escalated · retentions calling to apologize and offer a 1% rebate",
      detail:
        "The case has been escalated to the customer retentions team. They are assigned to call the account, apologize for the statement arriving too late to pay and for the demand for payment that followed, and offer a 1% rebate on the next bill.",
      team: "Customer retentions",
      owner: "Priya Shah, retentions lead",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "long_outage",
    all: [/office was down/i, /longer than you promised/i],
    quote: [/office was down/i, /longer than you promised/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the office was down for longer than you promised. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "ASS",
      title: "Assigned to the service team",
      summary: "Assigned · service lead calling, credit for the hours the office was down",
      detail:
        "The service team has the case. A lead is assigned to call the customer today, confirm the office is back, and put a credit on the next bill for the hours the office was down.",
      team: "Service team",
      owner: "David Pell, service lead",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "repeat_visits",
    all: [/third visit/i, /still dropping/i],
    quote: [/third visit/i, /still dropping/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because this is the third visit and the connection is still dropping. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "ENG",
      title: "Escalated to a senior engineer",
      summary: "Escalated · senior engineer booked, backup connection until the line stays up",
      detail:
        "A senior engineer has been escalated onto the case, and a backup connection is being put in until the office line stays up.",
      team: "Engineering",
      owner: "Senior engineer desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "billed_not_live",
    all: [/billed us/i, /never turned on/i],
    quote: [/billed us/i, /never turned on/i],
    nps: 3,
    csat: 1,
    reason: (quotes) =>
      `NPS 3 and CSAT 1 because the customer was billed for a line that was never turned on. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "BIL",
      title: "Offer made by the billing team",
      summary: "Offer made · charge taken off and a corrected bill sent",
      detail:
        "The billing team has taken the charge off the account and is sending a corrected bill. The offer is already made, not waiting for another approval.",
      team: "Billing",
      owner: "Helen Okonkwo, billing",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "surprise_price",
    all: [/price went up/i, /weren't told/i],
    quote: [/price went up/i, /weren't told/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because the price went up and they weren't told first. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "COM",
      title: "Assigned to the accounts team",
      summary: "Assigned · price rise held, written terms, 30 days to decide",
      detail:
        "The accounts team has the case. The price rise is on hold, the current bill stays as it is, written terms are going out, and the customer has 30 days to accept or talk it through.",
      team: "Accounts",
      owner: "Accounts desk",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "missed_install",
    all: [/install/i, /nobody arrived/i],
    quote: [/nobody arrived/i],
    nps: 4,
    csat: 2,
    reason: (quotes) =>
      `NPS 4 and CSAT 2 because nobody arrived for the install. “${quotes[0]}”`,
    nba: {
      referencePrefix: "INS",
      title: "Escalated to the install team",
      summary: "Escalated · new install this week, install fee waived",
      detail:
        "The install team has been escalated. A new visit is booked this week and the install fee is waived because nobody arrived.",
      team: "Installs",
      owner: "James Adeyemi, install desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "late_go_live",
    all: [/three weeks late/i, /still not live/i],
    quote: [/three weeks late/i, /still not live/i],
    nps: 4,
    csat: 2,
    reason: (quotes) =>
      `NPS 4 and CSAT 2 because the new office line is three weeks late and still not live. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "SET",
      title: "Assigned to the setup desk",
      summary: "Assigned · named owner, new date today, callback booked",
      detail:
        "The setup desk has named an owner, promised a new go-live date today, and booked a callback before the end of the day.",
      team: "Setup",
      owner: "Tom Becker, setup desk",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "silent_account_manager",
    all: [/account manager/i, /didn't return/i],
    quote: [/account manager/i, /didn't return/i],
    nps: 5,
    csat: 2,
    reason: (quotes) =>
      `NPS 5 and CSAT 2 because the account manager didn't return the customer's calls. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "AMD",
      title: "Escalated to the account director",
      summary: "Escalated · covering account manager, meeting booked this week",
      detail:
        "The account director has been escalated. A covering account manager is assigned and a meeting is booked with the customer this week.",
      team: "Account management",
      owner: "Account director",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "double_charge",
    all: [/charged us twice/i],
    quote: [/charged us twice/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the customer was charged twice for the same bill. “${quotes[0]}”`,
    nba: {
      referencePrefix: "DUP",
      title: "Offer made by billing",
      summary: "Offer made · the duplicate payment is being refunded today",
      detail:
        "Billing has started the refund of the duplicate payment today and will email the customer when it leaves the account.",
      team: "Billing",
      owner: "Helen Okonkwo, billing",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "unusable_slow",
    all: [/slow connection/i, /unusable all week/i],
    quote: [/slow connection/i, /unusable all week/i],
    nps: 4,
    csat: 1,
    reason: (quotes) =>
      `NPS 4 and CSAT 1 because the office has had a slow connection that was unusable all week. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "SPD",
      title: "Assigned to support",
      summary: "Assigned · engineer tomorrow morning at the office",
      detail:
        "Support has booked an engineer for tomorrow morning at the office and will call the customer with the arrival time today.",
      team: "Support",
      owner: "Ruth Nkosi, support",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "missed_callback",
    all: [/callback never came/i],
    quote: [/callback never came/i],
    nps: 5,
    csat: 2,
    reason: (quotes) =>
      `NPS 5 and CSAT 2 because a promised callback never came. “${quotes[0]}”`,
    nba: {
      referencePrefix: "CBK",
      title: "Assigned to the duty manager",
      summary: "Assigned · duty manager calling within the hour",
      detail:
        "The duty manager is assigned to call the customer within the hour and stay on the case until it is closed.",
      team: "Support",
      owner: "Duty manager",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "move_not_ready",
    all: [/office move/i, /line was not ready/i],
    quote: [/office move/i, /line was not ready/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because the line was not ready for the office move. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "MOV",
      title: "Escalated to installs",
      summary: "Escalated · install crew tomorrow, backup connection until then",
      detail:
        "Installs has been escalated. A crew is booked for tomorrow, and a backup connection is going in today so the office can work until the line is ready.",
      team: "Installs",
      owner: "James Adeyemi, install desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "passed_around",
    all: [/transferred me four times/i],
    quote: [/transferred me four times/i],
    nps: 6,
    csat: 2,
    reason: (quotes) =>
      `NPS 6 and CSAT 2 because the customer was transferred four times and still has no owner. “${quotes[0]}”`,
    nba: {
      referencePrefix: "OWN",
      title: "Assigned to one case owner",
      summary: "Assigned · one person owns the case and will call back today",
      detail:
        "One case owner is now assigned. They will call the customer today and will not pass the call on again.",
      team: "Support",
      owner: "Sara Iqbal, case owner",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "wrong_bill_total",
    all: [/bill is wrong/i, /sites we closed/i],
    quote: [/bill is wrong/i, /sites we closed/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because the bill still charges for sites the customer closed. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "FIX",
      title: "Offer made by billing",
      summary: "Offer made · closed sites removed and the difference credited",
      detail:
        "Billing has removed the closed sites from the account and is crediting the difference on the next bill. The customer will get the corrected bill by email today.",
      team: "Billing",
      owner: "Helen Okonkwo, billing",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "no_warning",
    all: [/cut us off/i, /no warning/i],
    quote: [/cut us off/i, /no warning/i],
    nps: 1,
    csat: 2,
    reason: (quotes) =>
      `NPS 1 and CSAT 2 because the office was cut off with no warning. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "CUT",
      title: "Escalated to retentions",
      summary: "Escalated · line turned back on, retentions calling to apologize",
      detail:
        "The line is being turned back on now. Retentions has been escalated to call, apologize for the cut-off with no warning, and confirm it will not happen again without a conversation.",
      team: "Customer retentions",
      owner: "Priya Shah, retentions lead",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
];

const MILD: { re: RegExp; label: string }[] = [
  { re: /would have liked a text/i, label: "no warning before the outage" },
  { re: /harder to read than it needs to be/i, label: "a bill that is hard to read" },
  { re: /a bit slow at busy times/i, label: "a connection that is a bit slow when the office is busy" },
  { re: /not yet enabled/i, label: "a login that is still not switched on" },
  { re: /on hold for nine minutes/i, label: "a long wait on hold" },
  { re: /still cautious/i, label: "they are not sure the fix will hold" },
];

const STRONG = [
  /really pleased/i,
  /excellent/i,
  /went smoothly/i,
  /on the day you promised/i,
  /will renew/i,
  /spot on/i,
  /we signed off/i,
  /we will go ahead/i,
];

const CALM = [/appreciate the update/i, /that all makes sense/i];

function customerLines(transcript: Transcript): string[] {
  return transcript.lines.filter((line) => line.speaker === "Customer").map((line) => line.text);
}

function linesMatching(lines: string[], patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const pattern of patterns) {
    const line =
      lines.find((candidate) => pattern.test(candidate) && !found.includes(candidate)) ??
      lines.find((candidate) => pattern.test(candidate));
    if (line && !found.includes(line)) found.push(line);
  }
  return found;
}

function matchesAll(lines: string[], patterns: RegExp[]): boolean {
  return patterns.every((pattern) => lines.some((line) => pattern.test(line)));
}

export function npsBand(nps: number): NpsBand {
  if (nps >= 9) return "promoter";
  if (nps >= 7) return "passive";
  return "detractor";
}

export function csatBand(csat: number): CsatBand {
  if (csat >= 4) return "positive";
  if (csat === 3) return "neutral";
  return "negative";
}

export function isNegativeScore(nps: number, csat: number): boolean {
  return nps <= 6 || csat <= 2;
}

export function gaugeColor(amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const hue = t < 0.45 ? 6 + (36 - 6) * (t / 0.45) : 36 + (142 - 36) * ((t - 0.45) / 0.55);
  return `hsl(${hue.toFixed(0)} 68% 36%)`;
}

function referenceFor(prefix: string, id: string): string {
  const digits = id.replace(/\D/g, "");
  return `${prefix}-${digits}`;
}

function actionFrom(rule: Rule, id: string): NextBestAction {
  return {
    title: rule.nba.title,
    summary: rule.nba.summary,
    detail: rule.nba.detail,
    team: rule.nba.team,
    owner: rule.nba.owner,
    status: rule.nba.status,
    statusLabel: rule.nba.statusLabel,
    reference: referenceFor(rule.nba.referencePrefix, id),
  };
}

export function analyzeTranscript(transcript: Transcript): Analysis {
  const lines = customerLines(transcript);
  const issue = ISSUES.find((rule) => matchesAll(lines, rule.all));

  if (issue) {
    const quotes = linesMatching(lines, issue.quote);
    return {
      id: transcript.id,
      sentiment: "negative",
      nps: issue.nps,
      csat: issue.csat,
      npsBand: npsBand(issue.nps),
      csatBand: csatBand(issue.csat),
      reason: issue.reason(quotes),
      quotes,
      nba: actionFrom(issue, transcript.id),
    };
  }

  const mild = MILD.find((signal) => lines.some((line) => signal.re.test(line)));
  if (mild) {
    const quotes = linesMatching(lines, [mild.re]);
    return {
      id: transcript.id,
      sentiment: "mixed",
      nps: 7,
      csat: 3,
      npsBand: "passive",
      csatBand: "neutral",
      reason: `NPS 7 (passive) and CSAT 3 (neutral). The call was handled, and the customer still raised ${mild.label}: “${quotes[0] ?? ""}”`,
      quotes,
      nba: null,
    };
  }

  const strongQuotes = linesMatching(lines, STRONG);
  if (strongQuotes.length > 0) {
    const nps = strongQuotes.length >= 2 ? 10 : 9;
    const csat = 5;
    return {
      id: transcript.id,
      sentiment: "positive",
      nps,
      csat,
      npsBand: npsBand(nps),
      csatBand: csatBand(csat),
      reason: `NPS ${nps} (promoter) and CSAT ${csat}. The customer described a clean result: “${strongQuotes[0]}”`,
      quotes: strongQuotes.slice(0, 2),
      nba: null,
    };
  }

  const calmQuotes = linesMatching(lines, CALM);
  const quotes = calmQuotes.length ? calmQuotes.slice(0, 2) : [lines[0] ?? transcript.topic];
  return {
    id: transcript.id,
    sentiment: "positive",
    nps: 8,
    csat: 4,
    npsBand: "passive",
    csatBand: "positive",
    reason: `NPS 8 (passive) and CSAT 4 (positive). The tone is fine, without a strong recommendation: “${quotes[0]}”`,
    quotes,
    nba: null,
  };
}

export function statusTone(status: NbaStatus): "bad" | "warn" | "good" {
  if (status === "offer_made") return "good";
  if (status === "assigned") return "warn";
  return "bad";
}

export function sentimentLabel(sentiment: Sentiment): string {
  if (sentiment === "positive") return "Positive";
  if (sentiment === "mixed") return "Mixed";
  return "Negative";
}
