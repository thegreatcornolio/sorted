import { Suspense } from "react";
import { TranscriptDesk } from "@/components/TranscriptDesk";

export default function InteractionsPage() {
  return (
    <Suspense fallback={<p className="empty">Opening the interactions…</p>}>
      <TranscriptDesk />
    </Suspense>
  );
}
