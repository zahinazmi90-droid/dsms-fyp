import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { queryMovementReport } from "@/lib/report";
import { formatDisplay } from "@/lib/tz";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await requireRole("warden", "admin");
    const { searchParams } = new URL(req.url);
    const filters = {
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      matricNumber: searchParams.get("matricNumber") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      semesterId: searchParams.get("semesterId") || undefined,
      movementTypeId: searchParams.get("movementTypeId") || undefined,
      lateOnly: searchParams.get("lateOnly") === "true",
    };
    const rows = await queryMovementReport(filters);

    const wb = new ExcelJS.Workbook();
    const summarySheet = wb.addWorksheet("Ringkasan");
    summarySheet.addRow(["Laporan Pergerakan Pelajar - DSMS"]);
    summarySheet.addRow([`Tarikh Dijana: ${formatDisplay(new Date())}`]);
    summarySheet.addRow([`Penapis: ${JSON.stringify(filters)}`]);
    summarySheet.addRow([`Jumlah Rekod: ${rows.length}`]);
    summarySheet.addRow([`Jumlah Lewat: ${rows.filter((r) => r.lateStatus === "LATE").length}`]);

    const sheet = wb.addWorksheet("Rekod Terperinci");
    sheet.columns = [
      { header: "Nama", key: "studentName", width: 25 },
      { header: "No. Matrik", key: "matricNumber", width: 15 },
      { header: "Jabatan", key: "departmentName", width: 18 },
      { header: "Semester", key: "semesterLabel", width: 14 },
      { header: "Jenis Pergerakan", key: "movementTypeLabel", width: 18 },
      { header: "Tujuan", key: "purpose", width: 25 },
      { header: "Alamat Luar", key: "outsideAddress", width: 25 },
      { header: "Masa Keluar", key: "timeOut", width: 20 },
      { header: "Masa Masuk", key: "timeIn", width: 20 },
      { header: "Status Lewat", key: "lateStatus", width: 14 },
      { header: "Status Kelulusan", key: "approvalStatus", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      sheet.addRow({
        ...r,
        timeOut: formatDisplay(new Date(r.timeOut)),
        timeIn: r.timeIn ? formatDisplay(new Date(r.timeIn)) : "-",
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    await logAudit({ userId: user.id, action: "REPORT_EXPORT_EXCEL", ipAddress: getClientIp(req) });

    return new Response(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="laporan-pergerakan-${Date.now()}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
