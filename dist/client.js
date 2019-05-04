"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 *  OnWebsocketMessage:
 *    Use Twitch.IRC.Parse over Twitch.ParseIRCMessage. Requires significant
 *    rewrite of OnWebsocketMessage and of bound event handlers in drivers.
 *  OnWebsocketError:
 *    error seems to be lost somewhere
 */

/* TODO:
 *  Fix the following:
 *    Join specific room (JoinChannel only looks at channel.channel)
 *  Implement the following features:
 *    Raid messages
 *      msg-param-viewerCount (raid size)
 *      msg-param-displayName (raider's name)
 *      msg-param-login (raider's login)
 *  Implement the following commands:
 *    RECONNECT
 */

/* Event classes {{{0 */

/* Base Event object for Twitch events */

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TwitchEvent = function () {
  function TwitchEvent(type, raw_line, parsed) {
    _classCallCheck(this, TwitchEvent);

    this._cmd = type;
    this._raw = !!raw_line ? raw_line : "";
    this._parsed = !!parsed ? parsed : {};
    if (!TwitchEvent.COMMANDS.hasOwnProperty(this._cmd)) {
      Util.Error("Command " + this._cmd + " not enumerated in this.COMMANDS");
    }
  }

  _createClass(TwitchEvent, [{
    key: "has_value",
    value: function has_value(key) {
      return this._parsed.hasOwnProperty(key);
    }
  }, {
    key: "value",
    value: function value(key) {
      return this._parsed[key];
    }

    /* Event-specific methods */

  }, {
    key: "flag",
    value: function flag(_flag) {
      if (!!this._parsed.flags) {
        return this._parsed.flags[_flag];
      }
      return undefined;
    }

    /* Extra attributes */

  }, {
    key: "repr",
    value: function repr() {
      /* Return a value similar to Object.toSource() */
      var cls = Object.getPrototypeOf(this).constructor.name;
      var args = [this._cmd, this._raw, this._parsed];
      return "new " + cls + "(" + JSON.stringify(args) + ")";
    }
  }, {
    key: "type",
    get: function get() {
      return "twitch-" + this._cmd.toLowerCase();
    }
  }, {
    key: "command",
    get: function get() {
      return this._cmd;
    }
  }, {
    key: "raw_line",
    get: function get() {
      return this._raw;
    }
  }, {
    key: "values",
    get: function get() {
      return this._parsed;
    }
  }, {
    key: "channel",
    get: function get() {
      return this._parsed.channel;
    }
  }, {
    key: "message",
    get: function get() {
      return this._parsed.message;
    }
  }, {
    key: "user",
    get: function get() {
      return this._parsed.user;
    }
  }, {
    key: "name",
    get: function get() {
      return this._parsed.flags["display-name"];
    }
  }, {
    key: "flags",
    get: function get() {
      return this._parsed.flags;
    }
  }], [{
    key: "COMMANDS",
    get: function get() {
      return {
        CHAT: "CHAT",
        PING: "PING",
        ACK: "ACK",
        TOPIC: "TOPIC",
        NAMES: "NAMES",
        JOIN: "JOIN",
        PART: "PART",
        MODE: "MODE",
        PRIVMSG: "PRIVMSG",
        WHISPER: "WHISPER",
        USERSTATE: "USERSTATE",
        ROOMSTATE: "ROOMSTATE",
        STREAMINFO: "STREAMINFO",
        USERNOTICE: "USERNOTICE",
        GLOBALUSERSTATE: "GLOBALUSERSTATE",
        CLEARCHAT: "CLEARCHAT",
        HOSTTARGET: "HOSTTARGET",
        NOTICE: "NOTICE",
        SUB: "SUB",
        RESUB: "RESUB",
        GIFTSUB: "GIFTSUB",
        ANONGIFTSUB: "ANONGIFTSUB",
        OPEN: "OPEN",
        CLOSE: "CLOSE",
        MESSAGE: "MESSAGE",
        ERROR: "ERROR",
        OTHER: "OTHER"
      };
    }
  }]);

  return TwitchEvent;
}();

/* Event object for chat events */


