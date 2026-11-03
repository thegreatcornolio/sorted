"use client";

import { useEffect, useState } from "react";

export const STEP_MS = 3000;
const KEY = "sorted-ingest-started-at";
const RESTART = "sorted-ingest-restart";

export function restartIngest(): number {
  const started = Date.now();
  sessionStorage.setItem(KEY, String(started));
  window.dispatchEvent(new CustomEvent(RESTART, { detail: started }));
  return started;
}

export function useIngest(total: number) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const apply = (started: number) => {
      setStartedAt(started);
      setNow(Date.now());
    };
    const stored = Number(sessionStorage.getItem(KEY));
    const started = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (!(stored > 0)) sessionStorage.setItem(KEY, String(started));
    apply(started);
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    const onRestart = (event: Event) => {
      const next = (event as CustomEvent<number>).detail;
      apply(typeof next === "number" ? next : Date.now());
    };
    window.addEventListener(RESTART, onRestart);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(RESTART, onRestart);
    };
  }, []);

  const count =
    startedAt == null || now === 0 ? 0 : Math.min(total, Math.max(0, Math.floor((now - startedAt) / STEP_MS)));

  return { count, replay: restartIngest, epoch: startedAt };
}
