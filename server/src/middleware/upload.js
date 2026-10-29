import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configurable upload size limits (bytes)
const MAX_VIDEO_BYTES = parseInt(process.env.MAX_VIDEO_UPLOAD_BYTES, 10) || 20 * 1024 * 1024; // 20 MB default
const MAX_FILE_BYTES = parseInt(process.env.MAX_FILE_UPLOAD_BYTES, 10) || 10 * 1024 * 1024;   // 10 MB default

// Allowed MIME types & extensions
const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
  'image/jpeg', 'image/png', 'image/webp'
]);
const ALLOWED_VIDEO_EXTS = new Set([
  '.mp4', '.webm', '.mov', '.mkv',
  '.jpg', '.jpeg', '.png', '.webp'
]);

const ALLOWED_MEDIA_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
]);
const ALLOWED_MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.txt']);

// Ensure uploads folder exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  },
});

// Video & Photo Multer Instance for Deepfake Lab
const videoMulter = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!ALLOWED_VIDEO_EXTS.has(ext) || !ALLOWED_VIDEO_MIMES.has(mime)) {
      const err = new Error(
        `Invalid video format or image format (${ext || mime}). Allowed video formats: MP4, WebM, MOV. Allowed image formats: JPG, PNG, WebP.`
      );
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  },
});

// Document/Image Multer Instance
const mediaMulter = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (!ALLOWED_MEDIA_EXTS.has(ext) || !ALLOWED_MEDIA_MIMES.has(mime)) {
      const err = new Error(
        `Invalid file format (${ext || mime}). Allowed formats: JPG, PNG, WebP, PDF, TXT.`
      );
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * Express middleware wrapper for video uploads with robust error responses
 */
export const handleVideoUpload = (req, res, next) => {
  videoMulter.single('video')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const limitMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
        return res.status(413).json({
          message: `Video file exceeds maximum allowed size of ${limitMb}MB. Please provide a shorter clip.`,
        });
      }
      return res.status(400).json({
        message: err.message || 'Video upload failed. Please verify format and size.',
      });
    }
    next();
  });
};

/**
 * Express middleware wrapper for image/document uploads with robust error responses
 */
export const handleMediaUpload = (req, res, next) => {
  mediaMulter.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
        return res.status(413).json({
          message: `File exceeds maximum allowed size of ${limitMb}MB.`,
        });
      }
      return res.status(400).json({
        message: err.message || 'File upload failed. Please verify format and size.',
      });
    }
    next();
  });
};