var TwitchChatEvent = function (_TwitchEvent) {
  _inherits(TwitchChatEvent, _TwitchEvent);

  function TwitchChatEvent(raw_line, parsed) {
    _classCallCheck(this, TwitchChatEvent);

    var _this = _possibleConstructorReturn(this, (TwitchChatEvent.__proto__ || Object.getPrototypeOf(TwitchChatEvent)).call(this, "CHAT", raw_line, parsed));

    _this._id = parsed.flags.id;
    return _this;
  }

  _createClass(TwitchChatEvent, [{
    key: "has_badge",
    value: function has_badge(badge) {
      var rev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

      if (!this.flags.badges) return false;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.flags.badges[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _step$value = _slicedToArray(_step.value, 2),
              badge_name = _step$value[0],
              badge_rev = _step$value[1];

          if (badge_name == badge) {
            if (rev !== undefined) {
              return badge_rev == rev;
            } else {
              return true;
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return false;
    }

    /* Extra attributes */

  }, {
    key: "repr",
    value: function repr() {
      /* Return a value similar to Object.toSource() */
      var cls = Object.getPrototypeOf(this).constructor.name;
      var args = [this._raw.repr(), JSON.stringify(this._parsed)].join(",");
      return "new " + cls + "(" + args + ")";
    }
  }, {
    key: "id",
    get: function get() {
      return this._id;
    }
  }, {
    key: "iscaster",
    get: function get() {
      return this.has_badge("broadcaster");
    }
  }, {
    key: "ismod",
    get: function get() {
      return this._parsed.flags.mod || this.has_badge("moderator") || this.iscaster;
    }
  }, {
    key: "issub",
    get: function get() {
      return this._parsed.flags.subscriber || this.has_badge("subscriber");
    }
  }, {
    key: "isvip",
    get: function get() {
      return this.has_badge("vip");
    }
  }]);

  return TwitchChatEvent;
}(TwitchEvent);

/* End of event classes section 0}}} */

/* TwitchClient constructor definition */


function TwitchClient(opts) {
  var cfg_name = opts.Name;
  var cfg_clientid = opts.ClientID;
  var cfg_pass = opts.Pass;

  /* Core variables */
  this._ws = null;
  this._is_open = false;
  this._connected = false;
  this._username = null;
  this._debug = opts.Debug || 0;
  /* Channels/rooms presently connected to */
  this._channels = [];
  /* Channels/rooms about to be connected to */
  this._pending_channels = opts.Channels || [];
  /* Room information {"#ch": {...}} */
  this._rooms = {};
  /* History of sent chat messages (recent = first) */
  this._history = [];
  /* Maximum history size */
  this._hist_max = opts.HistorySize || TwitchClient.DEFAULT_HISTORY_SIZE;
  /* Granted capabilities */
  this._capabilities = [];
  /* TwitchClient's userstate information */
  this._self_userstate = {};
  /* TwitchClient's userid */
  this._self_userid = null;
  /* Emotes the TwitchClient is allowed to use */
  this._self_emotes = {}; /* {eid: ename} */
  /* Extension support */
  this._enable_ffz = !opts.NoFFZ;
  this._enable_bttv = !opts.NoBTTV;

  /* Whether or not we were given a clientid */
  this._has_clientid = !!cfg_clientid && cfg_clientid.length > 0;

  /* Don't load assets (for small testing) */
  this._no_assets = !!opts.NoAssets;

  /* Badge, emote, cheermote definitions */
  this._channel_badges = {};
  this._global_badges = {};
  this._channel_cheers = {};

  /* Extension emotes */
  this._ffz_channel_emotes = {};
  this._ffz_badges = {};
  this._ffz_badge_users = {};
  this._bttv_badges = {}; /* If BTTV adds badges */
  this._bttv_channel_emotes = {};

  /* Let the client be used as an arbitrary key-value store */
  this._kv = {};
  this.get = function _Client_get(k) {
    return this._kv[k];
  };
  this.set = function _Client_set(k, v) {
    this._kv[k] = v;
  };
  this.has = function _Client_has(k) {
    return this._kv.hasOwnProperty(k);
  };

  /* Handle authentication and password management */
  this._authed = !!cfg_pass;
  var oauth = void 0,
      oauth_header = void 0;
  if (this._authed) {
    if (cfg_pass.indexOf("oauth:") != 0) {
      oauth = "oauth:" + cfg_pass;
      oauth_header = "OAuth " + cfg_pass;
    } else {
      oauth = cfg_pass;
      oauth_header = cfg_pass.replace(/^oauth:/, 'OAuth ');
    }
  }

  /* Construct the Twitch API object */
  var pub_headers = {};
  var priv_headers = {};
  if (this._has_clientid) {
    pub_headers["Client-Id"] = cfg_clientid;
  }
  if (this._authed) {
    priv_headers["Authorization"] = oauth_header;
  }
  this._api = new Twitch.API(pub_headers, priv_headers);

  /* TwitchClient.Connect() */
  this.Connect = function _TwitchClient_Connect() {
    if (this._ws !== null) {
      this._ws.close();
    }

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = this._channels[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var c = _step2.value;

        this._pending_channels.push(c);
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    this._channels = [];
    this._rooms = {};
    this._capabilities = [];
    this._username = null;
    this._is_open = false;
    this._connected = false;

    var self = this;

    this._ws = new WebSocket("wss://irc-ws.chat.twitch.tv");
    this._ws.client = this;
    this._ws.onopen = function _ws_onopen(e) {
      try {
        Util.LogOnly("ws open>", this.url);
        self._connected = false;
        self._is_open = true;
        self.OnWebsocketOpen(cfg_name, oauth);
      } catch (e) {
        alert("ws._onopen error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this._ws.onmessage = function _ws_onmessage(e) {
      try {
        Util.DebugOnly('ws recv>', Twitch.StripCredentials(e.data.repr()));
        self.OnWebsocketMessage(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString() + "\n" + e.stack);
        throw e;
      }
    }.bind(this._ws);
    this._ws.onerror = function _ws_onerror(e) {
      try {
        Util.DebugOnly('ws error>', e);
        self._connected = false;
        self.OnWebsocketError(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this._ws.onclose = function _ws_onclose(e) {
      try {
        Util.DebugOnly('ws close>', e);
        self._connected = false;
        self._is_open = false;
        self.OnWebsocketClose(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this.send = function _TwitchClient_send(m) {
      try {
        this._ws.send(m);
        Util.DebugOnly('ws send>', Twitch.StripCredentials(m).repr());
      } catch (e) {
        alert("this.send error: " + e.toString());
        throw e;
      }
    }.bind(this);

    Util.LogOnly("Connecting to Twitch...");
  }.bind(this);

  Util.LogOnly("Client constructed and ready for action");
}

/* Statics */
TwitchClient.DEFAULT_HISTORY_SIZE = 300;
TwitchClient.DEFAULT_MAX_MESSAGES = 100;

/* Debugging section {{{0 */

/* debug(args...): output everything given to the console as a debugging
 * message, if config.Debug was set to true */
TwitchClient.prototype.debug = function _TwitchClient_debug() {
  if (this._debug) {
    Util.LogOnly.apply(Util.LogOnly, arguments);
  }
};

/* Obtain the current client debug level (*not* logger debug level) */
TwitchClient.prototype.GetDebug = function _TwitchClient_GetDebug() {
  return this._debug;
};

/* Update both client and logger debug level */
TwitchClient.prototype.SetDebug = function _TwitchClient_SetDebug(val) {
  if (val === false || val === 0) this._debug = 0;else if (val === true || val === 1) this._debug = 1;else if (val === 2) this._debug = 2;else if (!!val) {
    this._debug = 1;
  } else {
    this._debug = 0;
  }
  Util.DebugLevel = this._debug;
};

/* End debugging section 0}}} */

/* Event handling {{{0 */

/* Bind a function to the event specified (wraps document.addEventListener) */
TwitchClient.prototype.bind = function _TwitchClient_bind(event, callback) {
  Util.Bind(event, callback);
};

/* Unbind a function from the TwitchChat event specified */
TwitchClient.prototype.unbind = function _TwitchClient_unbind(event, callback) {
  Util.Unbind(event, callback);
};

/* End event handling 0}}} */

/* Private functions section {{{0 */

/* Return the value of _self_userstate for the given channel and attribute */
TwitchClient.prototype._selfUserState = function _TwitchClient__selfUserState(channel, value) {
  var ch = Twitch.FormatChannel(channel);
  if (this._self_userstate) {
    if (this._self_userstate[ch]) {
      return this._self_userstate[ch][value];
    }
  }
  return null;
};

/* Private: Ensure the user specified is in reduced form */
TwitchClient.prototype._ensureUser = function _TwitchClient__ensureUser(user) {
  if (user.indexOf('!') > -1) {
    return Twitch.ParseUser(user);
  } else {
    return user;
  }
};

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureChannel = function _TwitchClient__ensureChannel(channel) {
  if (typeof channel == "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
};

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureRoom = function _TwitchClient__ensureRoom(channel) {
  channel = this._ensureChannel(channel);
  var cname = channel.channel;
  if (!(cname in this._rooms)) {
    this._rooms[cname] = {
      users: [], /* Joined users */
      userInfo: {}, /* Joined users' info */
      operators: [], /* Operators */
      channel: channel, /* Channel object */
      rooms: {}, /* Known rooms */
      id: null, /* Channel ID */
      online: false, /* Currently streaming */
      stream: {}, /* Stream status */
      streams: [] /* Stream statuses */
    };
  }
};

/* Private: Called when a user joins a channel */
TwitchClient.prototype._onJoin = function _TwitchClient__onJoin(channel, user) {
  user = this._ensureUser(user);
  channel = this._ensureChannel(channel);
  this._ensureRoom(channel);
  if (!this._rooms[channel.channel].users.includes(user)) {
    if (channel.room && channel.roomuid) {
      /* User joined a channel room */
      this._rooms[channel.channel].users.push(user);
    } else {
      /* User joined a channel's main room */
      this._rooms[channel.channel].users.push(user);
    }
  }
  if (!this._rooms[channel.channel].userInfo.hasOwnProperty(user)) {
    this._rooms[channel.channel].userInfo[user] = {};
  }
};

/* Private: Called when a user parts a channel */
TwitchClient.prototype._onPart = function _TwitchClient__onPart(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  if (this._rooms[cname].users.includes(user)) {
    var idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users.splice(idx, 1);
  }
};

/* Private: Called when the client receives a MODE +o event */
TwitchClient.prototype._onOp = function _TwitchClient__onOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  if (!this._rooms[cname].operators.includes(user)) {
    this._rooms[cname].operators.push(user);
  }
};

/* Private: Called when the client receives a MODE -o event */
TwitchClient.prototype._onDeOp = function _TwitchClient__onDeOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  var idx = this._rooms[cname].operators.indexOf(user);
  if (idx > -1) {
    this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
  }
};

/* Private: Load in the extra chatrooms a streamer may or may not have */
TwitchClient.prototype._getRooms = function _TwitchClient__getRooms(cname, cid) {
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.Rooms(cid), function _rooms_cb(json) {
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = json["rooms"][Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var room_def = _step3.value;

        if (this._rooms[cname].rooms === undefined) this._rooms[cname].rooms = {};
        this._rooms[cname].rooms[room_def["name"]] = room_def;
      }
    } catch (err) {
      _didIteratorError3 = true;
      _iteratorError3 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion3 && _iterator3.return) {
          _iterator3.return();
        }
      } finally {
        if (_didIteratorError3) {
          throw _iteratorError3;
        }
      }
    }
  }.bind(this), {}, true);
};

/* Private: Load in the channel badges for a given channel name and ID */
TwitchClient.prototype._getChannelBadges = function _TwitchClient__getChannelBadges(cname, cid) {
  this._channel_badges[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get badges; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Badges(cid), function _badges_cb(json) {
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = Object.keys(json)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var badge_name = _step4.value;

        this._channel_badges[cname][badge_name] = json[badge_name];
      }
    } catch (err) {
      _didIteratorError4 = true;
      _iteratorError4 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion4 && _iterator4.return) {
          _iterator4.return();
        }
      } finally {
        if (_didIteratorError4) {
          throw _iteratorError4;
        }
      }
    }
  }.bind(this), {}, false);
};

/* Private: Load in the channel cheermotes for a given channel name and ID */
TwitchClient.prototype._getChannelCheers = function _TwitchClient__getChannelCheers(cname, cid) {
  this._channel_cheers[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get channel cheers; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Cheers(cid), function _cheers_cb(json) {
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = json.actions[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var cdef = _step5.value;

        /* Simplify things later by adding the regexps here */
        cdef.word_pattern = new RegExp('^(' + RegExp.escape(cdef.prefix) + ')([1-9][0-9]*)$', 'i');
        cdef.line_pattern = new RegExp('(?:\\b[\\s]|^)(' + RegExp.escape(cdef.prefix) + ')([1-9][0-9]*)(?:\\b|[\\s]|$)', 'ig');
        cdef.split_pattern = new RegExp('(?:\\b[\\s]|^)(' + RegExp.escape(cdef.prefix) + '[1-9][0-9]*)(?:\\b|[\\s]|$)', 'ig');
        this._channel_cheers[cname][cdef.prefix] = cdef;
      }
    } catch (err) {
      _didIteratorError5 = true;
      _iteratorError5 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion5 && _iterator5.return) {
          _iterator5.return();
        }
      } finally {
        if (_didIteratorError5) {
          throw _iteratorError5;
        }
      }
    }
  }.bind(this), {}, false);
};

