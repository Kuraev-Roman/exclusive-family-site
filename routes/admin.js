const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const db = require('../utils/db');
const { requireAdmin, requireStaff } = require('../utils/middleware');

// Базовый доступ к /admin/* — админ или зам.админа
router.use(requireStaff);

// ---------- ГЛАВНАЯ АДМИН-ПАНЕЛЬ ----------
router.get('/', (req, res) => {
  res.render('admin-dashboard', {
    usersCount: db.get('users').size().value(),
    birthdaysCount: db.get('birthdays').size().value(),
    krajNewCount: db.get('kraj').filter({ status: 'new' }).size().value(),
    newsCount: db.get('news').size().value(),
    pollsCount: db.get('polls').size().value(),
    applicationsNewCount: db.get('applications').filter({ status: 'new' }).size().value(),
    albumCount: db.get('album').size().value(),
    faqCount: db.get('faq').size().value(),
    isFullAdmin: req.session.user.role === 'admin'
  });
});

// ---------- ПОЛЬЗОВАТЕЛИ (только полный админ) ----------
router.get('/users', requireAdmin, (req, res) => {
  res.render('admin-users', { users: db.get('users').value(), error: null, success: null });
});

router.post('/users/create', requireAdmin, (req, res) => {
  const { nickname, password, role } = req.body;
  const render = (error, success) =>
    res.render('admin-users', { users: db.get('users').value(), error, success });

  if (!nickname || !password) return render('Заполните ник и пароль.', null);
  if (db.get('users').find({ nickname }).value()) return render('Такой ник уже занят.', null);

  const allowedRoles = ['member', 'deputy', 'admin'];
  db.get('users').push({
    id: Date.now(),
    nickname: nickname.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: allowedRoles.includes(role) ? role : 'member',
    createdAt: new Date().toISOString()
  }).write();

  render(null, `Аккаунт "${nickname}" создан.`);
});

router.post('/users/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.get('users').find({ id }).value();
  if (user && user.nickname === 'admin') {
    return res.render('admin-users', {
      users: db.get('users').value(),
      error: 'Нельзя удалить главного администратора.',
      success: null
    });
  }
  db.get('users').remove({ id }).write();
  res.redirect('/admin/users');
});

router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.render('admin-users', {
      users: db.get('users').value(),
      error: 'Пароль должен быть от 4 символов.',
      success: null
    });
  }
  db.get('users').find({ id }).assign({ passwordHash: bcrypt.hashSync(newPassword, 10) }).write();
  res.render('admin-users', {
    users: db.get('users').value(),
    error: null,
    success: 'Пароль пользователя сброшен.'
  });
});

router.post('/users/:id/role', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { role } = req.body;
  const user = db.get('users').find({ id }).value();
  const allowedRoles = ['member', 'deputy', 'admin'];

  if (user && user.nickname === 'admin') {
    return res.render('admin-users', {
      users: db.get('users').value(),
      error: 'Нельзя менять роль главного администратора.',
      success: null
    });
  }
  if (!allowedRoles.includes(role)) {
    return res.render('admin-users', {
      users: db.get('users').value(),
      error: 'Некорректная роль.',
      success: null
    });
  }

  db.get('users').find({ id }).assign({ role }).write();
  res.render('admin-users', {
    users: db.get('users').value(),
    error: null,
    success: 'Роль обновлена.'
  });
});

// Публичная карточка контакта (для страницы "Администрация") — только полный админ
router.post('/users/:id/contact', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { publicTitle, contactUrl, showOnContacts } = req.body;

  db.get('users').find({ id }).assign({
    publicTitle: (publicTitle || '').trim().slice(0, 60),
    contactUrl: (contactUrl || '').trim(),
    showOnContacts: showOnContacts === 'on'
  }).write();

  res.render('admin-users', {
    users: db.get('users').value(),
    error: null,
    success: 'Контактные данные обновлены.'
  });
});

