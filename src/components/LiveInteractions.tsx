"use client";

import { useEffect, useState } from "react";
import {
  interactionsFromPulse,
  loadPulseAggregate,
  PULSE_FETCH_TIMEOUT_MS,
  type LiveInteractionRecord,
  type PulseAggregate,
} from "@/lib/live-pulse";
import { SiteHeader } from "./SiteHeader";

type Phase = "waiting" | "ready" | "error";

export function LiveInteractions() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pulse, setPulse] = useState<PulseAggregate | null>(null);
  const [attempt, setAttempt] = useState(0);
  const records: LiveInteractionRecord[] = phase === "ready" && pulse ? interactionsFromPulse(pulse) : [];
  const total = phase === "ready" && pulse ? pulse.total : 0;

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
    setPulse(null);
    setAttempt((current) => current + 1);
  }

  const status =
    phase === "error"
      ? "Could not load"
      : phase === "ready" && total === 0
        ? "No scored transcripts yet"
        : phase === "ready"
          ? `${total} ${total === 1 ? "interaction" : "interactions"}`
          : "Waiting";

  return (
    <>
      <SiteHeader current="live-interactions">
        <span className="live-pill" data-testid="live-status">
          <span className={phase === "waiting" ? "dot is-on" : "dot"} aria-hidden="true" />
          {status}
        </span>
      </SiteHeader>
      <main className="desk" data-testid="live-interactions">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">Live scores · scored transcripts</p>
            <h1>Interactions</h1>
            <p>Scored files from the live pulse, newest first. The percentages are the running mix after that file was scored.</p>
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
          <section className="panel" aria-label="Scored interactions">
            <div className="panel-head">
              <h2>Scored interactions</h2>
              <p>{phase === "ready" ? `${records.length} ${records.length === 1 ? "file" : "files"}` : "Live pulse"}</p>
            </div>
            <div className="feed">
              {phase === "ready" && records.length === 0 ? (
                <p className="empty" data-testid="live-interactions-empty">
                  No scored interactions yet.
                </p>
              ) : null}
              {records.map((record, index) => (
                <article
                  key={`${record.file}:${record.scoredAt}:${index}`}
                  className="feed-hit live-row"
                  data-testid="live-interaction"
                  data-file={record.file}
                >
                  <strong>{record.file}</strong>
                  <span className="meta">{record.when}</span>
                  <span className="score-lines">
                    <span className="score-line">Positive {record.positive}%</span>
                    <span className="score-line">Negative {record.negative}%</span>
                  </span>
                  {record.quote ? <span className="quote-line is-open">{record.quote}</span> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
