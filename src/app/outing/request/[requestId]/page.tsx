"use client";

import { useEffect, useState, use } from "react";
import { StatusPill } from "@/components/StatusPill";

export default function OutingRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const [data, setData] = useState<{
    studentName: string;
    matricNumber: string;
    movementTypeLabel: string | null;
    purpose: string | null;
    timeOut: string;
    timeIn: string | null;
    approvalStatus: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/outing/request/${requestId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Ralat berlaku.");
          return;
        }
        setData(json.request);
      })
      .catch(() => setError("Sambungan tidak tersedia."));
  }, [requestId]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white font-bold text-lg mb-4 tracking-label">
            DSMS
          </div>
          <h1 className="text-lg font-bold text-ink">Status Permohonan Keluar</h1>
        </div>

        {error && (
          <div className="bg-white border border-line rounded-2xl p-6 text-center">
            <p className="text-sm text-[var(--status-late)]">{error}</p>
          </div>
        )}

        {!data && !error && <p className="text-center text-sm text-ink-soft">Memuatkan...</p>}

        {data && (
          <div className="bg-white border border-line rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{data.studentName}</p>
                <p className="text-xs text-ink-soft font-mono-data">{data.matricNumber}</p>
              </div>
              <StatusPill status={data.approvalStatus} />
            </div>
            <div className="text-sm space-y-1.5 pt-3 border-t border-line">
              <Row label="Jenis" value={data.movementTypeLabel ?? "-"} />
              {data.purpose && <Row label="Tujuan" value={data.purpose} />}
              <Row label="Masa Keluar" value={new Date(data.timeOut).toLocaleString("ms-MY")} />
              <Row label="Masa Masuk" value={data.timeIn ? new Date(data.timeIn).toLocaleString("ms-MY") : "-"} />
            </div>
            <p className="text-xs text-ink-soft text-center pt-2">
              Halaman ini sentiasa menunjukkan status TERKINI — muat semula bila-bila masa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