/* Private: Load in the global and per-channel FFZ emotes */
TwitchClient.prototype._getFFZEmotes = function _TwitchClient__getFFZEmotes(cname, cid) {
  this._ffz_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.FFZEmotes(cid), function _ffz_emotes_cb(json) {
    var ffz = this._ffz_channel_emotes[cname];
    ffz.id = json.room._id;
    ffz.set_id = json.room.set;
    ffz.css = json.room.css;
    ffz.display_name = json.room.display_name;
    ffz.user_name = json.room.id;
    ffz.is_group = json.room.is_group;
    ffz.mod_urls = {};
    if (json.room.mod_urls) {
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = Object.entries(json.room.mod_urls)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var _step6$value = _slicedToArray(_step6.value, 2),
              k = _step6$value[0],
              v = _step6$value[1];

          if (!!v) {
            ffz.mod_urls[k] = Util.URL(v);
          }
        }
      } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion6 && _iterator6.return) {
            _iterator6.return();
          }
        } finally {
          if (_didIteratorError6) {
            throw _iteratorError6;
          }
        }
      }
    }
    if (json.room.moderator_badge) {
      ffz.mod_badge = Util.URL(json.room.moderator_badge);
    } else {
      ffz.mod_badge = null;
    }
    ffz.sets_raw = json.sets;
    if (json.sets[ffz.set_id]) {
      var set_def = json.sets[ffz.set_id];
      ffz.emotes_name = set_def.title;
      ffz.emotes_desc = set_def.description || "";
      ffz.emotes = {};
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = Object.entries(set_def.emoticons)[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var _step7$value = _slicedToArray(_step7.value, 2),
              k = _step7$value[0],
              v = _step7$value[1];

          if (v.hidden) continue;
          ffz.emotes[v.name] = v;
          var _iteratorNormalCompletion8 = true;
          var _didIteratorError8 = false;
          var _iteratorError8 = undefined;

          try {
            for (var _iterator8 = Object.entries(v.urls)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
              var _step8$value = _slicedToArray(_step8.value, 2),
                  size = _step8$value[0],
                  url = _step8$value[1];

              ffz.emotes[v.name].urls[size] = Util.URL(url);
            }
          } catch (err) {
            _didIteratorError8 = true;
            _iteratorError8 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion8 && _iterator8.return) {
                _iterator8.return();
              }
            } finally {
              if (_didIteratorError8) {
                throw _iteratorError8;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }
    }
  }.bind(this), function _ffze_onerror(resp) {
    if (resp.status == 404) {
      Util.Log("Channel " + cname + ":" + cid + " has no FFZ emotes");
    }
  });
};

