"use client";

import { useEffect, useState } from "react";

export const STEP_MS = 3000;
const KEY = "sorted-ingest-started-at";

export function useIngest(total: number) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const stored = Number(sessionStorage.getItem(KEY));
    const started = Number.isFinite(stored) && stored > 0 ? stored : Date.now();
    if (!(stored > 0)) sessionStorage.setItem(KEY, String(started));
    setStartedAt(started);
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  const count =
    startedAt == null || now === 0 ? 0 : Math.min(total, Math.max(0, Math.floor((now - startedAt) / STEP_MS)));

  const replay = () => {
    const started = Date.now();
    sessionStorage.setItem(KEY, String(started));
    setStartedAt(started);
    setNow(Date.now());
  };

  return { count, replay, epoch: startedAt };
}
