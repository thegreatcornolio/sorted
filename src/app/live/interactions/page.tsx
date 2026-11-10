import { Suspense } from "react";
import { LiveInteractions } from "@/components/LiveInteractions";

export default function LiveInteractionsPage() {
  return (
    <Suspense fallback={<p className="empty">Opening the interactions…</p>}>
      <LiveInteractions />
    </Suspense>
  );
}
