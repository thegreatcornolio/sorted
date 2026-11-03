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
    id: "late_bill_demand",
    all: [/bill/i, /too late to pay/i, /demand for payment/i],
    quote: [/too late to pay/i, /demand for payment/i],
    nps: 1,
    csat: 1,
    reason: (quotes) =>
      `NPS 1 and CSAT 1 because the bill arrived too late to pay, and then a demand for payment followed. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "RET",
      title: "Escalated to the customer retentions team",
      summary: "Escalated · retentions calling to apologize and offer a 1% rebate",
      detail:
        "The case has been escalated to the customer retentions team. They are assigned to contact the customer, apologize for the bill arriving too late to pay and for the demand for payment that followed, and offer a 1% rebate on the next bill.",
      team: "Customer retentions",
      owner: "Priya Shah, retentions lead",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "late_delivery",
    all: [/arrived late/i, /three days late/i],
    quote: [/arrived late/i, /three days late/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the parcel arrived late, three days late. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "DEL",
      title: "Assigned to the delivery team",
      summary: "Assigned · delivery lead calling, delivery fee refunded",
      detail:
        "The delivery team has the case. A lead is assigned to call the customer today, confirm the parcel is in hand, and refund the delivery fee on the next bill.",
      team: "Delivery",
      owner: "David Pell, delivery lead",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "damaged_item",
    all: [/arrived broken/i, /still waiting/i],
    quote: [/arrived broken/i, /still waiting/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the item arrived broken and the customer is still waiting for a replacement. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "REP",
      title: "Escalated to replacements",
      summary: "Escalated · replacement sent today, return label included",
      detail:
        "Replacements has been escalated. A new item is sent today, and a return label is included so the broken one can go back at no cost.",
      team: "Replacements",
      owner: "Replacements desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "missing_refund",
    all: [/refund never arrived/i],
    quote: [/refund never arrived/i],
    nps: 3,
    csat: 1,
    reason: (quotes) =>
      `NPS 3 and CSAT 1 because the refund never arrived. “${quotes[0]}”`,
    nba: {
      referencePrefix: "REF",
      title: "Offer made by refunds",
      summary: "Offer made · the missing refund is being paid today",
      detail:
        "Refunds has started the missing payment today and will email the customer when it leaves the account. The offer is already made.",
      team: "Refunds",
      owner: "Helen Okonkwo, refunds",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "surprise_fee",
    all: [/extra fee/i, /weren't told/i],
    quote: [/extra fee/i, /weren't told/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because an extra fee appeared and they weren't told first. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "FEE",
      title: "Assigned to the accounts team",
      summary: "Assigned · extra fee taken off, written note of the charges",
      detail:
        "The accounts team has the case. The extra fee is taken off, the current bill stays as it should, and a short note of the real charges is going out.",
      team: "Accounts",
      owner: "Accounts desk",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "long_wait",
    all: [/on hold/i, /forty minutes/i],
    quote: [/on hold/i, /forty minutes/i],
    nps: 4,
    csat: 2,
    reason: (quotes) =>
      `NPS 4 and CSAT 2 because the customer was on hold for forty minutes. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "WAIT",
      title: "Assigned to the duty manager",
      summary: "Assigned · duty manager apologizing, a person booked to call back",
      detail:
        "The duty manager is assigned to call the customer today, apologize for the forty minutes on hold, and stay on the question until it is answered.",
      team: "Support",
      owner: "Duty manager",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "wrong_item",
    all: [/wrong item/i, /second time/i],
    quote: [/wrong item/i, /second time/i],
    nps: 4,
    csat: 1,
    reason: (quotes) =>
      `NPS 4 and CSAT 1 because the wrong item was sent, and this is the second time. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "WRG",
      title: "Escalated to the warehouse",
      summary: "Escalated · right item sent today, the wrong one collected",
      detail:
        "The warehouse has been escalated. The right item goes out today and a driver will collect the wrong one. The customer is not charged again.",
      team: "Warehouse",
      owner: "James Adeyemi, warehouse desk",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "account_locked",
    all: [/locked out/i, /cannot pay/i],
    quote: [/locked out/i, /cannot pay/i],
    nps: 5,
    csat: 2,
    reason: (quotes) =>
      `NPS 5 and CSAT 2 because the customer is locked out and cannot pay. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "ACC",
      title: "Assigned to account help",
      summary: "Assigned · account unlocked, a fresh sign-in link sent",
      detail:
        "Account help has unlocked the account and sent a fresh sign-in link. They will stay on the case until the customer can pay.",
      team: "Account help",
      owner: "Account help desk",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "double_charge",
    all: [/charged me twice/i],
    quote: [/charged me twice/i],
    nps: 2,
    csat: 1,
    reason: (quotes) =>
      `NPS 2 and CSAT 1 because the customer was charged twice for the same order. “${quotes[0]}”`,
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
        "One case owner is now assigned. They will contact the customer today and will not pass the case on again.",
      team: "Support",
      owner: "Sara Iqbal, case owner",
      status: "assigned",
      statusLabel: "Assigned",
    },
  },
  {
    id: "cancelled_still_billed",
    all: [/cancelled/i, /still billed/i],
    quote: [/cancelled/i, /still billed/i],
    nps: 3,
    csat: 1,
    reason: (quotes) =>
      `NPS 3 and CSAT 1 because the customer cancelled and was still billed. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "CAN",
      title: "Offer made by billing",
      summary: "Offer made · cancellation confirmed and the extra charge removed",
      detail:
        "Billing has confirmed the cancellation and removed the charge that should not have been taken. The customer will get the corrected bill by email today.",
      team: "Billing",
      owner: "Helen Okonkwo, billing",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "complaint_ignored",
    all: [/raised a complaint/i, /no one came back/i],
    quote: [/raised a complaint/i, /no one came back/i],
    nps: 4,
    csat: 2,
    reason: (quotes) =>
      `NPS 4 and CSAT 2 because a complaint was raised and no one came back. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "CMP",
      title: "Escalated to the complaints lead",
      summary: "Escalated · complaints lead calling today with an answer",
      detail:
        "The complaints lead has been escalated onto the case and will contact the customer today with an answer, not another handoff.",
      team: "Complaints",
      owner: "Complaints lead",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
  {
    id: "short_refund",
    all: [/refund was short/i, /full amount/i],
    quote: [/refund was short/i, /full amount/i],
    nps: 3,
    csat: 2,
    reason: (quotes) =>
      `NPS 3 and CSAT 2 because the refund was short of the full amount. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "SHR",
      title: "Offer made by refunds",
      summary: "Offer made · the rest of the refund is being paid today",
      detail:
        "Refunds has paid the rest of the amount today. The customer will get an email when the balance leaves the account.",
      team: "Refunds",
      owner: "Helen Okonkwo, refunds",
      status: "offer_made",
      statusLabel: "Offer made",
    },
  },
  {
    id: "closed_no_warning",
    all: [/closed the account/i, /no warning/i],
    quote: [/closed the account/i, /no warning/i],
    nps: 1,
    csat: 2,
    reason: (quotes) =>
      `NPS 1 and CSAT 2 because the account was closed with no warning. “${quotes[0]}” “${quotes[1]}”`,
    nba: {
      referencePrefix: "CUT",
      title: "Escalated to retentions",
      summary: "Escalated · account opened again, retentions calling to apologize",
      detail:
        "The account is being opened again now. Retentions has been escalated to contact the customer, apologize for closing it with no warning, and confirm it will not happen again without a conversation.",
      team: "Customer retentions",
      owner: "Priya Shah, retentions lead",
      status: "escalated",
      statusLabel: "Escalated",
    },
  },
];

const MILD: { re: RegExp; label: string }[] = [
  { re: /would have liked a text/i, label: "no text when the order was on the way" },
  { re: /harder to read than it needs to be/i, label: "a bill that is hard to read" },
  { re: /reply was just a bit slow/i, label: "a reply that was a bit slow" },
  { re: /not yet enabled/i, label: "a login that is still not switched on" },
  { re: /on hold for nine minutes/i, label: "a short wait on hold" },
  { re: /still cautious/i, label: "they are waiting to see the refund clear" },
];

const STRONG = [
  /really pleased/i,
  /excellent/i,
  /went smoothly/i,
  /on the day you promised/i,
  /will shop again/i,
  /spot on/i,
  /very happy with it/i,
  /that was easy/i,
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
      reason: `NPS 7 (passive) and CSAT 3 (neutral). The interaction was handled, and the customer still raised ${mild.label}: “${quotes[0] ?? ""}”`,
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