// ---------- ДНИ РОЖДЕНИЯ ----------
const importUpload = multer({ dest: path.join(__dirname, '..', 'data', 'tmp') });

const bdayPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'avatars')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `bday_${Date.now()}${ext}`);
  }
});
const bdayPhotoUpload = multer({ storage: bdayPhotoStorage, limits: { fileSize: 6 * 1024 * 1024 } });

router.get('/birthdays', (req, res) => {
  const rows = db.get('birthdays').sortBy(['month', 'day']).value();
  res.render('admin-birthdays', { rows, error: null, success: null });
});

router.post('/birthdays/add', bdayPhotoUpload.single('photo'), (req, res) => {
  const { nickname, day, month } = req.body;
  const d = Number(day), m = Number(month);
  const render = (error, success) =>
    res.render('admin-birthdays', {
      rows: db.get('birthdays').sortBy(['month', 'day']).value(), error, success
    });

  if (!nickname || !d || !m || d < 1 || d > 31 || m < 1 || m > 12) {
    return render('Проверьте ник, день (1-31) и месяц (1-12).', null);
  }

  db.get('birthdays').push({
    id: Date.now(),
    nickname: nickname.trim(),
    day: d,
    month: m,
    photo: req.file ? `/uploads/avatars/${req.file.filename}` : null
  }).write();
  render(null, `Добавлено: ${nickname}`);
});

router.post('/birthdays/:id/photo', bdayPhotoUpload.single('photo'), (req, res) => {
  if (req.file) {
    db.get('birthdays').find({ id: Number(req.params.id) })
      .assign({ photo: `/uploads/avatars/${req.file.filename}` }).write();
  }
  res.redirect('/admin/birthdays');
});

router.post('/birthdays/:id/delete', (req, res) => {
  db.get('birthdays').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/birthdays');
});

// Импорт таблицы Excel (.xlsx) или CSV с колонками Nickname / День / Месяц (или дата)
router.post('/birthdays/import', importUpload.single('file'), (req, res) => {
  const render = (error, success) =>
    res.render('admin-birthdays', {
      rows: db.get('birthdays').sortBy(['month', 'day']).value(), error, success
    });

  if (!req.file) return render('Выберите файл .xlsx или .csv для импорта.', null);

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let entries = [];

    if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      entries = records.map(r => normalizeRow(r));
    } else {
      const wb = XLSX.readFile(req.file.path, { cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
      entries = json.map(r => normalizeRow(r));
    }

    entries = entries.filter(e => e && e.nickname && e.day && e.month);

    entries.forEach((e, idx) => {
      db.get('birthdays').push({
        id: Date.now() + idx,
        nickname: e.nickname,
        day: e.day,
        month: e.month
      }).write();
    });

    fs.unlinkSync(req.file.path);
    render(null, `Импортировано записей: ${entries.length}`);
  } catch (err) {
    console.error(err);
    render('Не удалось разобрать файл. Проверьте формат колонок.', null);
  }
});

// Пытаемся найти ник/день/месяц в разных возможных названиях колонок
function normalizeRow(r) {
  const keys = Object.keys(r);
  const findKey = (patterns) =>
    keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));

  const nickKey = findKey(['nick', 'ник', 'имя']);
  const dayKey = findKey(['день', 'day']);
  const monthKey = findKey(['месяц', 'month']);
  const dateKey = findKey(['дата', 'date']);

  const nickname = nickKey ? String(r[nickKey]).trim() : null;
  let day = dayKey ? parseInt(r[dayKey], 10) : null;
  let month = monthKey ? parseInt(r[monthKey], 10) : null;

  if ((!day || !month) && dateKey && r[dateKey]) {
    const d = new Date(r[dateKey]);
    if (!isNaN(d.getTime())) {
      day = d.getDate();
      month = d.getMonth() + 1;
    }
  }

  if (!nickname || !day || !month) return null;
  return { nickname, day, month };
}

