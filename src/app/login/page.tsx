"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Log masuk gagal.");
        setLoading(false);
        return;
      }
      const dest =
        data.role === "student"
          ? "/student"
          : data.role === "guard"
          ? "/guard"
          : data.role === "warden"
          ? "/warden"
          : data.role === "lecturer"
          ? "/lecturer"
          : data.role === "head_of_programme"
          ? "/hop"
          : "/admin";
      router.push(dest);
      router.refresh();
    } catch {
      setError("Sambungan tidak tersedia. Sila cuba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white font-bold text-lg mb-4 tracking-label">
            DSMS
          </div>
          <h1 className="text-xl font-bold text-ink">Log Masuk Sistem</h1>
          <p className="text-sm text-ink-soft mt-1">
            Sistem Pengurusan Pergerakan Pelajar Digital
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-line rounded-2xl p-6 space-y-4">
          <div>
            <label htmlFor="loginId" className="block text-sm font-medium text-ink mb-1.5">
              Nombor Matrik / ID Pengguna
            </label>
            <input
              id="loginId"
              type="text"
              required
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="cth: 12345"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Kata Laluan
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--status-late)] bg-[var(--status-late-tint)] rounded-lg px-3 py-2" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" full disabled={loading}>
            {loading ? "Sedang log masuk..." : "Log Masuk"}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-soft mt-6">
          Pelajar baharu?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Daftar akaun di sini
          </Link>
        </p>

        <p className="text-center text-xs text-ink-soft mt-3">
          Imbas kod QR di pos pengawal untuk membuka sistem ini, kemudian log masuk untuk teruskan.
        </p>
      </div>
    </div>
  );
}
