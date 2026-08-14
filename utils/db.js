const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbFile = path.join(__dirname, '..', 'data', 'db.json');
const adapter = new FileSync(dbFile);
const db = low(adapter);

// Дефолтная структура базы данных
db.defaults({
  users: [],
  birthdays: [],
  kraj: [],          // сообщения раздела "Кражи" (жалобы/репорты с изображением)
  news: [],          // новости / посты с телеграм-канала
  minions: [],       // шутки про миньонов
  polls: [],         // интерактивы/голосования
  applications: [],  // заявки на вступление в семью (без регистрации)
  settings: {
    siteName: 'EXCLUSIVE FAMILY',
    tagline: 'Strength · Loyalty · Honor'
  }
}).write();

// Создаём админа по умолчанию, если пользователей ещё нет
function seedAdmin() {
  const users = db.get('users').value();
  if (!users.find(u => u.role === 'admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.get('users').push({
      id: Date.now(),
      nickname: 'admin',
      passwordHash: hash,
      role: 'admin',
      createdAt: new Date().toISOString()
    }).write();
    console.log('>>> Создан аккаунт администратора: логин "admin", пароль "admin123" (смените после первого входа)');
  }
}

// Импорт дней рождения из подготовленного JSON (один раз, если таблица пуста)
function seedBirthdays() {
  const existing = db.get('birthdays').value();
  if (existing.length === 0) {
    const importPath = path.join(__dirname, '..', 'data', 'birthdays-import.json');
    if (fs.existsSync(importPath)) {
      const raw = JSON.parse(fs.readFileSync(importPath, 'utf-8'));
      const rows = raw.map((r, idx) => ({
        id: Date.now() + idx,
        nickname: r.nickname,
        day: r.day,
        month: r.month
      }));
      db.set('birthdays', rows).write();
      console.log(`>>> Импортировано ${rows.length} дней рождения из Excel`);
    }
  }
}

function seedMinions() {
  const existing = db.get('minions').value();
  if (existing.length === 0) {
    db.set('minions', [
      { id: 1, text: 'Бело-жёлто-чёрная банда семьи EXCLUSIVE — миньоны тоже в доле 🍌' },
      { id: 2, text: 'Когда админ спит — миньоны охраняют раздел «Кражи» 👀🍌' },
      { id: 3, text: 'В семье EXCLUSIVE даже миньоны носят золотые короны 👑🍌' },
      { id: 4, text: 'Bello! Пароль не подошёл — миньон уже зовёт админа 🍌🚨' },
      { id: 5, text: 'Миньон-именинник получает банан вне очереди 🍌🎂' }
    ]).write();
  }
}

seedAdmin();
seedBirthdays();
seedMinions();

module.exports = db;
