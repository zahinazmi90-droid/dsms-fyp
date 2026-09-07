import { db } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Defaults below encode the CURRENT baseline SOP from the interview
 * (10/08/2026). They are seeded into system_settings on first run and are
 * fully editable afterwards via /admin/settings. Nothing here is hardcoded
 * into business logic — src/lib/rules/* always reads from this table.
 */
export const SETTINGS_DEFAULTS: Array<{
  key: string;
  value: unknown;
  label: string;
  description: string;
  category: string;
}> = [
  { key: "college_name", value: "KKTM Kuantan", label: "Nama Kolej", description: "Nama kolej dipaparkan pada dashboard dan laporan.", category: "GENERAL" },
  { key: "system_name", value: "Digital Student Movement Management System (DSMS)", label: "Nama Sistem", description: "Nama rasmi sistem.", category: "GENERAL" },
  { key: "timezone", value: "Asia/Kuala_Lumpur", label: "Zon Waktu", description: "Zon waktu rasmi untuk semua rekod pergerakan.", category: "GENERAL" },

  { key: "normal_outing_enabled", value: true, label: "Aktifkan Outing Biasa", description: "Benarkan pelajar keluar tanpa kelulusan khas.", category: "OUTING" },
  { key: "study_outing_enabled", value: true, label: "Aktifkan Outing Waktu Kuliah", description: "Benarkan keluar semasa waktu kuliah dengan kelulusan.", category: "OUTING" },
  { key: "overnight_enabled", value: true, label: "Aktifkan Bermalam Luar", description: "Benarkan pelajar mendaftar bermalam di luar kolej.", category: "OUTING" },
  { key: "emergency_enabled", value: true, label: "Aktifkan Kecemasan", description: "Benarkan pendaftaran pergerakan kecemasan.", category: "OUTING" },

  { key: "late_detection_enabled", value: true, label: "Aktifkan Pengesanan Lewat", description: "Kira status lewat berdasarkan tempoh masuk semula.", category: "LATE" },
  { key: "late_grace_minutes", value: 0, label: "Tempoh Bertoleransi (minit)", description: "Bilangan minit toleransi selepas waktu tamat sebelum status LEWAT ditetapkan.", category: "LATE" },

  { key: "study_approval_required", value: true, label: "Kelulusan Wajib - Waktu Kuliah", description: "Wajibkan kelulusan pensyarah & Ketua Program untuk outing waktu kuliah.", category: "APPROVAL" },
  { key: "overnight_approval_required", value: false, label: "Kelulusan Wajib - Bermalam", description: "Wajibkan kelulusan Warden untuk bermalam di luar.", category: "APPROVAL" },
  { key: "emergency_approval_required", value: false, label: "Kelulusan Wajib - Kecemasan", description: "Wajibkan kelulusan untuk kes kecemasan.", category: "APPROVAL" },
  { key: "guard_can_approve", value: false, label: "Pengawal Boleh Meluluskan", description: "Benarkan pengawal keselamatan meluluskan permohonan tertentu.", category: "APPROVAL" },
  { key: "warden_approval_required", value: false, label: "Kelulusan Wajib - Warden", description: "Wajibkan kelulusan warden secara umum.", category: "APPROVAL" },

  { key: "student_login_required", value: true, label: "Log Masuk Wajib", description: "Pelajar mesti log masuk sebelum merekod pergerakan.", category: "SYSTEM" },
  { key: "purpose_required", value: true, label: "Tujuan Wajib Diisi", description: "Wajibkan medan tujuan untuk outing biasa.", category: "SYSTEM" },
  { key: "phone_required", value: true, label: "Nombor Telefon Wajib", description: "Wajibkan pengesahan nombor telefon semasa keluar.", category: "SYSTEM" },
  { key: "address_required_for_overnight", value: true, label: "Alamat Wajib - Bermalam", description: "Wajibkan alamat luar untuk pergerakan bermalam.", category: "SYSTEM" },

  { key: "student_can_view_own_history", value: true, label: "Pelajar Lihat Sejarah Sendiri", description: "Benarkan pelajar melihat sejarah pergerakan sendiri sahaja.", category: "PRIVACY" },
  { key: "guard_can_view_phone", value: true, label: "Pengawal Lihat Nombor Telefon", description: "Benarkan pengawal melihat nombor telefon untuk tujuan kecemasan.", category: "PRIVACY" },
  { key: "warden_can_view_phone", value: true, label: "Warden Lihat Nombor Telefon", description: "Benarkan warden melihat nombor telefon pelajar.", category: "PRIVACY" },

  { key: "report_enabled", value: true, label: "Aktifkan Laporan", description: "Benarkan penjanaan laporan oleh Warden/Admin.", category: "REPORTS" },
  { key: "excel_export_enabled", value: true, label: "Eksport Excel", description: "Benarkan eksport laporan dalam format Excel.", category: "REPORTS" },
  { key: "pdf_export_enabled", value: true, label: "Eksport PDF", description: "Benarkan eksport laporan dalam format PDF.", category: "REPORTS" },

  { key: "qr_enabled", value: true, label: "Aktifkan Kod QR", description: "Papar kod QR akses di pos pengawal.", category: "QR" },
  { key: "qr_url", value: "http://localhost:3000", label: "URL Sistem untuk QR", description: "URL yang dijana dalam kod QR (skru sistem, BUKAN endpoint auto keluar/masuk).", category: "QR" },
  { key: "qr_location_description", value: "Pos Pengawal Utama", description: "Lokasi paparan kod QR.", label: "Lokasi Kod QR", category: "QR" },

  {
    key: "location_verification_enabled",
    value: false,
    label: "Aktifkan Pengesahan Lokasi GPS",
    description:
      "Wajibkan pelajar berada berdekatan kampus (mengikut GPS telefon) sebelum boleh KELUAR/MASUK. PENTING: Sila sahkan campus_latitude/campus_longitude di bawah adalah TEPAT (guna Google Maps) sebelum mengaktifkan ini, atau pelajar sah akan terkunci keluar.",
    category: "LOCATION",
  },
  {
    key: "campus_latitude",
    // Approximate placeholder based on the college's public address (Km 8,
    // Jalan Gambang, Mukim Kuala Kuantan) -- NOT verified against the exact
    // building. Get the precise value from Google Maps (right-click the
    // exact campus location -> the decimal coordinates shown at the top)
    // and update this before enabling location verification.
    value: 3.79,
    label: "Latitud Kampus",
    description: "Koordinat GPS latitud kampus. Dapatkan nilai TEPAT dari Google Maps (klik kanan lokasi kampus sebenar).",
    category: "LOCATION",
  },
  {
    key: "campus_longitude",
    value: 103.28,
    label: "Longitud Kampus",
    description: "Koordinat GPS longitud kampus. Dapatkan nilai TEPAT dari Google Maps (klik kanan lokasi kampus sebenar).",
    category: "LOCATION",
  },
  {
    key: "campus_radius_meters",
    value: 400,
    label: "Radius Dibenarkan (meter)",
    description: "Jarak maksimum (dalam meter) dari koordinat kampus yang dibenarkan untuk KELUAR/MASUK.",
    category: "LOCATION",
  },

  { key: "retention_policy", value: "INDEFINITE", label: "Dasar Simpanan Rekod", description: "Tempoh simpanan rekod pergerakan pelajar.", category: "SYSTEM" },
];

