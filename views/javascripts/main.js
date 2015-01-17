(function($) {
    $(document).ready(function() {
        var userList = $("div ul.list-inline")
            , tabs = $("#rooms")
            , tabsContent = $("div.tab-content")
            , loggedUsers = []
            , notificationEnabled = false
            , unreadMessages = 0
            , offsetTime = 0
            , i18n = new I18n({directory: "/locales", extension: ".json"});

        $.idleTimer(300000);
        moment.locale(window.navigator.userLanguage || window.navigator.language);
        i18n.setLocale(window.navigator.userLanguage || window.navigator.language);
        var socket = io.connect("//" + window.location.host);

        socket.on("userList", function (users) {
            loggedUsers = users;
            refreshUserList();
        }).on("syncTime", function (serverTime) {
            offsetTime = moment(serverTime).diff(new Date().toISOString());
        }).on("syncLocale", function(locale) {
            moment.locale(locale);
            i18n.setLocale(locale);
        }).on("roomsList", function(rooms) {
            var firstRoom = true;
            if (tabs.html().length > 0) {
                socket.disconnect();
                setTimeout(function(){ window.location.reload(); }, 2000);
                return;
            }

            for(var i = 0, length = rooms.length; i < length; i++) {
                var roomName = i18n.__(rooms[i].name) || rooms[i].name;
                tabs.append(tmpl("room_tab_template", { name: roomName, id: rooms[i].id, active: firstRoom }));
                tabsContent.append(tmpl("room_template", { id: rooms[i].id, active: firstRoom, i18n: i18n }));
                chat(rooms[i]);
                if (firstRoom) {
                    firstRoom = false;
                }
            }
        });

        var chat = function(room) {
            var messageBox = $("#" + room.id + " #messages")
                , textarea = $("#" + room.id + " #message")
                , writingList = $("#" + room.id + " #writing")
                , usersWriting = [];

            var socket = io.connect("//" + window.location.host + room.URI);

            socket.on("message", function(message) {
                if (message.i18n != null) {
                    message.author.name = i18n.__(message.author.name);
                    message.msg = i18n.__(message.msg, message.i18n);
                }
                appendLine(message.author.name, message.msg, message.date);
                if (notificationEnabled && !(!!message.init)) {
                    unreadMessages++;
                    document.title = "(" + unreadMessages + ") Chaunli";
                    if (message.notif) {
                        show(message.author, message.msg);
                    }
                }
            }).on("writing", function(data) {
                var found = false;
                usersWriting = $.grep(usersWriting, function(user, i) {
                    if (user.name === data.user.name) {
                        found = true;
                        if (!(!!data.status)) {
                            return false;
                        }
                    }
                    return true;
                });
                if (!found && !!data.status) {
                    usersWriting.push(data.user);
                }
                refreshWritingUser();
            }).on("reload", function(reload) {
                if (!!reload.status) {
                    window.location.reload();
                }
            });

            var refreshWritingUser = function () {
                writingList.html("");
                if (usersWriting.length === 1) {
                    for (var user in usersWriting) {
                        writingList.append(tmpl("writing_single_template", { name: usersWriting[user].name, i18n: i18n }));
                    }
                } else if (usersWriting.length > 1) {
                    var users = usersWriting.map(function(user) {
                        return user.name;
                    }).join(", ");
                    writingList.append(tmpl("writing_multi_template", { names: users, i18n: i18n }));
                }
            };

            var appendLine = function(name, message, date) {
                messageBox.append(tmpl("message_template", { name: name, message: emojify.replace(message), date: date, formated_date: moment(date).add(offsetTime, "milliseconds").format("LLL") }));
                messageBox.stop().animate({scrollTop: messageBox[0].scrollHeight}, "slow");
                $('[data-toggle="tooltip"]').tooltip();
            };

            var send = function() {
                if (textarea.val().length > 0) {
                    socket.emit("writing", {status: false});
                    socket.emit("message", {msg: textarea.val()}, function (message) {
                        $("#" + room.id + " #message").val("");
                        appendLine(message.author.name, message.msg, message.date);
                    });
                }
            };

            $("#" + room.id + " #send").bind("click", send);
            textarea.keydown(function (e) {
                if ((e.keyCode === 10 || e.keyCode === 13)) {
                    if (e.ctrlKey || e.shiftKey) {
                        e.preventDefault();
                        textarea.insertAtCaret("\r\n");
                    } else {
                        e.preventDefault();
                        send();
                        return;
                    }
                }
                socket.emit("writing", { status: true });
                callbackWithTimeOut(10000, function() {
                    socket.emit("writing", { status: false });
                });
            });

            $(window).on("blur focus", function(e) {
                var prevType = $(this).data("prevType");

                if (prevType !== e.type) {   //  reduce double fire issues
                    switch (e.type) {
                        case "blur":
                            notificationEnabled = true;
                            break;
                        case "focus":
                            document.title = "Chaunli";
                            unreadMessages = 0;
                            notificationEnabled = false;
                            break;
                    }
                }

                $(this).data("prevType", e.type);
            });
        };

        socket.on("userChanged", function(action) {
            var user = action.user;
            if (action.type === "joined") {
                loggedUsers.push(user);
                refreshUserList();
            } else if (action.type === "left") {
                loggedUsers = removeFromObject(loggedUsers, "id", user);
                refreshUserList();
            } else if (action.type === "idle") {
                refreshUser(user, action.changed);
            }
        });
        $(document).on( "idle.idleTimer", function(event, elem, obj){
            socket.emit("idle", { status: true }, function (user, changed) {
                refreshUser(user, changed);
            });
        }).on( "active.idleTimer", function(event, elem, obj, triggerevent){
            socket.emit("idle", { status: false }, function (user, changed) {
                refreshUser(user, changed);
            });
        });

        var refreshUser = function (user, changed) {
            $.each(loggedUsers, function () {
                if (this.id === user) {
                    var currentUser = this;
                    $.each(changed, function(key, value) {
                        currentUser[key] = value;
                    });
                }
            });
            refreshUserList();
        };

        var refreshUserList = function () {
            userList.html("");
            var idleClass;
            for (var user in loggedUsers) {
                idleClass = !!loggedUsers[user].idle ? "idle" : "";
                userList.append(tmpl("user_template", { idleClass: idleClass, name: loggedUsers[user].name, md5: loggedUsers[user].md5 }));
            }
            $('[data-toggle="tooltip"]').tooltip();
        };

        var removeFromObject = function(object, property, value) {
            var done = false;
            return object.filter(function (item) {
                var skip = false;
                if (!done && item[property] === value) {
                    done = true;
                    skip = true;
                }
                return item[property] !== value || (done && !skip);
            });
        };

        var Notification = window.Notification || window.mozNotification || window.webkitNotification;

        Notification.requestPermission(function (permission) {
            // console.log(permission);
        });

        function show(exp, msg) {
            var instance = new Notification(
                exp.name, {
                    body: convertHtmlToText(msg),
                    icon: "http://www.gravatar.com/avatar/" + exp.md5 + "?s=128"

                }
            );

            instance.onclick = function () {
                // Something to do
            };
            instance.onerror = function () {
                // Something to do
            };
            instance.onshow = function () {
                setTimeout(function() {
                    instance.close();
                }, 5000);
            };
            instance.onclose = function () {
                // Something to do
            };

            return false;
        }

        var writeTimeout = null ;
        function callbackWithTimeOut(time, callback) {
            if (typeof callback !== "function") {
                console.log("Callback must be a function") ;
                return ;
            }
            if (null == time) {
                time = 500 ;
            }
            if (null !== writeTimeout) {
                clearTimeout(writeTimeout) ;
            }
            writeTimeout = setTimeout(callback, time) ;
        }

        function convertHtmlToText(html) {
            var returnText = "" + html;

            //-- remove BR tags and replace them with line break
            returnText=returnText.replace(/<br>/gi, "\n");
            returnText=returnText.replace(/<br\s\/>/gi, "\n");
            returnText=returnText.replace(/<br\/>/gi, "\n");

            //-- remove P and A tags but preserve what's inside of them
            returnText=returnText.replace(/<p.*>/gi, "\n");
            returnText=returnText.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, " $2 ($1)");

            //-- remove all inside SCRIPT and STYLE tags
            returnText=returnText.replace(/<script.*>[\w\W]{1,}(.*?)[\w\W]{1,}<\/script>/gi, "");
            returnText=returnText.replace(/<style.*>[\w\W]{1,}(.*?)[\w\W]{1,}<\/style>/gi, "");
            //-- remove all else
            returnText=returnText.replace(/<(?:.|\s)*?>/g, "");

            //-- get rid of more than 2 multiple line breaks:
            returnText=returnText.replace(/(?:(?:\r\n|\r|\n)\s*){2,}/gim, "\n\n");

            //-- get rid of more than 2 spaces:
            returnText = returnText.replace(/ +(?= )/g,'');

            //-- get rid of html-encoded characters:
            returnText=returnText.replace(/&nbsp;/gi," ");
            returnText=returnText.replace(/&amp;/gi,"&");
            returnText=returnText.replace(/&quot;/gi,'"');
            returnText=returnText.replace(/&#39;/gi,'\'');
            returnText=returnText.replace(/&lt;/gi,'<');
            returnText=returnText.replace(/&gt;/gi,'>');

            return returnText;
        }

        jQuery.fn.extend({
            insertAtCaret: function(myValue){
                return this.each(function(i) {
                    if (document.selection) {
                        //For browsers like Internet Explorer
                        this.focus();
                        var sel = document.selection.createRange();
                        sel.text = myValue;
                        this.focus();
                    }
                    else if (this.selectionStart || this.selectionStart == '0') {
                        //For browsers like Firefox and Webkit based
                        var startPos = this.selectionStart;
                        var endPos = this.selectionEnd;
                        var scrollTop = this.scrollTop;
                        this.value = this.value.substring(0, startPos)+myValue+this.value.substring(endPos,this.value.length);
                        this.focus();
                        this.selectionStart = startPos + myValue.length - 1;
                        this.selectionEnd = startPos + myValue.length - 1;
                        this.scrollTop = scrollTop;
                    } else {
                        this.value += myValue;
                        this.focus();
                    }
                });
            }
        });

        window.onbeforeunload = function(e) {
            socket.disconnect();
        };
    });
})(jQuery);
