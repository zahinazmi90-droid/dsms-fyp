"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { Button } from "@/components/Button";

type Holiday = {
  id: string;
  name: string;
  date: string;
  outingStart: string;
  returnDeadline: string;
  isActive: boolean;
};

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [outingStart, setOutingStart] = useState("07:30");
  const [returnDeadline, setReturnDeadline] = useState("22:00");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/holidays");
    const data = await res.json();
    setHolidays(data.holidays ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date, outingStart, returnDeadline, isActive: true }),
    });
    setSubmitting(false);
    setName("");
    setDate("");
    load();
  }

  async function toggleActive(h: Holiday) {
    await fetch("/api/admin/holidays", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: h.id, isActive: !h.isActive }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Pengurusan Cuti</h1>

      <form onSubmit={handleAdd} className="bg-white border border-line rounded-2xl p-5 grid sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink-soft mb-1">Nama Cuti</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Tarikh</label>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Mula Outing</label>
          <input type="time" value={outingStart} onChange={(e) => setOutingStart(e.target.value)} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Had Pulang</label>
          <input type="time" value={returnDeadline} onChange={(e) => setReturnDeadline(e.target.value)} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
        </div>
        <div className="sm:col-span-5">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Menambah..." : "Tambah Cuti"}
          </Button>
        </div>
      </form>

      <div className="bg-white border border-line rounded-2xl divide-y divide-line">
        {holidays.map((h) => (
          <div key={h.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{h.name}</p>
              <p className="text-xs text-ink-soft">
                {h.date} · {h.outingStart} - {h.returnDeadline}
              </p>
            </div>
            <Button variant={h.isActive ? "secondary" : "primary"} onClick={() => toggleActive(h)} className="!py-2 !px-3 text-xs">
              {h.isActive ? "Nyahaktifkan" : "Aktifkan"}
            </Button>
          </div>
        ))}
        {holidays.length === 0 && <p className="p-8 text-center text-sm text-ink-soft">Tiada cuti didaftarkan.</p>}
      </div>
    </div>
  );
}
