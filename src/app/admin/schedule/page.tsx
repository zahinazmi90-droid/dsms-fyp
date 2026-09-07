"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";

type Rule = {
  dayType: string;
  outingStart: string;
  returnDeadline: string;
  isActive: boolean;
};

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Isnin",
  TUESDAY: "Selasa",
  WEDNESDAY: "Rabu",
  THURSDAY: "Khamis",
  FRIDAY: "Jumaat",
  SATURDAY: "Sabtu",
  SUNDAY: "Ahad",
  HOLIDAY: "Cuti (Lalai)",
};
const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "HOLIDAY"];

export default function AdminSchedulePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/schedule");
    const data = await res.json();
    const byDay = new Map<string, Rule>((data.rules ?? []).map((r: Rule) => [r.dayType, r]));
    setRules(DAY_ORDER.map((d) => byDay.get(d) ?? { dayType: d, outingStart: "17:00", returnDeadline: "19:00", isActive: true }));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  function update(dayType: string, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r) => (r.dayType === dayType ? { ...r, ...patch } : r)));
  }

  async function save(rule: Rule) {
    setSaving(rule.dayType);
    await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    setSaving(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Jadual Waktu Outing &amp; Had Pulang</h1>
        <p className="text-sm text-ink-soft mt-1">
          Tetapkan waktu mula outing dan had masa pulang bagi setiap hari. Peraturan &ldquo;Cuti&rdquo; hanya terpakai jika
          tarikh tersebut didaftarkan di halaman Cuti.
        </p>
      </div>

      <div className="bg-white border border-line rounded-2xl divide-y divide-line">
        {rules.map((r) => (
          <div key={r.dayType} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="w-28 shrink-0 text-sm font-medium text-ink">{DAY_LABEL[r.dayType]}</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-soft">Mula</label>
              <input
                type="time"
                value={r.outingStart}
                onChange={(e) => update(r.dayType, { outingStart: e.target.value })}
                className="rounded-lg border border-line px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-soft">Had Pulang</label>
              <input
                type="time"
                value={r.returnDeadline}
                onChange={(e) => update(r.dayType, { returnDeadline: e.target.value })}
                className="rounded-lg border border-line px-2 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={r.isActive} onChange={(e) => update(r.dayType, { isActive: e.target.checked })} />
              Aktif
            </label>
            <div className="sm:ml-auto">
              <Button onClick={() => save(r)} disabled={saving === r.dayType} className="!py-2 !px-3 text-xs">
                {saving === r.dayType ? "..." : "Simpan"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
