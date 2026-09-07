"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/Button";

export default function AdminQrPage() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/qr", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat menjana kod QR.");
        return;
      }
      setDataUrl(data.dataUrl);
      setTarget(data.target);
    } catch {
      setError("Sambungan tidak tersedia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadQr();

    // If Admin changes qr_url in Settings on another tab, then switches
    // BACK to this already-open QR tab (no full page reload), this
    // component would otherwise keep showing the stale QR forever since
    // useEffect only runs once on mount. Refetching whenever the tab
    // becomes visible again fixes that without needing a manual reload.
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadQr();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadQr]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">Kod QR Akses</h1>
          <p className="text-sm text-ink-soft mt-1">
            Cetak dan letakkan kod ini di pos pengawal, atau kongsi dalam kumpulan WhatsApp. Imbasan kod ini HANYA
            membuka halaman log masuk sistem — ia TIDAK merekod pelajar keluar/masuk secara automatik.
          </p>
        </div>
        <Button variant="secondary" onClick={loadQr} disabled={loading} className="!py-2 !px-3 text-xs shrink-0">
          {loading ? "..." : "Jana Semula"}
        </Button>
      </div>

      <p className="text-xs text-ink-soft bg-primary-tint rounded-lg px-3 py-2">
        Jika anda baru menukar URL QR di Tetapan, klik <strong>&ldquo;Jana Semula&rdquo;</strong> di atas untuk
        pastikan kod QR di bawah menggunakan URL terkini.
      </p>

      {error && <p className="text-sm text-[var(--status-late)] bg-[var(--status-late-tint)] rounded-lg p-3">{error}</p>}

      {dataUrl && (
        <div className="bg-white border border-line rounded-2xl p-8 flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Kod QR akses sistem DSMS" width={280} height={280} />
          <p className="text-xs text-ink-soft font-mono-data break-all text-center">{target}</p>
        </div>
      )}
    </div>
  );
}
