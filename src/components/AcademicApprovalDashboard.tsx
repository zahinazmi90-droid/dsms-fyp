"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";

type Req = {
  approvalId: string;
  approverRole: string;
  status: string;
  requestedAt: string;
  movementRecordId: string;
  movementApprovalStatus: string;
  studentName: string;
  matricNumber: string;
  movementTypeLabel: string | null;
  purpose: string | null;
  timeOut: string;
};

export function AcademicApprovalDashboard({ roleLabel }: { roleLabel: string }) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/academic/pending");
    const data = await res.json();
    setRequests(data.requests ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(approvalId: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(approvalId);
    await fetch("/api/approvals/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision }),
    });
    setBusyId(null);
    load();
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Permohonan Keluar Pelajar</h1>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-sm text-ink">Menunggu Keputusan Anda</h2>
        </div>
        <div className="divide-y divide-line">
          {pending.map((r) => {
            const alreadyFinalized = r.movementApprovalStatus === "APPROVED" || r.movementApprovalStatus === "REJECTED";
            return (
              <div key={r.approvalId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {r.studentName} <span className="text-ink-soft font-mono-data">({r.matricNumber})</span>
                  </p>
                  <p className="text-xs text-ink-soft mt-0.5">{r.movementTypeLabel ?? "-"}</p>
                  {r.purpose && <p className="text-xs text-ink-soft">{r.purpose}</p>}
                  <p className="text-xs text-ink-soft font-mono-data mt-0.5">
                    Dihantar: {new Date(r.timeOut).toLocaleString("ms-MY")}
                  </p>
                  {alreadyFinalized && (
                    <p className="text-xs font-medium text-primary mt-1">Keputusan muktamad telah dibuat oleh Ketua Program.</p>
                  )}
                </div>
                {alreadyFinalized ? (
                  <span className="text-xs text-ink-soft shrink-0">Tiada tindakan diperlukan</span>
                ) : (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" disabled={busyId === r.approvalId} onClick={() => decide(r.approvalId, "REJECTED")} className="!py-2 text-xs">
                      Tolak
                    </Button>
                    <Button disabled={busyId === r.approvalId} onClick={() => decide(r.approvalId, "APPROVED")} className="!py-2 text-xs">
                      Lulus
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {loaded && pending.length === 0 && (
            <p className="p-8 text-center text-sm text-ink-soft">Tiada permohonan menunggu keputusan {roleLabel}.</p>
          )}
        </div>
      </div>

      {decided.length > 0 && (
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-semibold text-sm text-ink">Sejarah Keputusan</h2>
          </div>
          <div className="divide-y divide-line">
            {decided.slice(0, 10).map((r) => (
              <div key={r.approvalId} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {r.studentName} <span className="text-ink-soft font-mono-data">({r.matricNumber})</span>
                  </p>
                  <p className="text-xs text-ink-soft">{r.movementTypeLabel ?? "-"}</p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    r.status === "APPROVED" ? "text-[var(--status-in)]" : "text-[var(--status-late)]"
                  }`}
                >
                  {r.status === "APPROVED" ? "Diluluskan" : r.status === "REJECTED" ? "Ditolak" : r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
