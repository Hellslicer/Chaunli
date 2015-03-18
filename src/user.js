var config = require("config")
    , users = config.get("users");

exports.findOne = function(username, callback) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === username || user.email === username || user.alias === username) {
            return callback(null, user);
        }
    }
    return callback(null, null);
};

exports.findById = function(id, callback) {
    var idx = id - 1;
    if (users[idx]) {
        callback(null, users[idx]);
    } else {
        callback(new Error("User " + id + " does not exist"));
    }
};

exports.findByToken = function(token, callback) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.token === token) {
            return callback(null, user);
        }
    }
    return callback(null, null);
};