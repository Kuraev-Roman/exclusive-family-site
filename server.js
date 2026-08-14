const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'exclusive-family-super-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 дней
}));

// Прокидываем текущего пользователя во все шаблоны
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.settings = db.get('settings').value();
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/pages'));
app.use('/admin', require('./routes/admin'));
app.use('/kraj', require('./routes/kraj'));

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`\n=== EXCLUSIVE FAMILY сайт запущен ===`);
  console.log(`Открой в браузере: http://localhost:${PORT}`);
  console.log(`Админ по умолчанию: admin / admin123\n`);
});
