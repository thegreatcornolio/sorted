"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadPulseAggregate,
  movementLabel,
  PULSE_FETCH_TIMEOUT_MS,
  type PulseAggregate,
} from "@/lib/live-pulse";
import {
  deskPeople,
  engage,
  followUpEmail,
  readEngaging,
  splitDesk,
  writeEngaging,
  type DeskChannel,
  type EngagingEntry,
  type EngagingPerson,
} from "@/lib/vulnerable-desk";
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
  calls: [],
  vulnerable: [],
};

type Phase = "waiting" | "ready" | "error";

function isEngagingPerson(person: { file: string } & { channel?: DeskChannel }): person is EngagingPerson {
  return person.channel === "call" || person.channel === "email";
}

export function VulnerableCustomerDesk() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pulse, setPulse] = useState<PulseAggregate>(BLANK_PULSE);
  const [attempt, setAttempt] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [engaging, setEngaging] = useState<EngagingEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [mode, setMode] = useState<DeskChannel | null>(null);

  useEffect(() => {
    setEngaging(readEngaging(window.localStorage));
    setStorageReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      setEngaging(readEngaging(window.localStorage));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const people = useMemo(() => (phase === "ready" ? deskPeople(pulse.vulnerable) : []), [phase, pulse]);
  const listed = useMemo(() => splitDesk(people, storageReady ? engaging : []), [people, engaging, storageReady]);
  const selected =
    listed.queue.find((person) => person.file === selectedFile) ??
    listed.engaging.find((person) => person.file === selectedFile) ??
    null;
  const draft = selected ? followUpEmail(selected) : null;
  const listsReady = phase === "ready" && storageReady;

  function retry() {
    setPhase("waiting");
    setAttempt((current) => current + 1);
  }

  function select(file: string) {
    setSelectedFile(file);
    setMode(null);
  }

  function move(channel: DeskChannel) {
    if (!selected || isEngagingPerson(selected)) return;
    const next = engage(engaging, {
      file: selected.file,
      channel,
      movedAt: new Date().toISOString(),
    });
    setEngaging(next);
    writeEngaging(window.localStorage, next);
    setMode(null);
  }

  const status =
    phase === "error"
      ? "Could not load"
      : phase === "ready" && pulse.total === 0
        ? "No scored transcripts yet"
        : phase === "ready"
          ? `${pulse.total} ${pulse.total === 1 ? "interaction" : "interactions"}`
          : "Waiting";

  return (
    <>
      <SiteHeader current="live-vulnerable-customer">
        <span className="live-pill" data-testid="live-status">
          <span className={phase === "waiting" ? "dot is-on" : "dot"} aria-hidden="true" />
          {status}
        </span>
      </SiteHeader>
      <main className="desk agent-desk" data-testid="vulnerable-customer-desk">
        <div className="wrap">
          <div className="desk-intro">
            <p className="kicker">Agent desk · medical inbound</p>
            <h1>Vulnerable Customer</h1>
            <p>
              Follow up after Sorted flags someone. The queue is the{" "}
              <Link href="/live/vulnerable">Vulnerable Customers</Link> list. Choose a person, then call or email.
              Neither action leaves this browser. Engaging stays in this browser after a refresh.
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
          <div className="desk-grid">
            <div className="agent-lists">
              <section className="panel" aria-label="Queue" data-testid="agent-queue">
                <div className="panel-head">
                  <h2>Queue</h2>
                  <p>{listsReady ? `${listed.queue.length} to follow up` : "Live pulse"}</p>
                </div>
                <div className="feed">
                  {phase === "error" ? <p className="empty">The live list did not load.</p> : null}
                  {phase !== "error" && !listsReady ? <p className="empty">Waiting for the live list.</p> : null}
                  {listsReady && listed.queue.length === 0 ? (
                    <p className="empty" data-testid="agent-queue-empty">
                      {people.length === 0
                        ? "No vulnerable customers yet. A person appears here when the live list has someone to follow up."
                        : "Everyone on the live list is in Engaging."}
                    </p>
                  ) : null}
                  {listsReady
                    ? listed.queue.map((person) => (
                        <button
                          key={person.file}
                          type="button"
                          className={selectedFile === person.file ? "feed-hit is-selected" : "feed-hit"}
                          aria-pressed={selectedFile === person.file}
                          data-testid="agent-queue-person"
                          data-file={person.file}
                          onClick={() => select(person.file)}
                        >
                          <strong>{person.label}</strong>
                          <span className="meta">{person.email}</span>
                          <span className="meta">{person.phone}</span>
                          <span className="meta">Identified {movementLabel(person.scoredAt)}</span>
                          <span className="meta">{person.file}</span>
                          <span className="eyebrow">Why they were categorised</span>
                          <span className="reason-copy" data-testid="agent-reason">
                            {person.vulnerability_reason}
                          </span>
                          <span className="eyebrow">Suggested next step</span>
                          <span className="reason-copy" data-testid="agent-next-step">
                            {person.next_step}
                          </span>
                        </button>
                      ))
                    : null}
                </div>
              </section>
              <section className="panel reason-panel" aria-label="Engaging" data-testid="agent-engaging">
                <div className="panel-head">
                  <h2>Engaging</h2>
                  <p aria-live="polite">{listsReady ? `${listed.engaging.length} in progress` : "This browser"}</p>
                </div>
                <div className="feed">
                  {listsReady && listed.engaging.length === 0 ? (
                    <p className="empty" data-testid="agent-engaging-empty">
                      No one is in Engaging yet. Call or email moves a person here, and a refresh in this browser keeps
                      them here.
                    </p>
                  ) : null}
                  {listsReady
                    ? listed.engaging.map((person) => (
                        <button
                          key={person.file}
                          type="button"
                          className={selectedFile === person.file ? "feed-hit is-selected" : "feed-hit"}
                          aria-pressed={selectedFile === person.file}
                          data-testid="agent-engaging-person"
                          data-file={person.file}
                          data-channel={person.channel}
                          onClick={() => select(person.file)}
                        >
                          <strong>{person.label}</strong>
                          <span className="row-tags">
                            <span className="tag pos">{person.channel === "email" ? "Email" : "Call"}</span>
                          </span>
                          <span className="meta">Engaging · {movementLabel(person.movedAt)}</span>
                          <span className="meta">Identified {movementLabel(person.scoredAt)}</span>
                          <span className="eyebrow">Why they were categorised</span>
                          <span className="reason-copy">{person.vulnerability_reason}</span>
                          <span className="eyebrow">Suggested next step</span>
                          <span className="reason-copy">{person.next_step}</span>
                        </button>
                      ))
                    : null}
                </div>
              </section>
            </div>
            <aside className="panel actions" aria-label="Follow-up">
              <div className="panel-head">
                <h2>{selected ? selected.label : "Follow-up"}</h2>
                <p>{selected ? (isEngagingPerson(selected) ? "Engaging" : "Selected") : "Choose a person"}</p>
              </div>
              {!selected ? (
                <p className="empty" data-testid="agent-follow-up-empty">
                  Select someone in the queue. Email fills a draft from their reason and next step. Call opens a dummy
                  panel. Nothing is sent, and no call is placed.
                </p>
              ) : (
                <>
                  <dl className="vulnerable-fields agent-fields">
                    <div>
                      <dt>Dummy email</dt>
                      <dd data-testid="dummy-email">{selected.email}</dd>
                    </div>
                    <div>
                      <dt>Dummy phone</dt>
                      <dd data-testid="dummy-phone">{selected.phone}</dd>
                    </div>
                    <div>
                      <dt>Identified</dt>
                      <dd>{movementLabel(selected.scoredAt)}</dd>
                    </div>
                    <div>
                      <dt>Why they were categorised</dt>
                      <dd>{selected.vulnerability_reason}</dd>
                    </div>
                    <div>
                      <dt>Suggested next step</dt>
                      <dd>{selected.next_step}</dd>
                    </div>
                  </dl>
                  {isEngagingPerson(selected) ? (
                    <p className="empty" data-testid="engaging-note">
                      {selected.label} is in Engaging
                      {selected.channel === "email"
                        ? " after a dummy email. No message was sent."
                        : " after a dummy call. No call was placed."}
                    </p>
                  ) : (
                    <>
                      <div className="agent-choice">
                        <button
                          type="button"
                          className="text-button"
                          aria-pressed={mode === "call"}
                          data-testid="choose-call"
                          onClick={() => setMode("call")}
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          aria-pressed={mode === "email"}
                          data-testid="choose-email"
                          onClick={() => setMode("email")}
                        >
                          Email
                        </button>
                      </div>
                      {mode === "email" && draft ? (
                        <div className="draft" data-testid="email-draft">
                          <p className="meta">To {selected.email}</p>
                          <p className="draft-subject">
                            <span className="eyebrow">Subject</span> {draft.subject}
                          </p>
                          <div className="draft-body" data-testid="email-body">
                            {draft.body}
                          </div>
                          <p className="hint">Click to email does not send this message. It moves them to Engaging.</p>
                          <button
                            type="button"
                            className="text-button"
                            data-testid="click-to-email"
                            onClick={() => move("email")}
                          >
                            Click to email
                          </button>
                        </div>
                      ) : null}
                      {mode === "call" ? (
                        <div className="call-panel" data-testid="call-panel">
                          <p>No call is placed. This number is fake and stays on the desk.</p>
                          <p className="call-number">{selected.phone}</p>
                          <p className="hint">Click to call does not dial. It moves them to Engaging.</p>
                          <button
                            type="button"
                            className="text-button"
                            data-testid="click-to-call"
                            onClick={() => move("call")}
                          >
                            Click to call
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
