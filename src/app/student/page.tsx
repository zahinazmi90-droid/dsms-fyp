"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/Button";

type Me = {
  id: string;
  role: string;
  loginId: string;
  profile: { matricNumber: string; name: string; phone: string; departmentName: string | null; semesterLabel: string | null };
  status: string;
};

type MovementType = { id: string; label: string; requiresApproval: boolean; requiresAddress: boolean; requiresPurpose: boolean };
type Fellow = { id: string; name: string; floorArea: string };

export default function StudentDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flow, setFlow] = useState<"idle" | "chooseType" | "form" | "confirming">("idle");
  const [types, setTypes] = useState<MovementType[]>([]);
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [selectedType, setSelectedType] = useState<MovementType | null>(null);
  const [purpose, setPurpose] = useState("");
  const [address, setAddress] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyFellow, setEmergencyFellow] = useState("");
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warn"; text: string } | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      // If the server ever returns something that isn't JSON (a rare edge
      // case, e.g. a mid-deploy transient error), don't let res.json() throw
      // an unhandled exception that crashes the whole page -- show a
      // friendly message instead.
      const data = await res.json().catch(() => null);
      if (!data) {
        setLoadError("Tidak dapat memuatkan data. Sila muat semula halaman ini.");
        return;
      }
      if (!data.user) {
        // Session expired/invalid (e.g. after a database reset) -- send the
        // student back to login instead of showing a stuck/broken page.
        router.push("/login");
        return;
      }
      setMe(data.user);
      setLoadError(null);
    } catch {
      setLoadError("Sambungan tidak tersedia. Sila muat semula halaman ini.");
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadMe();
  }, [loadMe]);

  async function openKeluar() {
    setMessage(null);
    const res = await fetch("/api/movement/types");
    const data = await res.json();
    setTypes(data.types ?? []);
    const fres = await fetch("/api/fellows");
    const fdata = await fres.json();
    setFellows(fdata.fellows ?? []);
    setFlow("chooseType");
  }

  function chooseType(t: MovementType) {
    setSelectedType(t);
    setPurpose("");
    setAddress("");
    setExpectedReturn("");
    setEmergencyReason("");
    setEmergencyFellow("");
    setPhoneConfirmed(false);
    setFlow("form");
  }

  async function getBrowserLocation(): Promise<{ latitude?: number; longitude?: number }> {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return {};
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        // Permission denied / unavailable / timed out -- don't block the
        // whole flow here. The server decides whether location is actually
        // required (based on the location_verification_enabled setting)
        // and returns a clear error message if so.
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  async function submitCheckout() {
    if (!selectedType || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { latitude, longitude } = await getBrowserLocation();
      const res = await fetch("/api/movement/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementTypeId: selectedType.id,
          purpose: purpose || undefined,
          outsideAddress: address || undefined,
          expectedReturnAt: expectedReturn ? new Date(expectedReturn).toISOString() : undefined,
          emergencyReason: emergencyReason || undefined,
          emergencyFellowId: emergencyFellow || undefined,
          phoneConfirmed,
          latitude,
          longitude,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Ralat berlaku." });
        setSubmitting(false);
        return;
      }
      setMessage({ type: "success", text: data.message });
      setFlow("idle");
      await loadMe();
    } catch {
      setMessage({ type: "error", text: "Sambungan tidak tersedia. Rekod TIDAK disimpan. Sila cuba lagi." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCheckin() {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { latitude, longitude } = await getBrowserLocation();
      const res = await fetch("/api/movement/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Ralat berlaku." });
        setSubmitting(false);
        return;
      }
      setMessage({ type: data.late ? "warn" : "success", text: data.message });
      await loadMe();
    } catch {
      setMessage({ type: "error", text: "Sambungan tidak tersedia. Rekod TIDAK disimpan. Sila cuba lagi." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!me) {
    if (loadError) {
      return (
        <div className="text-center py-20 space-y-3">
          <p className="text-sm text-[var(--status-late)]">{loadError}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Muat Semula
          </Button>
        </div>
      );
    }
    return <div className="text-center text-ink-soft py-20 text-sm">Memuatkan...</div>;
  }

  const canKeluar = me.status === "IN_COLLEGE";
  const canMasuk = ["OUTSIDE", "LATE", "OVERNIGHT"].includes(me.status);

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-[var(--status-in-tint)] text-[var(--status-in)]"
              : message.type === "warn"
              ? "bg-[var(--status-late-tint)] text-[var(--status-late)]"
              : "bg-[var(--status-late-tint)] text-[var(--status-late)]"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Gate pass signature card */}
      <div className="gate-pass">
        <div className="gate-pass-notch-left" />
        <div className="gate-pass-notch-right" />
        <div className="p-5">
          <p className="text-[11px] font-bold tracking-label text-primary uppercase">Pas Akses Pelajar</p>
          <h2 className="text-lg font-bold text-ink mt-1">{me.profile.name}</h2>
          <p className="text-sm text-ink-soft font-mono-data">{me.profile.matricNumber}</p>
        </div>
        <div className="px-5 pt-6 pb-5 flex items-center justify-between">
          <div className="text-xs text-ink-soft space-y-0.5">
            <p>{me.profile.departmentName ?? "-"}</p>
            <p>{me.profile.semesterLabel ?? "-"}</p>
          </div>
          <StatusPill status={me.status} />
        </div>
      </div>

      {/* Primary actions */}
      {flow === "idle" && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="primary" disabled={!canKeluar} onClick={openKeluar} className="py-5 text-base">
            KELUAR
          </Button>
          <Button variant="secondary" disabled={!canMasuk} onClick={submitCheckin} className="py-5 text-base">
            {submitting ? "..." : "MASUK"}
          </Button>
        </div>
      )}

      {flow === "chooseType" && (
        <div className="bg-white border border-line rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-ink">Pilih Jenis Pergerakan</h3>
          <div className="space-y-2">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => chooseType(t)}
                className="w-full text-left px-4 py-3 rounded-xl border border-line hover:border-primary hover:bg-primary-tint transition-colors flex items-center justify-between"
              >
                <span className="text-sm font-medium text-ink">{t.label}</span>
                {t.requiresApproval && (
                  <span className="text-[11px] text-ink-soft">Perlu Kelulusan</span>
                )}
              </button>
            ))}
            {types.length === 0 && (
              <p className="text-sm text-ink-soft">Tiada jenis pergerakan diaktifkan buat masa ini.</p>
            )}
          </div>
          <Button variant="ghost" full onClick={() => setFlow("idle")}>
            Batal
          </Button>
        </div>
      )}

      {flow === "form" && selectedType && (
        <div className="bg-white border border-line rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-ink">{selectedType.label}</h3>

          {selectedType.requiresPurpose && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Tujuan</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="cth: Membeli barangan keperluan"
              />
            </div>
          )}

          {selectedType.requiresAddress && (
            <>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Alamat Luar</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  rows={2}
                  placeholder="Alamat tempat bermalam"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Jangkaan Tarikh/Masa Pulang</label>
                <input
                  type="datetime-local"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </>
          )}

          {selectedType.id === "EMERGENCY" && (
            <>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Sebab Kecemasan</label>
                <textarea
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Hubungi Fellow</label>
                <select
                  value={emergencyFellow}
                  onChange={(e) => setEmergencyFellow(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Pilih Fellow</option>
                  {fellows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} - {f.floorArea}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {selectedType.id !== "EMERGENCY" && (
            <div className="rounded-xl border border-line p-3 space-y-2">
              <p className="text-xs text-ink-soft">Nombor telefon anda:</p>
              <p className="text-sm font-mono-data text-ink">{me.profile.phone}</p>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={phoneConfirmed} onChange={(e) => setPhoneConfirmed(e.target.checked)} />
                Saya sahkan nombor telefon di atas adalah terkini
              </label>
              <a href="/student/profile" className="text-xs font-medium text-primary hover:underline inline-block">
                Nombor tidak betul? Kemaskini di sini →
              </a>
            </div>
          )}

          {selectedType.requiresApproval && (
            <p className="text-xs text-ink-soft bg-primary-tint rounded-lg px-3 py-2">
              Permohonan ini memerlukan kelulusan sebelum status anda menjadi &ldquo;Di Luar&rdquo;.
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setFlow("chooseType")} disabled={submitting}>
              Kembali
            </Button>
            <Button variant="primary" full onClick={submitCheckout} disabled={submitting}>
              {submitting ? "Menghantar..." : "Sahkan KELUAR"}
            </Button>
          </div>
        </div>
      )}

      {!canKeluar && !canMasuk && flow === "idle" && me.status === "PENDING_APPROVAL" && (
        <p className="text-center text-sm text-ink-soft">Permohonan anda sedang menunggu kelulusan.</p>
      )}

      {!canKeluar && !canMasuk && flow === "idle" && me.status === "REJECTED" && (
        <div className="text-center bg-[var(--status-late-tint)] rounded-xl p-4">
          <p className="text-sm font-medium text-[var(--status-late)]">
            Permohonan keluar anda telah ditolak oleh Ketua Program.
          </p>
          <p className="text-xs text-ink-soft mt-1">Sila hubungi Warden untuk penjelasan lanjut.</p>
        </div>
      )}
    </div>
  );
}
