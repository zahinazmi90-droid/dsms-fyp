"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { Button } from "@/components/Button";

type Student = {
  id: string;
  matricNumber: string;
  name: string;
  phone: string | null;
  departmentName: string | null;
  semesterLabel: string | null;
  isActive: boolean;
};
type Lookup = { id: string; name?: string; label?: string };

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [semesters, setSemesters] = useState<Lookup[]>([]);
  const [form, setForm] = useState({ matricNumber: "", name: "", departmentId: "", semesterId: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sRes, lRes] = await Promise.all([fetch("/api/admin/students"), fetch("/api/admin/lookups")]);
    const sData = await sRes.json();
    const lData = await lRes.json();
    setStudents(sData.students ?? []);
    setDepartments(lData.departments ?? []);
    setSemesters(lData.semesters ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Ralat berlaku.");
      return;
    }
    setForm({ matricNumber: "", name: "", departmentId: "", semesterId: "", phone: "", password: "" });
    setShowForm(false);
    load();
  }

  async function approve(studentId: string) {
    setBusyId(studentId);
    await fetch("/api/admin/students/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setBusyId(null);
    load();
  }

  async function reject(studentId: string) {
    if (!confirm("Tolak dan padam pendaftaran ini? Tindakan ini tidak boleh dibatalkan.")) return;
    setBusyId(studentId);
    await fetch("/api/admin/students/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setBusyId(null);
    load();
  }

  const pending = students.filter((s) => !s.isActive);
  const active = students.filter((s) => s.isActive);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">Pengurusan Pelajar</h1>
        <Button onClick={() => setShowForm((s) => !s)} className="!py-2 !px-3 text-xs">
          {showForm ? "Tutup" : "+ Tambah Pelajar"}
        </Button>
      </div>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-label text-[var(--status-outside)]">
            Menunggu Pengesahan ({pending.length})
          </h2>
          <div className="bg-white border border-[var(--status-outside)] rounded-2xl divide-y divide-line">
            {pending.map((s) => (
              <div key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {s.name} <span className="text-ink-soft font-mono-data">({s.matricNumber})</span>
                  </p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {s.departmentName ?? "-"} · {s.semesterLabel ?? "-"}
                  </p>
                  {s.phone && <p className="text-xs text-ink-soft font-mono-data">Tel: {s.phone}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" disabled={busyId === s.id} onClick={() => reject(s.id)} className="!py-2 text-xs">
                    Tolak
                  </Button>
                  <Button disabled={busyId === s.id} onClick={() => approve(s.id)} className="!py-2 text-xs">
                    Lulus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-line rounded-2xl p-5 grid sm:grid-cols-3 gap-3">
          <Field label="No. Matrik">
            <input required value={form.matricNumber} onChange={(e) => setForm({ ...form, matricNumber: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
          </Field>
          <Field label="Nama">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
          </Field>
          <Field label="Telefon (cth: 0123456789)">
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
          </Field>
          <Field label="Jabatan">
            <select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select required value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Kata Laluan Awal">
            <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" />
          </Field>
          {error && <p className="sm:col-span-3 text-sm text-[var(--status-late)]">{error}</p>}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Menyimpan..." : "Cipta Akaun Pelajar"}</Button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-label text-primary">Pelajar Aktif ({active.length})</h2>
        <div className="bg-white border border-line rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft border-b border-line">
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">No. Matrik</th>
                <th className="px-3 py-2 font-medium">Jabatan</th>
                <th className="px-3 py-2 font-medium">Semester</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{s.name}</td>
                  <td className="px-3 py-2.5 font-mono-data text-ink-soft">{s.matricNumber}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{s.departmentName ?? "-"}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{s.semesterLabel ?? "-"}</td>
                  <td className="px-3 py-2.5 text-ink-soft">Aktif</td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Tiada pelajar aktif.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-soft mb-1">{label}</label>
      {children}
    </div>
  );
}
