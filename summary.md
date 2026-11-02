# SchoolPlus+ ERP — Project Summary

**Project location:** `D:\FULL SCHOOLS DATA BASE\arday-7480ba4f-main`
**Live website:** https://scholplus.com
**Date:** October 29, 2026

---

## 1. System Overview

SchoolPlus+ is a full-featured school management ERP (Enterprise Resource Planning) system. It is a multi-tenant platform supporting multiple schools with role-based access for Super Admins, School Admins, Teachers, Students, and Parents.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query (TanStack), Zustand, i18next |
| Backend | Node.js, Express.js, TypeScript, Prisma ORM |
| Database | MySQL 8 (via XAMPP) |
| Auth | JWT (access + refresh tokens), bcrypt |
| Build | Vite (frontend), tsc (backend) |
| Testing | Vitest, React Testing Library |

### Major Modules

- **Schools & Settings** — school profiles, departments, academic years, currency, branding
- **Classes** — class creation, editing, teacher/student enrollment, capacity, monthly fees
- **Students** — registration, enrollment, profiles, status, fee overrides
- **Teachers** — profiles, assignments, departments, salaries
- **Parents** — relationships, portal access
- **Attendance** — daily marking, reports, analytics
- **Grades & Exams** — grading, report cards, exam types, unlocks
- **Assignments** — creation, submission, grading
- **Timetable** — scheduling, slots, courses
- **Invoices & Payments** — monthly invoice generation, payment recording, outstanding balances, refunds
- **Billing** — financial dashboards, reports, export (PDF/Excel/CSV)
- **Learning Materials** — upload, sharing
- **Notifications** — in-app notifications
- **Audit Logs** — action tracking
- **User Management** — roles, permissions, archived users
- **Super Admin Dashboard** — platform-wide analytics, school management

---

## 2. Project Structure

```
D:\FULL SCHOOLS DATA BASE\
├── arday-7480ba4f-main/          # Main application
│   ├── src/                      # Frontend (React + Vite)
│   │   ├── components/           # UI components (classes, settings, invoices, etc.)
│   │   ├── pages/                # Route pages
│   │   ├── hooks/                # React Query hooks (useClasses, useStudents, etc.)
│   │   ├── lib/                  # Utilities, API client, validations
│   │   ├── contexts/             # Auth context
│   │   ├── stores/               # Zustand stores
│   │   └── test/                 # Vitest tests
│   ├── server/                   # Backend (Express + Prisma)
│   │   ├── src/
│   │   │   ├── routes/           # API route handlers (classes, students, invoices, etc.)
│   │   │   ├── controllers/      # Business logic controllers
│   │   │   ├── middleware/       # Auth, school access, validation, error handling
│   │   │   ├── utils/            # Audit log, invoice numbers, etc.
│   │   │   └── config/           # Database, env config
│   │   └── prisma/
│   │       └── schema.prisma     # Database schema (MySQL)
│   ├── dist/                     # Production build output
│   ├── .env                      # Frontend env (VITE_API_URL)
│   └── package.json
├── schoolplus.sql                # Database backup
├── summary.md                    # This file
└── ...
```

---

## 3. Database Schema (Key Models)

### Core Entities

- **School** — id, name, slug, status, plan, monthlyFee (default), currency, department_type
- **Class** — id, name, grade, section, schoolId, teacherId, capacity, education_level, program, level_label
- **class_fees** — composite PK (class_id, school_id), monthly_fee (Decimal), currency
- **Student** — id, userId, schoolId, enrollmentNumber, grade, section, parentId, etc.
- **Teacher** — id, userId, schoolId, employeeId, department, subjects
- **Invoice** — id, studentId, schoolId, amount, dueDate, status, currency, billing_period
- **PaymentHistory** — id, invoiceId, amount, paymentMethod, recordedBy, school_id
- **ClassStudent** — classId, studentId, enrolledAt (enrollment)
- **ClassTeacher** — classId, teacherId, role (teacher assignment)
- **Attendance** — studentId, classId, date, status
- **Grade** — studentId, courseId, score, maxScore, weight
- **TimetableSlot** — classId, courseId, teacherId, dayOfWeek, startTime, endTime

### Fee Resolution Priority

