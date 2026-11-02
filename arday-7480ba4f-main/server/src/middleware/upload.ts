import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createStorage(subdirectory: string) {
  const uploadPath = path.join(env.uploadDir, subdirectory);
  ensureDirectoryExists(uploadPath);

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });
}

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  cb(null, true);
};

export const uploadSchoolAssets = multer({
  storage: createStorage('school-assets'),
  limits: { fileSize: env.maxFileSize },
  fileFilter,
});

export const uploadAvatars = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: env.maxFileSize },
  fileFilter,
});

export const uploadLearningMaterials = multer({
  storage: createStorage('learning-materials'),
  limits: { fileSize: env.maxFileSize },
  fileFilter,
});

export const uploadPlatformAssets = multer({
  storage: createStorage('platform-assets'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for images
  fileFilter: (_req, file, cb) => {
    // SVG is excluded because it can contain executable scripts (XSS risk).
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed. SVG is not permitted for security reasons.'));
    }
  },
});
