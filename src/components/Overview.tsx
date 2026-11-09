"use client";

import { useMemo } from "react";
import Link from "next/link";
import { companyNps } from "@/lib/analyze";
import { useIngest } from "@/lib/ingest";
import { pulseFrom } from "@/lib/pulse";
import { allRows } from "@/lib/rows";
import { ScoreDial } from "./ScoreDial";
import { SentimentPulseCard } from "./SentimentPulseCard";
import { SiteHeader } from "./SiteHeader";

export function Overview() {
  const rows = useMemo(() => allRows(), []);
  const { count } = useIngest(rows.length);
  const visible = rows.slice(0, count);
  const promoters = visible.filter((row) => row.analysis.npsBand === "promoter").length;
  const passives = visible.filter((row) => row.analysis.npsBand === "passive").length;
  const detractors = visible.filter((row) => row.analysis.npsBand === "detractor").length;
  const nps = companyNps(visible.map((row) => row.analysis.nps));
  const csatValues = visible.map((row) => row.analysis.csat);
  const avgCsat = csatValues.length ? csatValues.reduce((sum, value) => sum + value, 0) / csatValues.length : null;
  const themes = new Map<string, { label: string; count: number; worst: number }>();
  for (const row of visible) {
    if (row.analysis.nps > 6 || !row.analysis.theme) continue;
    const current = themes.get(row.analysis.theme) ?? { label: row.analysis.theme, count: 0, worst: 10 };
    current.count += 1;
    current.worst = Math.min(current.worst, row.analysis.nps);
    themes.set(row.analysis.theme, current);
  }
  const top = [...themes.values()]
    .sort((a, b) => b.count - a.count || a.worst - b.worst || a.label.localeCompare(b.label))
    .slice(0, 5);
  const ingesting = count < rows.length;
  const pulse = pulseFrom(visible);

  return (
    <>
      <SiteHeader current="overview">
        <span className="live-pill">
          <span className={ingesting ? "dot is-on" : "dot"} aria-hidden="true" />
          {count === 0 ? "Waiting for the first interaction" : ingesting ? `Ingesting ${count} of ${rows.length}` : `Queue ingested · ${rows.length}`}
        </span>
      </SiteHeader>
      <main className="desk">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">NPS and CSAT · customer interactions support</p>
            <div className="intro-row">
              <h1>Customer interactions support</h1>
              <Link href="/live" className="text-button" data-testid="open-live">
                Open live scores
              </Link>
            </div>
          </div>
          <div className="summary-grid">
            <section className="panel summary-card" aria-label="NPS">
              <ScoreDial
                label="NPS"
                value={nps}
                min={-100}
                max={100}
                digits={0}
                signed
              />
              <p className="band-counts" data-testid="nps-bands">
                <span>
                  Promoters <strong data-testid="kpi-promoters">{promoters}</strong>
                  <small>9–10</small>
                </span>
                <span>
                  Passives <strong data-testid="kpi-passives">{passives}</strong>
                  <small>7–8</small>
                </span>
                <span>
                  Detractors <strong data-testid="kpi-detractors">{detractors}</strong>
                  <small>0–6</small>
                </span>
              </p>
              <p className="meta dial-note" data-testid="kpi-nps">
                {nps === null ? "NPS appears with the first interaction." : `NPS ${nps > 0 ? "+" : ""}${nps}`}
              </p>
            </section>
            <section className="panel summary-card" aria-label="CSAT">
              <ScoreDial
                label="CSAT"
                value={avgCsat}
                min={1}
                max={5}
              />
              <p className="meta dial-note" data-testid="kpi-csat">
                {avgCsat === null ? "CSAT appears with the first interaction." : `Average ${avgCsat.toFixed(1)}`}
              </p>
            </section>
          </div>
          <SentimentPulseCard pulse={pulse} />
          <section className="panel reason-panel" aria-label="Top reasons for bad NPS">
            <div className="panel-head">
              <h2>Top 5 reasons for bad NPS</h2>
              <p>Detractors only · updates as they arrive</p>
            </div>
            {top.length === 0 ? (
              <p className="empty">Reasons appear when the first detractor arrives. A detractor is an interaction scored 0 to 6.</p>
            ) : (
              <ol className="reason-list">
                {top.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={{ pathname: "/interactions", query: { reason: item.label } }}
                      data-testid="top-reason"
                      data-reason={item.label}
                    >
                      <strong>{item.label}</strong>
                      <span>
                        {item.count} {item.count === 1 ? "detractor" : "detractors"}
                        <span aria-hidden="true"> →</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