/* Private: Load in the global and per-channel BTTV emotes */
TwitchClient.prototype._getBTTVEmotes = function _TwitchClient__getBTTVEmotes(cname, cid) {
  this._bttv_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVEmotes(cname.lstrip('#')), function _bttv_emotes_cb(json) {
    var bttv = this._bttv_channel_emotes[cname];
    bttv.emotes = {};
    var _iteratorNormalCompletion9 = true;
    var _didIteratorError9 = false;
    var _iteratorError9 = undefined;

    try {
      for (var _iterator9 = json.emotes[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
        var emote = _step9.value;

        bttv.emotes[emote.code] = {
          'id': emote.id,
          'code': emote.code,
          'channel': emote.channel,
          'image-type': emote.imageType,
          'url': Util.URL(json.urlTemplate.replace('{{id}}', emote.id).replace('{{image}}', '1x'))
        };
      }
    } catch (err) {
      _didIteratorError9 = true;
      _iteratorError9 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion9 && _iterator9.return) {
          _iterator9.return();
        }
      } finally {
        if (_didIteratorError9) {
          throw _iteratorError9;
        }
      }
    }
  }.bind(this), function _bttve_onerror(resp) {
    if (resp.status == 404) {
      Util.Log("Channel " + cname + ":" + cid + " has no BTTV emotes");
    }
  });
};

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges = function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.AllBadges(), function _badges_cb(json) {
    var _iteratorNormalCompletion10 = true;
    var _didIteratorError10 = false;
    var _iteratorError10 = undefined;

    try {
      for (var _iterator10 = Object.keys(json["badge_sets"])[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
        var badge_name = _step10.value;

        this._global_badges[badge_name] = json["badge_sets"][badge_name];
      }
    } catch (err) {
      _didIteratorError10 = true;
      _iteratorError10 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion10 && _iterator10.return) {
          _iterator10.return();
        }
      } finally {
        if (_didIteratorError10) {
          throw _iteratorError10;
        }
      }
    }
  }.bind(this), {}, false);
  if (this._enable_ffz) {
    this._api.GetSimpleCB(Twitch.URL.FFZBadgeUsers(), function _ffz_bades_cb(resp) {
      var _iteratorNormalCompletion11 = true;
      var _didIteratorError11 = false;
      var _iteratorError11 = undefined;

      try {
        for (var _iterator11 = Object.values(resp.badges)[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
          var badge = _step11.value;

          this._ffz_badges[badge.id] = badge;
        }
      } catch (err) {
        _didIteratorError11 = true;
        _iteratorError11 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion11 && _iterator11.return) {
            _iterator11.return();
          }
        } finally {
          if (_didIteratorError11) {
            throw _iteratorError11;
          }
        }
      }

      var _iteratorNormalCompletion12 = true;
      var _didIteratorError12 = false;
      var _iteratorError12 = undefined;

      try {
        for (var _iterator12 = Object.entries(resp.users)[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
          var _step12$value = _slicedToArray(_step12.value, 2),
              badge_nr = _step12$value[0],
              users = _step12$value[1];

          this._ffz_badge_users[badge_nr] = users;
        }
      } catch (err) {
        _didIteratorError12 = true;
        _iteratorError12 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion12 && _iterator12.return) {
            _iterator12.return();
          }
        } finally {
          if (_didIteratorError12) {
            throw _iteratorError12;
          }
        }
      }
    }.bind(this));
  }
};

/* Private: Build a faux PRIVMSG event from the chat message given */
TwitchClient.prototype._build_privmsg = function _TwitchClient__build_privmsg(chobj, message) {
  /* Construct the parsed flags object */
  var flag_obj = {};
  var emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
  var chstr = Twitch.FormatChannel(chobj);
  flag_obj["badges"] = this._self_userstate[chstr]["badges"];
  if (!flag_obj["badges"]) {
    flag_obj["badges"] = [];
  }
  flag_obj["color"] = this._self_userstate[chstr]["color"];
  flag_obj["subscriber"] = this._self_userstate[chstr]["subscriber"];
  flag_obj["mod"] = this._self_userstate[chstr]["mod"];
  flag_obj["vip"] = this._self_userstate[chstr]["vip"] || null;
  flag_obj["broadcaster"] = this._self_userstate[chstr]["broadcaster"] || null;
  flag_obj["display-name"] = this._self_userstate[chstr]["display-name"];
  flag_obj["emotes"] = emote_obj;
  flag_obj["id"] = Util.Random.uuid();
  flag_obj["user-id"] = this._self_userid;
  flag_obj["room-id"] = this._rooms[chobj.channel].id;
  flag_obj["tmi-sent-ts"] = new Date().getTime();
  flag_obj["turbo"] = 0;
  flag_obj["user-type"] = "";

  /* Construct the formatted flags string */
  var flag_str = "@";
  flag_str += "badges=";
  if (flag_obj["badges"]) {
    var badges = [];
    var _iteratorNormalCompletion13 = true;
    var _didIteratorError13 = false;
    var _iteratorError13 = undefined;

    try {
      for (var _iterator13 = flag_obj["badges"][Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
        var _step13$value = _slicedToArray(_step13.value, 2),
            b = _step13$value[0],
            r = _step13$value[1];

        badges.push(b + "/" + r);
      }
    } catch (err) {
      _didIteratorError13 = true;
      _iteratorError13 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion13 && _iterator13.return) {
          _iterator13.return();
        }
      } finally {
        if (_didIteratorError13) {
          throw _iteratorError13;
        }
      }
    }

    flag_str += badges.join(",");
  }
  flag_str += ";color=" + flag_obj["color"];
  flag_str += ";display-name=" + flag_obj["display-name"];
  flag_str += ";subscriber=" + flag_obj["subscriber"];
  flag_str += ";mod=" + flag_obj["mod"];
  /* Only populate vip and broadcaster attributes if set */
  if (flag_obj["vip"]) {
    flag_str += ";vip=" + flag_obj["vip"];
  }
  if (flag_obj["broadcaster"]) {
    flag_str += ";broadcaster=" + flag_obj["broadcaster"];
  }
  flag_str += ";emotes=" + Twitch.FormatEmoteFlag(flag_obj["emotes"]);
  flag_str += ";id=" + flag_obj["id"];
  flag_str += ";user-id=" + flag_obj["user-id"];
  flag_str += ";room-id=" + flag_obj["room-id"];
  flag_str += ";tmi-sent-ts=" + flag_obj["tmi-sent-ts"];
  flag_str += ";turbo=" + flag_obj["turbo"];
  flag_str += ";user-type=" + flag_obj["user-type"];

  /* Build the raw and parsed objects */
  var user = this._self_userstate[chstr]["display-name"].toLowerCase();
  var useruri = ":" + user + "!" + user + "@" + user + ".tmi.twitch.tv";
  var channel = Twitch.FormatChannel(chobj);

  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  var raw_line = flag_str + " " + useruri + " PRIVMSG " + channel + " :";
  if (message.startsWith('/me ')) {
    raw_line += '\x01ACTION ' + message + '\x01';
    message = message.substr('/me '.length);
    flag_obj.action = true;
  } else {
    raw_line += message;
  }

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, {
    cmd: "PRIVMSG",
    flags: flag_obj,
    user: Twitch.ParseUser(useruri),
    channel: chobj,
    message: message,
    synthesized: true /* mark the object as synthesized */
  });
};

