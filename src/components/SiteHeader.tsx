import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({
  current,
  children,
}: {
  current?: "overview" | "live" | "interactions" | "scoring";
  children?: ReactNode;
}) {
  return (
    <header className="site-header">
      <Link href="/" className="header-mark">
        <img className="header-mark-on-dark" src="/trilogy-deck-dark.png" alt="Trilogy" width={768} height={192} />
        <img className="header-mark-on-light" src="/trilogy-logo.png" alt="" width={4160} height={920} />
      </Link>
      <Link href="/" className="brand">
        <strong>
          SORTED<span>.AI</span>
        </strong>
        <small>Customer support</small>
      </Link>
      <div className="header-right">
        <nav className="site-nav" aria-label="Site">
          <Link href="/" aria-current={current === "overview" ? "page" : undefined}>
            Overview
          </Link>
          <Link href="/live" aria-current={current === "live" ? "page" : undefined}>
            Live
          </Link>
          <Link href="/interactions" aria-current={current === "interactions" ? "page" : undefined}>
            Interactions
          </Link>
          <Link href="/scoring" aria-current={current === "scoring" ? "page" : undefined}>
            Score model
          </Link>
        </nav>
        {children ? <div className="header-slot">{children}</div> : null}
      </div>
    </header>
  );
}
