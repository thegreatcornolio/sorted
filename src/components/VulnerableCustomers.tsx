"use client";

import { useEffect, useState } from "react";
import {
  loadPulseAggregate,
  movementLabel,
  overviewFromPulse,
  PULSE_FETCH_TIMEOUT_MS,
  type LiveOverview as LiveOverviewModel,
  type PulseAggregate,
  type VulnerableCustomer,
} from "@/lib/live-pulse";
import { ScoreDial } from "./ScoreDial";
import { SiteHeader } from "./SiteHeader";

const BLANK_PULSE: PulseAggregate = {
  total: 0,
  mix: { positive: 0, neutral: 0, negative: 0 },
  promoters: 0,
  detractors: 0,
  csat: null,
  reasons: [],
  evidence: null,
  movement: [],
  vulnerable: [],
};

const EMPTY: LiveOverviewModel = overviewFromPulse(BLANK_PULSE);

type Phase = "waiting" | "ready" | "error";

export function VulnerableCustomers() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pulse, setPulse] = useState<PulseAggregate>(BLANK_PULSE);
  const [attempt, setAttempt] = useState(0);
  const shown = phase === "ready" ? overviewFromPulse(pulse) : EMPTY;
  const people: VulnerableCustomer[] = phase === "ready" ? pulse.vulnerable : [];

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void loadPulseAggregate(PULSE_FETCH_TIMEOUT_MS, fetch, controller.signal)
      .then((aggregate) => {
        if (cancelled) return;
        setPulse(aggregate);
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPhase((current) => (current === "ready" ? "ready" : "error"));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => setAttempt((current) => current + 1), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setAttempt((current) => current + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function retry() {
    setPhase("waiting");
    setAttempt((current) => current + 1);
  }

  const status =
    phase === "error"
      ? "Could not load"
      : phase === "ready" && shown.total === 0
        ? "No scored transcripts yet"
        : phase === "ready"
          ? `${shown.total} ${shown.total === 1 ? "interaction" : "interactions"}`
          : "Waiting";

  return (
    <>
      <SiteHeader current="live-vulnerable">
        <span className="live-pill" data-testid="live-status">
          <span className={phase === "waiting" ? "dot is-on" : "dot"} aria-hidden="true" />
          {status}
        </span>
      </SiteHeader>
      <main className="desk" data-testid="vulnerable-customers">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">Live scores · medical inbound</p>
            <h1>Vulnerable Customers</h1>
            <p>
              Each person on a medical inbound call who has trouble paying, is late on payments, or whose circumstances
              have changed so they cannot pay. Disliking a price is not enough to be listed.
            </p>
            {phase === "waiting" ? (
              <p className="status-line" data-testid="pulse-waiting">
                Waiting for scored transcripts.
              </p>
            ) : null}
            {phase === "error" ? (
              <div className="intro-actions status-line" data-testid="pulse-error">
                <p>Scored transcripts did not load.</p>
                <button type="button" className="text-button" onClick={retry} data-testid="retry-pulse">
                  Retry
                </button>
              </div>
            ) : null}
          </div>
          <div className="summary-grid">
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
            <section className="panel summary-card" aria-label="CSAT">
              <ScoreDial label="CSAT" value={shown.csat} min={1} max={5} />
              <p className="meta dial-note" data-testid="kpi-csat">
                {shown.csat === null ? "CSAT appears with the first interaction." : `Average ${shown.csat.toFixed(1)}`}
              </p>
            </section>
          </div>
          <section className="panel reason-panel" aria-label="Vulnerable customers">
            <div className="panel-head">
              <h2>Vulnerable customers</h2>
              <p>{phase === "ready" ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "Live pulse"}</p>
            </div>
            {phase === "ready" && people.length === 0 ? (
              <p className="empty" data-testid="vulnerable-empty">
                No vulnerable customers yet. A person appears here when a scored transcript shows trouble paying, a late
                payment, or a change in circumstances that means they cannot pay.
              </p>
            ) : (
              <ol className="vulnerable-list">
                {people.map((person) => (
                  <li key={`${person.file}:${person.scoredAt}`}>
                    <article className="vulnerable-card" data-testid="vulnerable-customer" data-file={person.file}>
                      <h3>{person.person}</h3>
                      <span className="meta">{person.file}</span>
                      {person.scoredAt ? <span className="meta">{movementLabel(person.scoredAt)}</span> : null}
                      <dl className="vulnerable-fields">
                        <div>
                          <dt>Why they were categorised</dt>
                          <dd data-testid="vulnerable-reason">{person.vulnerability_reason}</dd>
                        </div>
                        <div>
                          <dt>Suggested next step</dt>
                          <dd data-testid="vulnerable-next-step">{person.next_step}</dd>
                        </div>
                      </dl>
                    </article>
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
