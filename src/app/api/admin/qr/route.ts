import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole("admin", "guard");
    const qrEnabled = await getSetting<boolean>("qr_enabled");
    if (!qrEnabled) {
      return NextResponse.json({ error: "Kod QR tidak diaktifkan." }, { status: 400 });
    }
    const qrUrl = await getSetting<string>("qr_url");

    // SECURITY: the QR encodes only the app's login URL. Scanning it never
    // marks a student in/out by itself — it just opens the app, where the
    // student must authenticate and explicitly choose KELUAR/MASUK.
    const target = `${qrUrl}/login`;
    const dataUrl = await QRCode.toDataURL(target, { width: 400, margin: 2 });

    return NextResponse.json({ dataUrl, target });
  } catch (err) {
    return handleApiError(err);
  }
}
