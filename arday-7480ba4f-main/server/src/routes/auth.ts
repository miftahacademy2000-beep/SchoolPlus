import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from '../validators/auth.js';
import {
  login,
  register,
  getMe,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  updatePassword,
} from '../controllers/authController.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', validate(registerSchema), register);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

router.get('/me', requireAuth, getMe);
router.post('/update-password', requireAuth, validate(updatePasswordSchema), updatePassword);

export default router;
