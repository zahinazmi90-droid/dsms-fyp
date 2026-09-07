/**
 * SINGLE source of truth for role-based navigation links.
 */
export type NavLink = { href: string; label: string };

export const ROLE_TITLE: Record<string, string> = {
  guard: "Pengawal Keselamatan",
  warden: "Warden",
  admin: "Admin",
  student: "Pelajar",
  lecturer: "Pensyarah",
  head_of_programme: "Ketua Program",
};

export const ROLE_NAV: Record<string, NavLink[]> = {
  guard: [
    { href: "/guard", label: "Dashboard" },
    { href: "/guard/search", label: "Carian" },
    { href: "/profile", label: "Profil" },
  ],
  warden: [
    { href: "/warden", label: "Dashboard" },
    { href: "/guard/search", label: "Carian" },
    { href: "/warden/reports", label: "Laporan" },
    { href: "/profile", label: "Profil" },
  ],
  admin: [
    { href: "/warden", label: "Dashboard" },
    { href: "/admin/settings", label: "Tetapan" },
    { href: "/admin/schedule", label: "Jadual" },
    { href: "/admin/holidays", label: "Cuti" },
    { href: "/admin/students", label: "Pelajar" },
    { href: "/admin/staff", label: "Pensyarah/HOP" },
    { href: "/admin/qr", label: "QR" },
    { href: "/admin/audit", label: "Audit Log" },
    { href: "/profile", label: "Profil" },
  ],
  student: [
    { href: "/student", label: "Dashboard" },
    { href: "/student/history", label: "Sejarah" },
    { href: "/student/profile", label: "Profil" },
  ],
  lecturer: [
    { href: "/lecturer", label: "Permohonan" },
    { href: "/profile", label: "Profil" },
  ],
  head_of_programme: [
    { href: "/hop", label: "Permohonan" },
    { href: "/profile", label: "Profil" },
  ],
};
