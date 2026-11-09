"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CLEAR_TRANSCRIPTS_TIMEOUT_MS,
  clearPulseResults,
  clearStoredTranscripts,
  loadPulseAggregate,
  overviewFromPulse,
  PULSE_FETCH_TIMEOUT_MS,
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
  csat: null,
  reasons: [],
  evidence: null,
  movement: [],
});

type Phase = "waiting" | "ready" | "error";

export function LiveOverview() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [model, setModel] = useState<LiveOverviewModel>(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [confirmTranscripts, setConfirmTranscripts] = useState(false);
  const [deletingTranscripts, setDeletingTranscripts] = useState(false);
  const generation = useRef(0);
  const shown = phase === "ready" ? model : EMPTY;

  useEffect(() => {
    let cancelled = false;
    const generationAtStart = generation.current;
    const controller = new AbortController();
    void loadPulseAggregate(PULSE_FETCH_TIMEOUT_MS, fetch, controller.signal)
      .then((aggregate) => {
        if (cancelled || generation.current !== generationAtStart) return;
        setModel(overviewFromPulse(aggregate));
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

  function showCleared(aggregate: Parameters<typeof overviewFromPulse>[0]) {
    generation.current += 1;
    setModel(overviewFromPulse(aggregate));
    setPhase("ready");
  }

  function clearResults() {
    if (clearing || deletingTranscripts) return;
    setClearing(true);
    void clearPulseResults(PULSE_FETCH_TIMEOUT_MS, fetch)
      .then((aggregate) => {
        showCleared(aggregate);
      })
      .catch(() => {
        setPhase("error");
      })
      .finally(() => {
        setClearing(false);
      });
  }

  function deleteTranscripts() {
    if (clearing || deletingTranscripts) return;
    setDeletingTranscripts(true);
    void clearStoredTranscripts(CLEAR_TRANSCRIPTS_TIMEOUT_MS, fetch)
      .then((aggregate) => {
        setConfirmTranscripts(false);
        showCleared(aggregate);
      })
      .catch(() => {
        setPhase("error");
      })
      .finally(() => {
        setDeletingTranscripts(false);
      });
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
      <SiteHeader current="live">
        <span className="live-pill" data-testid="live-status">
          <span className={phase === "waiting" ? "dot is-on" : "dot"} aria-hidden="true" />
          {status}
        </span>
      </SiteHeader>
      <main className="desk" data-testid="live-overview">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">Live scores · scored transcripts</p>
            <div className="intro-row">
              <h1>Customer interactions support</h1>
              <span className="intro-actions">
                <button type="button" className="text-button" onClick={clearResults} disabled={clearing} data-testid="clear-results">
                  {clearing ? "Clearing results" : "Clear results"}
                </button>
                <Link href="/" className="text-button" data-testid="open-demo">
                  Open the demo
                </Link>
              </span>
            </div>
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
          <section className="panel clear-transcripts" aria-label="Clear transcripts" data-testid="clear-transcripts">
            <h2>Clear transcripts</h2>
            <p>
              Deletes every file in processedtranscripts: the moved call transcripts, the result JSON, and the error JSON. It also
              writes an empty score record. Files still in incomingtranscripts are left in place.
            </p>
            {confirmTranscripts ? (
              <div className="intro-actions">
                <p>Delete those stored transcripts and result files? This cannot be undone.</p>
                <button
                  type="button"
                  className="text-button is-danger"
                  onClick={deleteTranscripts}
                  disabled={deletingTranscripts || clearing}
                  data-testid="confirm-clear-transcripts"
                >
                  {deletingTranscripts ? "Deleting stored transcripts" : "Delete stored transcripts"}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmTranscripts(false)}
                  disabled={deletingTranscripts}
                  data-testid="cancel-clear-transcripts"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-button is-danger"
                onClick={() => setConfirmTranscripts(true)}
                disabled={deletingTranscripts || clearing}
                data-testid="ask-clear-transcripts"
              >
                Clear transcripts
              </button>
            )}
          </section>
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
