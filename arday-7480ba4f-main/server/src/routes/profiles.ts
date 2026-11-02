import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadAvatars } from '../middleware/upload.js';
import { updateProfileSchema, saveSettingsSchema } from '../validators/profiles.js';
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  deleteAvatar,
  saveSettings,
  getSettings,
} from '../controllers/profileController.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, validate(updateProfileSchema), updateMyProfile);
router.post('/me/avatar', requireAuth, uploadAvatars.single('avatar'), uploadAvatar);
router.delete('/me/avatar', requireAuth, deleteAvatar);
router.post('/me/settings', requireAuth, validate(saveSettingsSchema), saveSettings);
router.get('/me/settings', requireAuth, getSettings);

export default router;
