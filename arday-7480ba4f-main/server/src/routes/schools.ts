import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createSchoolSchema,
  updateSchoolSchema,
  updateSchoolStatusSchema,
} from '../validators/schools.js';
import {
  listSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  updateSchoolStatus,
  getSchoolDashboard,
} from '../controllers/schoolController.js';

const router = Router();

router.get('/', requireAuth, listSchools);
router.get('/:id', requireAuth, getSchoolById);
router.post('/', requireAuth, validate(createSchoolSchema), createSchool);
router.put('/:id', requireAuth, validate(updateSchoolSchema), updateSchool);
router.delete('/:id', requireAuth, requireSuperAdmin, deleteSchool);
router.put('/:id/status', requireAuth, requireSuperAdmin, validate(updateSchoolStatusSchema), updateSchoolStatus);
router.get('/:id/dashboard', requireAuth, getSchoolDashboard);

export default router;
