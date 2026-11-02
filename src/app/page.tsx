import { Suspense } from "react";
import { TranscriptDesk } from "@/components/TranscriptDesk";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="empty">Opening the transcript desk…</p>}>
      <TranscriptDesk />
    </Suspense>
  );
}