1. Student-specific fee override (`student_fee_overrides`)
2. Class-specific fee (`class_fees.monthly_fee`)
3. School default fee (`schools.monthly_fee`)

A class fee of `0` or empty means "use school default."

---

## 4. Monthly Fee Bug — Root Cause & Fix

### The Bug

Changing a class's Monthly Fee in Edit Class → Details → Save Details returned **HTTP 500** and the fee never persisted.

### Root Cause

The `audit_logs.details` column is defined as:
```sql
`details` longtext ... CHECK (json_valid(`details`))
```

When `logAuditEvent()` was called without a `details` parameter, it stored `details: ''` (empty string). Empty string is **not valid JSON**, so MySQL rejected the insert with error 4025 (constraint violation). This exception propagated out of `PUT /classes/:id`, causing every class update to fail with 500.

### Fix Applied

**File:** `server/src/utils/auditLog.ts`
```diff
- details: details ? JSON.stringify(details) : '',
+ details: details ? JSON.stringify(details) : '{}',
```

### Supporting Fixes

| File | Change |
|---|---|
| `src/hooks/useClasses.ts` | Mapped `monthly_fee` from API's `monthlyFee` field (was always null); added `school_id` + new fields to `useUpdateClass`; in-place cache patching |
| `src/components/classes/EditClassModal.tsx` | Added fee validation (rejects NaN/negative), `school_id` in payload, syncs form from persisted response, `onSaved` callback |
| `src/pages/ClassesPage.tsx` | Passes `onSaved` to update `classToEdit` (prevents stale reopen) |
| `src/components/settings/MonthlyFeeSection.tsx` | Sends `school_id` with fee updates |
| `server/src/routes/classes.ts` | Nullable `monthly_fee` schema (`z.number().min(0).nullable().optional()`), school-ownership check via `ensureSchoolAccess`, correct composite selector (`class_id_school_id`), row create/update/delete, id guard, Language/Level/education_level fields |

### Verification Results

| Fee Change | API Status | DB Value | Reopen Shows |
|---|---|---|---|
| 3.50 → 5.00 | 200 | 5.00 | 5.00 |
| 5.00 → 2.00 | 200 | 2.00 | 2.00 |
| 2.00 → 10.00 | 200 | 10.00 | 10.00 |
| 10.00 → 3.50 | 200 | 3.50 | 3.50 |

- `npm run build`: success
- `npx vitest run`: 23/23 passed
- Historical invoices, payments, outstanding balances: **untouched**

---

## 5. API Endpoints (Classes)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/classes` | List classes (paginated, filtered by school) |
| GET | `/api/classes/:id` | Get single class with teacher, students, fees |
| POST | `/api/classes` | Create class |
| PUT | `/api/classes/:id` | Update class (name, grade, section, capacity, monthly_fee, program, level_label, education_level) |
| DELETE | `/api/classes/:id` | Delete class (cascades enrollments) |
| POST | `/api/classes/:id/assign-teacher` | Assign teacher |
| GET | `/api/classes/:id/students` | List enrolled students |
| POST | `/api/classes/:id/enroll` | Enroll students |
| DELETE | `/api/classes/:id/enroll/:studentId` | Unenroll student |
| GET | `/api/classes/:id/teachers` | List class teachers |
| POST | `/api/classes/:id/teachers` | Assign multiple teachers |
| DELETE | `/api/classes/:id/teachers/:teacherId` | Unassign teacher |

### Update Flow (Monthly Fee)

```
EditClassModal (input) → handleSaveDetails()
  → useUpdateClass.mutateAsync({ id, school_id, monthly_fee, ... })
    → api.put('/classes/:id', { ... })
      → Backend PUT /classes/:id
        → validate(updateClassSchema)
        → requireSchoolAccess middleware (sets req.schoolId)
        → ensureSchoolAccess (verifies school ownership + role)
        → prisma.class.update({ data: { ... } })
        → if monthly_fee !== undefined:
            → if null or 0: delete class_fees row (uses school default)
            → else: upsert class_fees row with new amount
        → logAuditEvent(...)  ← fixed: details defaults to '{}'
        → return { data: { ...class, monthlyFee } }
    → onSuccess: patch React Query cache + invalidate ['classes'], ['class-fees']
  → modal syncs form from response + calls onSaved(updated)
  → ClassesPage updates classToEdit
```

---

## 6. Authentication & Authorization

- JWT-based auth (access token + refresh token)
- Roles: `super_admin`, `school_admin`, `teacher`, `student`, `parent`
- School isolation via `requireSchoolAccess` middleware (validates school_id against user's roles/memberships)
- Super admins can access any school; school admins are scoped to their school
- `ensureSchoolAccess` verifies the user has the required role in the target school

---

## 7. Frontend State Management

- **React Query (TanStack)** — server state, caching, invalidation
- **Zustand** — client state (current school override for super admins)
- **React Context** — auth state (user, roles, profile)
- Query keys: `['classes', schoolId, teacherId]`, `['class-fees', schoolId]`

---

## 8. Testing

### Automated Tests (Vitest)

- `src/test/auth.test.tsx` — Auth provider, login flow
- `src/test/invoiceFinancials.test.ts` — Invoice calculations
- `src/test/studentAccountFlow.test.ts` — Student registration, credentials, enrollment
- `src/test/studentImportFiles.test.ts` — File import
- `src/test/superAdminDashboard.test.tsx` — Super admin dashboard

**Result:** 23/23 tests passed.

### Manual Verification

- Monthly fee updates (3.50→5.00, 5.00→2.00, 2.00→10.00, 10.00→3.50) — all persist in DB and UI
- Invalid fee values rejected by validation
- Cross-school access denied (403)
- Empty/0 fee uses school default
- Historical invoices/payments unchanged

---

## 9. Deployment

### Local Development

```bash
# Backend
cd "D:\FULL SCHOOLS DATA BASE\arday-7480ba4f-main\server"
npm run dev          # tsx watch src/index.ts (port 3000)

# Frontend
cd "D:\FULL SCHOOLS DATA BASE\arday-7480ba4f-main"
npm run dev          # vite (port 8080, proxies /api to localhost:3000)
```

### Production Build

```bash
# Frontend
npm run build        # outputs to dist/

# Backend
cd server && npm run build   # tsc → dist/
npm run start                # node dist/index.js
```

### Environment Variables

**Frontend (`.env`):**
```
VITE_API_URL=http://localhost:3000/api
```

**Backend (`server/.env`):**
```
DB_URL=mysql://root:@127.0.0.1:3306/scholplus
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=http://localhost:8080,...
```

### Hosting Platform

- Frontend: Lovable (lovable.dev) — "Share → Publish"
- Backend: Standalone Node.js process (no Dockerfile/CI config in repo)
- Database: MySQL 8 (XAMPP locally)

---

## 10. Known Issues & Limitations

1. **Production deployment not performed** — The live site (scholplus.com) runs a different backend codebase (`db.controller.ts` based, controller architecture) from `C:\Users\ENG - KHADAR BOODO\Music\SCHOOL FULL`. The fix in `D:\FULL SCHOOLS DATA BASE` works locally but has not been deployed to production. Hosting access is required to complete deployment.

2. **Pre-existing TypeScript error** — `server/src/routes/students.ts:294` has a type error (`enrollmentNumber: string | undefined` assigned to required `string`). This is unrelated to the Monthly Fee fix and existed before changes.

3. **Service worker caching** — The PWA service worker may cache old frontend bundles. Users may need to hard-refresh after deployment.

4. **Multiple project copies** — There are several copies of the project on the machine (`D:\FULL SCHOOLS DATA BASE`, `D:\saaa\`, `C:\Users\ENG - KHADAR BOODO\Music\SCHOOL FULL`). Only `D:\FULL SCHOOLS DATA BASE` was fixed in this session. The others may need the same auditLog fix applied.

---

## 11. Files Changed Summary

### Frontend
- `src/hooks/useClasses.ts`
- `src/components/classes/EditClassModal.tsx`
- `src/components/settings/MonthlyFeeSection.tsx`
- `src/pages/ClassesPage.tsx`

### Backend
- `server/src/routes/classes.ts`
- `server/src/utils/auditLog.ts`
- `server/src/middleware/schoolAccess.ts` (copied to saaa copy)

### No changes to
- Database schema (no migrations)
- Historical invoices, payments, or financial records
- Authentication/authorization logic
- Other modules (students, teachers, attendance, grades, etc.)