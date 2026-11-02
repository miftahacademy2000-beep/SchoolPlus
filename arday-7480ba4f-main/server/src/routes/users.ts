import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  updateCredentialsSchema,
  addRoleSchema,
} from '../validators/users.js';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  addRole,
  removeRole,
  updateCredentials,
} from '../controllers/userController.js';

const router = Router();

router.get('/', requireAuth, requireSuperAdmin, listUsers);
router.post('/', requireAuth, validate(createUserSchema), createUser);
router.post('/update-credentials', requireAuth, validate(updateCredentialsSchema), updateCredentials);
router.get('/:id', requireAuth, getUserById);
router.put('/:id', requireAuth, validate(updateUserSchema), updateUser);
router.delete('/:id', requireAuth, deleteUser);
router.post('/:id/roles', requireAuth, validate(addRoleSchema), addRole);
router.delete('/:id/roles/:roleId', requireAuth, removeRole);

export default router;
