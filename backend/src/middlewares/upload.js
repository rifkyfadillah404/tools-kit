const fs = require('fs');
const path = require('path');
const multer = require('multer');

const toolsUploadDir = path.join(__dirname, '../../uploads/tools');

if (!fs.existsSync(toolsUploadDir)) {
  fs.mkdirSync(toolsUploadDir, { recursive: true });
}

const sanitizeName = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, toolsUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const base = path.basename(file.originalname || 'tool-photo', ext);
    const safeBase = sanitizeName(base) || 'tool-photo';
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('File harus berupa gambar'));
    return;
  }

  cb(null, true);
};

const uploadToolPhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadToolPhoto,
  toolsUploadDir,
};
