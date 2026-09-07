"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/StatusPill";

type Rec = {
  id: string;
  movementTypeLabel: string | null;
  purpose: string | null;
  outsideAddress: string | null;
  timeOut: string;
  timeIn: string | null;
  lateStatus: string;
  approvalStatus: string;
};

export default function StudentHistoryPage() {
  const [records, setRecords] = useState<Rec[] | null>(null);

  useEffect(() => {
    fetch("/api/movement/history")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-ink">Sejarah Pergerakan Saya</h1>
      {!records && <p className="text-sm text-ink-soft">Memuatkan...</p>}
      {records && records.length === 0 && (
        <div className="bg-white border border-line rounded-2xl p-8 text-center">
          <p className="text-sm text-ink-soft">Belum ada rekod pergerakan.</p>
        </div>
      )}
      <div className="space-y-3">
        {records?.map((r) => (
          <div key={r.id} className="bg-white border border-line rounded-xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{r.movementTypeLabel ?? r.id}</p>
                {r.purpose && <p className="text-xs text-ink-soft mt-0.5">{r.purpose}</p>}
                {r.outsideAddress && <p className="text-xs text-ink-soft mt-0.5">{r.outsideAddress}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {r.timeIn && <StatusPill status={r.lateStatus} />}
                {!r.timeIn && r.approvalStatus === "PENDING" && <StatusPill status="PENDING" />}
                {!r.timeIn && r.approvalStatus !== "PENDING" && <StatusPill status="OUTSIDE" />}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-mono-data text-ink-soft">
              <div>
                <p className="text-[10px] uppercase tracking-label text-ink-soft/70">Keluar</p>
                <p>{new Date(r.timeOut).toLocaleString("ms-MY")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-label text-ink-soft/70">Masuk</p>
                <p>{r.timeIn ? new Date(r.timeIn).toLocaleString("ms-MY") : "-"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
