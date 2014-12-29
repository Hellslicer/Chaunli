Chaunli
=======
[![NPM](https://nodei.co/npm/chaunli.png?downloads=true)](https://nodei.co/npm/chaunli/)

[![Dependency Status](https://david-dm.org/hellslicer/chaunli.png)](https://david-dm.org/hellslicer/chaunli)

Simple webchat in NodeJS.

## Requirements

* Redis

Redis is required to store sessions and messages.

## Installation

```
$ git clone https://github.com/Hellslicer/Chaunli.git .
$ npm install
```

Change configuration in /config

```
$ npm start
```

Default users are:
- admin@localhost / admin
- user@localhost / user

## Features

* Realtime
* Authentification
* HTML5 Notifications
* Stored messages
* Multiple rooms
* Markdown
* Avatar via Gravatar
* i18n

## Configuration

* server

  * `host` - Host (ie. 127.0.0.1)
  * `port` - Port (ie. 8210)

* redis

  * `host` - Host (ie. 127.0.0.1)
  * `port` - Port (ie. 6379)
  * `prefix` - Prefix used to store data (ie. chaunli)

* secret_token

  Secret token used by Chaunli

* rooms

  Array of available rooms

* users

  Array of users

  * `id` - Unique identifier
  * `username` - Username
  * `alias` - Alias used for PM
  * `password` - MD5 encoded password
  * `email` - Email
  * `roles` - Array of permissions
    * `admin` - Administrator
    * `user` - Basic user

## License

(The MIT License)

Copyright (c) 2014 Kévin Poirot <hellslicer@minecorps.fr>. See [License](https://github.com/hellslicer/chaunli/blob/master/LICENSE) for details.
