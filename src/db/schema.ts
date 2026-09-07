import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * DSMS Database Schema (Drizzle ORM, PostgreSQL dialect).
 *
 * Migrated from SQLite (used for early local-only development) to
 * PostgreSQL so the system can run as a real, persistent, always-on
 * deployment (Vercel + a hosted Postgres such as Neon/Supabase) instead of
 * a single local SQLite file that only exists on one machine.
 *
 * All timestamp columns are kept as TEXT storing ISO-8601 strings in UTC
 * (exactly as before) rather than native `timestamp` columns. This is a
 * deliberate choice, not an oversight: every timestamp that business logic
 * compares against (time_out, time_in, deadline_applied_at,
 * expected_return_at) is always explicitly set by application code via
 * `new Date().toISOString()` -- never left to a database-generated default --
 * so keeping them as plain ISO text preserves exact, predictable string
 * semantics across both database engines with zero behavior change to
 * `src/lib/tz.ts` or any late-detection/report-filtering logic.
 *
 * Columns that DO rely on a database-generated default (created_at,
 * updated_at, requested_at) are purely informational/audit timestamps that
 * the app only ever sorts, never range-filters -- so Postgres's own default
 * text format for `now()` is safe to use as-is.
 */

// ---------- ROLES / USERS ----------
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // uuid
    role: text("role", { enum: ["student", "guard", "warden", "admin", "lecturer", "head_of_programme"] }).notNull(),
    // For students, loginId = matric number. For staff, loginId = email/username.
    loginId: text("login_id").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
    updatedAt: text("updated_at").notNull().default(sql`now()::text`),
  },
  (t) => [uniqueIndex("users_login_id_idx").on(t.loginId)]
);

export const departments = pgTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const semesters = pgTable("semesters", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const fellows = pgTable("fellows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  floorArea: text("floor_area").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const students = pgTable(
  "students",
  {
    id: text("id").primaryKey(),
    matricNumber: text("matric_number").notNull(),
    name: text("name").notNull(),
    departmentId: text("department_id").references(() => departments.id),
    semesterId: text("semester_id").references(() => semesters.id),
    phone: text("phone").notNull(),
    fellowId: text("fellow_id").references(() => fellows.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [
    uniqueIndex("students_matric_idx").on(t.matricNumber),
    index("students_dept_idx").on(t.departmentId),
  ]
);

// ---------- ACADEMIC STAFF (Lecturer / Head of Programme) ----------
// Mirrors the `students` table pattern: id = users.id (1:1). A staff row's
// `role` on the `users` table (lecturer vs head_of_programme) determines
// what they can do; `departmentId` here scopes WHICH programme they act
// for.
export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    departmentId: text("department_id").references(() => departments.id),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [index("staff_dept_idx").on(t.departmentId)]
);

// ---------- MINIMAL TIMETABLE (class_sessions) ----------
// NOTE ON SCOPE: no class-timetable system existed prior to this feature
// -- only the daily OUTING schedule_rules. This is a deliberately minimal
// timetable: enough to answer "is this student's programme+semester in a
// class right now, and if so, which lecturer teaches it?"
export const classSessions = pgTable(
  "class_sessions",
  {
    id: text("id").primaryKey(),
    departmentId: text("department_id").notNull().references(() => departments.id),
    semesterId: text("semester_id").notNull().references(() => semesters.id),
    dayOfWeek: text("day_of_week", {
      enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
    }).notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    lecturerId: text("lecturer_id").notNull().references(() => staff.id),
    courseName: text("course_name"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("class_sessions_dept_sem_day_idx").on(t.departmentId, t.semesterId, t.dayOfWeek)]
);

// ---------- MOVEMENT ----------
export const movementTypes = pgTable("movement_types", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  requiresAddress: boolean("requires_address").notNull().default(false),
  requiresPurpose: boolean("requires_purpose").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
});

export const movementRecords = pgTable(
  "movement_records",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id").notNull().references(() => students.id),
    movementTypeId: text("movement_type_id").notNull().references(() => movementTypes.id),

    purpose: text("purpose"),
    outsideAddress: text("outside_address"),
    emergencyReason: text("emergency_reason"),
    emergencyFellowId: text("emergency_fellow_id").references(() => fellows.id),

    timeOut: text("time_out").notNull(),
    expectedReturnAt: text("expected_return_at"),

    timeIn: text("time_in"),

    deadlineAppliedAt: text("deadline_applied_at"),
    lateStatus: text("late_status", { enum: ["ON_TIME", "LATE", "PENDING"] })
      .notNull()
      .default("PENDING"),

    approvalStatus: text("approval_status", {
      enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"],
    })
      .notNull()
      .default("NOT_REQUIRED"),

    notes: text("notes"),
    createdBy: text("created_by").notNull(),

    idempotencyKey: text("idempotency_key"),

    createdAt: text("created_at").notNull().default(sql`now()::text`),
    updatedAt: text("updated_at").notNull().default(sql`now()::text`),
  },
  (t) => [
    index("movement_student_idx").on(t.studentId),
    index("movement_timeout_idx").on(t.timeOut),
    index("movement_timein_idx").on(t.timeIn),
    uniqueIndex("movement_idem_idx").on(t.idempotencyKey),
    // CRITICAL data-integrity guarantee: at most one ACTIVE (time_in still
    // NULL) movement record per student, enforced by Postgres itself via a
    // partial unique index -- not just the application-level "does an
    // active record already exist?" check in the checkout route. That
    // application check is a check-then-insert pattern which, on its own,
    // has a theoretical race-condition window under truly simultaneous
    // requests; this index closes that window at the database layer
    // regardless of what the application code does.
    uniqueIndex("movement_one_active_per_student_idx")
      .on(t.studentId)
      .where(sql`${t.timeIn} IS NULL`),
  ]
);

// ---------- APPROVALS ----------
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id").primaryKey(),
    movementRecordId: text("movement_record_id").notNull().references(() => movementRecords.id),
    approverRole: text("approver_role", {
      enum: ["TEACHER", "HEAD_OF_PROGRAMME", "WARDEN", "GUARD"],
    }).notNull(),
    // Which SPECIFIC lecturer/HOP this step belongs to (their users.id).
    // Nullable for backward compatibility with WARDEN/GUARD/legacy steps.
    // When set (new lecturer/HOP flow), the deciding user must match this
    // exact id -- not just share the role.
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    status: text("status", {
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    })
      .notNull()
      .default("PENDING"),
    remarks: text("remarks"),
    requestedAt: text("requested_at").notNull().default(sql`now()::text`),
    decidedAt: text("decided_at"),
    decidedBy: text("decided_by"),
  },
  (t) => [
    index("approval_movement_idx").on(t.movementRecordId),
    index("approval_assignee_idx").on(t.assignedToUserId),
  ]
);

