const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../utils/db');
const { requireAuth, requirePortal } = require('../utils/middleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'kraj')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `kraj_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, okTypes.includes(file.mimetype));
  }
});

// Список сообщений/репортов — видно только админу
router.get('/', requirePortal('kraj'), (req, res) => {
  const items = db.get('kraj').sortBy('createdAt').reverse().value();
  res.render('kraj-admin', { items });
});

// Форма отправки сообщения (с картинкой) любым авторизованным пользователем
router.get('/send', requireAuth, (req, res) => {
  res.render('kraj-send', { error: null, success: null });
});

router.post('/send', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.render('kraj-send', { error: 'Прикрепите изображение.', success: null });
  }
  db.get('kraj').push({
    id: Date.now(),
    fromNickname: req.session.user.nickname,
    comment: (req.body.comment || '').slice(0, 500),
    imagePath: `/uploads/kraj/${req.file.filename}`,
    status: 'new',
    createdAt: new Date().toISOString()
  }).write();
  res.render('kraj-send', { error: null, success: 'Сообщение отправлено администратору.' });
});

// Админ отмечает репорт как рассмотренный
router.post('/:id/resolve', requirePortal('kraj'), (req, res) => {
  db.get('kraj').find({ id: Number(req.params.id) }).assign({ status: 'resolved' }).write();
  res.redirect('/kraj');
});

router.post('/:id/delete', requirePortal('kraj'), (req, res) => {
  db.get('kraj').remove({ id: Number(req.params.id) }).write();
  res.redirect('/kraj');
});

module.exports = router;
