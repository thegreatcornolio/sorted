import { Suspense } from "react";
import { DemoInteractionsRedirect } from "@/components/DemoInteractionsRedirect";

export default function InteractionsRedirectPage() {
  return (
    <Suspense fallback={<p className="empty">Opening the demo interactions…</p>}>
      <DemoInteractionsRedirect />
    </Suspense>
  );
}
