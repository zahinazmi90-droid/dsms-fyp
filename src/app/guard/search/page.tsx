"use client";

import { useState, FormEvent } from "react";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/Button";

type Result = {
  id: string;
  name: string;
  matricNumber: string;
  phone: string | null;
  departmentName: string | null;
  semesterLabel: string | null;
  status: string;
  lastRecord: { movementTypeLabel: string | null; timeOut: string; timeIn: string | null; purpose: string | null } | null;
};

export default function GuardSearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/guard/search?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Carian Pelajar</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nama atau No. Matrik"
          className="flex-1 rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "..." : "Cari"}
        </Button>
      </form>

      {results && results.length === 0 && (
        <p className="text-sm text-ink-soft">Tiada keputusan untuk &ldquo;{q}&rdquo;.</p>
      )}

      <div className="space-y-3">
        {results?.map((r) => (
          <div key={r.id} className="bg-white border border-line rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-ink">{r.name}</p>
                <p className="text-xs text-ink-soft font-mono-data">{r.matricNumber}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
            <div className="mt-2 text-xs text-ink-soft space-y-0.5">
              <p>
                {r.departmentName ?? "-"} · {r.semesterLabel ?? "-"}
              </p>
              {r.phone && <p className="font-mono-data">Tel: {r.phone}</p>}
              {r.lastRecord && (
                <p>
                  Rekod terakhir: {r.lastRecord.movementTypeLabel ?? "-"} ·{" "}
                  {new Date(r.lastRecord.timeOut).toLocaleString("ms-MY")}
                  {r.lastRecord.timeIn ? ` → ${new Date(r.lastRecord.timeIn).toLocaleString("ms-MY")}` : " (aktif)"}
                </p>
              )}
            </div>
            {r.status === "REJECTED" && (
              <div className="mt-3">
                <Button
                  variant="secondary"
                  className="!py-1.5 !px-3 text-xs"
                  onClick={async () => {
                    await fetch("/api/warden/force-checkin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ studentId: r.id }),
                    });
                    handleSearch(new Event("submit") as unknown as FormEvent);
                  }}
                >
                  Tutup Rekod (Ditolak)
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
