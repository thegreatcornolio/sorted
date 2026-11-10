"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function DemoInteractionsRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const query = params.toString();
    router.replace(query ? `/demo/interactions?${query}` : "/demo/interactions");
  }, [router, params]);

  return <p className="empty">Opening the demo interactions…</p>;
}
