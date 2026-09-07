"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";

type Lookup = { id: string; name?: string; label?: string };

export default function RegisterPage() {
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [semesters, setSemesters] = useState<Lookup[]>([]);
  const [form, setForm] = useState({
    matricNumber: "",
    name: "",
    phone: "",
    departmentId: "",
    semesterId: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/departments-semesters")
      .then((r) => r.json())
      .then((d) => {
        setDepartments(d.departments ?? []);
        setSemesters(d.semesters ?? []);
      });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Kata laluan dan pengesahan kata laluan tidak sepadan.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricNumber: form.matricNumber,
          name: form.name,
          phone: form.phone,
          departmentId: form.departmentId,
          semesterId: form.semesterId,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ralat berlaku.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Sambungan tidak tersedia. Sila cuba lagi.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center bg-white border border-line rounded-2xl p-8 space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--status-in-tint)] text-[var(--status-in)] text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-bold text-ink">Pendaftaran Berjaya Dihantar</h1>
          <p className="text-sm text-ink-soft">
            Akaun anda akan diaktifkan selepas disahkan oleh Admin. Sila cuba log masuk selepas itu.
          </p>
          <Link href="/login">
            <Button full>Kembali ke Log Masuk</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white font-bold text-lg mb-4 tracking-label">
            DSMS
          </div>
          <h1 className="text-xl font-bold text-ink">Daftar Akaun Pelajar</h1>
          <p className="text-sm text-ink-soft mt-1">Akaun anda perlu disahkan oleh Admin sebelum boleh digunakan.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-line rounded-2xl p-6 space-y-4">
          <Field label="Nombor Matrik">
            <input
              required
              value={form.matricNumber}
              onChange={(e) => setForm({ ...form, matricNumber: e.target.value })}
              placeholder="cth: 12345"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field label="Nama Penuh">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama penuh seperti kad pengenalan"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field label="Nombor Telefon">
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="cth: 0123456789"
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field label="Jabatan / Program">
            <select
              required
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Pilih jabatan/program</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Semester">
            <select
              required
              value={form.semesterId}
              onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Pilih semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kata Laluan">
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          <Field label="Sahkan Kata Laluan">
            <input
              required
              type="password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </Field>

          {error && (
            <div className="text-sm text-[var(--status-late)] bg-[var(--status-late-tint)] rounded-lg px-3 py-2" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" full disabled={submitting}>
            {submitting ? "Menghantar..." : "Daftar"}
          </Button>
        </form>

        <p className="text-center text-xs text-ink-soft mt-6">
          Sudah ada akaun?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}
