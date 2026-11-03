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
      `NPS 1 and CSAT 1 because the statement arrived too late to pay and credit control then issued a demand for payment. “${quotes[0]}” “${quotes[1]}”`,
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
    id: "sla_breach",
    all: [/circuit was down/i, /breached the sla/i],
    quote: [/circuit was down/i, /breached the sla/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the circuit was down long enough to breach the fix SLA and the site could not operate. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "ASS",
      title: "Assigned to service assurance",
      summary: "Assigned · duty manager calling, 10% MRC service credit",
      detail:
        "Service assurance has taken the case. The duty manager is assigned to call the customer before noon, confirm restoration, and apply the contractual service credit of 10% of the monthly charge on the affected circuit.",
      team: "Service assurance",
      owner: "David Pell, duty manager",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "repeat_fault",
    all: [/third truck-roll/i, /packet loss/i],
    quote: [/third truck-roll/i, /packet loss/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because this is the third truck-roll and the packet loss returns after each visit. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "NOC",
      title: "Escalated to the network operations centre",
      summary: "Escalated · chronic fault, senior engineer and LTE failover",
      detail:
        "The ticket has been escalated to the network operations centre as a chronic fault. A senior engineer is assigned, and a temporary LTE failover is being put on the depot until the fiber stays stable.",
      team: "Network operations centre",
      owner: "NOC chronic desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "phantom_charge",
    all: [/invoiced/i, /never handed over/i],
    quote: [/invoiced/i, /never handed over/i],
    nps: 3,
    csat: 1,
    reason: (quotes) =>
      `NPS 3 and CSAT 1 because the customer was invoiced for a circuit that was never handed over. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "BIL",
      title: "Offer made by billing resolutions",
      summary: "Offer made · charge credited and statement reissued",
      detail:
        "Billing resolutions has credited the monthly charge for the circuit that was never handed over and is sending a corrected statement to the finance director. The offer is already on the account, not waiting for approval.",
      team: "Billing resolutions",
      owner: "Helen Okonkwo, billing resolutions",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "surprise_renewal",
    all: [/price increase/i, /weren't told/i],
    quote: [/price increase/i, /weren't told/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because a renewal price increase arrived with no prior notice to procurement. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "COM",
      title: "Assigned to commercial",
      summary: "Assigned · increase held, written terms, 30 days to decide",
      detail:
        "Commercial has the case. The price increase is held, current rates stay on the bill, written renewal terms are being sent, and the customer has 30 days to accept or renegotiate.",
      team: "Commercial",
      owner: "Account commercial desk",
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
      `NPS 4 and CSAT 2 because the install was missed and nobody arrived for the booked windows. “${quotes[0]}”`,
    nba: {
      referencePrefix: "FLD",
      title: "Escalated to field operations",
      summary: "Escalated · priority rebook this week, install fee waived",
      detail:
        "Field operations has been escalated. A priority install is booked inside this week and the install fee is waived because nobody arrived for the two windows the customer stood a team down for.",
      team: "Field operations",
      owner: "James Adeyemi, field control",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "provisioning_stall",
    all: [/provisioning/i, /18 days/i, /still not live/i],
    quote: [/18 days/i, /still not live/i],
    nps: 4,
    csat: 2,
    reason: (quotes) =>
      `NPS 4 and CSAT 2 because provisioning is 18 days past the ready-for-service date and the circuit is still not live. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "PRV",
      title: "Assigned to provisioning control",
      summary: "Assigned · named owner, revised RFS today, callback booked",
      detail:
        "Provisioning control has assigned a named owner, committed to issue a revised ready-for-service date today, and booked a callback to the managing director before close of business.",
      team: "Provisioning control",
      owner: "Tom Becker, provisioning control",
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
      `NPS 5 and CSAT 2 because the account manager didn't return repeated calls on a renewal. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "AMD",
      title: "Escalated to the account director",
      summary: "Escalated · covering account manager, recovery meeting this week",
      detail:
        "The account director has been escalated. A covering account manager is assigned and a recovery meeting is booked with the customer this week.",
      team: "Account management",
      owner: "Account director",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
];

const MILD: { re: RegExp; label: string }[] = [
  { re: /proactive text/i, label: "no proactive notice" },
  { re: /harder than it needs to be/i, label: "statement format" },
  { re: /slightly under the committed rate/i, label: "rate shortfall" },
  { re: /not yet enabled/i, label: "portal access still open" },
  { re: /on hold for nine minutes/i, label: "queue time" },
  { re: /still cautious/i, label: "confidence not restored" },
];

const STRONG = [
  /really pleased/i,
  /excellent/i,
  /smooth handover/i,
  /on the committed day/i,
  /will renew/i,
  /spot on/i,
  /signed the acceptance/i,
  /intend to proceed/i,
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
    const nps = issue.nps;
    const csat = issue.csat;
    return {
      id: transcript.id,
      sentiment: "negative",
      nps,
      csat,
      npsBand: npsBand(nps),
      csatBand: csatBand(csat),
      reason: quotes.length === issue.quote.length ? issue.reason(quotes) : issue.reason(quotes),
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
      reason: `NPS ${nps} (promoter) and CSAT ${csat}. The customer described a clean business outcome: “${strongQuotes[0]}”`,
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