// ---------- НОВОСТИ / ЛЕНТА (копипаст из телеграм-канала) ----------
const newsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'news')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `news_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const newsUpload = multer({ storage: newsStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/news', (req, res) => {
  res.render('admin-news', { items: db.get('news').sortBy('createdAt').reverse().value(), error: null, success: null });
});

router.post('/news/create', newsUpload.array('images', 6), (req, res) => {
  const { text, videoUrl } = req.body;
  const render = (error, success) =>
    res.render('admin-news', {
      items: db.get('news').sortBy('createdAt').reverse().value(), error, success
    });

  if (!text && (!req.files || req.files.length === 0) && !videoUrl) {
    return render('Добавьте текст, фото или ссылку на видео.', null);
  }

  db.get('news').push({
    id: Date.now(),
    text: (text || '').trim(),
    images: (req.files || []).map(f => `/uploads/news/${f.filename}`),
    videoUrl: (videoUrl || '').trim(),
    createdAt: new Date().toISOString()
  }).write();

  render(null, 'Пост опубликован.');
});

router.post('/news/:id/delete', (req, res) => {
  db.get('news').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/news');
});

// ---------- ИНТЕРАКТИВЫ / ГОЛОСОВАНИЯ ----------
const pollImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'news')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `poll_${Date.now()}${ext}`);
  }
});
const pollImageUpload = multer({ storage: pollImageStorage, limits: { fileSize: 8 * 1024 * 1024 } });

router.get('/interactives', (req, res) => {
  res.render('admin-interactives', {
    polls: db.get('polls').sortBy('createdAt').reverse().value(),
    error: null, success: null
  });
});

router.post('/interactives/create', pollImageUpload.single('image'), (req, res) => {
  const { question } = req.body;
  const options = (req.body.options || '')
    .split('\n')
    .map(o => o.trim())
    .filter(Boolean);

  const render = (error, success) =>
    res.render('admin-interactives', {
      polls: db.get('polls').sortBy('createdAt').reverse().value(), error, success
    });

  if (!question || options.length < 2) {
    return render('Введите вопрос и минимум 2 варианта ответа (каждый с новой строки).', null);
  }

  db.get('polls').push({
    id: Date.now(),
    question: question.trim(),
    image: req.file ? `/uploads/news/${req.file.filename}` : null,
    options: options.map(text => ({ text, votes: 0 })),
    voters: [],
    status: 'active',
    createdAt: new Date().toISOString()
  }).write();

  render(null, 'Голосование создано.');
});

router.post('/interactives/:id/close', (req, res) => {
  db.get('polls').find({ id: Number(req.params.id) }).assign({ status: 'closed' }).write();
  res.redirect('/admin/interactives');
});

router.post('/interactives/:id/delete', (req, res) => {
  db.get('polls').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/interactives');
});

// ---------- ЗАЯВКИ НА ВСТУПЛЕНИЕ ----------
router.get('/applications', (req, res) => {
  res.render('admin-applications', {
    applications: db.get('applications').sortBy('createdAt').reverse().value()
  });
});

router.post('/applications/:id/resolve', (req, res) => {
  db.get('applications').find({ id: Number(req.params.id) }).assign({ status: 'resolved' }).write();
  res.redirect('/admin/applications');
});

router.post('/applications/:id/delete', (req, res) => {
  db.get('applications').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/applications');
});

// ---------- АЛЬБОМ (фото и видео) ----------
const albumStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'album')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `album_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const albumUpload = multer({
  storage: albumStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // до 60MB — под короткие видео
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    cb(null, ok);
  }
});

router.get('/album', (req, res) => {
  res.render('admin-album', {
    items: db.get('album').sortBy('createdAt').reverse().value(),
    error: null, success: null
  });
});

