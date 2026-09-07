"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  requestId: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      const data = await res.json();
      setUnreadCount(data.count ?? 0);
    } catch {
      // silent
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadCount();
    const t = setInterval(loadCount, 20000);
    return () => clearInterval(t);
  }, [loadCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  }

  async function markRead(id: string, requestId: string | null) {
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    loadCount();
    if (requestId) {
      setOpen(false);
      router.push(`/outing/request/${requestId}`);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={toggleOpen} className="relative p-2 rounded-lg hover:bg-surface text-ink-soft" aria-label="Notifikasi">
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-late)] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-line rounded-xl shadow-lg z-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-semibold text-ink">Notifikasi</span>
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Tandakan semua dibaca
            </button>
          </div>
          <div className="divide-y divide-line">
            {notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id, n.requestId)}
                className={`w-full text-left px-4 py-3 hover:bg-surface transition-colors ${!n.isRead ? "bg-primary-tint/40" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                    <p className="text-xs text-ink-soft line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-ink-soft mt-1">{new Date(n.createdAt).toLocaleString("ms-MY")}</p>
                  </div>
                </div>
              </button>
            ))}
            {notifs.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-soft">Tiada notifikasi.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
