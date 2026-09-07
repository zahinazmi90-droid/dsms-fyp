"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusPill } from "@/components/StatusPill";

type Row = {
  recordId: string;
  studentId: string;
  name: string;
  matricNumber: string;
  departmentName: string | null;
  semesterLabel: string | null;
  phone: string | null;
  movementType: string | null;
  purpose: string | null;
  timeOut: string;
  expectedReturnAt: string | null;
  durationMinutes: number;
  status: string;
};

type Dashboard = {
  counts: { totalStudents: number; inCollege: number; outside: number; late: number };
  currentlyOutside: Row[];
};

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}

export default function GuardDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guard/dashboard");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Ralat memuatkan dashboard.");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Sambungan tidak tersedia.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return <div className="text-sm text-[var(--status-late)] bg-[var(--status-late-tint)] rounded-xl p-4">{error}</div>;
  }
  if (!data) return <p className="text-sm text-ink-soft">Memuatkan...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Jumlah Pelajar" value={data.counts.totalStudents} color="var(--ink)" />
        <StatCard label="Dalam Kolej" value={data.counts.inCollege} color="var(--status-in)" />
        <StatCard label="Di Luar" value={data.counts.outside} color="var(--status-outside)" />
        <StatCard label="Lewat" value={data.counts.late} color="var(--status-late)" />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold text-sm text-ink">Pelajar Di Luar Sekarang</h2>
          <span className="text-xs text-ink-soft">{data.currentlyOutside.length} rekod</span>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="px-5 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">No. Matrik</th>
                <th className="px-3 py-2 font-medium">Jabatan</th>
                <th className="px-3 py-2 font-medium">Jenis</th>
                <th className="px-3 py-2 font-medium">Masa Keluar</th>
                <th className="px-3 py-2 font-medium">Tempoh</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.currentlyOutside.map((r) => (
                <tr key={r.recordId} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-3 font-mono-data text-ink-soft">{r.matricNumber}</td>
                  <td className="px-3 py-3 text-ink-soft">{r.departmentName ?? "-"}</td>
                  <td className="px-3 py-3 text-ink-soft">{r.movementType ?? "-"}</td>
                  <td className="px-3 py-3 font-mono-data text-ink-soft">
                    {new Date(r.timeOut).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-3 font-mono-data text-ink-soft">{formatDuration(r.durationMinutes)}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
              {data.currentlyOutside.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                    Tiada pelajar di luar buat masa ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-line">
          {data.currentlyOutside.map((r) => (
            <div key={r.recordId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm text-ink">{r.name}</p>
                  <p className="text-xs text-ink-soft font-mono-data">{r.matricNumber}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span>{r.movementType ?? "-"}</span>
                <span>
                  Keluar{" "}
                  {new Date(r.timeOut).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>{formatDuration(r.durationMinutes)}</span>
              </div>
            </div>
          ))}
          {data.currentlyOutside.length === 0 && (
            <p className="p-8 text-center text-sm text-ink-soft">Tiada pelajar di luar buat masa ini.</p>
          )}
        </div>
      </div>
    </div>
  );
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