let cache: Map<string, unknown> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5000;

// Reasonable bounds for numeric settings. Without this, the admin settings
// endpoint previously accepted ANY value (e.g. a negative or absurdly large
// late_grace_minutes), which could silently make every check-in read as
// late (or never late) regardless of the actual time -- a config validation
// gap, not an intentional feature.
const NUMBER_BOUNDS: Record<string, { min: number; max: number }> = {
  late_grace_minutes: { min: 0, max: 180 },
  campus_radius_meters: { min: 10, max: 5000 },
  campus_latitude: { min: -90, max: 90 },
  campus_longitude: { min: -180, max: 180 },
};

export type SettingValidation = { ok: true } | { ok: false; error: string };

/** Validates a proposed setting value against its expected type and (for numbers) sane bounds. */
export function validateSettingValue(key: string, value: unknown): SettingValidation {
  const def = SETTINGS_DEFAULTS.find((d) => d.key === key);
  if (!def) {
    return { ok: false, error: "Tetapan tidak dikenali." };
  }

  const expectedType = typeof def.value;

  if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      return { ok: false, error: "Nilai untuk tetapan ini mesti benar/salah (on/off)." };
    }
    return { ok: true };
  }

  if (expectedType === "number") {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      return { ok: false, error: "Nilai untuk tetapan ini mesti nombor yang sah." };
    }
    const bounds = NUMBER_BOUNDS[key];
    if (bounds && (value < bounds.min || value > bounds.max)) {
      return { ok: false, error: `Nilai mesti di antara ${bounds.min} dan ${bounds.max}.` };
    }
    return { ok: true };
  }

  // string settings
  if (typeof value !== "string") {
    return { ok: false, error: "Nilai untuk tetapan ini mesti teks." };
  }
  if (value.length > 500) {
    return { ok: false, error: "Nilai terlalu panjang (maksimum 500 aksara)." };
  }
  if (key === "qr_url" && value.trim() && !/^https?:\/\//.test(value.trim())) {
    return { ok: false, error: "URL QR mesti bermula dengan http:// atau https://." };
  }
  return { ok: true };
}

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const all = await getAllSettings();
  return all.get(key) as T;
}

export async function getAllSettings(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const rows = await db.select().from(systemSettings);
  const map = new Map<string, unknown>();
  for (const row of rows) {
    try {
      map.set(row.key, JSON.parse(row.value));
    } catch {
      map.set(row.key, row.value);
    }
  }
  cache = map;
  cacheAt = Date.now();
  return map;
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function setSetting(key: string, value: unknown) {
  const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  const json = JSON.stringify(value);
  if (existing.length) {
    await db
      .update(systemSettings)
      .set({ value: json, updatedAt: new Date().toISOString() })
      .where(eq(systemSettings.key, key));
  } else {
    const def = SETTINGS_DEFAULTS.find((d) => d.key === key);
    await db.insert(systemSettings).values({
      key,
      value: json,
      label: def?.label ?? key,
      description: def?.description ?? "",
      category: def?.category ?? "GENERAL",
    });
  }
  invalidateSettingsCache();
}
