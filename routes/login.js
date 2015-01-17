var passport = require("passport");

exports.show = function(req, res, next) {
    if (req.method === "GET") {
        if (req.isAuthenticated()) {
            res.redirect('/');
        }
        return res.render("login", {
            user: req.user
        });
    } else {
        passport.authenticate('local', function(err, user, info) {
            if (err) { return next(err); }
            if (!user) { return res.redirect('/login'); }
            req.logIn(user, function(err) {
                if (err) { return next(err); }
                return res.redirect("/");
            });
        })(req, res, next);
    }
};