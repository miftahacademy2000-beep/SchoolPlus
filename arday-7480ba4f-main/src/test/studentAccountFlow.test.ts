import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prisma, logAuditEvent } = vi.hoisted(() => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    school: { findUnique: vi.fn() },
    student: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    membership: { upsert: vi.fn() },
    $transaction: vi.fn(),
    archivedUser: { findUnique: vi.fn(), delete: vi.fn() },
    timetableSlot: { findMany: vi.fn() },
    grade: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
  },
  logAuditEvent: vi.fn(),
}));

vi.mock('../../server/src/config/database.js', () => ({ prisma }));
vi.mock('../../server/src/utils/auditLog.js', () => ({ logAuditEvent }));
vi.mock('../../server/src/config/env.js', () => ({
  env: {
    jwtSecret: 'test-access-secret',
    jwtRefreshSecret: 'test-refresh-secret',
    jwtExpiresIn: '1h',
    jwtRefreshExpiresIn: '1d',
  },
}));

import bcrypt from '../../server/node_modules/bcryptjs/index.js';
import { login } from '../../server/src/controllers/authController.js';
import { createUser, updateCredentials } from '../../server/src/controllers/userController.js';
import studentPortalRouter from '../../server/src/routes/student-portal.js';
import archivedUsersRouter from '../../server/src/routes/archived-users.js';

const schoolId = '7b74b90f-54f2-4d8e-9c25-f5212fc8f5c0';
const studentUserId = 'b4ba7e57-3c78-4ff5-b852-ff03be7c8c5a';
const studentId = '71a0ccfe-6285-4a5e-8d1c-e0f50b17776e';

function responseMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function lastRouteHandler(router: unknown, path: string) {
  const layers = (router as { stack: Array<{ route?: { path: string; stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> } }> }).stack;
  const route = layers.find((layer) => layer.route?.path === path)?.route;
  if (!route) throw new Error(`Route ${path} not found`);
  return route.stack[route.stack.length - 1].handle;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('student account flow', () => {
  it('persists registration fields, login ID, password hash, and the shared account relationship', async () => {
    const password = 'correct-horse-battery';
    const profileCreate = vi.fn(({ data }) => Promise.resolve({
      ...data,
      avatarUrl: null,
      mustChangePassword: false,
      preferredLanguage: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const studentCreate = vi.fn().mockResolvedValue({
      id: studentId,
      userId: studentUserId,
      schoolId,
      enrollmentNumber: 'ENR-0082',
      grade: 'Grade 8',
      dateOfBirth: new Date('2012-04-12'),
    });
    const tx = {
      profile: { create: profileCreate },
      userRole: { create: vi.fn().mockResolvedValue({}) },
      membership: { create: vi.fn().mockResolvedValue({}) },
      student: { create: studentCreate },
    };
    prisma.userRole.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: 'super_admin', schoolId: null });
    prisma.school.findUnique.mockResolvedValue({ id: schoolId });
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.profile.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    prisma.userRole.findMany.mockResolvedValue([{ id: 'role-1', role: 'student', schoolId }]);

    const req = {
      user: { userId: 'admin-1' },
      body: {
        login_id: 'student-82',
        password,
        full_name: 'Student Example',
        role: 'student',
        school_id: schoolId,
        enrollment_number: 'ENR-0082',
        grade: 'Grade 8',
        date_of_birth: '2012-04-12',
        phone: '5550100',
      },
    };
    const res = responseMock();

    await createUser(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const savedProfile = profileCreate.mock.calls[0][0].data;
    expect(savedProfile).toMatchObject({
      loginId: 'student-82',
      fullName: 'Student Example',
      phone: '5550100',
    });
    expect(await bcrypt.compare(password, savedProfile.passwordHash)).toBe(true);
    expect(studentCreate.mock.calls[0][0].data).toMatchObject({
      userId: savedProfile.id,
      schoolId,
      enrollmentNumber: 'ENR-0082',
      grade: 'Grade 8',
      dateOfBirth: new Date('2012-04-12'),
    });
  });

  it('authenticates by persisted login ID and does not return the password hash', async () => {
    const passwordHash = await bcrypt.hash('student-password', 4);
    prisma.profile.findFirst.mockResolvedValue({
      id: studentUserId,
      email: 'student.82@school.local',
      loginId: 'student-82',
      passwordHash,
      fullName: 'Student Example',
      phone: null,
      avatarUrl: null,
      mustChangePassword: false,
      preferredLanguage: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.userRole.findMany.mockResolvedValue([{ id: 'role-1', role: 'student', schoolId }]);
    const req = { body: { login_id: 'student-82', password: 'student-password' } };
    const res = responseMock();

    await login(req as never, res as never);

    expect(prisma.profile.findFirst).toHaveBeenCalledWith({ where: { loginId: 'student-82' } });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.id).toBe(studentUserId);
    expect(JSON.stringify(payload)).not.toContain(passwordHash);
  });

  it('preserves login ID and password hash when an administrator edits unrelated profile fields', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      id: studentUserId,
      email: 'student.82@school.local',
      loginId: 'student-82',
      passwordHash: 'existing-hash',
    });
    prisma.userRole.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: 'school_admin', schoolId })
      .mockResolvedValueOnce({ role: 'student', schoolId });
    const profileUpdate = vi.fn().mockResolvedValue({
      id: studentUserId,
      fullName: 'Student Example',
      email: 'student.82@school.local',
      loginId: 'student-82',
      phone: '5550199',
      mustChangePassword: false,
      updatedAt: new Date(),
    });
    const updateStudent = vi.fn().mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (callback) => callback({
      profile: { update: profileUpdate },
      student: { updateMany: updateStudent },
    }));
    const req = {
      user: { userId: 'admin-1' },
      body: { user_id: studentUserId, school_id: schoolId, phone: '5550199', grade: 'Grade 9' },
    };
    const res = responseMock();

    await updateCredentials(req as never, res as never);

    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: studentUserId },
      data: { phone: '5550199' },
    }));
    expect(profileUpdate.mock.calls[0][0].data).not.toHaveProperty('loginId');
    expect(profileUpdate.mock.calls[0][0].data).not.toHaveProperty('passwordHash');
    expect(updateStudent).toHaveBeenCalledWith({
      where: { userId: studentUserId, schoolId },
      data: { grade: 'Grade 9' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('changes credentials only after an authorized explicit credential update', async () => {
    const password = 'new-student-password';
    const originalPasswordHash = await bcrypt.hash('old-student-password', 4);
    prisma.profile.findUnique.mockResolvedValue({
      id: studentUserId,
      email: 'student.82@school.local',
      loginId: 'student-82',
      passwordHash: originalPasswordHash,
    });
    prisma.userRole.findFirst.mockResolvedValue({ role: 'super_admin', schoolId: null });
    prisma.profile.findFirst.mockResolvedValue(null);
    const profileUpdate = vi.fn(async ({ data }) => ({
      id: studentUserId,
      fullName: 'Student Example',
      email: data.email,
      loginId: data.loginId,
      phone: null,
      mustChangePassword: false,
      updatedAt: new Date(),
    }));
    prisma.$transaction.mockImplementation(async (callback) => callback({
      profile: { update: profileUpdate },
      student: { updateMany: vi.fn() },
    }));
    const req = {
      user: { userId: 'admin-1' },
      body: {
        user_id: studentUserId,
        new_login_id: 'student-82-new',
        new_password: password,
        must_change_password: false,
      },
    };
    const res = responseMock();

    await updateCredentials(req as never, res as never);

    const savedHash = profileUpdate.mock.calls[0][0].data.passwordHash;
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: studentUserId },
      data: expect.objectContaining({ loginId: 'student-82-new', email: 'student-82-new@school.local' }),
    }));
    expect(savedHash).not.toBe(password);
    expect(await bcrypt.compare(password, savedHash)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects credential changes from an administrator without access to the student school', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      id: studentUserId,
      email: 'student.82@school.local',
      loginId: 'student-82',
      passwordHash: 'existing-hash',
    });
    prisma.userRole.findFirst.mockResolvedValue(null);
    const profileUpdate = vi.fn();
    const req = {
      user: { userId: 'admin-1' },
      body: {
        user_id: studentUserId,
        school_id: schoolId,
        new_login_id: 'student-82-new',
        new_password: 'new-student-password',
      },
    };
    const res = responseMock();

    await updateCredentials(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('loads portal profile only from the authenticated student and excludes password hash fields', async () => {
    const student = {
      id: studentId,
      userId: studentUserId,
      schoolId,
      enrollmentNumber: 'ENR-0082',
      grade: 'Grade 8',
      dateOfBirth: null,
      createdAt: new Date(),
      profile: {
        id: studentUserId,
        fullName: 'Student Example',
        email: 'student.82@school.local',
        loginId: 'student-82',
        phone: null,
        avatarUrl: null,
      },
      schools: { id: schoolId, name: 'Example School', logoUrl: null },
      classStudents: [],
    };
    prisma.student.findFirst.mockResolvedValue(student);
    prisma.userRole.findFirst.mockResolvedValue({ role: 'student', schoolId });
    const handler = lastRouteHandler(studentPortalRouter, '/');
    const req = {
      user: { userId: studentUserId },
      params: { id: 'another-student-id' },
      query: { user_id: 'another-student-user' },
    };
    const res = responseMock();

    await handler(req, res);

    expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: studentUserId, archived_at: null },
    }));
    expect(res.json.mock.calls[0][0].data).toMatchObject({
      id: studentId,
      user_id: studentUserId,
      school_id: schoolId,
      enrollment_number: 'ENR-0082',
      profile: { full_name: 'Student Example', login_id: 'student-82' },
      school: { id: schoolId, name: 'Example School' },
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('passwordHash');
  });

  it('rejects portal access if the authenticated account has no student role for its school', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: studentId,
      userId: studentUserId,
      schoolId,
      profile: null,
      schools: { id: schoolId, name: 'Example School', logoUrl: null },
      classStudents: [],
    });
    prisma.userRole.findFirst.mockResolvedValue(null);
    const handler = lastRouteHandler(studentPortalRouter, '/');
    const res = responseMock();

    await handler({ user: { userId: studentUserId } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: studentUserId, archived_at: null },
    }));
  });

  it('queries invoices and payment history by the authenticated student and school', async () => {
    prisma.student.findFirst.mockResolvedValue({
      id: studentId,
      userId: studentUserId,
      schoolId,
      profile: null,
      schools: { id: schoolId, name: 'Example School', logoUrl: null },
      classStudents: [],
    });
    prisma.userRole.findFirst.mockResolvedValue({ role: 'student', schoolId });
    prisma.invoice.findMany.mockResolvedValue([]);
    const handler = lastRouteHandler(studentPortalRouter, '/invoices');
    const req = {
      user: { userId: studentUserId },
      params: { student_id: 'student-b' },
      query: { user_id: 'student-b-user' },
    };
    const res = responseMock();

    await handler(req, res);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId, schoolId },
      include: {
        paymentHistory: expect.objectContaining({
          select: expect.objectContaining({ id: true, amount: true }),
        }),
      },
    }));
    expect(res.json.mock.calls[0][0].data.summary.total).toBe(0);
  });

  it('restores a retained student record rather than creating a duplicate account or student', async () => {
    const archived = {
      id: 'archive-1',
      originalId: studentId,
      userId: studentUserId,
      schoolId,
      userType: 'student',
      metadata: JSON.stringify({ enrollmentNumber: 'ENR-0082', grade: 'Grade 8' }),
      fullName: 'Student Example',
      email: 'student.82@school.local',
      phone: null,
      avatarUrl: null,
    };
    const update = vi.fn().mockResolvedValue({ id: studentId, archived_at: null });
    const findStudent = vi.fn()
      .mockResolvedValueOnce({ id: studentId, enrollmentNumber: 'ENR-0082' })
      .mockResolvedValueOnce(null);
    prisma.userRole.findMany.mockResolvedValue([{ role: 'school_admin', schoolId }]);
    prisma.archivedUser.findUnique.mockResolvedValue(archived);
    prisma.$transaction.mockImplementation(async (callback) => callback({
      student: {
        findFirst: findStudent,
        update,
        create: vi.fn(),
      },
      archivedUser: { delete: vi.fn() },
      profile: { findUnique: vi.fn(), upsert: vi.fn() },
    }));
    const handler = lastRouteHandler(archivedUsersRouter, '/restore/:id');
    const req = { params: { id: 'archive-1' }, user: { userId: 'admin-1' } };
    const res = responseMock();

    await handler(req, res);

    expect(update).toHaveBeenCalledWith({
      where: { id: studentId },
      data: { archived_at: null },
    });
    expect(res.json.mock.calls[0][0].data.id).toBe(studentId);
  });

  it('treats an existing enrollment import as a no-op and preserves its credentials', async () => {
    prisma.userRole.findFirst
      .mockResolvedValueOnce({ role: 'school_admin', schoolId })
      .mockResolvedValueOnce(null);
    prisma.school.findUnique.mockResolvedValue({ id: schoolId });
    prisma.student.findFirst.mockResolvedValue({
      id: studentId,
      userId: studentUserId,
      schoolId,
      enrollmentNumber: 'ENR-0082',
      profile: {
        fullName: 'Student Example',
        email: 'student.82@school.local',
        loginId: 'student-82',
        phone: null,
      },
    });
    const req = {
      user: { userId: 'admin-1' },
      body: {
        login_id: 'different-id',
        password: 'a-different-password',
        full_name: 'Updated Name',
        role: 'student',
        school_id: schoolId,
        enrollment_number: 'ENR-0082',
      },
    };
    const res = responseMock();

    await createUser(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].existing).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.profile.findFirst).not.toHaveBeenCalled();
  });

  it('scopes duplicate enrollment detection to the target school', async () => {
    const otherSchoolId = '8b74b90f-54f2-4d8e-9c25-f5212fc8f5c1';
    const profileCreate = vi.fn(({ data }) => Promise.resolve({
      ...data,
      avatarUrl: null,
      mustChangePassword: false,
      preferredLanguage: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const studentCreate = vi.fn().mockResolvedValue({
      id: 'student-school-b',
      userId: 'student-user-b',
      schoolId: otherSchoolId,
      enrollmentNumber: 'SHARED-ENROLLMENT',
    });
    const tx = {
      profile: { create: profileCreate },
      userRole: { create: vi.fn().mockResolvedValue({}) },
      membership: { create: vi.fn().mockResolvedValue({}) },
      student: { create: studentCreate },
    };
    prisma.userRole.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: 'super_admin', schoolId: null });
    prisma.school.findUnique.mockResolvedValue({ id: otherSchoolId });
    prisma.student.findFirst.mockResolvedValue(null);
    prisma.profile.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    prisma.userRole.findMany.mockResolvedValue([{ id: 'role-2', role: 'student', schoolId: otherSchoolId }]);
    const req = {
      user: { userId: 'admin-1' },
      body: {
        login_id: 'school-b-student',
        password: 'student-password',
        full_name: 'Student in School B',
        role: 'student',
        school_id: otherSchoolId,
        enrollment_number: 'SHARED-ENROLLMENT',
      },
    };
    const res = responseMock();

    await createUser(req as never, res as never);

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: { schoolId: otherSchoolId, enrollmentNumber: 'SHARED-ENROLLMENT' },
      include: expect.any(Object),
    });
    expect(studentCreate.mock.calls[0][0].data).toMatchObject({
      schoolId: otherSchoolId,
      enrollmentNumber: 'SHARED-ENROLLMENT',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
