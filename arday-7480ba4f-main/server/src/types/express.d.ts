import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
      /**
       * Canonical school context resolved by `requireSchoolAccess`.
       * Every tenant-scoped handler must use this value instead of reading
       * `school_id` from params/query/body directly.
       *
       * - A concrete id means the caller has been verified for that school.
       * - `undefined` is only possible for a global super admin.
       */
      schoolId?: string;
    }
  }
}
