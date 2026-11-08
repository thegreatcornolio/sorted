"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadSentimentPulseUrl,
  overviewFromPulse,
  readPulseAggregate,
  type LiveOverview as LiveOverviewModel,
} from "@/lib/live-pulse";
import { ScoreDial } from "./ScoreDial";
import { SentimentPulseCard } from "./SentimentPulseCard";
import { SiteHeader } from "./SiteHeader";

const EMPTY = overviewFromPulse({
  total: 0,
  mix: { positive: 0, neutral: 0, negative: 0 },
  promoters: 0,
  detractors: 0,
  reasons: [],
  evidence: null,
  movement: [],
});

type Phase = "waiting" | "loading" | "ready" | "error";

export function LiveOverview() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [model, setModel] = useState<LiveOverviewModel>(EMPTY);
  const shown = phase === "ready" ? model : EMPTY;

  useEffect(() => {
    let cancelled = false;
    const seen = { current: false };

    async function tick() {
      const url = await loadSentimentPulseUrl();
      if (cancelled) return;
      if (!url) {
        if (!seen.current) setPhase("waiting");
        return;
      }
      if (!seen.current) setPhase("loading");
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const aggregate = readPulseAggregate(await response.json());
        if (!aggregate) throw new Error("shape");
        if (cancelled) return;
        seen.current = true;
        setModel(overviewFromPulse(aggregate));
        setPhase("ready");
      } catch {
        if (cancelled) return;
        if (!seen.current) setPhase("error");
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const status =
    phase === "loading"
      ? "Reading scored transcripts"
      : phase === "error"
        ? "Sentiment Pulse could not be loaded"
        : shown.total === 0
          ? "Waiting"
          : `${shown.total} ${shown.total === 1 ? "interaction" : "interactions"}`;

  return (
    <>
      <SiteHeader current="overview">
        <span className="live-pill" data-testid="live-status">
          <span className={phase === "loading" ? "dot is-on" : "dot"} aria-hidden="true" />
          {status}
        </span>
      </SiteHeader>
      <main className="desk" data-testid="live-overview">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">NPS · customer interactions support</p>
            <div className="intro-row">
              <h1>Customer interactions support</h1>
              <Link href="/demo" className="text-button" data-testid="open-demo">
                Open the demo
              </Link>
            </div>
          </div>
          <div className="summary-grid is-single">
            <section className="panel summary-card" aria-label="NPS">
              <ScoreDial label="NPS" value={shown.nps} min={-100} max={100} digits={0} signed />
              <p className="band-counts" data-testid="nps-bands">
                <span>
                  Promoters <strong data-testid="kpi-promoters">{shown.promoters}</strong>
                  <small>9–10</small>
                </span>
                <span>
                  Passives <strong data-testid="kpi-passives">{shown.passives}</strong>
                  <small>7–8</small>
                </span>
                <span>
                  Detractors <strong data-testid="kpi-detractors">{shown.detractors}</strong>
                  <small>0–6</small>
                </span>
              </p>
              <p className="meta dial-note" data-testid="kpi-nps">
                {shown.nps === null ? "NPS appears with the first interaction." : `NPS ${shown.nps > 0 ? "+" : ""}${shown.nps}`}
              </p>
            </section>
          </div>
          <SentimentPulseCard pulse={shown.pulse} />
          <section className="panel reason-panel" aria-label="Top reasons for bad NPS">
            <div className="panel-head">
              <h2>Top 5 reasons for bad NPS</h2>
              <p>Detractors only · updates as they arrive</p>
            </div>
            {shown.reasons.length === 0 ? (
              <p className="empty">Reasons appear when the first detractor arrives. A detractor is an interaction scored 0 to 6.</p>
            ) : (
              <ol className="reason-list">
                {shown.reasons.map((item) => (
                  <li key={item.label}>
                    <div className="reason-row" data-testid="top-reason" data-reason={item.label}>
                      <strong>{item.label}</strong>
                      <span>
                        {item.count} {item.count === 1 ? "detractor" : "detractors"}
                      </span>
                    </div>
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
