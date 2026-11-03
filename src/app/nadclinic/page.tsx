import { Suspense } from "react";
import { TranscriptDesk } from "@/components/TranscriptDesk";

export default function NadClinicPage() {
  return (
    <Suspense fallback={<p className="empty">Opening the transcript desk…</p>}>
      <TranscriptDesk />
    </Suspense>
  );
}
