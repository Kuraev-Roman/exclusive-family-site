// Автоимпорт постов из телеграм-канала в раздел "Новости".
// Работает через Telegram Bot API (long polling), без сторонних библиотек.
//
// Как настроить (см. README):
// 1. Создать бота через @BotFather, получить токен.
// 2. Добавить бота АДМИНОМ в свой канал вручную (по инвайт-ссылке бот сам
//    зайти не может — это ограничение Telegram, добавляет владелец канала).
// 3. Задать переменную окружения TELEGRAM_BOT_TOKEN на Render (Environment).
// Без токена модуль просто ничего не делает.

const fs = require('fs');
const path = require('path');
const db = require('./db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;
const FILE_API = TOKEN ? `https://api.telegram.org/file/bot${TOKEN}` : null;
const POLL_INTERVAL_MS = 15000;
const NEWS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'news');

function getOffset() {
  return db.get('settings.telegramOffset').value() || 0;
}
function setOffset(offset) {
  db.set('settings.telegramOffset', offset).write();
}

async function downloadTelegramFile(fileId, destName) {
  const fileInfoRes = await fetch(`${API}/getFile?file_id=${fileId}`);
  const fileInfo = await fileInfoRes.json();
  if (!fileInfo.ok) return null;

  const filePath = fileInfo.result.file_path;
  const ext = path.extname(filePath) || '';
  const localName = `${destName}${ext}`;
  const localPath = path.join(NEWS_DIR, localName);

  const fileRes = await fetch(`${FILE_API}/${filePath}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  return `/uploads/news/${localName}`;
}

async function processPost(post) {
  const images = [];
  let videoPath = null;
  const text = post.caption || post.text || '';

  try {
    if (post.photo && post.photo.length) {
      // Берём фото самого большого размера (последнее в массиве)
      const largest = post.photo[post.photo.length - 1];
      const savedPath = await downloadTelegramFile(largest.file_id, `tg_${post.message_id}_photo`);
      if (savedPath) images.push(savedPath);
    }
    if (post.video) {
      videoPath = await downloadTelegramFile(post.video.file_id, `tg_${post.message_id}_video`);
    }
  } catch (err) {
    console.error('Ошибка загрузки медиа из Telegram:', err.message);
  }

  if (!text && images.length === 0 && !videoPath) return; // пустое служебное сообщение — пропускаем

  db.get('news').push({
    id: Date.now() + post.message_id,
    text: text.trim(),
    images,
    videoUrl: videoPath || '',
    source: 'telegram',
    createdAt: new Date().toISOString()
  }).write();

  console.log(`>>> Импортирован пост из Telegram (id ${post.message_id})`);
}

async function pollOnce() {
  if (!API) return;
  try {
    const offset = getOffset();
    const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=0&allowed_updates=["channel_post"]`);
    const data = await res.json();
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      if (update.channel_post) {
        await processPost(update.channel_post);
      }
      setOffset(update.update_id + 1);
    }
  } catch (err) {
    console.error('Ошибка опроса Telegram Bot API:', err.message);
  }
}

function start() {
  if (!TOKEN) {
    console.log('>>> TELEGRAM_BOT_TOKEN не задан — автоимпорт новостей из Telegram выключен.');
    return;
  }
  console.log('>>> Автоимпорт новостей из Telegram включён (long polling).');
  pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

module.exports = { start };
