#!/usr/bin/env node

var path = require("path");
process.env["NODE_CONFIG_DIR"] = path.resolve(__dirname, "./config");

var express = require("express")
    , session = require('express-session')
    , config = require("config")
    , redis = require("redis")
    , client = redis.createClient(config.get("redis.port"), config.get("redis.host"))
    , RedisStore = require("connect-redis")(session)
    , sessionStore = new RedisStore({client: client})
    , app = express()
    , http = require("http")
    , server = http.createServer(app)
    , io = require("socket.io").listen(server)
    , md5 = require("MD5")
    , passport = require("passport")
    , LocalStrategy = require("passport-local").Strategy
    , passportSocketIo = require("passport.socketio")
    , bodyParser = require("body-parser")
    , cookieParser = require("cookie-parser")
    , i18n = require("i18n")
    , User = require(path.resolve(__dirname, "./src/user"))
    , chat = require(path.resolve(__dirname, "./src/chat"));

app.set("views", path.resolve(__dirname, "./views"));
app.set("view engine", "jade");
app.use(express.static(path.join(app.get("views"))));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
app.use(session({
    key:                "chaunli.sid",
    store:              sessionStore,
    secret:             config.get("secret_token"),
    resave:             true,
    saveUninitialized:  true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/locales", express.static(path.resolve(__dirname, "./locales")));
app.use(i18n.init);
i18n.configure({
    locales:["en", "fr"],
    directory: path.resolve(__dirname, "./locales")
});
passport.use(new LocalStrategy({
        usernameField: "email",
        passwordField: "password"
    },
    function(username, password, done) {
        // asynchronous verification
        process.nextTick(function () {
            User.findOne(username, function(err, user) {
                if (err) { return done(err); }
                if (!user) { return done(null, false, { message: i18n.__("Unknown user %s", username) }); }
                if (user.password != md5(password)) { return done(null, false, { message: i18n.__("Invalid password") }); }
                return done(null, user);
            })
        });
    }
));
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});
io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,
    key:         "chaunli.sid",
    secret:      config.get("secret_token"),
    store:       sessionStore,
    success:     onAuthorizeSuccess,
    fail:        onAuthorizeFail
}));

function onAuthorizeSuccess(data, accept){
    i18n.init(data);
    data.user.locale = i18n.getLocale(data);
    data.user.idle = false;
    console.info(new Date().toLocaleString() + " Successful connection to socket.io (lang: " + data.user.locale + ")");
    accept();
}

function onAuthorizeFail(data, message, error, accept){
    console.info(new Date().toLocaleString() + " Failed connection to socket.io: " + message);
    if(error)
        accept(new Error(message));
}

var index = require(path.resolve(__dirname, "./routes/index"))
    , login = require(path.resolve(__dirname, "./routes/login"))
    , logout = require(path.resolve(__dirname, "./routes/logout"));

app.all("/", index.show);
app.all("/login", login.show);
app.all("/logout", logout.show);

app.use(function(req, res, next) {
    return res.render("404", {
        title: i18n.__("Page not found")
    });
});

client.on("error", function (err) {
    console.log("Redis error: " + err);
});

io.on("connection", function(socket) {
    chat.init(socket);
});
chat.getRooms().forEach(function(room) {
    var endpoint = io.of(room.URI).on("connection", function(socket) {
        chat.respond(socket, endpoint, room, client);
    });
});

server.listen(config.get("server.port"), config.get("server.host"), function() {
    return console.info("Server started on http://%s:%d in %s mode", server.address().address, server.address().port, app.settings.env);
});

process.on('message', function(msg) {
    // PM2 Graceful reload
    if (msg == 'shutdown') {
        chat.close(io);

        setTimeout(function() {
            process.exit(0);
        }, 2000);
    }
});
process.on('exit', function(code) {
    chat.close(io);
});