router.post('/album/upload', albumUpload.array('files', 10), (req, res) => {
  const render = (error, success) =>
    res.render('admin-album', {
      items: db.get('album').sortBy('createdAt').reverse().value(), error, success
    });

  if (!req.files || req.files.length === 0) return render('Выберите хотя бы один файл.', null);

  const caption = (req.body.caption || '').trim().slice(0, 300);

  req.files.forEach((f, idx) => {
    const isVideo = f.mimetype.startsWith('video/');
    db.get('album').push({
      id: Date.now() + idx,
      type: isVideo ? 'video' : 'photo',
      path: `/uploads/album/${f.filename}`,
      caption,
      createdAt: new Date().toISOString()
    }).write();
  });

  render(null, `Загружено файлов: ${req.files.length}`);
});

router.post('/album/:id/delete', (req, res) => {
  db.get('album').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/album');
});

// ---------- НАСТРОЙКИ: ССЫЛКИ НА СОЦСЕТИ (только полный админ) ----------
router.get('/settings', requireAdmin, (req, res) => {
  res.render('admin-settings', {
    socialLinks: db.get('settings.socialLinks').value() || [],
    joinIntro: db.get('settings.joinIntro').value() || '',
    joinCriteria: db.get('settings.joinCriteria').value() || [],
    guideIntro: db.get('settings.guideIntro').value() || '',
    error: null, success: null
  });
});

function renderSettings(req, res, error, success) {
  res.render('admin-settings', {
    socialLinks: db.get('settings.socialLinks').value() || [],
    joinIntro: db.get('settings.joinIntro').value() || '',
    joinCriteria: db.get('settings.joinCriteria').value() || [],
    guideIntro: db.get('settings.guideIntro').value() || '',
    error, success
  });
}

router.post('/settings/social/add', requireAdmin, (req, res) => {
  const { label, url } = req.body;
  if (!label || !url) return renderSettings(req, res, 'Укажите название и ссылку.', null);

  db.get('settings.socialLinks').push({
    id: Date.now(),
    label: label.trim(),
    url: url.trim()
  }).write();

  renderSettings(req, res, null, 'Ссылка добавлена.');
});

router.post('/settings/social/:id/delete', requireAdmin, (req, res) => {
  db.get('settings.socialLinks').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/settings');
});

// Условия вступления (текст на странице /join)
router.post('/settings/join-intro', requireAdmin, (req, res) => {
  db.set('settings.joinIntro', (req.body.joinIntro || '').trim()).write();
  renderSettings(req, res, null, 'Текст обновлён.');
});

router.post('/settings/join-criteria/add', requireAdmin, (req, res) => {
  const { icon, text } = req.body;
  if (!text) return renderSettings(req, res, 'Укажите текст условия.', null);

  db.get('settings.joinCriteria').push({
    id: Date.now(),
    icon: (icon || '✅').trim(),
    text: text.trim()
  }).write();

  renderSettings(req, res, null, 'Условие добавлено.');
});

router.post('/settings/join-criteria/:id/delete', requireAdmin, (req, res) => {
  db.get('settings.joinCriteria').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/settings');
});

// Текст гайда для новичков
router.post('/settings/guide-intro', requireAdmin, (req, res) => {
  db.set('settings.guideIntro', (req.body.guideIntro || '').trim()).write();
  renderSettings(req, res, null, 'Текст гайда обновлён.');
});

// ---------- FAQ (админ или зам.админа) ----------
router.get('/faq', (req, res) => {
  res.render('admin-faq', {
    items: db.get('faq').value(),
    error: null, success: null
  });
});

router.post('/faq/add', (req, res) => {
  const { question, answer } = req.body;
  const render = (error, success) =>
    res.render('admin-faq', { items: db.get('faq').value(), error, success });

  if (!question || !answer) return render('Заполните вопрос и ответ.', null);

  db.get('faq').push({
    id: Date.now(),
    question: question.trim(),
    answer: answer.trim()
  }).write();

  render(null, 'Вопрос добавлен.');
});

router.post('/faq/:id/delete', (req, res) => {
  db.get('faq').remove({ id: Number(req.params.id) }).write();
  res.redirect('/admin/faq');
});

module.exports = router;
