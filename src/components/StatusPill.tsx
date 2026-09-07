const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  IN_COLLEGE: { label: "Dalam Kolej", color: "var(--status-in)", bg: "var(--status-in-tint)" },
  ON_TIME: { label: "Tepat Masa", color: "var(--status-in)", bg: "var(--status-in-tint)" },
  APPROVED: { label: "Diluluskan", color: "var(--status-in)", bg: "var(--status-in-tint)" },
  OUTSIDE: { label: "Di Luar", color: "var(--status-outside)", bg: "var(--status-outside-tint)" },
  LATE: { label: "Lewat", color: "var(--status-late)", bg: "var(--status-late-tint)" },
  REJECTED: { label: "Ditolak", color: "var(--status-late)", bg: "var(--status-late-tint)" },
  OVERNIGHT: { label: "Bermalam", color: "var(--status-overnight)", bg: "var(--status-overnight-tint)" },
  PENDING_APPROVAL: { label: "Menunggu Kelulusan", color: "var(--status-pending)", bg: "var(--status-pending-tint)" },
  PENDING: { label: "Menunggu", color: "var(--status-pending)", bg: "var(--status-pending-tint)" },
  NOT_REQUIRED: { label: "Tidak Diperlukan", color: "var(--status-pending)", bg: "var(--status-pending-tint)" },
};

export function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "var(--status-pending)", bg: "var(--status-pending-tint)" };
  return (
    <span className="status-pill" style={{ color: cfg.color, background: cfg.bg }}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
