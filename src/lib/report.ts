import { and, eq, gte, lte, like, SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords, movementTypes, students, departments, semesters } from "@/db/schema";

export type ReportFilters = {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;
  matricNumber?: string;
  departmentId?: string;
  semesterId?: string;
  movementTypeId?: string;
  lateOnly?: boolean;
};

export async function queryMovementReport(filters: ReportFilters) {
  const conditions: SQL[] = [];
  if (filters.dateFrom) conditions.push(gte(movementRecords.timeOut, `${filters.dateFrom}T00:00:00.000Z`));
  if (filters.dateTo) conditions.push(lte(movementRecords.timeOut, `${filters.dateTo}T23:59:59.999Z`));
  if (filters.matricNumber) conditions.push(like(students.matricNumber, `%${filters.matricNumber}%`));
  if (filters.departmentId) conditions.push(eq(students.departmentId, filters.departmentId));
  if (filters.semesterId) conditions.push(eq(students.semesterId, filters.semesterId));
  if (filters.movementTypeId) conditions.push(eq(movementRecords.movementTypeId, filters.movementTypeId));
  if (filters.lateOnly) conditions.push(eq(movementRecords.lateStatus, "LATE"));

  const query = db
    .select({
      id: movementRecords.id,
      studentName: students.name,
      matricNumber: students.matricNumber,
      departmentName: departments.name,
      semesterLabel: semesters.label,
      movementTypeLabel: movementTypes.label,
      purpose: movementRecords.purpose,
      outsideAddress: movementRecords.outsideAddress,
      timeOut: movementRecords.timeOut,
      timeIn: movementRecords.timeIn,
      lateStatus: movementRecords.lateStatus,
      approvalStatus: movementRecords.approvalStatus,
    })
    .from(movementRecords)
    .innerJoin(students, eq(movementRecords.studentId, students.id))
    .leftJoin(departments, eq(students.departmentId, departments.id))
    .leftJoin(semesters, eq(students.semesterId, semesters.id))
    .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id));

  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  return rows;
}
