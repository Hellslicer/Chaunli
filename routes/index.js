var path = require("path");

exports.show = function(req, res, next) {
    if (req.isAuthenticated()) {
        return res.render("index", {
            page: "index"
        });
    }
    res.redirect('/login')
};