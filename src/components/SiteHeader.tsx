import Link from "next/link";
import type { ReactNode } from "react";

type Current = "live" | "live-interactions" | "live-vulnerable" | "demo" | "demo-interactions" | "scoring";

export function SiteHeader({
  current,
  children,
}: {
  current?: Current;
  children?: ReactNode;
}) {
  const demo = current === "demo" || current === "demo-interactions" || current === "scoring";
  const links = demo
    ? [
        { href: "/demo", label: "Demo", current: current === "demo" },
        { href: "/demo/interactions", label: "Interactions", current: current === "demo-interactions" },
        { href: "/scoring", label: "Score model", current: current === "scoring" },
      ]
    : [
        { href: "/", label: "Live", current: current === "live" },
        { href: "/live/interactions", label: "Interactions", current: current === "live-interactions" },
        { href: "/live/vulnerable", label: "Vulnerable Customers", current: current === "live-vulnerable" },
      ];
  const aside = demo ? { href: "/", label: "Live" } : { href: "/demo", label: "Demo" };

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
        <nav className="site-nav" aria-label={demo ? "Demo" : "Live"}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="nav-aside">
          <Link href={aside.href}>{aside.label}</Link>
        </span>
        {children ? <div className="header-slot">{children}</div> : null}
      </div>
    </header>
  );
}
