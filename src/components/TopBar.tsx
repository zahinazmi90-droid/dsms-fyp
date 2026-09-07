"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "./NotificationBell";
import { setupPushNotifications } from "@/lib/firebase/client";

export function TopBar({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Best-effort, silent -- if Firebase isn't configured or the user
    // denies permission, this just logs a warning (see client.ts) and
    // the in-app notification bell keeps working normally regardless.
    setupPushNotifications().catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-line">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white text-[11px] font-bold tracking-label shrink-0">
            DSMS
          </span>
          <span className="text-sm font-semibold text-ink-soft truncate">{title}</span>
        </div>
        <nav className="hidden sm:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === l.href ? "bg-primary-tint text-primary" : "text-ink-soft hover:bg-surface"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <button onClick={logout} className="text-sm font-medium text-ink-soft hover:text-[var(--status-late)] px-2 py-1.5">
            Log Keluar
          </button>
        </div>
      </div>
      <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              pathname === l.href ? "bg-primary-tint text-primary" : "text-ink-soft hover:bg-surface"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