/* End private functions section 0}}} */

/* Role and moderation functions {{{0 */

/* Return whether or not the client is authenticated with an AuthID */
TwitchClient.prototype.IsAuthed = function _TwitchClient_IsAuthed() {
  return this._authed;
};

/* Return true if the client is a subscriber in the channel given */
TwitchClient.prototype.IsSub = function _TwitchClient_IsSub(channel) {
  return this._selfUserState(channel, "sub");
};

/* Return true if the client is a VIP in the channel given */
TwitchClient.prototype.IsVIP = function _TwitchClient_IsVIP(channel) {
  return this._selfUserState(channel, "vip");
};

/* Return true if the client is a moderator in the channel given */
TwitchClient.prototype.IsMod = function _TwitchClient_IsMod(channel) {
  return this._selfUserState(channel, "mod");
};

/* Return true if the client is the broadcaster for the channel given */
TwitchClient.prototype.IsCaster = function _TwitchClient_IsCaster(channel) {
  return this._selfUserState(channel, "broadcaster");
};

/* Timeout the specific user in the specified channel */
TwitchClient.prototype.Timeout = function _TwitchClient_Timeout(channel, user) {
  var duration = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "600s";
  var reason = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = "Timed out by " + this._username + " from " + channel.channel + " for " + duration;
  }
  this.SendMessage(channel, "/timeout " + user + " " + duration + " \"" + reason + "\"");
};

/* Un-timeout the specific user in the specified channel */
TwitchClient.prototype.UnTimeout = function _TwitchClient_UnTimeout(channel, user) {
  this.SendMessage(channel, "/untimeout " + user);
};

/* Ban the specific user from the specified channel */
TwitchClient.prototype.Ban = function _TwitchClient_Ban(channel, user) {
  var reason = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = "Banned from " + channel.channel + " by " + this._username;
  }
  this.SendMessage(channel, "/ban " + user + " " + reason);
};

/* Unban the specific user from the specified channel */
TwitchClient.prototype.UnBan = function _TwitchClient_UnBan(channel, user) {
  this.SendMessage(channel, "/unban " + user);
};

/* End of role and moderation functions 0}}} */

/* Channel functions {{{0 */

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel = function _TwitchClient_JoinChannel(channel) {
  channel = this._ensureChannel(channel);
  var ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) == -1) {
      this.send("JOIN " + ch);
      this._channels.push(ch);
    } else {
      Util.Warn("JoinChannel: Already in " + ch);
    }
  } else if (this._pending_channels.indexOf(ch) == -1) {
    this._pending_channels.push(ch);
  }
};

/* Request the client to leave the channel specified */
TwitchClient.prototype.LeaveChannel = function _TwitchClient_LeaveChannel(channel) {
  channel = this._ensureChannel(channel);
  var ch = channel.channel;
  if (this._is_open) {
    var idx = this._channels.indexOf(ch);
    if (idx > -1) {
      this.send("PART " + ch);
      this._channels.splice(idx, 1);
      delete this._rooms[ch]; /* harmless if fails */
    } else {
      Util.Warn("LeaveChannel: Not in channel " + ch);
    }
  }
};

/* Return whether or not the client is in the channel specified */
TwitchClient.prototype.IsInChannel = function _TwitchClient_IsInChannel(channel) {
  channel = this._ensureChannel(channel);
  var ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) > -1) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels = function _TwitchClient_GetJoinedChannels() {
  return this._channels;
};

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo = function _TwitchClient_GetChannelInfo(channel) {
  return this._rooms[channel] || {};
};

/* End channel functions 0}}} */

/* Functions related to cheers and emotes {{{0 */

/* Return whether or not the given word is a cheer for the given channel */
TwitchClient.prototype.IsCheer = function _TwitchClient_IsCheer(cname, word) {
  if (this._channel_cheers.hasOwnProperty(cname)) {
    var _iteratorNormalCompletion14 = true;
    var _didIteratorError14 = false;
    var _iteratorError14 = undefined;

    try {
      for (var _iterator14 = Object.keys(this._channel_cheers[cname])[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
        var name = _step14.value;

        if (word.match(this._channel_cheers[cname][name].word_pattern)) {
          return true;
        }
      }
    } catch (err) {
      _didIteratorError14 = true;
      _iteratorError14 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion14 && _iterator14.return) {
          _iterator14.return();
        }
      } finally {
        if (_didIteratorError14) {
          throw _iteratorError14;
        }
      }
    }
  }
  return false;
};

/* Return all of the cheers found in the message */
TwitchClient.prototype.FindCheers = function _TwitchClient_FindCheers(cname, message) {
  var matches = [];
  var parts = message.split(" ");
  var offset = 0;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    var _iteratorNormalCompletion15 = true;
    var _didIteratorError15 = false;
    var _iteratorError15 = undefined;

    try {
      for (var _iterator15 = Object.entries(this._channel_cheers[cname])[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
        var _step15$value = _slicedToArray(_step15.value, 2),
            name = _step15$value[0],
            cheer = _step15$value[1];

        if (message.search(cheer.line_pattern) > -1) {
          var _iteratorNormalCompletion16 = true;
          var _didIteratorError16 = false;
          var _iteratorError16 = undefined;

          try {
            for (var _iterator16 = parts[Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
              var token = _step16.value;

              var m = token.match(cheer.word_pattern);
              if (m) {
                var num_bits = Number.parseInt(m[2]);
                matches.push({
                  cheer: cheer,
                  name: m[1],
                  bits: num_bits,
                  start: offset,
                  end: offset + token.length
                });
              }
              offset += token.length + 1;
            }
          } catch (err) {
            _didIteratorError16 = true;
            _iteratorError16 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion16 && _iterator16.return) {
                _iterator16.return();
              }
            } finally {
              if (_didIteratorError16) {
                throw _iteratorError16;
              }
            }
          }
        }
      }
    } catch (err) {
      _didIteratorError15 = true;
      _iteratorError15 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion15 && _iterator15.return) {
          _iterator15.return();
        }
      } finally {
        if (_didIteratorError15) {
          throw _iteratorError15;
        }
      }
    }
  }
  return matches;
};

/* Obtain information about a given cheermote */
TwitchClient.prototype.GetCheer = function _TwitchClient_GetCheer(cname, name) {
  var cheer = null;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    if (this._channel_cheers[cname].hasOwnProperty(name)) {
      cheer = this._channel_cheers[cname][name];
    }
  }
  return cheer;
};

/* Return the URL to the image for the emote specified */
TwitchClient.prototype.GetEmote = function _TwitchClient_GetEmote(emote_id) {
  return Twitch.URL.Emote(emote_id, '1.0');
};

