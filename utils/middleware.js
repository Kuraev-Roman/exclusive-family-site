function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Полный админ — доступ к аккаунтам, настройкам, контактам администрации
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Доступ только для главного администратора семьи.'
    });
  }
  next();
}

// Админ или зам.админа — доступ к повседневному управлению контентом
// (дни рождения, новости, интерактивы, альбом, кражи, заявки, FAQ)
function requireStaff(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (role !== 'admin' && role !== 'deputy') {
    return res.status(403).render('error', {
      message: 'Доступ только для администрации семьи (админ или зам. админа).'
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStaff };
