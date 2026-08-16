// Порталы админ-панели, доступ к которым можно выдавать замам админа отдельно.
const PORTALS = {
  news: 'Новости',
  album: 'Альбом',
  birthdays: 'Дни рождения',
  applications: 'Заявки на вступление',
  interactives: 'Интерактивы',
  kraj: 'Кражи',
  faq: 'FAQ',
  questions: 'Обращения к администрации'
};

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Доступ только для администратора семьи.'
    });
  }
  next();
}

// Пускает админа (полный доступ) или зама админа, у которого явно выдан
// доступ к конкретному порталу. Обычных участников — не пускает.
function requirePortal(portal) {
  return function (req, res, next) {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (user.role === 'admin') return next();
    if (user.role === 'deputy' && Array.isArray(user.portals) && user.portals.includes(portal)) {
      return next();
    }
    return res.status(403).render('error', {
      message: 'У вас нет доступа к этому разделу админ-панели. Обратитесь к главному администратору.'
    });
  };
}

// Пускает любого сотрудника семьи (админа или зама), независимо от порталов —
// используется для общих экранов вроде входа в саму админ-панель.
function requireStaff(req, res, next) {
  const user = req.session.user;
  if (!user) return res.redirect('/login');
  if (user.role === 'admin' || user.role === 'deputy') return next();
  return res.status(403).render('error', {
    message: 'Доступ только для администрации семьи.'
  });
}

module.exports = { requireAuth, requireAdmin, requireStaff, requirePortal, PORTALS };