/* Obtain the FFZ emotes for a channel */
TwitchClient.prototype.GetFFZEmotes = function _TwitchClient_GetFFZEmotes(channel) {
  return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
};

/* Obtain the BTTV emotes for a channel */
TwitchClient.prototype.GetBTTVEmotes = function _TwitchClient_GetBTTVEmotes(channel) {
  return this._bttv_channel_emotes[Twitch.FormatChannel(channel)];
};

/* End of functions related to cheers and emotes 0}}} */

/* Return true if the client has been granted the capability specified. Values
 * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
 * following: twitch.tv/tags twitch.tv/commands twitch.tv/membership
 */
TwitchClient.prototype.HasCapability = function _TwitchClient_HasCapability(test_cap) {
  var _iteratorNormalCompletion17 = true;
  var _didIteratorError17 = false;
  var _iteratorError17 = undefined;

  try {
    for (var _iterator17 = this._capabilities[Symbol.iterator](), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
      var cap = _step17.value;

      if (test_cap == cap || cap.endsWith('/' + test_cap.lstrip('/'))) {
        return true;
      }
    }
  } catch (err) {
    _didIteratorError17 = true;
    _iteratorError17 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion17 && _iterator17.return) {
        _iterator17.return();
      }
    } finally {
      if (_didIteratorError17) {
        throw _iteratorError17;
      }
    }
  }

  return false;
};

/* Get the client's current username */
TwitchClient.prototype.GetName = function _TwitchClient_GetName() {
  return this._username;
};

/* Return whether or not the numeric user ID refers to the client itself */
TwitchClient.prototype.IsUIDSelf = function _TwitchClient_IsUIDSelf(userid) {
  return userid == this._self_userid;
};

/* Functions for sending messages {{{0 */

/* Send a message to the channel specified */
TwitchClient.prototype.SendMessage = function _TwitchClient_SendMessage(channel, message) {
  var bypassFaux = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected && this._authed) {
    this.send("PRIVMSG " + channel.channel + " :" + message);
    /* Dispatch a faux "Message Received" event */
    if (!bypassFaux) {
      if (this._self_userstate[Twitch.FormatChannel(channel)]) {
        Util.FireEvent(this._build_privmsg(channel, message));
      } else {
        Util.Error("No USERSTATE given for channel " + channel);
      }
    }
  } else {
    var chname = Twitch.FormatChannel(channel);
    Util.Warn("Unable to send \"" + message + "\" to " + chname + ": not connected or not authed");
  }
};

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll = function _TwitchClient_SendMessageToAll(message) {
  if (this._connected) {
    var _iteratorNormalCompletion18 = true;
    var _didIteratorError18 = false;
    var _iteratorError18 = undefined;

    try {
      for (var _iterator18 = this._channels[Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
        var ch = _step18.value;

        this.SendMessage(ch, message);
      }
    } catch (err) {
      _didIteratorError18 = true;
      _iteratorError18 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion18 && _iterator18.return) {
          _iterator18.return();
        }
      } finally {
        if (_didIteratorError18) {
          throw _iteratorError18;
        }
      }
    }
  } else {
    Util.Warn("Unable to send \"" + message + "\" to all channels: not connected");
  }
};

/* Send text to the Twitch servers, bypassing any special logic */
TwitchClient.prototype.SendRaw = function _TwitchClient_SendRaw(raw_msg) {
  this.send(raw_msg.trimEnd() + "\r\n");
};

/* End of functions for sending messages 0}}} */

/* History functions {{{0 */

/* Add a message to the history of sent messages */
TwitchClient.prototype.AddHistory = function _TwitchClient_AddHistory(message) {
  this._history.unshift(message);
  if (this._history.length > this._hist_max) {
    this._history.pop();
  }
};

/* Obtain the history of sent messages */
TwitchClient.prototype.GetHistory = function _TwitchClient_GetHistort() {
  /* Make a copy to prevent unexpected modification */
  return this._history.map(function (x) {
    return x;
  });
};

/* Obtain the nth most recently sent message */
TwitchClient.prototype.GetHistoryItem = function _TwitchClient_GetHistoryItem(n) {
  if (n >= 0 && n < this._history.length) {
    return this._history[n];
  }
  return null;
};

/* Obtain the maximum number of history items */
TwitchClient.prototype.GetHistoryMax = function _TwitchClient_GetHistoryMax() {
  return this._hist_max;
};

/* Obtain the current number of history items */
TwitchClient.prototype.GetHistoryLength = function _TwitchClient_GetHistoryLength() {
  return this._history.length;
};

/* End of history functions 0}}} */

/* Badge handling functions {{{0 */

/* Get an object containing all of the known badges */
TwitchClient.prototype.GetAllBadges = function _TwitchClient_GetAllBadges() {
  var result = { global: {} };
  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = Object.keys(this._channel_badges)[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var cname = _step19.value;

      result[cname] = {};
      var _iteratorNormalCompletion21 = true;
      var _didIteratorError21 = false;
      var _iteratorError21 = undefined;

      try {
        for (var _iterator21 = Object.entries(this._channel_badges[cname])[Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
          var _step21$value = _slicedToArray(_step21.value, 2),
              name = _step21$value[0],
              val = _step21$value[1];

          result[cname][name] = val;
        }
      } catch (err) {
        _didIteratorError21 = true;
        _iteratorError21 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion21 && _iterator21.return) {
            _iterator21.return();
          }
        } finally {
          if (_didIteratorError21) {
            throw _iteratorError21;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError19 = true;
    _iteratorError19 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion19 && _iterator19.return) {
        _iterator19.return();
      }
    } finally {
      if (_didIteratorError19) {
        throw _iteratorError19;
      }
    }
  }

  var _iteratorNormalCompletion20 = true;
  var _didIteratorError20 = false;
  var _iteratorError20 = undefined;

  try {
    for (var _iterator20 = Object.keys(this._global_badges)[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
      var name = _step20.value;

      result.global[name] = this._global_badges[name];
    }
  } catch (err) {
    _didIteratorError20 = true;
    _iteratorError20 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion20 && _iterator20.return) {
        _iterator20.return();
      }
    } finally {
      if (_didIteratorError20) {
        throw _iteratorError20;
      }
    }
  }

  return result;
};

/* Return true if the badge specified is a global badge */
TwitchClient.prototype.IsGlobalBadge = function _TwitchClient_IsGlobalBadge(badge_name) {
  var badge_version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  if (badge_name in this._global_badges) {
    if (badge_version === null) {
      return Object.keys(this._global_badges[badge_name].versions).length > 0;
    } else if (badge_version in this._global_badges[badge_name].versions) {
      if (!!this._global_badges[badge_name].versions[badge_version]) {
        return true;
      }
    }
  }
  return false;
};

