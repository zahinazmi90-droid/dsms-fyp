"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { StatusPill } from "@/components/StatusPill";

type Rec = {
  id: string;
  studentName: string;
  matricNumber: string;
  departmentName: string | null;
  semesterLabel: string | null;
  movementTypeLabel: string | null;
  purpose: string | null;
  timeOut: string;
  timeIn: string | null;
  lateStatus: string;
  approvalStatus: string;
};

export default function WardenReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [records, setRecords] = useState<Rec[] | null>(null);
  const [loading, setLoading] = useState(false);

  function buildQuery() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (matricNumber) params.set("matricNumber", matricNumber);
    if (lateOnly) params.set("lateOnly", "true");
    return params.toString();
  }

  async function search() {
    setLoading(true);
    const res = await fetch(`/api/warden/history?${buildQuery()}`);
    const data = await res.json();
    setRecords(data.records ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Laporan Pergerakan</h1>

      <div className="bg-white border border-line rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Dari Tarikh</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-line px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">Hingga Tarikh</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-line px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1">No. Matrik</label>
            <input
              value={matricNumber}
              onChange={(e) => setMatricNumber(e.target.value)}
              className="w-full rounded-lg border border-line px-2.5 py-2 text-sm"
              placeholder="cth: 2425"
            />
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} />
              Lewat Sahaja
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={search} disabled={loading}>
            {loading ? "Mencari..." : "Jana Laporan"}
          </Button>
          <a
            href={`/api/warden/report/excel?${buildQuery()}`}
            className="inline-flex items-center rounded-xl px-4 py-3 font-semibold text-sm bg-white text-ink border border-line hover:bg-surface"
          >
            Eksport Excel
          </a>
          <a
            href={`/api/warden/report/pdf?${buildQuery()}`}
            className="inline-flex items-center rounded-xl px-4 py-3 font-semibold text-sm bg-white text-ink border border-line hover:bg-surface"
          >
            Eksport PDF
          </a>
        </div>
      </div>

      {records && (
        <div className="bg-white border border-line rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Matrik</th>
                <th className="px-3 py-2 font-medium">Jenis</th>
                <th className="px-3 py-2 font-medium">Keluar</th>
                <th className="px-3 py-2 font-medium">Masuk</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.studentName}</td>
                  <td className="px-3 py-2.5 font-mono-data text-ink-soft">{r.matricNumber}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{r.movementTypeLabel ?? "-"}</td>
                  <td className="px-3 py-2.5 font-mono-data text-ink-soft">{new Date(r.timeOut).toLocaleString("ms-MY")}</td>
                  <td className="px-3 py-2.5 font-mono-data text-ink-soft">
                    {r.timeIn ? new Date(r.timeIn).toLocaleString("ms-MY") : "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.lateStatus} />
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                    Tiada rekod ditemui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
