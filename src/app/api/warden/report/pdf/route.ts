import PDFDocument from "pdfkit";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { queryMovementReport } from "@/lib/report";
import { formatDisplay } from "@/lib/tz";
import { logAudit, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireRole("warden", "admin");
    const { searchParams } = new URL(req.url);
    const filters = {
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      matricNumber: searchParams.get("matricNumber") || undefined,
      lateOnly: searchParams.get("lateOnly") === "true",
    };
    const rows = await queryMovementReport(filters);

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.on("data", (c) => chunks.push(c));

    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).text("Laporan Pergerakan Pelajar - DSMS", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Tarikh Dijana: ${formatDisplay(new Date())}`);
    doc.text(`Jumlah Rekod: ${rows.length}  |  Jumlah Lewat: ${rows.filter((r) => r.lateStatus === "LATE").length}`);
    doc.moveDown(1);

    doc.fontSize(8);
    for (const r of rows) {
      doc.text(
        `${r.studentName} (${r.matricNumber}) | ${r.movementTypeLabel ?? "-"} | Keluar: ${formatDisplay(
          new Date(r.timeOut)
        )} | Masuk: ${r.timeIn ? formatDisplay(new Date(r.timeIn)) : "-"} | ${r.lateStatus}`
      );
    }

    doc.end();
    const buffer = await done;

    await logAudit({ userId: user.id, action: "REPORT_EXPORT_PDF", ipAddress: getClientIp(req) });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-pergerakan-${Date.now()}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
