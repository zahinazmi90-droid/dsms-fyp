"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  action: string;
  target: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
  userLoginId: string | null;
  userRole: string | null;
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Log Audit</h1>
      <div className="bg-white border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="px-4 py-2 font-medium">Masa</th>
              <th className="px-3 py-2 font-medium">Pengguna</th>
              <th className="px-3 py-2 font-medium">Tindakan</th>
              <th className="px-3 py-2 font-medium">Sasaran</th>
              <th className="px-3 py-2 font-medium">Butiran</th>
              <th className="px-3 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 font-mono-data text-ink-soft whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString("ms-MY")}
                </td>
                <td className="px-3 py-2 text-ink-soft">{l.userLoginId ?? "-"} ({l.userRole ?? "-"})</td>
                <td className="px-3 py-2 font-medium text-ink">{l.action}</td>
                <td className="px-3 py-2 text-ink-soft font-mono-data">{l.target ?? "-"}</td>
                <td className="px-3 py-2 text-ink-soft">{l.description ?? "-"}</td>
                <td className="px-3 py-2 text-ink-soft font-mono-data">{l.ipAddress ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs?.length === 0 && <p className="p-8 text-center text-sm text-ink-soft">Tiada log audit.</p>}
      </div>
    </div>
  );
}
