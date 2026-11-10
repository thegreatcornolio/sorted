"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  callByFile,
  callsForReason,
  interactionsFromPulse,
  loadPulseAggregate,
  movementLabel,
  PULSE_FETCH_TIMEOUT_MS,
  type LiveInteractionRecord,
  type PulseAggregate,
  type PulseCall,
} from "@/lib/live-pulse";
import { LiveCallDetail } from "./LiveCallDetail";
import { SiteHeader } from "./SiteHeader";

type Phase = "waiting" | "ready" | "error";

export function LiveInteractions() {
  const params = useSearchParams();
  const reasonFilter = params.get("reason");
  const requested = params.get("call");
  const openedRequest = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pulse, setPulse] = useState<PulseAggregate | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const records: LiveInteractionRecord[] = phase === "ready" && pulse ? interactionsFromPulse(pulse) : [];
  const calls: PulseCall[] = phase === "ready" && pulse && reasonFilter ? callsForReason(pulse, reasonFilter) : [];
  const total = phase === "ready" && pulse ? pulse.total : 0;
  const selected = phase === "ready" && pulse && selectedFile ? callByFile(pulse, selectedFile) : null;

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

  useEffect(() => {
    if (!requested || !pulse || openedRequest.current === requested) return;
    if (!callByFile(pulse, requested)) return;
    openedRequest.current = requested;
    setSelectedFile(requested);
  }, [requested, pulse]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedFile(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [selected]);

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
            <p>
              {reasonFilter
                ? "Scored detractors for this reason, newest first."
                : "Scored files from the live pulse, newest first. The percentages are the running mix after that file was scored."}
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
          <section className="panel" aria-label={reasonFilter ? "Detractors for this reason" : "Scored interactions"}>
            <div className="panel-head">
              <h2>{reasonFilter ?? "Scored interactions"}</h2>
              <p data-testid={reasonFilter ? "reason-filter" : undefined}>
                {reasonFilter ? (
                  <>
                    {phase === "ready" ? `${calls.length} ${calls.length === 1 ? "detractor" : "detractors"}` : "Live pulse"} ·{" "}
                    <Link href="/live/interactions">All interactions</Link>
                  </>
                ) : phase === "ready" ? (
                  `${records.length} ${records.length === 1 ? "file" : "files"}`
                ) : (
                  "Live pulse"
                )}
              </p>
            </div>
            <div className="feed">
              {phase === "ready" && !reasonFilter && records.length === 0 ? (
                <p className="empty" data-testid="live-interactions-empty">
                  No scored interactions yet.
                </p>
              ) : null}
              {phase === "ready" && reasonFilter && calls.length === 0 ? (
                <p className="empty" data-testid="live-reason-empty">
                  No scored interactions for this reason.
                </p>
              ) : null}
              {reasonFilter
                ? calls.map((call) => (
                    <button
                      key={`${call.file}:${call.scoredAt}`}
                      type="button"
                      className="feed-hit"
                      data-testid="live-call"
                      data-file={call.file}
                      onClick={() => setSelectedFile(call.file)}
                    >
                      <strong>{call.file}</strong>
                      <span className="meta">{movementLabel(call.scoredAt)}</span>
                      <span className="score-lines">
                        <span className="score-line">NPS {call.npsBand}</span>
                        <span className="score-line">CSAT {call.csat ?? "—"}</span>
                      </span>
                      <span className="reason-copy">{call.reason}</span>
                      {call.quote ? <span className="quote-line is-open">{call.quote}</span> : null}
                    </button>
                  ))
                : records.map((record, index) => (
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
      {selected ? <LiveCallDetail call={selected} onClose={() => setSelectedFile(null)} /> : null}
    </>
  );
}
