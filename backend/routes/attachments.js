const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { optimizeImage, createThumbnail } = require('../middleware/imageOptimizer');
const db = require('../config/database');
const { logActivity } = require('../utils/logger');

router.use(authMiddleware);

// 업로드 디렉토리
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 허용 확장자
const allowedExts = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic',
  '.pdf', '.txt', '.rtf', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.hwp',
  '.zip', '.7z', '.rar',
  '.log'
]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    try {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      if (!ext) return cb(new Error('파일 확장자를 확인할 수 없습니다.'));
      if (!allowedExts.has(ext)) return cb(new Error(`허용되지 않는 파일 형식입니다: ${ext}`));
      return cb(null, true);
    } catch (e) {
      return cb(new Error('파일 형식 확인 중 오류가 발생했습니다.'));
    }
  }
});

// ============================================
// 업로드: attachments에 post_id NULL로 INSERT 후 id 반환
// ============================================
router.post('/upload', (req, res) => {
  upload.array('files', 5)(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || '업로드 실패' });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: '업로드할 파일이 없습니다.' });
      }

      const processed = await Promise.all(
        req.files.map(async (file) => {
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const absPath = path.join(__dirname, '../uploads', file.filename);

          const ext = path.extname(originalName).toLowerCase();
          const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic'].includes(ext);

          if (isImage) {
            await optimizeImage(absPath, { maxWidth: 1920, maxHeight: 1080, quality: 85 });
            await createThumbnail(absPath, 300);
          }

          return {
            filename: file.filename,
            original_filename: originalName,
            filepath: `uploads/${file.filename}`,
            filesize: file.size,
            mimetype: file.mimetype,
            is_image: isImage
          };
        })
      );

      const ids = [];
      for (const f of processed) {
        const [result] = await db.query(
          `INSERT INTO attachments
           (post_id, filename, original_filename, filepath, filesize, mimetype)
           VALUES (NULL, ?, ?, ?, ?, ?)`,
          [f.filename, f.original_filename, f.filepath, f.filesize, f.mimetype]
        );
        ids.push(result.insertId);
      }

      const fileNames = processed.map(f => f.original_filename).join(', ');
      logActivity('info', `파일 업로드: ${fileNames} (업로더: ${req.user.name})`, { userId: req.user.id, req });

      return res.status(201).json({
        success: true,
        message: '파일 업로드 성공',
        data: {
          attachment_ids: ids,
          files: processed.map((f, i) => ({
            id: ids[i],
            original_filename: f.original_filename,
            filename: f.filename,
            filepath: `/${f.filepath.replace(/\\/g, '/')}`,
            filesize: f.filesize,
            mimetype: f.mimetype,
            is_image: f.is_image
          }))
        }
      });
    } catch (error) {
      console.error('File upload error:', error);
      return res.status(500).json({
        success: false,
        message: error?.message || '파일 업로드 중 오류가 발생했습니다.'
      });
    }
  });
});

// ============================================
// 다운로드: /api/attachments/download/:id
// ============================================
router.get('/download/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: '잘못된 파일 ID입니다.' });
    }

    const [rows] = await db.query(
      'SELECT id, filename, original_filename, filepath FROM attachments WHERE id = ?',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '파일 정보를 찾을 수 없습니다.' });
    }

    const att = rows[0];

    // filepath는 "uploads/xxx" 형태
    const absPath = path.join(__dirname, '..', att.filepath);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: '파일이 서버에 존재하지 않습니다.' });
    }

    const downloadName = att.original_filename || att.filename || `file-${att.id}`;
    return res.download(absPath, downloadName);
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ success: false, message: '파일 다운로드 중 오류가 발생했습니다.' });
  }
});

module.exports = router;