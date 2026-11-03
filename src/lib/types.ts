export type Speaker = "Agent" | "Customer";

export type Channel = "voice" | "email" | "whatsapp";

export type Transcript = {
  id: string;
  channel: Channel;
  company: string;
  contact: string;
  role: string;
  place: string;
  queue: string;
  agent: string;
  callTime: string;
  duration: string;
  topic: string;
  lines: { speaker: Speaker; text: string }[];
};

export type Sentiment = "positive" | "mixed" | "negative";

export type NpsBand = "promoter" | "passive" | "detractor";

export type CsatBand = "positive" | "neutral" | "negative";

export type NbaStatus = "escalated" | "assigned" | "offer_made";

export type NextBestAction = {
  title: string;
  summary: string;
  detail: string;
  team: string;
  owner: string;
  status: NbaStatus;
  statusLabel: string;
  reference: string;
};

export type Analysis = {
  id: string;
  sentiment: Sentiment;
  nps: number;
  csat: number;
  npsBand: NpsBand;
  csatBand: CsatBand;
  reason: string;
  quotes: string[];
  nba: NextBestAction | null;
};
