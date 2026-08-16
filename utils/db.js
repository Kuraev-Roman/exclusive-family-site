const low = require('lowdb');
const Memory = require('lowdb/adapters/Memory');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Если задана переменная окружения DATABASE_URL (Neon/Postgres) — данные
// хранятся там и переживают перезапуски/передеплои. Если её нет — работаем
// по-старому, в локальном JSON-файле (удобно для разработки на своём ПК).
const DATABASE_URL = process.env.DATABASE_URL;
const usePostgres = !!DATABASE_URL;

let db;
let pgPool = null;

if (usePostgres) {
  db = low(new Memory());
} else {
  const dbFile = path.join(__dirname, '..', 'data', 'db.json');
  db = low(new FileSync(dbFile));
}

// ---------- Дефолты и сидирование (одинаковые для обоих режимов) ----------

function applyDefaultsAndSeed() {
  db.defaults({
    users: [],
    birthdays: [],
    kraj: [],
    news: [],
    minions: [],
    polls: [],
    applications: [],
    album: [],
    faq: [],
    questions: [],
    settings: {
      siteName: 'EXCLUSIVE FAMILY',
      tagline: 'Strength · Loyalty · Honor',
      socialLinks: [],
      telegramOffset: 0
    }
  }).write();

  if (!db.get('settings.socialLinks').value()) {
    db.set('settings.socialLinks', []).write();
  }

  seedFaq();

  seedAdmin();
  seedBirthdays();
  seedMinions();
}

function seedAdmin() {
  const users = db.get('users').value();
  if (!users.find(u => u.role === 'admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.get('users').push({
      id: Date.now(),
      nickname: 'admin',
      passwordHash: hash,
      role: 'admin',
      roleTitle: 'Глава семьи',
      contact: '',
      portals: [],
      createdAt: new Date().toISOString()
    }).write();
    console.log('>>> Создан аккаунт администратора: логин "admin", пароль "admin123" (смените после первого входа)');
  }
}

function seedFaq() {
  const existing = db.get('faq').value();
  if (existing.length === 0) {
    db.set('faq', [
      {
        id: Date.now(),
        question: 'Как вступить в семью?',
        answer: 'Заполните заявку на странице «Вступить» — укажите ник, контакт и немного расскажите о себе. Админ или зам. админа свяжутся с вами.',
        order: 1
      },
      {
        id: Date.now() + 1,
        question: 'Кто может создать мне аккаунт на сайте?',
        answer: 'Аккаунты выдают только администратор и заместители администратора после одобрения заявки на вступление.',
        order: 2
      },
      {
        id: Date.now() + 2,
        question: 'Куда писать, если у меня вопрос лично к админу?',
        answer: 'Откройте раздел «Связь с администрацией» — там список админов и замов с контактами, либо форма личного вопроса.',
        order: 3
      }
    ]).write();
  }
}

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
      { id: 1, text: '⚠️ Внимание: при миньонах ничего не говорим — стучат админу за банан 🍌' },
      { id: 2, text: '⚠️ Внимание: миньон в чате — сохраняй скрины, потом пригодится в «Кражах» 🍌📸' },
      { id: 3, text: '⚠️ Внимание: если миньон молчит — значит уже донёс админу 👀🍌' },
      { id: 4, text: '⚠️ Внимание: пароль не подошёл трижды — миньон уже летит с докладом 🍌🚨' },
      { id: 5, text: '⚠️ Внимание: у именинника миньон отжимает банан без очереди 🍌🎂' },
      { id: 6, text: '⚠️ Внимание: миньоны голосуют за пейнтбол в каждом опросе, не ведитесь 🍌🗳️' }
    ]).write();
  }
}

// ---------- Режим Postgres (Neon) ----------

let ready;

if (usePostgres) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let replicateTimer = null;
  const replicateNow = async () => {
    try {
      const state = JSON.stringify(db.getState());
      await pgPool.query(
        `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, updated_at = now()`,
        [state]
      );
    } catch (err) {
      console.error('>>> Не удалось сохранить данные в Postgres:', err.message);
    }
  };
  const scheduleReplicate = () => {
    clearTimeout(replicateTimer);
    replicateTimer = setTimeout(replicateNow, 400);
  };

  ready = (async () => {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id smallint PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const { rows } = await pgPool.query('SELECT data FROM app_state WHERE id = 1');
      if (rows.length) {
        db.setState(rows[0].data);
        console.log('>>> Состояние базы данных загружено из Postgres (Neon)');
      } else {
        console.log('>>> В Postgres пока нет данных — создаю начальное состояние');
      }

      applyDefaultsAndSeed();
      await replicateNow(); // сразу сохранить (в т.ч. дефолты/сидинг) в Postgres

      // После первого сохранения — каждый .write() автоматически реплицируется
      const originalWrite = db.write.bind(db);
      db.write = function (...args) {
        const result = originalWrite(...args);
        scheduleReplicate();
        return result;
      };
    } catch (err) {
      console.error('>>> Ошибка подключения к Postgres — сайт работает во временном режиме (данные НЕ сохраняются между перезапусками):', err.message);
      applyDefaultsAndSeed();
    }
  })();
} else {
  applyDefaultsAndSeed();
  ready = Promise.resolve();
}

db.ready = ready;
module.exports = db;
