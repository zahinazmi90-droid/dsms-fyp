// Standalone scripts run via `npx tsx ...` do NOT automatically load .env
// the way `next dev`/`next build`/`next start` do -- this import must come
// FIRST, before the db/client import below, or DATABASE_URL will be
// undefined even when .env has the correct value.
import "dotenv/config";
import { randomUUID } from "crypto";
import { db, pool } from "../src/db/client";
import {
  users,
  students,
  departments,
  semesters,
  fellows,
  movementTypes,
  movementRecords,
  approvalRequests,
  scheduleRules,
  holidayDates,
  systemSettings,
  auditLogs,
  sessions,
  staff,
  classSessions,
  notifications,
  userPushTokens,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { SETTINGS_DEFAULTS } from "../src/lib/settings";

async function main() {
  console.log("Clearing existing data (safe to run repeatedly)...");
  // Delete in FK-safe order (children before parents) so re-running this
  // script against a persistent Postgres database never hits a duplicate
  // matric-number / unique-constraint error.
  await db.delete(auditLogs);
  await db.delete(sessions);
  await db.delete(notifications);
  await db.delete(userPushTokens);
  await db.delete(approvalRequests);
  await db.delete(movementRecords);
  await db.delete(movementTypes);
  await db.delete(classSessions);
  await db.delete(students);
  await db.delete(staff);
  await db.delete(fellows);
  await db.delete(semesters);
  await db.delete(departments);
  await db.delete(scheduleRules);
  await db.delete(holidayDates);
  await db.delete(systemSettings);
  await db.delete(users);

  console.log("Seeding DSMS database...");

  // Departments -- real programmes offered at this college.
  const deptList = [
    { id: randomUUID(), name: "Diploma Kejuruteraan Pembuatan (Teknologi dan Proses) — DKP" },
    { id: randomUUID(), name: "Diploma Kejuruteraan Pembuatan (Automasi Industri dan Robotik) — DKI" },
    { id: randomUUID(), name: "Diploma Kejuruteraan Pembuatan (Rekabentuk Pembuatan) — DKN" },
    { id: randomUUID(), name: "Diploma Kejuruteraan Pembuatan (Automotif) — DKA" },
    { id: randomUUID(), name: "Diploma Kejuruteraan Kualiti (Quality Engineering) — DKQ" },
  ];
  await db.insert(departments).values(deptList);

  // Semesters
  const semList = [1, 2, 3, 4, 5, 6].map((n) => ({ id: randomUUID(), label: `Semester ${n}` }));
  await db.insert(semesters).values(semList);

  // Fellows
  const fellowList = [
    { id: randomUUID(), name: "Fellow Ahmad", phone: "013-1110001", floorArea: "Blok A - Tingkat 1" },
    { id: randomUUID(), name: "Fellow Siti", phone: "013-1110002", floorArea: "Blok A - Tingkat 2" },
    { id: randomUUID(), name: "Fellow Ravi", phone: "013-1110003", floorArea: "Blok B - Tingkat 1" },
  ];
  await db.insert(fellows).values(fellowList);

  // ---- Academic staff: Lecturer + Head of Programme, one HOP + a couple
  // lecturers per department. Scale note: the real target scale (~15
  // lecturers/programme, ~1000 students total) is NOT fully seeded here --
  // this seed provides a small, realistic sample sufficient to test the
  // routing/notification logic end-to-end. Add more via /admin/staff.
  const staffPassHash = await hashPassword("Staff@123");
  const hopByDept: Record<string, string> = {};
  const lecturersByDept: Record<string, string[]> = {};

  for (const dept of deptList) {
    const hopId = randomUUID();
    const code = dept.name.match(/DK[A-Z]/)?.[0]?.toLowerCase() ?? dept.id.slice(0, 4);
    await db.insert(users).values({ id: hopId, role: "head_of_programme", loginId: `hop.${code}@example.local`, passwordHash: staffPassHash });
    await db.insert(staff).values({ id: hopId, name: `Ketua Program (${code.toUpperCase()})`, departmentId: dept.id });
    hopByDept[dept.id] = hopId;

    lecturersByDept[dept.id] = [];
    for (let i = 1; i <= 2; i++) {
      const lecId = randomUUID();
      await db.insert(users).values({ id: lecId, role: "lecturer", loginId: `pensyarah${i}.${code}@example.local`, passwordHash: staffPassHash });
      await db.insert(staff).values({ id: lecId, name: `Pensyarah ${i} (${code.toUpperCase()})`, departmentId: dept.id });
      lecturersByDept[dept.id].push(lecId);
    }
  }

  // Class sessions: broad weekday coverage for the first 3 departments
  // (so a STUDY checkout during normal weekday hours finds a class ->
  // exercises the "Lecturer + HOP notified together" path). The last
  // department (DKQ) is deliberately left WITHOUT class sessions so it
  // exercises the "no matching class -> HOP only" path instead.
  const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
  for (const dept of deptList.slice(0, 3)) {
    for (const day of weekdays) {
      await db.insert(classSessions).values({
        id: randomUUID(),
        departmentId: dept.id,
        semesterId: semList[4].id, // Semester 5 (matches Zahin's seeded semester)
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "18:00",
        lecturerId: lecturersByDept[dept.id][0],
        courseName: "Kelas Contoh",
        isActive: true,
      });
    }
  }

  // Movement types
  await db.insert(movementTypes).values([
    { id: "NORMAL", label: "Outing Biasa", requiresApproval: false, requiresAddress: false, requiresPurpose: true, isActive: true },
    { id: "STUDY", label: "Outing Waktu Kuliah", requiresApproval: true, requiresAddress: false, requiresPurpose: true, isActive: true },
    { id: "OVERNIGHT", label: "Bermalam Luar", requiresApproval: false, requiresAddress: true, requiresPurpose: false, isActive: true },
    { id: "EMERGENCY", label: "Kecemasan", requiresApproval: false, requiresAddress: false, requiresPurpose: false, isActive: true },
  ]);

  // Schedule rules - baseline SOP from interview 10/08/2026
  await db.insert(scheduleRules).values([
    { id: randomUUID(), dayType: "MONDAY", outingStart: "17:00", returnDeadline: "19:00", isActive: true },
    { id: randomUUID(), dayType: "TUESDAY", outingStart: "17:00", returnDeadline: "19:00", isActive: true },
    { id: randomUUID(), dayType: "WEDNESDAY", outingStart: "17:00", returnDeadline: "19:00", isActive: true },
    { id: randomUUID(), dayType: "THURSDAY", outingStart: "17:00", returnDeadline: "19:00", isActive: true },
    { id: randomUUID(), dayType: "FRIDAY", outingStart: "17:00", returnDeadline: "22:00", isActive: true },
    { id: randomUUID(), dayType: "SATURDAY", outingStart: "07:30", returnDeadline: "22:00", isActive: true },
    { id: randomUUID(), dayType: "SUNDAY", outingStart: "07:30", returnDeadline: "22:00", isActive: true },
    { id: randomUUID(), dayType: "HOLIDAY", outingStart: "07:30", returnDeadline: "22:00", isActive: true },
  ]);

  // Example holiday (demo)
  await db.insert(holidayDates).values({
    id: randomUUID(),
    name: "Cuti Pertengahan Semester (Contoh)",
    date: "2026-09-14",
    outingStart: "07:30",
    returnDeadline: "22:00",
    isActive: true,
  });

  // Settings defaults
  for (const s of SETTINGS_DEFAULTS) {
    await db.insert(systemSettings).values({
      key: s.key,
      value: JSON.stringify(s.value),
      label: s.label,
      description: s.description,
      category: s.category,
    });
  }

  // Test accounts
  const studentPass = await hashPassword("Student@123");
  const staffPass = await hashPassword("Staff@123");

  const studentId = randomUUID();
  await db.insert(users).values({ id: studentId, role: "student", loginId: "12345", passwordHash: studentPass });
  await db.insert(students).values({
    id: studentId,
    matricNumber: "12345",
    name: "MUHAMMAD ZAHIN BIN MOHD AZMI",
    departmentId: deptList[0].id, // DKP - update via Admin panel if this isn't your actual programme
    semesterId: semList[4].id,
    phone: "012-3456789",
    fellowId: fellowList[0].id,
  });

  await db.insert(users).values({ id: randomUUID(), role: "guard", loginId: "guard@example.local", passwordHash: staffPass });
  await db.insert(users).values({ id: randomUUID(), role: "warden", loginId: "warden@example.local", passwordHash: staffPass });
  await db.insert(users).values({ id: randomUUID(), role: "admin", loginId: "admin@example.local", passwordHash: staffPass });

  // 50 dummy students for backtesting/demo (fake data only, matric range
  // 2425950-2425999 deliberately avoids colliding with 12345 above).
  const maleFirst = [
    "Amir", "Hafiz", "Danish", "Zul", "Faiz", "Aiman", "Haziq", "Adam", "Rizwan",
    "Syafiq", "Firdaus", "Hakim", "Wan", "Iqbal", "Naufal", "Idris", "Fahmi",
    "Azlan", "Zaki", "Harith", "Fikri", "Amsyar", "Danial", "Irfan", "Luqman",
  ];
  const femaleFirst = [
    "Farah", "Nurul", "Aina", "Mira", "Iman", "Sara", "Liyana", "Puteri", "Nabila",
    "Alya", "Aisyah", "Qistina", "Balqis", "Diyana", "Husna", "Izzati", "Nadhirah",
    "Sofea", "Adawiyah", "Farhana", "Wardina", "Aleesya", "Batrisyia", "Maisara",
    "Nur Elysa",
  ];
  const fatherNames = [
    "Rahman", "Kassim", "Yusof", "Ismail", "Hashim", "Zainal", "Bakar", "Salleh",
    "Halim", "Rashid", "Malek", "Aziz", "Karim", "Latif", "Samad", "Noh", "Din",
    "Hamid", "Jamil", "Osman", "Talib", "Wahab", "Sani", "Ghani", "Fadzil",
  ];

  for (let i = 0; i < 50; i++) {
    const isMale = i % 2 === 0;
    const first = isMale ? maleFirst[i % maleFirst.length] : femaleFirst[i % femaleFirst.length];
    const father = fatherNames[(i * 7) % fatherNames.length]; // different stride so pairing varies
    const connector = isMale ? "bin" : "binti";
    const name = `${first} ${connector} ${father}`;

    const id = randomUUID();
    const matric = `24259${(50 + i).toString()}`;
    await db.insert(users).values({ id, role: "student", loginId: matric, passwordHash: studentPass });
    await db.insert(students).values({
      id,
      matricNumber: matric,
      name,
      departmentId: deptList[i % deptList.length].id,
      semesterId: semList[i % semList.length].id,
      phone: `01${1 + (i % 9)}-${(3000000 + i * 37).toString().slice(0, 7)}`,
      fellowId: fellowList[i % fellowList.length].id,
    });
  }

  console.log("Seed complete.");
  console.log("Test accounts:");
  console.log("  Student : 12345 / Student@123");
  console.log("  Guard   : guard@example.local / Staff@123");
  console.log("  Warden  : warden@example.local / Staff@123");
  console.log("  Admin   : admin@example.local / Staff@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
