exports.show = function(req, res, next) {
    req.logout();
    res.redirect('/');
};