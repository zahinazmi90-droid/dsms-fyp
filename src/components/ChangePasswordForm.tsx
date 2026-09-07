"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/Button";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Ralat berlaku." });
        return;
      }
      setMsg({ ok: true, text: "Kata laluan berjaya dikemaskini." });
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setMsg({ ok: false, text: "Sambungan tidak tersedia. Sila cuba lagi." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-line rounded-2xl p-5 space-y-4">
      <h2 className="font-semibold text-sm text-ink">Tukar Kata Laluan</h2>
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Kata Laluan Semasa</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">Kata Laluan Baharu</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="text-xs text-ink-soft mt-1">Sekurang-kurangnya 8 aksara.</p>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-[var(--status-in)]" : "text-[var(--status-late)]"}`} role="status">
          {msg.text}
        </p>
      )}
      <Button type="submit" full disabled={submitting}>
        {submitting ? "Menyimpan..." : "Kemaskini Kata Laluan"}
      </Button>
    </form>
  );
}
