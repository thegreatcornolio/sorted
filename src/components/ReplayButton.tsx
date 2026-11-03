"use client";

import { restartIngest } from "@/lib/ingest";

export function ReplayButton() {
  return (
    <button type="button" className="text-button" onClick={() => restartIngest()}>
      Replay
    </button>
  );
}
