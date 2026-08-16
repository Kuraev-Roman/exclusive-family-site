const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('../utils/db');
const { requireAuth } = require('../utils/middleware');

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `avatar_${req.session.user.id}_${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

// --- Страница входа ---
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { nickname, password } = req.body;
  const user = db.get('users').find({ nickname }).value();

  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.render('login', { error: 'Неверный ник или пароль.' });
  }

  req.session.user = {
    id: user.id,
    nickname: user.nickname,
    role: user.role,
    portals: user.portals || []
  };
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- Профиль: аватар + смена пароля (доступно любому авторизованному) ---
router.get('/profile', requireAuth, (req, res) => {
  const user = db.get('users').find({ id: req.session.user.id }).value();
  res.render('profile', { error: null, success: null, user });
});

router.post('/profile/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  const render = (error, success) => {
    const user = db.get('users').find({ id: req.session.user.id }).value();
    res.render('profile', { error, success, user });
  };
  if (!req.file) return render('Выберите изображение.', null);

  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  db.get('users').find({ id: req.session.user.id }).assign({ avatarPath }).write();

  // Синхронизируем фото с записью дня рождения по совпадению ника
  const me = db.get('users').find({ id: req.session.user.id }).value();
  db.get('birthdays').filter({ nickname: me.nickname }).each(b => {
    db.get('birthdays').find({ id: b.id }).assign({ photo: avatarPath }).write();
  }).value();

  render(null, 'Фото профиля обновлено.');
});

router.post('/profile/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword, newPasswordRepeat } = req.body;
  const user = db.get('users').find({ id: req.session.user.id }).value();

  if (!user || !bcrypt.compareSync(currentPassword || '', user.passwordHash)) {
    return res.render('profile', { error: 'Текущий пароль неверный.', success: null });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.render('profile', { error: 'Новый пароль должен быть от 4 символов.', success: null });
  }
  if (newPassword !== newPasswordRepeat) {
    return res.render('profile', { error: 'Пароли не совпадают.', success: null });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.get('users').find({ id: user.id }).assign({ passwordHash: hash }).write();
  res.render('profile', { error: null, success: 'Пароль успешно изменён.' });
});

module.exports = router;
