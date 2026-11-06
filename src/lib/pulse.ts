import type { Row } from "./rows";

export type PulsePoint = { time: string; positive: number; negative: number };

export type PulseView = {
  total: number;
  mix: { positive: number; neutral: number; negative: number };
  promoters: number;
  detractors: number;
  topics: { label: string; count: number; width: number }[];
  evidence: { quote: string; company: string; id: string } | null;
  series: PulsePoint[];
  drivers: { label: string; share: number }[];
};

export function wholeShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let leftover = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const item of order) {
    if (leftover <= 0) break;
    floors[item.index] += 1;
    leftover -= 1;
  }
  return floors;
}

export function pulseFrom(rows: Row[]): PulseView {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  let promoters = 0;
  let detractors = 0;
  const themes = new Map<string, { label: string; count: number; worst: number }>();
  let evidence: PulseView["evidence"] = null;
  const series: PulsePoint[] = [];

  rows.forEach((row) => {
    if (row.analysis.sentiment === "positive") positive += 1;
    else if (row.analysis.sentiment === "negative") negative += 1;
    else neutral += 1;
    if (row.analysis.npsBand === "promoter") promoters += 1;
    if (row.analysis.npsBand === "detractor") detractors += 1;
    if (row.analysis.nps <= 6 && row.analysis.theme) {
      const current = themes.get(row.analysis.theme) ?? { label: row.analysis.theme, count: 0, worst: 10 };
      current.count += 1;
      current.worst = Math.min(current.worst, row.analysis.nps);
      themes.set(row.analysis.theme, current);
    }
    const quote = row.analysis.quotes[0];
    if (row.analysis.npsBand === "detractor" && quote) {
      evidence = { quote, company: row.transcript.company, id: row.transcript.id };
    }
    const shares = wholeShares([positive, neutral, negative]);
    series.push({ time: row.transcript.callTime, positive: shares[0], negative: shares[2] });
  });

  const mixShares = rows.length ? wholeShares([positive, neutral, negative]) : [0, 0, 0];
  const ranked = [...themes.values()].sort(
    (a, b) => b.count - a.count || a.worst - b.worst || a.label.localeCompare(b.label),
  );
  const leader = ranked[0]?.count ?? 0;
  return {
    total: rows.length,
    mix: { positive: mixShares[0], neutral: mixShares[1], negative: mixShares[2] },
    promoters,
    detractors,
    topics: ranked.slice(0, 2).map((topic) => ({
      label: topic.label,
      count: topic.count,
      width: leader ? Math.round((topic.count / leader) * 100) : 0,
    })),
    evidence,
    series,
    drivers: ranked.slice(0, 3).map((topic) => ({
      label: topic.label,
      share: negative ? Math.round((topic.count / negative) * 100) : 0,
    })),
  };
}