/* Return true if the badge specified exists as a channel badge */
TwitchClient.prototype.IsChannelBadge = function _TwitchClient_IsChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  if (channel.channel in this._channel_badges) {
    if (badge_name in this._channel_badges[channel.channel]) {
      if (!!this._channel_badges[channel.channel][badge_name]) {
        return true;
      }
    }
  }
  return false;
};

/* Returns Object {
 *   image_url_1x: "https://static-cdn.jtvnw.net/badges/...",
 *   image_url_2x: "https://static-cdn.jtvnw.net/badges/...",
 *   image_url_4x: "https://static-cdn.jtvnw.net/badges/...",
 *   description: "Badge Description",
 *   title: "Badge Name",
 *   click_action: "badge_action",
 *   click_url: ""
 * } */
TwitchClient.prototype.GetGlobalBadge = function _TwitchClient_GetGlobalBadge(badge_name) {
  var badge_version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  if (this._global_badges.hasOwnProperty(badge_name)) {
    if (badge_version === null) {
      badge_version = Object.keys(this._global_badges[badge_name].versions).min();
    }
    if (this._global_badges[badge_name].versions.hasOwnProperty(badge_version)) {
      return this._global_badges[badge_name].versions[badge_version];
    }
  }
  return {};
};

/* Returns Object {
 *   alpha: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   image: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   svg: "https://static-cdn.jtvnw.net/chat-badges/<badge>.svg"
 * } */
TwitchClient.prototype.GetChannelBadge = function _TwitchClient_GetChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  return this._channel_badges[channel.channel][badge_name];
};

/* Obtain all of the global badges */
TwitchClient.prototype.GetGlobalBadges = function _TwitchClient_GetGlobalBadges() {
  return new Object(this._global_badges);
};

/* Obtain all of the channel badges for the specified channel */
TwitchClient.prototype.GetChannelBadges = function _TwitchClient_GetChannelBadges(channel) {
  channel = this._ensureChannel(channel);
  if (this._channel_badges.hasOwnProperty(channel.channel)) {
    return new Object(this._channel_badges[channel.channel]);
  }
  return {};
};

/* End of badge handling functions 0}}} */

/* Websocket callbacks {{{0 */

/* Callback: called when the websocket opens */
TwitchClient.prototype.OnWebsocketOpen = function _TwitchClient_OnWebsocketOpen(name, pass) {
  this.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  if (name && pass) {
    this._username = name;
  } else {
    this._username = "justinfan" + Math.floor(Math.random() * 999999);
  }
  if (!!pass) {
    this.send("PASS " + (pass.indexOf("oauth:") == 0 ? "" : "oauth:") + pass);
    this.send("NICK " + name);
  } else {
    this.send("NICK " + this._username);
  }
  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = this._pending_channels[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var i = _step22.value;

      this.JoinChannel(i);
    }
  } catch (err) {
    _didIteratorError22 = true;
    _iteratorError22 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion22 && _iterator22.return) {
        _iterator22.return();
      }
    } finally {
      if (_didIteratorError22) {
        throw _iteratorError22;
      }
    }
  }

  this._pending_channels = [];
  this._getGlobalBadges();
  Util.FireEvent(new TwitchEvent("OPEN", null, { "has-clientid": this._has_clientid }));
};