// ---------- SCHEDULE / RULES ----------
export const scheduleRules = pgTable(
  "schedule_rules",
  {
    id: text("id").primaryKey(),
    dayType: text("day_type", {
      enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "HOLIDAY"],
    }).notNull(),
    outingStart: text("outing_start").notNull(),
    returnDeadline: text("return_deadline").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("schedule_daytype_idx").on(t.dayType)]
);

export const holidayDates = pgTable("holiday_dates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  date: text("date").notNull(),
  outingStart: text("outing_start").notNull(),
  returnDeadline: text("return_deadline").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// ---------- SETTINGS ----------
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`now()::text`),
});

// ---------- AUDIT ----------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    target: text("target"),
    description: text("description"),
    ipAddress: text("ip_address"),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);

// ---------- SESSIONS ----------
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// ---------- NOTIFICATIONS (FCM two-layer architecture: DB + push) ----------
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientUserId: text("recipient_user_id").notNull().references(() => users.id),
    type: text("type", {
      enum: [
        "OUTING_SUBMITTED",
        "LECTURER_APPROVAL_REQUIRED",
        "HOP_APPROVAL_REQUIRED",
        "LECTURER_APPROVED",
        "LECTURER_REJECTED",
        "HOP_APPROVED",
        "HOP_REJECTED",
        "OUTING_APPROVED",
        "OUTING_REJECTED",
        "AFTER_HOURS_REQUEST",
        "WARDEN_APPROVED",
        "WARDEN_REJECTED",
        "LATE_RETURN",
        "OUTING_CANCELLED",
      ],
    }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    requestId: text("request_id"),
    movementId: text("movement_id"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [
    index("notifications_recipient_created_idx").on(t.recipientUserId, t.createdAt),
    index("notifications_recipient_unread_idx").on(t.recipientUserId, t.isRead),
  ]
);

// ---------- FCM DEVICE / PUSH TOKENS ----------
export const userPushTokens = pgTable(
  "user_push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    token: text("token").notNull(),
    deviceType: text("device_type"),
    browser: text("browser"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: text("last_seen_at").notNull().default(sql`now()::text`),
    createdAt: text("created_at").notNull().default(sql`now()::text`),
  },
  (t) => [
    uniqueIndex("user_push_tokens_token_idx").on(t.token),
    index("user_push_tokens_user_idx").on(t.userId),
  ]
);
