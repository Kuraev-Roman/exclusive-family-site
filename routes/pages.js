const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAuth } = require('../utils/middleware');

const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function getTodaysBirthdays() {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  return db.get('birthdays').filter({ day, month }).value();
}

function getActivePoll() {
  return db.get('polls').filter({ status: 'active' }).sortBy('createdAt').last().value() || null;
}

router.get('/', (req, res) => {
  const news = db.get('news').sortBy('createdAt').reverse().take(3).value();
  const todaysBirthdays = getTodaysBirthdays();

  const today = new Date();
  const todayKey = (today.getMonth() + 1) * 100 + today.getDate();
  const all = db.get('birthdays').value()
    .map(b => ({ ...b, key: b.month * 100 + b.day }))
    .sort((a, b) => a.key - b.key);
  const upcoming = all.filter(b => b.key >= todayKey).concat(all.filter(b => b.key < todayKey)).slice(0, 5);

  const activePoll = getActivePoll();

  const jokes = db.get('minions').value();
  const joke = jokes.length ? jokes[Math.floor(Math.random() * jokes.length)] : null;

  res.render('index', { news, upcoming, todaysBirthdays, activePoll, MONTHS, joke });
});

router.get('/birthdays', (req, res) => {
  const rows = db.get('birthdays').value();
  const grouped = {};
  for (let m = 1; m <= 12; m++) grouped[m] = [];
  rows.forEach(r => { if (grouped[r.month]) grouped[r.month].push(r); });
  Object.keys(grouped).forEach(m => grouped[m].sort((a, b) => a.day - b.day));
  const todaysBirthdays = getTodaysBirthdays();
  res.render('birthdays', { grouped, MONTHS, todaysBirthdays });
});

router.get('/news', (req, res) => {
  const items = db.get('news').sortBy('createdAt').reverse().value();
  res.render('news', { items });
});

// Отдельная страница одного поста — чтобы на него можно было дать прямую ссылку
router.get('/news/:id', (req, res) => {
  const item = db.get('news').find({ id: Number(req.params.id) }).value();
  if (!item) return res.status(404).render('404');
  res.render('news-post', { item });
});

router.get('/minions', (req, res) => {
  const jokes = db.get('minions').value();
  res.render('minions', { jokes });
});

// ---------- АЛЬБОМ (фото и видео) ----------
router.get('/album', (req, res) => {
  const items = db.get('album').sortBy('createdAt').reverse().value();
  res.render('album', { items });
});

// ---------- ИНТЕРАКТИВЫ / ГОЛОСОВАНИЯ ----------
router.get('/interactives', (req, res) => {
  const polls = db.get('polls').sortBy('createdAt').reverse().value();
  const userId = req.session.user ? req.session.user.id : null;
  res.render('interactives', { polls, userId, error: null });
});

router.post('/interactives/:id/vote', requireAuth, (req, res) => {
  const poll = db.get('polls').find({ id: Number(req.params.id) }).value();
  const optionIndex = Number(req.body.optionIndex);
  const userId = req.session.user.id;

  if (!poll || poll.status !== 'active' || !poll.options[optionIndex]) {
    return res.redirect('/interactives');
  }
  if (poll.voters && poll.voters.includes(userId)) {
    return res.redirect('/interactives'); // уже голосовал
  }

  db.get('polls').find({ id: poll.id }).update('options', opts => {
    opts[optionIndex].votes = (opts[optionIndex].votes || 0) + 1;
    return opts;
  }).update('voters', v => { (v || []).push(userId); return v || [userId]; }).write();

  res.redirect('/interactives');
});

// ---------- ВСТУПЛЕНИЕ В СЕМЬЮ (без регистрации) ----------
router.get('/join', (req, res) => {
  res.render('join', { error: null, success: null });
});

router.post('/join', (req, res) => {
  const { nickname, contact, rank, activity, donation, message } = req.body;
  if (!nickname || !contact) {
    return res.render('join', { error: 'Укажите ник и контакт (телеграм) для связи.', success: null });
  }
  db.get('applications').push({
    id: Date.now(),
    nickname: nickname.trim(),
    contact: contact.trim(),
    rank: (rank || '').trim().slice(0, 40),
    activity: (activity || '').trim().slice(0, 40),
    donation: (donation || '').trim().slice(0, 40),
    message: (message || '').trim().slice(0, 800),
    status: 'new',
    createdAt: new Date().toISOString()
  }).write();
  res.render('join', { error: null, success: 'Заявка отправлена! Админ свяжется с вами в ближайшее время.' });
});

// ---------- FAQ ----------
router.get('/faq', (req, res) => {
  const items = db.get('faq').sortBy('order').value();
  res.render('faq', { items });
});

// ---------- НАВИГАЦИЯ ДЛЯ НОВИЧКОВ ----------
router.get('/guide', (req, res) => {
  res.render('guide');
});

// ---------- СВЯЗЬ С АДМИНИСТРАЦИЕЙ ----------
router.get('/team', (req, res) => {
  const team = db.get('users')
    .filter(u => u.role === 'admin' || u.role === 'deputy')
    .sortBy(u => (u.role === 'admin' ? 0 : 1))
    .value();
  res.render('team', {
    team,
    socialLinks: db.get('settings.socialLinks').value() || [],
    error: null, success: null
  });
});

router.post('/team/ask', (req, res) => {
  const { toUserId, fromNickname, fromContact, message } = req.body;
  const team = db.get('users').filter(u => u.role === 'admin' || u.role === 'deputy').value();
  const socialLinks = db.get('settings.socialLinks').value() || [];

  const render = (error, success) => res.render('team', { team, socialLinks, error, success });

  if (!fromNickname || !fromContact || !message) {
    return render('Заполните ник, контакт для ответа и сам вопрос.', null);
  }

  const target = toUserId ? db.get('users').find({ id: Number(toUserId) }).value() : null;

  db.get('questions').push({
    id: Date.now(),
    toUserId: target ? target.id : null,
    toNickname: target ? target.nickname : 'Вся администрация',
    fromNickname: fromNickname.trim(),
    fromContact: fromContact.trim(),
    message: message.trim().slice(0, 800),
    status: 'new',
    createdAt: new Date().toISOString()
  }).write();

  render(null, 'Вопрос отправлен! Администрация ответит вам по указанному контакту.');
});

module.exports = router;
