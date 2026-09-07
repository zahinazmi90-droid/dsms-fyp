"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";

type Setting = {
  key: string;
  value: unknown;
  label: string;
  description: string;
  category: string;
};

const CATEGORY_ORDER = ["GENERAL", "OUTING", "RETURN", "APPROVAL", "LATE", "LOCATION", "PRIVACY", "REPORTS", "QR", "SYSTEM"];
const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "Umum",
  OUTING: "Peraturan Outing",
  RETURN: "Peraturan Pulang",
  APPROVAL: "Kelulusan",
  LATE: "Lewat Pulang",
  LOCATION: "Lokasi Kampus (GPS)",
  PRIVACY: "Privasi",
  REPORTS: "Laporan",
  QR: "Kod QR",
  SYSTEM: "Sistem",
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [dirty, setDirty] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings(data.settings ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  function currentValue(s: Setting) {
    return Object.prototype.hasOwnProperty.call(dirty, s.key) ? dirty[s.key] : s.value;
  }

  async function save(s: Setting) {
    setSaving(s.key);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: s.key, value: currentValue(s) }),
    });
    setSaving(null);
    setSavedKey(s.key);
    setTimeout(() => setSavedKey(null), 2000);
    load();
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: settings.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-ink">Tetapan Sistem</h1>
        <p className="text-sm text-ink-soft mt-1">
          Semua peraturan kolej boleh dikonfigurasi di sini. Perubahan direkodkan dalam log audit.
        </p>
      </div>

      {grouped.map((g) => (
        <section key={g.cat} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-label text-primary">{CATEGORY_LABEL[g.cat] ?? g.cat}</h2>
          <div className="bg-white border border-line rounded-2xl divide-y divide-line">
            {g.items.map((s) => (
              <div key={s.key} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{s.label}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{s.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SettingInput s={s} value={currentValue(s)} onChange={(v) => setDirty((d) => ({ ...d, [s.key]: v }))} />
                  <Button
                    variant={savedKey === s.key ? "secondary" : "primary"}
                    disabled={saving === s.key}
                    onClick={() => save(s)}
                    className="!py-2 !px-3 text-xs"
                  >
                    {saving === s.key ? "..." : savedKey === s.key ? "Disimpan" : "Simpan"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SettingInput({
  s,
  value,
  onChange,
}: {
  s: Setting;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (typeof s.value === "boolean") {
    return (
      <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <span className="w-10 h-6 bg-line rounded-full peer-checked:bg-primary transition-colors relative">
          <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    );
  }
  if (typeof s.value === "number") {
    return (
      <input
        type="number"
        value={value as number}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-line px-2.5 py-1.5 text-sm"
      />
    );
  }
  return (
    <input
      type="text"
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      className="w-56 rounded-lg border border-line px-2.5 py-1.5 text-sm"
    />
  );
}
