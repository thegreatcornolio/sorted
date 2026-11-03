import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader({
  current,
  children,
}: {
  current?: "overview" | "interactions" | "scoring";
  children?: ReactNode;
}) {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <strong>
          SORTED<span>.AI</span>
        </strong>
        <small>Customer support</small>
      </Link>
      <nav className="site-nav" aria-label="Demos">
        <Link href="/" aria-current={current === "overview" ? "page" : undefined}>
          Overview
        </Link>
        <Link href="/interactions" aria-current={current === "interactions" ? "page" : undefined}>
          Interactions
        </Link>
        <Link href="/scoring" aria-current={current === "scoring" ? "page" : undefined}>
          Score model
        </Link>
      </nav>
      {children ? <div className="header-slot">{children}</div> : null}
    </header>
  );
}
