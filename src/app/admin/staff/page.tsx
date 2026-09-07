"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { Button } from "@/components/Button";

type StaffRow = { id: string; name: string; phone: string | null; isActive: boolean; departmentName: string | null; loginId: string; role: string };
type ClassRow = { id: string; departmentName: string; semesterLabel: string; dayOfWeek: string; startTime: string; endTime: string; lecturerName: string; courseName: string | null };
type Lookup = { id: string; name?: string; label?: string };

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [semesters, setSemesters] = useState<Lookup[]>([]);
  const [lecturers, setLecturers] = useState<StaffRow[]>([]);

  const [staffForm, setStaffForm] = useState({ name: "", loginId: "", role: "lecturer", departmentId: "", phone: "", password: "" });
  const [classForm, setClassForm] = useState({ departmentId: "", semesterId: "", dayOfWeek: "MONDAY", startTime: "10:00", endTime: "12:00", lecturerId: "", courseName: "" });
  const [staffError, setStaffError] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [submittingClass, setSubmittingClass] = useState(false);

  const load = useCallback(async () => {
    const [sRes, cRes, lRes] = await Promise.all([
      fetch("/api/admin/staff"),
      fetch("/api/admin/class-sessions"),
      fetch("/api/admin/lookups"),
    ]);
    const sData = await sRes.json();
    const cData = await cRes.json();
    const lData = await lRes.json();
    setStaff(sData.staff ?? []);
    setClasses(cData.classSessions ?? []);
    setDepartments(lData.departments ?? []);
    setSemesters(lData.semesters ?? []);
    setLecturers((sData.staff ?? []).filter((s: StaffRow) => s.role === "lecturer"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load();
  }, [load]);

  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault();
    setSubmittingStaff(true);
    setStaffError(null);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffForm),
    });
    const data = await res.json();
    setSubmittingStaff(false);
    if (!res.ok) {
      setStaffError(data.error || "Ralat berlaku.");
      return;
    }
    setStaffForm({ name: "", loginId: "", role: "lecturer", departmentId: "", phone: "", password: "" });
    load();
  }

  async function handleCreateClass(e: FormEvent) {
    e.preventDefault();
    setSubmittingClass(true);
    setClassError(null);
    const res = await fetch("/api/admin/class-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classForm),
    });
    const data = await res.json();
    setSubmittingClass(false);
    if (!res.ok) {
      setClassError(data.error || "Ralat berlaku.");
      return;
    }
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-ink">Pensyarah &amp; Ketua Program</h1>
        <p className="text-sm text-ink-soft mt-1">
          Cipta akaun Pensyarah/Ketua Program, dan tetapkan jadual kelas ringkas supaya sistem tahu pensyarah mana yang
          bertanggungjawab bagi jabatan/semester/hari/waktu tertentu.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-label text-primary">Tambah Pensyarah / Ketua Program</h2>
        <form onSubmit={handleCreateStaff} className="bg-white border border-line rounded-2xl p-5 grid sm:grid-cols-3 gap-3">
          <Field label="Nama"><input required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          <Field label="ID Log Masuk (cth: email)"><input required value={staffForm.loginId} onChange={(e) => setStaffForm({ ...staffForm, loginId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          <Field label="Peranan">
            <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="lecturer">Pensyarah</option>
              <option value="head_of_programme">Ketua Program</option>
            </select>
          </Field>
          <Field label="Jabatan/Program">
            <select required value={staffForm.departmentId} onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Telefon"><input value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          <Field label="Kata Laluan Awal"><input required type="password" minLength={8} value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          {staffError && <p className="sm:col-span-3 text-sm text-[var(--status-late)]">{staffError}</p>}
          <div className="sm:col-span-3"><Button type="submit" disabled={submittingStaff}>{submittingStaff ? "Menyimpan..." : "Cipta Akaun"}</Button></div>
        </form>

        <div className="bg-white border border-line rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="px-4 py-2 font-medium">Nama</th><th className="px-3 py-2 font-medium">Peranan</th><th className="px-3 py-2 font-medium">Jabatan</th><th className="px-3 py-2 font-medium">Log Masuk</th>
            </tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{s.name}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{s.role === "lecturer" ? "Pensyarah" : "Ketua Program"}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{s.departmentName ?? "-"}</td>
                  <td className="px-3 py-2.5 text-ink-soft font-mono-data">{s.loginId}</td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-soft">Tiada staf lagi.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-label text-primary">Jadual Kelas (Minimum)</h2>
        <form onSubmit={handleCreateClass} className="bg-white border border-line rounded-2xl p-5 grid sm:grid-cols-3 gap-3">
          <Field label="Jabatan/Program">
            <select required value={classForm.departmentId} onChange={(e) => setClassForm({ ...classForm, departmentId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select required value={classForm.semesterId} onChange={(e) => setClassForm({ ...classForm, semesterId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Hari">
            <select value={classForm.dayOfWeek} onChange={(e) => setClassForm({ ...classForm, dayOfWeek: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Masa Mula"><input type="time" value={classForm.startTime} onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          <Field label="Masa Tamat"><input type="time" value={classForm.endTime} onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          <Field label="Pensyarah">
            <select required value={classForm.lecturerId} onChange={(e) => setClassForm({ ...classForm, lecturerId: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm">
              <option value="">Pilih</option>
              {lecturers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Nama Kursus (pilihan)"><input value={classForm.courseName} onChange={(e) => setClassForm({ ...classForm, courseName: e.target.value })} className="w-full rounded-lg border border-line px-2.5 py-2 text-sm" /></Field>
          {classError && <p className="sm:col-span-3 text-sm text-[var(--status-late)]">{classError}</p>}
          <div className="sm:col-span-3"><Button type="submit" disabled={submittingClass}>{submittingClass ? "Menyimpan..." : "Tambah Kelas"}</Button></div>
        </form>

        <div className="bg-white border border-line rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-soft border-b border-line">
              <th className="px-4 py-2 font-medium">Jabatan</th><th className="px-3 py-2 font-medium">Semester</th><th className="px-3 py-2 font-medium">Hari</th><th className="px-3 py-2 font-medium">Masa</th><th className="px-3 py-2 font-medium">Pensyarah</th>
            </tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink">{c.departmentName}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.semesterLabel}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.dayOfWeek}</td>
                  <td className="px-3 py-2.5 text-ink-soft font-mono-data">{c.startTime}-{c.endTime}</td>
                  <td className="px-3 py-2.5 text-ink-soft">{c.lecturerName}</td>
                </tr>
              ))}
              {classes.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Tiada kelas didaftarkan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-soft mb-1">{label}</label>{children}</div>;
}
