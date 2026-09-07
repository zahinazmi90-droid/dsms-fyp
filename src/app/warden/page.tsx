"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";

type Counts = { totalStudents: number; inCollege: number; outside: number; late: number };
type Approval = {
  approvalId: string;
  approverRole: string;
  requestedAt: string;
  movementRecordId: string;
  studentName: string;
  matricNumber: string;
  movementTypeLabel: string | null;
  purpose: string | null;
  outsideAddress: string | null;
  timeOut: string;
};

export default function WardenDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dRes, aRes] = await Promise.all([fetch("/api/guard/dashboard"), fetch("/api/warden/dashboard")]);
    const d = await dRes.json();
    const a = await aRes.json();
    setCounts(d.counts ?? null);
    setApprovals(a.pendingApprovals ?? []);
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

  return (
    <div className="space-y-6">
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Jumlah Pelajar" value={counts.totalStudents} color="var(--ink)" />
          <StatCard label="Dalam Kolej" value={counts.inCollege} color="var(--status-in)" />
          <StatCard label="Di Luar" value={counts.outside} color="var(--status-outside)" />
          <StatCard label="Lewat" value={counts.late} color="var(--status-late)" />
        </div>
      )}

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-sm text-ink">Permohonan Menunggu Kelulusan</h2>
        </div>
        <div className="divide-y divide-line">
          {approvals.map((a) => (
            <div key={a.approvalId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {a.studentName} <span className="text-ink-soft font-mono-data">({a.matricNumber})</span>
                </p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {a.movementTypeLabel} · Peranan diperlukan: {roleLabel(a.approverRole)}
                </p>
                {a.purpose && <p className="text-xs text-ink-soft">{a.purpose}</p>}
                {a.outsideAddress && <p className="text-xs text-ink-soft">{a.outsideAddress}</p>}
                <p className="text-xs text-ink-soft font-mono-data mt-0.5">
                  Diminta: {new Date(a.requestedAt).toLocaleString("ms-MY")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  disabled={busyId === a.approvalId}
                  onClick={() => decide(a.approvalId, "REJECTED")}
                  className="!py-2"
                >
                  Tolak
                </Button>
                <Button disabled={busyId === a.approvalId} onClick={() => decide(a.approvalId, "APPROVED")} className="!py-2">
                  Lulus
                </Button>
              </div>
            </div>
          ))}
          {approvals.length === 0 && <p className="p-8 text-center text-sm text-ink-soft">Tiada permohonan menunggu.</p>}
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  return { TEACHER: "Pensyarah", HEAD_OF_PROGRAMME: "Ketua Program", WARDEN: "Warden", GUARD: "Pengawal" }[role] ?? role;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4">
      <p className="text-2xl font-bold font-mono-data" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-ink-soft mt-1">{label}</p>
    </div>
  );
}