/* Callback: called when the websocket receives a message */
TwitchClient.prototype.OnWebsocketMessage = function _TwitchClient_OnWebsocketMessage(ws_event) {
  var _this2 = this;

  var lines = ws_event.data.split("\r\n");
  var _iteratorNormalCompletion23 = true;
  var _didIteratorError23 = false;
  var _iteratorError23 = undefined;

  try {
    var _loop = function _loop() {
      var line = _step23.value;

      /* Ignore empty lines */
      if (line.trim() == '') {
        return "continue";
      }

      /* Parse the message (TODO: Use Twitch.IRC.Parse()) */
      var result = Twitch.ParseIRCMessage(line);
      Util.Trace('result1:', result);
      try {
        var result2 = Twitch.IRC.Parse(line);
        Util.Trace('result2:', result2);
      } catch (e) {
        Util.Error(e);
      }

      /* Fire twitch-message for every line received */
      Util.FireEvent(new TwitchEvent("MESSAGE", line, result));

      /* Make sure the room is tracked */
      if (result.channel && result.channel.channel) {
        _this2._ensureRoom(result.channel);
      }

      /* Don't handle messages with NULL commands */
      if (!result.cmd) {
        Util.Error('result.cmd is NULL for', result, line);
        return "continue";
      }

      /* Fire top-level event */
      Util.FireEvent(new TwitchEvent(result.cmd, line, result));

      /* Parse and handle result.channel to simplify code below */
      var cname = null;
      var cstr = null;
      var room = null;
      var roomid = null;
      if (result.channel) {
        _this2._ensureRoom(result.channel);
        cname = result.channel.channel;
        cstr = Twitch.FormatChannel(result.channel);
        room = _this2._rooms[cname];
        if (result.flags && result.flags["room-id"]) {
          roomid = result.flags["room-id"];
        }
      }

      /* Handle each command that could be returned */
      switch (result.cmd) {
        case "PING":
          _this2.send("PONG :" + result.server);
          break;
        case "ACK":
          _this2._connected = true;
          _this2._capabilities = result.flags;
          break;
        case "TOPIC":
          break;
        case "NAMES":
          var _iteratorNormalCompletion24 = true;
          var _didIteratorError24 = false;
          var _iteratorError24 = undefined;

          try {
            for (var _iterator24 = result.usernames[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
              var user = _step24.value;

              _this2._onJoin(result.channel, user);
            }
          } catch (err) {
            _didIteratorError24 = true;
            _iteratorError24 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion24 && _iterator24.return) {
                _iterator24.return();
              }
            } finally {
              if (_didIteratorError24) {
                throw _iteratorError24;
              }
            }
          }

          break;
        case "JOIN":
          _this2._onJoin(result.channel, result.user);
          break;
        case "PART":
          _this2._onPart(result.channel, result.user);
          break;
        case "MODE":
          if (result.modeflag == "+o") {
            _this2._onOp(result.channel, result.user);
          } else if (result.modeflag == "-o") {
            _this2._onDeOp(result.channel, result.user);
          }
          break;
        case "PRIVMSG":
          var event = new TwitchChatEvent(line, result);
          if (!room.userInfo.hasOwnProperty(result.user)) {
            room.userInfo[result.user] = {};
          }
          if (!event.flags.badges) event.flags.badges = [];
          if (_this2._enable_ffz) {
            var _iteratorNormalCompletion25 = true;
            var _didIteratorError25 = false;
            var _iteratorError25 = undefined;

            try {
              for (var _iterator25 = Object.entries(_this2._ffz_badge_users)[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
                var _step25$value = _slicedToArray(_step25.value, 2),
                    badge_nr = _step25$value[0],
                    users = _step25$value[1];

                if (users.indexOf(result.user) > -1) {
                  var ffz_badges = event.flags['ffz-badges'];
                  if (ffz_badges === undefined) ffz_badges = [];
                  ffz_badges.push(_this2._ffz_badges[badge_nr]);
                  event.flags['ffz-badges'] = ffz_badges;
                }
              }
            } catch (err) {
              _didIteratorError25 = true;
              _iteratorError25 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion25 && _iterator25.return) {
                  _iterator25.return();
                }
              } finally {
                if (_didIteratorError25) {
                  throw _iteratorError25;
                }
              }
            }
          }
          var ui = room.userInfo[result.user];
          ui.ismod = event.ismod;
          ui.issub = event.issub;
          ui.isvip = event.isvip;
          ui.userid = event.flags['user-id'];
          ui.uuid = event.flags['id'];
          ui.badges = event.flags['badges'];
          Util.FireEvent(event);
          break;
        case "WHISPER":
          break;
        case "USERSTATE":
          if (!_this2._self_userstate.hasOwnProperty(cstr)) {
            _this2._self_userstate[cstr] = {};
          }
          var _iteratorNormalCompletion26 = true;
          var _didIteratorError26 = false;
          var _iteratorError26 = undefined;

          try {
            for (var _iterator26 = Object.entries(result.flags)[Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
              var _step26$value = _slicedToArray(_step26.value, 2),
                  key = _step26$value[0],
                  val = _step26$value[1];

              _this2._self_userstate[cstr][key] = val;
            }
          } catch (err) {
            _didIteratorError26 = true;
            _iteratorError26 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion26 && _iterator26.return) {
                _iterator26.return();
              }
            } finally {
              if (_didIteratorError26) {
                throw _iteratorError26;
              }
            }
          }

          break;
        case "ROOMSTATE":
          room.id = roomid;
          room.channel = result.channel;
          if (_this2._authed) {
            _this2._getRooms(cname, roomid);
          }
          if (!_this2._no_assets) {
            _this2._getChannelBadges(cname, roomid);
            _this2._getChannelCheers(cname, roomid);
            if (_this2._enable_ffz) {
              _this2._getFFZEmotes(cname, roomid);
            }
            if (_this2._enable_bttv) {
              _this2._getBTTVEmotes(cname, roomid);
            }
          }
          _this2._api.GetCB(Twitch.URL.Stream(result.flags['room-id']), function _stream_cb(resp) {
            if (resp.streams && resp.streams.length > 0) {
              room.stream = resp.streams[0];
              room.streams = resp.streams;
              room.online = true;
            } else {
              room.stream = {};
              room.streams = [];
              room.online = false;
            }
            Util.FireEvent(new TwitchEvent("STREAMINFO", line, result));
          }.bind(_this2));
          break;
        case "USERNOTICE":
          if (result.sub_kind == "SUB") {
            Util.FireEvent(new TwitchEvent("SUB", line, result));
          } else if (result.sub_kind == "RESUB") {
            Util.FireEvent(new TwitchEvent("RESUB", line, result));
          } else if (result.sub_kind == "GIFTSUB") {
            Util.FireEvent(new TwitchEvent("GIFTSUB", line, result));
          } else if (result.sub_kind == "ANONGIFTSUB") {
            Util.FireEvent(new TwitchEvent("ANONGIFTSUB", line, result));
          }
          break;
        case "GLOBALUSERSTATE":
          _this2._self_userid = result.flags['user-id'];
          break;
        case "CLEARCHAT":
          break;
        case "CLEARMSG":
          break;
        case "HOSTTARGET":
          break;
        case "NOTICE":
          break;
        case "ERROR":
          break;
        case "OTHER":
          break;
        default:
          Util.Warn("Unhandled event:", result);
          break;
      }

      /* Obtain emotes the client is able to use */
      if (result.cmd == "USERSTATE" || result.cmd == "GLOBALUSERSTATE") {
        if (result.flags && result.flags["emote-sets"]) {
          _this2._api.GetCB(Twitch.URL.EmoteSet(result.flags["emote-sets"].join(',')), function _emoteset_cb(json) {
            var _iteratorNormalCompletion27 = true;
            var _didIteratorError27 = false;
            var _iteratorError27 = undefined;

            try {
              for (var _iterator27 = Object.keys(json["emoticon_sets"])[Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
                var eset = _step27.value;
                var _iteratorNormalCompletion28 = true;
                var _didIteratorError28 = false;
                var _iteratorError28 = undefined;

                try {
                  for (var _iterator28 = json["emoticon_sets"][eset][Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
                    var edef = _step28.value;

                    this._self_emotes[edef.id] = edef.code;
                  }
                } catch (err) {
                  _didIteratorError28 = true;
                  _iteratorError28 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion28 && _iterator28.return) {
                      _iterator28.return();
                    }
                  } finally {
                    if (_didIteratorError28) {
                      throw _iteratorError28;
                    }
                  }
                }
              }
            } catch (err) {
              _didIteratorError27 = true;
              _iteratorError27 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion27 && _iterator27.return) {
                  _iterator27.return();
                }
              } finally {
                if (_didIteratorError27) {
                  throw _iteratorError27;
                }
              }
            }
          }.bind(_this2));
        }
      }
    };

    for (var _iterator23 = lines[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
      var _ret = _loop();

      if (_ret === "continue") continue;
    }
  } catch (err) {
    _didIteratorError23 = true;
    _iteratorError23 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion23 && _iterator23.return) {
        _iterator23.return();
      }
    } finally {
      if (_didIteratorError23) {
        throw _iteratorError23;
      }
    }
  }
};

/* Callback: called when the websocket receives an error */
TwitchClient.prototype.OnWebsocketError = function _TwitchClient_OnWebsocketError(event) {
  Util.Error(event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
};

/* Callback: called when the websocket is closed */
TwitchClient.prototype.OnWebsocketClose = function _TwitchClient_OnWebsocketClose(event) {
  var _iteratorNormalCompletion29 = true;
  var _didIteratorError29 = false;
  var _iteratorError29 = undefined;

  try {
    for (var _iterator29 = this._channels[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
      var chobj = _step29.value;

      if (this._pending_channels.indexOf(chobj) == -1) {
        this._pending_channels.push(chobj);
      }
    }
  } catch (err) {
    _didIteratorError29 = true;
    _iteratorError29 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion29 && _iterator29.return) {
        _iterator29.return();
      }
    } finally {
      if (_didIteratorError29) {
        throw _iteratorError29;
      }
    }
  }

  this._channels = [];
  Util.Log("WebSocket Closed", event);
  Util.FireEvent(new TwitchEvent("CLOSE", event));
};

/* End websocket callbacks 0}}} */

/* Mark the Twitch Client API as loaded */
TwitchClient.API_Loaded = true;
document.dispatchEvent(new Event("twapi-client-loaded"));