"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Button } from "@/components/Button";

type Me = {
  loginId: string;
  profile: {
    matricNumber: string;
    name: string;
    phone: string;
    departmentName: string | null;
    semesterLabel: string | null;
  };
};

export default function StudentProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submittingPhone, setSubmittingPhone] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json().catch(() => null);
    if (data?.user) setMe(data.user);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  function startEditPhone() {
    setPhoneInput(me?.profile.phone ?? "");
    setPhoneMsg(null);
    setEditingPhone(true);
  }

  async function submitPhone(e: FormEvent) {
    e.preventDefault();
    setSubmittingPhone(true);
    setPhoneMsg(null);
    try {
      const res = await fetch("/api/student/update-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneMsg({ ok: false, text: data.error || "Ralat berlaku." });
        return;
      }
      setPhoneMsg({ ok: true, text: "Nombor telefon berjaya dikemaskini." });
      setEditingPhone(false);
      await load();
    } catch {
      setPhoneMsg({ ok: false, text: "Sambungan tidak tersedia. Sila cuba lagi." });
    } finally {
      setSubmittingPhone(false);
    }
  }

  if (!me) return <p className="text-sm text-ink-soft">Memuatkan...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-ink">Profil Saya</h1>

      <div className="bg-white border border-line rounded-2xl p-5 space-y-2 text-sm">
        <Row label="Nama" value={me.profile.name} />
        <Row label="No. Matrik" value={me.profile.matricNumber} />
        <Row label="Jabatan" value={me.profile.departmentName ?? "-"} />
        <Row label="Semester" value={me.profile.semesterLabel ?? "-"} />
      </div>

      <div className="bg-white border border-line rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-ink">Nombor Telefon</h2>
          {!editingPhone && (
            <button
              onClick={startEditPhone}
              className="text-xs font-medium text-primary hover:underline"
            >
              Kemaskini
            </button>
          )}
        </div>

        {!editingPhone && (
          <p className="text-sm font-mono-data text-ink">{me.profile.phone}</p>
        )}

        {editingPhone && (
          <form onSubmit={submitPhone} className="space-y-3">
            <input
              type="tel"
              required
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="cth: 0123456789"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setEditingPhone(false)} disabled={submittingPhone}>
                Batal
              </Button>
              <Button type="submit" full disabled={submittingPhone}>
                {submittingPhone ? "Menyimpan..." : "Simpan Nombor Telefon"}
              </Button>
            </div>
          </form>
        )}

        {phoneMsg && (
          <p className={`text-sm ${phoneMsg.ok ? "text-[var(--status-in)]" : "text-[var(--status-late)]"}`} role="status">
            {phoneMsg.text}
          </p>
        )}

        <p className="text-xs text-ink-soft">
          Nombor ini digunakan untuk tujuan kecemasan dan pengesahan semasa KELUAR. Pastikan ia sentiasa terkini.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-line last:border-0 py-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
