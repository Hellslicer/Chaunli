var path = require("path")
    , config = require("config")
    , md5 = require("MD5")
    , highlight = require('highlight.js')
    , Utils = require(path.resolve(__dirname, "./utils"))
    , User = require(path.resolve(__dirname, "./user"));

var markdownIt = require('markdown-it')({
    breaks: false,
    langPrefix: "lang",
    linkify: true,
    target: "_blank",
    typographer: true,
    highlight: function (code, lang) {
        if (lang && highlight.getLanguage(lang)) {
            try {
                return highlight.highlight(lang, code).value;
            } catch (__) {}
        }

        try {
            return highlight.highlightAuto(code).value;
        } catch (__) {}

        return ''; // use external default escaping
    }
});
markdownIt.renderer.rules.paragraph_open = function (tokens, idx /*, options, env */) {
    return '';
};
markdownIt.renderer.rules.paragraph_close = function (tokens, idx /*, options, env */) {
    if (tokens[idx].tight === true) {
        return tokens[idx + 1].type.slice(-5) === 'close' ? '' : '\n';
    }
    return '\n';
};
markdownIt.renderer.rules.link_open = function (tokens, idx /*, options, env */) {
    var title = tokens[idx].title ? (' title="' + markdownIt.utils.escapeHtml(markdownIt.utils.replaceEntities(tokens[idx].title)) + '"') : '';
    var target = ' target="_blank"';
    return '<a href="' + markdownIt.utils.escapeHtml(tokens[idx].href) + '"' + title + target + '>';
};

var users = [];
var currentUser;
var rooms = [];
var socketList = [];

for(var i = 0, length = config.get("rooms").length; i < length; i++) {
    var id = config.get("rooms")[i].toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-');
    rooms.push({
        "name": config.get("rooms")[i],
        "id": id,
        "URI": "/" + id
    });
}

exports.getRooms = function() {
    return rooms;
};

exports.init = function(socket) {
    socketList.push(socket);
    currentUser = {id: socket.request.user.id, name: socket.request.user.username, md5: md5(socket.request.user.email), roles: socket.request.user.roles, idle: socket.request.user.idle};
    users.push(currentUser);
    socket.broadcast.emit("userChanged", { type: "joined", user: currentUser });
    socket.emit("syncTime", new Date().toISOString());
    socket.emit("syncLocale", socket.request.user.locale);
    socket.emit("userList", users);
    socket.emit("roomsList", rooms);

    socket.on("idle", function(idle, callback) {
        socket.request.user.idle = !!idle.status;
        users = Utils.updateObject(users, "id", socket.request.user.id, { idle: socket.request.user.idle });
        socket.broadcast.emit("userChanged", { type: "idle", user: socket.request.user.id, changed: {idle: socket.request.user.idle} });
        callback(socket.request.user.id, { idle: socket.request.user.idle });
    }).on("disconnect", function() {
        socket.broadcast.emit("userChanged", { type: "left", user: socket.request.user.id });
        users = Utils.removeFromObject(users, "id", socket.request.user.id);
        socketList.splice(socketList.indexOf(socket), 1);
    });
};

exports.respond = function(socket, endpoint, room, redis) {
    socketList.push(socket);
    var req = socket.request
        , endpointName = [config.get("redis.prefix"), endpoint.name.replace(/\//g, '')].join("-");

    currentUser = {id: socket.request.user.id, name: socket.request.user.username, md5: md5(socket.request.user.email), roles: socket.request.user.roles};

    // Rooms
    if (currentUser.roles.indexOf("admin") !== -1) {
        socket.join("admins");
    } else {
        socket.join("users");
    }
    socket.join(currentUser.id); // User specific room for PM

    socket.broadcast.emit("message", {author: {name: "Server"}, date: new Date().toISOString(), msg: "%s just logged in", i18n: [socket.request.user.username]});
    socket.emit("message", {author: {name: req.__("Server")}, date: new Date().toISOString(), init: true, msg: req.__("Welcome to Chaunli !")});
    redis.lrange(endpointName + "-messages", -100, -1, function (err, replies) {
        replies.forEach(function (message) {
            message = JSON.parse(message);
            message.init = true;
            socket.emit("message", message);
        });
    });
    socket.on("message", function(message, callback) {
        if (message.msg !== "") {
            if (message.msg.substr(0, 1) === "/") {
                var command = message.msg.substr(1).split(" ")[0];
                var response = {};
                response.author = {name: req.__("Server")};
                response.date = new Date().toISOString();
                switch (command) {
                    case "about":
                        response.msg = req.__("Chat powered by Chaunli %s", " v0.1.6");
                        break;
                    case "help":
                        response.msg = req.__("Help is currently unavailable.");
                        break;
                    case "mp": case "pm":
                    var recipient = message.msg.substr(1).split(" ")[1] || "";
                    User.findOne(recipient, function(err, user) {
                        if (!user) {
                            response.msg =  req.__("Unknown user %s", recipient);
                            callback(response);
                            return;
                        } else if (user.id === socket.request.user.id) {
                            response.msg = req.__("You can't send a PM to yourself");
                            callback(response);
                            return;
                        }

                        user = users.filter(function (item) {
                            return (item.id === user.id);
                        });
                        if (user.length > 0) {
                            user = user[0];
                        } else {
                            response.msg = req.__("%s is not connected", recipient);
                            callback(response);
                            return;
                        }

                        var pm = message.msg.substr(1).split(" ").slice(2).join(" ") || "";
                        response.msg = markdownIt.render(pm);
                        response.author = {name: socket.request.user.username + " (MP)", md5: md5(socket.request.user.email)};
                        socket.broadcast.to(user.id).emit("message" , response);
                        response.author.name = req.__("To %s", user.name);
                        callback(response);
                    });
                    return;
                    case "reload":
                        if (socket.request.user.roles.indexOf("admin") !== -1) {
                            callback({msg: req.__("Reloading clients %s", "..."), author: { name: req.__("Server") }, date: response.date});
                            socket.broadcast.to("admins").emit("message", {author: {name: req.__("Server")}, date: response.date, msg: req.__("Reloading clients") + " (" + req.__("triggered by") + " " + socket.request.user.username + ") ..."});
                            socket.broadcast.to("users").emit("reload", {status: true});
                            return;
                        } else {
                            response.msg = req.__("You don't have access to this command.");
                            break;
                        }
                    default:
                        response.msg = req.__("Unrecognized command");
                }
                callback(response);
                return;
            }
            message.msg = markdownIt.render(message.msg);
            message.date = new Date().toISOString();
            message.author = {name: socket.request.user.username, md5: md5(socket.request.user.email)};
            message.notif = true;
            socket.broadcast.emit("message", message);
            message.notif = null;
            redis.rpush(endpointName + "-messages", JSON.stringify(message));
            callback(message);
        }
    }).on("writing", function(data) {
        currentUser = {id: socket.request.user.id, name: socket.request.user.username, md5: md5(socket.request.user.email), roles: socket.request.user.roles};
        socket.broadcast.emit("writing", { status: data.status, user: currentUser });
    }).on("disconnect", function() {
        socket.broadcast.emit("message", {author: {name: "Server"}, date: new Date().toISOString(), msg: "%s has just disconnected", i18n: [socket.request.user.username]});
        socketList.splice(socketList.indexOf(socket), 1);
    });
};

exports.close = function(io) {
    io.server.close();
    socketList.forEach(function(socket) {
        socket.destroy();
    });
};