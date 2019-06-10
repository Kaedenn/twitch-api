"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 * Remove either Twitch.API or Util.API
 * Change Twitch.API or Util.API to use fetch()
 * Remove Twitch.URL.Badges entirely
 * JoinChannel doesn't look at room or roomuid
 * Inconsistent code:
 *   _ensureChannel().channel vs {Parse,Format}Channel()
 *   Remove _ensureChannel() altogether?
 *   Use FormatChannel() value instead of ParseChannel().channel?
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
    this._raw = raw_line || "";
    this._parsed = parsed || {};
    if (!TwitchEvent.COMMANDS.hasOwnProperty(this._cmd)) {
      Util.Error("Command " + this._cmd + " not enumerated in this.COMMANDS");
    }
    /* Ensure certain flags have expected types */
    if (!this._parsed.message) {
      this._parsed.message = "";
    }
    if (!this._parsed.user) {
      this._parsed.user = null;
    }
    if (!this._parsed.flags) {
      this._parsed.flags = {};
    }
    if (!this._parsed.channel) {
      this._parsed.channel = { channel: "GLOBAL", room: null, roomuid: null };
    }
  }

  _createClass(TwitchEvent, [{
    key: "has_value",
    value: function has_value(key) {
      return this._parsed.hasOwnProperty(key);
    }
  }, {
    key: "flag",
    value: function flag(_flag) {
      return this.flags ? this.flags[_flag] : null;
    }

    /* Obtain the first non-falsy value of the listed flags */

  }, {
    key: "first_flag",
    value: function first_flag() {
      for (var _len = arguments.length, flags = Array(_len), _key = 0; _key < _len; _key++) {
        flags[_key] = arguments[_key];
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = flags[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var flag = _step.value;

          if (this.flags[flag]) {
            return this.flags[flag];
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

      return null;
    }
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
      return this.values.channel;
    }
  }, {
    key: "message",
    get: function get() {
      return this.values.message;
    }
  }, {
    key: "user",
    get: function get() {
      return this.values.user || this.flags["display-name"];
    }
  }, {
    key: "name",
    get: function get() {
      return this.flags["display-name"] || this.values.user;
    }
  }, {
    key: "flags",
    get: function get() {
      return this.values.flags;
    }
  }, {
    key: "notice_msgid",
    get: function get() {
      if (this._cmd === "NOTICE") {
        if (typeof this.flags["msg-id"] === "string") {
          return this.flags["msg-id"];
        }
      }
      return null;
    }
  }, {
    key: "notice_class",
    get: function get() {
      var msgid = this.notice_msgid;
      if (typeof msgid === "string") {
        return msgid.split('_')[0];
      }
      return null;
    }
  }], [{
    key: "COMMAND_LIST",
    get: function get() {
      return ["CHAT", "PING", "ACK", "TOPIC", "NAMES", "JOIN", "PART", "RECONNECT", "MODE", "PRIVMSG", "WHISPER", "USERSTATE", "ROOMSTATE", "STREAMINFO", "USERNOTICE", "GLOBALUSERSTATE", "CLEARCHAT", "HOSTTARGET", "NOTICE", "SUB", "RESUB", "GIFTSUB", "ANONGIFTSUB", "NEWUSER", "REWARDGIFT", "MYSTERYGIFT", "GIFTUPGRADE", "PRIMEUPGRADE", "ANONGIFTUPGRADE", "OTHERUSERNOTICE", "RAID", "OPEN", "CLOSE", "MESSAGE", "ERROR", "OTHER"];
    }
  }, {
    key: "COMMANDS",
    get: function get() {
      var result = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = TwitchEvent.COMMAND_LIST[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var cmd = _step2.value;

          result[cmd] = cmd;
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

      return result;
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
      var rev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (!this.flags.badges) return false;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.flags.badges[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _ref = _step3.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var badge_name = _ref2[0];
          var badge_rev = _ref2[1];

          if (badge_name === badge) {
            if (rev !== null) {
              return badge_rev === rev;
            } else {
              return true;
            }
          }
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

      return false;
    }
  }, {
    key: "repr",
    value: function repr() {
      /* Return a value similar to Object.toSource() */
      var cls = Object.getPrototypeOf(this).constructor.name;
      var raw = JSON.stringify(this._raw);
      var parsed = JSON.stringify(this._parsed);
      return "new " + cls + "(" + raw + "," + parsed + ")";
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
      return this.flags.mod || this.has_badge("moderator") || this.iscaster;
    }
  }, {
    key: "issub",
    get: function get() {
      return this.flags.subscriber || this.has_badge("subscriber");
    }
  }, {
    key: "isvip",
    get: function get() {
      return this.has_badge("vip");
    }
  }, {
    key: "sub_months",
    get: function get() {
      if (this.flags["badge-info"]) {
        for (var _ref3 in this.flags["badge-info"]) {
          var _ref4 = _slicedToArray(_ref3, 2);

          var bname = _ref4[0];
          var brev = _ref4[1];

          if (bname === "subscriber") {
            return brev;
          }
        }
      }
      return 0;
    }
  }]);

  return TwitchChatEvent;
}(TwitchEvent);

/* Event object for subscription events */


var TwitchSubEvent = function (_TwitchEvent2) {
  _inherits(TwitchSubEvent, _TwitchEvent2);

  function TwitchSubEvent(sub_kind, raw_line, parsed) {
    _classCallCheck(this, TwitchSubEvent);

    var _this2 = _possibleConstructorReturn(this, (TwitchSubEvent.__proto__ || Object.getPrototypeOf(TwitchSubEvent)).call(this, sub_kind, raw_line, parsed));

    _this2._sub_kind = sub_kind;
    return _this2;
  }

  _createClass(TwitchSubEvent, [{
    key: "kind",
    get: function get() {
      return this._sub_kind;
    }
  }, {
    key: "user",


    /* Methods below apply to all sub kinds */
    get: function get() {
      var name = this.first_flag('msg-param-login', 'display-name');
      return name || this._parsed.user;
    }
  }, {
    key: "plan",
    get: function get() {
      return this.flags['msg-param-sub-plan-name'];
    }
  }, {
    key: "plan_id",
    get: function get() {
      return this.flags['msg-param-sub-plan'];
    }
  }, {
    key: "months",
    get: function get() {
      return this.flags['msg-param-months'] || 0;
    }
  }, {
    key: "total_months",
    get: function get() {
      return this.flags['msg-param-cumulative-months'] || 0;
    }
  }, {
    key: "share_streak",
    get: function get() {
      return this.flags['msg-param-should-share-streak'];
    }
  }, {
    key: "streak_months",
    get: function get() {
      return this.flags['msg-param-streak-months'] || 0;
    }

    /* Methods below only apply only to gift subs */

  }, {
    key: "anonymous",
    get: function get() {
      return this.kind === TwitchSubEvent.ANONGIFTSUB;
    }
  }, {
    key: "recipient",
    get: function get() {
      return this.flags['msg-param-recipient-user-name'];
    }
  }, {
    key: "recipient_id",
    get: function get() {
      return this.flags['msg-param-recipient-id'];
    }
  }, {
    key: "recipient_name",
    get: function get() {
      return this.flags['msg-param-recipient-display-name'];
    }
  }], [{
    key: "FromMsgID",
    value: function FromMsgID(msgid) {
      if (msgid === "sub") return TwitchSubEvent.SUB;
      if (msgid === "resub") return TwitchSubEvent.RESUB;
      if (msgid === "subgift") return TwitchSubEvent.GIFTSUB;
      if (msgid === "anonsubgift") return TwitchSubEvent.ANONSUBGIFT;
      return null;
    }
  }, {
    key: "PlanName",
    value: function PlanName(plan_id) {
      var plan = "" + plan_id;
      if (plan === TwitchSubEvent.PLAN_PRIME) {
        return "Twitch Prime";
      } else if (plan === TwitchSubEvent.PLAN_TIER1) {
        return "Tier 1";
      } else if (plan === TwitchSubEvent.PLAN_TIER2) {
        return "Tier 2";
      } else if (plan === TwitchSubEvent.PLAN_TIER3) {
        return "Tier 3";
      } else {
        return "\"" + plan + "\"";
      }
    }
  }, {
    key: "SUB",
    get: function get() {
      return "SUB";
    }
  }, {
    key: "RESUB",
    get: function get() {
      return "RESUB";
    }
  }, {
    key: "GIFTSUB",
    get: function get() {
      return "GIFTSUB";
    }
  }, {
    key: "ANONGIFTSUB",
    get: function get() {
      return "ANONGIFTSUB";
    }
  }, {
    key: "PLAN_PRIME",
    get: function get() {
      return "Prime";
    }
  }, {
    key: "PLAN_TIER1",
    get: function get() {
      return "1000";
    }
  }, {
    key: "PLAN_TIER2",
    get: function get() {
      return "2000";
    }
  }, {
    key: "PLAN_TIER3",
    get: function get() {
      return "3000";
    }
  }]);

  return TwitchSubEvent;
}(TwitchEvent);

/* End of event classes section 0}}} */

/* Twitch Client class definition */


function TwitchClient(opts) {
  var cfg_name = opts.Name;
  var cfg_clientid = opts.ClientID;
  var cfg_pass = opts.Pass;

  /* Core variables */
  this._ws = null;
  this._is_open = false;
  this._connected = false;
  this._username = null;

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
  this._enable_ffz = !opts.NoFFZ || opts.NoAssets;
  this._enable_bttv = !opts.NoBTTV || opts.NoAssets;

  /* Whether or not we were given a clientid */
  this._has_clientid = cfg_clientid && cfg_clientid.length > 0;

  /* Don't load assets (for small testing) */
  this._no_assets = Boolean(opts.NoAssets);

  /* Badge, emote, cheermote definitions */
  this._channel_badges = {};
  this._global_badges = {};
  this._channel_cheers = {};

  /* Extension emotes */
  this._ffz_channel_emotes = {};
  this._ffz_badges = {};
  this._ffz_badge_users = {};
  this._bttv_badges = {}; /* If BTTV adds badges */
  this._bttv_global_emotes = {};
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
  this._authed = cfg_pass ? true : false;
  var oauth = void 0,
      oauth_header = void 0;
  if (this._authed) {
    if (cfg_pass.indexOf("oauth:") !== 0) {
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

    this._pending_channels = this._pending_channels.concat(this._channels);
    this._channels = [];
    this._rooms = {};
    this._capabilities = [];
    this._username = null;
    this._is_open = false;
    this._connected = false;

    this._endpoint = "wss://irc-ws.chat.twitch.tv";
    this._ws = new WebSocket(this._endpoint);
    this._ws.client = this;
    this._ws.onopen = function _ws_onopen(event) {
      try {
        Util.LogOnly("ws open>", this.url);
        this.client._connected = false;
        this.client._is_open = true;
        this.client._onWebsocketOpen(cfg_name, oauth);
      } catch (e) {
        alert("ws.onopen error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this._ws.onmessage = function _ws_onmessage(event) {
      try {
        var data = Twitch.StripCredentials(JSON.stringify(event.data));
        Util.TraceOnly('ws recv>', data);
        this.client._onWebsocketMessage(event);
      } catch (e) {
        alert("ws.onmessage error: " + e.toString() + "\n" + e.stack);
        throw e;
      }
    }.bind(this._ws);
    this._ws.onerror = function _ws_onerror(event) {
      try {
        Util.LogOnly('ws error>', event);
        this.client._connected = false;
        this.client._onWebsocketError(event);
      } catch (e) {
        alert("ws.onerror error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this._ws.onclose = function _ws_onclose(event) {
      try {
        Util.LogOnly('ws close>', event);
        this.client._connected = false;
        this.client._is_open = false;
        this.client._onWebsocketClose(event);
      } catch (e) {
        alert("ws.onclose error: " + e.toString());
        throw e;
      }
    }.bind(this._ws);
    this.send = function _TwitchClient_send(m) {
      try {
        this._ws.send(m);
        Util.DebugOnly('ws send>', Twitch.StripCredentials(JSON.stringify(m)));
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

/* Event handling {{{0 */

/* Bind a function to the event specified */
TwitchClient.prototype.bind = function _TwitchClient_bind(event, callback) {
  Util.Bind(event, callback);
};

/* Bind a function to catch events not bound */
TwitchClient.prototype.bindDefault = function _TwitchClient_bindDefault(callback) {
  Util.BindDefault(callback);
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
  if (typeof channel === "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
};

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureRoom = function _TwitchClient__ensureRoom(channel) {
  var cobj = this._ensureChannel(channel);
  var cname = cobj.channel;
  if (!(cname in this._rooms)) {
    this._rooms[cname] = {
      users: [], /* Joined users */
      userInfo: {}, /* Joined users' info */
      operators: [], /* Operators */
      channel: cobj, /* Channel object */
      rooms: {}, /* Known rooms */
      id: null, /* Channel ID */
      online: false, /* Currently streaming */
      stream: {}, /* Stream status */
      streams: [] /* Stream statuses */
    };
  }
};

/* Private: Called when a user joins a channel */
TwitchClient.prototype._onJoin = function _TwitchClient__onJoin(channel, userName) {
  var user = this._ensureUser(userName);
  var cobj = this._ensureChannel(channel);
  this._ensureRoom(channel);
  if (!this._rooms[cobj.channel].users.includes(user)) {
    if (cobj.room && cobj.roomuid) {
      /* User joined a channel room */
      this._rooms[cobj.channel].users.push(user);
    } else {
      /* User joined a channel's main room */
      this._rooms[cobj.channel].users.push(user);
    }
  }
  if (!this._rooms[cobj.channel].userInfo.hasOwnProperty(user)) {
    this._rooms[cobj.channel].userInfo[user] = {};
  }
};

/* Private: Called when a user parts a channel */
TwitchClient.prototype._onPart = function _TwitchClient__onPart(channel, userName) {
  var cobj = this._ensureChannel(channel);
  var user = this._ensureUser(userName);
  this._ensureRoom(cobj);
  var cname = cobj.channel;
  if (this._rooms[cname].users.includes(user)) {
    var idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users.splice(idx, 1);
  }
};

/* Private: Called when the client receives a MODE +o event */
TwitchClient.prototype._onOp = function _TwitchClient__onOp(channel, userName) {
  var cobj = this._ensureChannel(channel);
  var user = this._ensureUser(userName);
  this._ensureRoom(cobj);
  var cname = cobj.channel;
  if (!this._rooms[cname].operators.includes(user)) {
    this._rooms[cname].operators.push(user);
  }
};

/* Private: Called when the client receives a MODE -o event */
TwitchClient.prototype._onDeOp = function _TwitchClient__onDeOp(channel, userName) {
  var cobj = this._ensureChannel(channel);
  var user = this._ensureUser(userName);
  this._ensureRoom(cobj);
  var cname = cobj.channel;
  var idx = this._rooms[cname].operators.indexOf(user);
  if (idx > -1) {
    this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
  }
};

/* Private: Load in the extra chatrooms a streamer may or may not have */
TwitchClient.prototype._getRooms = function _TwitchClient__getRooms(cname, cid) {
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.Rooms(cid), function _rooms_cb(json) {
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = json["rooms"][Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var room_def = _step4.value;

        if (!this._rooms[cname].rooms) {
          this._rooms[cname].rooms = {};
        }
        this._rooms[cname].rooms[room_def["name"]] = room_def;
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
  }.bind(this), {}, true);
};

/* Private: Load in the channel badges for a given channel name and ID */
TwitchClient.prototype._getChannelBadges = function _TwitchClient__getChannelBadges(cname, cid) {
  var channel = this._ensureChannel(cname);
  var c = channel.channel;
  this._channel_badges[c] = {};
  this._api.GetCB(Twitch.URL.ChannelBadges(cid), function _badges_cb(json) {
    /* badge_sets
     *  subscriber
     *   versions
     *    <number of months>
     *     image_url_1x: url
     *     image_url_2x: url
     *     image_url_4x: url
     *     description: string
     *     title: string
     */
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = Object.entries(json.badge_sets)[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var _ref5 = _step5.value;

        var _ref6 = _slicedToArray(_ref5, 2);

        var badge_name = _ref6[0];
        var bdef = _ref6[1];

        var badge = {};
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = Object.entries(bdef.versions)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var _ref7 = _step6.value;

            var _ref8 = _slicedToArray(_ref7, 2);

            var months = _ref8[0];
            var urls = _ref8[1];

            badge[months] = urls;
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

        this._channel_badges[c][badge_name] = badge;
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

/* Private: Load in the channel cheermotes for a given channel name and ID */
TwitchClient.prototype._getChannelCheers = function _TwitchClient__getChannelCheers(cname, cid) {
  this._channel_cheers[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get channel cheers; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Cheers(cid), function _cheers_cb(json) {
    var _iteratorNormalCompletion7 = true;
    var _didIteratorError7 = false;
    var _iteratorError7 = undefined;

    try {
      for (var _iterator7 = json.actions[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
        var cdef = _step7.value;

        var p = RegExp.escape(cdef.prefix);
        /* Simplify things later by adding the regexps here */
        cdef.word_pattern = new RegExp("^(" + p + ")([1-9][0-9]*)$", 'i');
        cdef.line_pattern = new RegExp("(?:\\b[\\s]|^)(" + p + ")([1-9][0-9]*)(?:\\b|[\\s]|$)", 'ig');
        this._channel_cheers[cname][cdef.prefix] = cdef;
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
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = Object.entries(json.room.mod_urls)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var _ref9 = _step8.value;

          var _ref10 = _slicedToArray(_ref9, 2);

          var k = _ref10[0];
          var v = _ref10[1];

          if (v) {
            ffz.mod_urls[k] = Util.URL(v);
          }
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
      var _iteratorNormalCompletion9 = true;
      var _didIteratorError9 = false;
      var _iteratorError9 = undefined;

      try {
        for (var _iterator9 = Object.values(set_def.emoticons)[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
          var _v = _step9.value;

          if (_v.hidden) continue;
          ffz.emotes[_v.name] = _v;
          var _iteratorNormalCompletion10 = true;
          var _didIteratorError10 = false;
          var _iteratorError10 = undefined;

          try {
            for (var _iterator10 = Object.entries(_v.urls)[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
              var _ref11 = _step10.value;

              var _ref12 = _slicedToArray(_ref11, 2);

              var size = _ref12[0];
              var url = _ref12[1];

              ffz.emotes[_v.name].urls[size] = Util.URL(url);
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
    }
  }.bind(this), function _ffze_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly("Channel " + cname + ":" + cid + " has no FFZ emotes");
    }
  });
};

/* Private: Load in the global and per-channel BTTV emotes */
TwitchClient.prototype._getBTTVEmotes = function _TwitchClient__getBTTVEmotes(cname, cid) {
  this._bttv_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVEmotes(cname.replace(/^#/, "")), function _bttv_global_emotes_cb(json) {
    var url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
    var bttv = this._bttv_channel_emotes[cname];
    var _iteratorNormalCompletion11 = true;
    var _didIteratorError11 = false;
    var _iteratorError11 = undefined;

    try {
      for (var _iterator11 = json.emotes[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
        var emote = _step11.value;

        bttv[emote.code] = {
          'id': emote.id,
          'code': emote.code,
          'channel': emote.channel,
          'image-type': emote.imageType,
          'url': Util.URL(url_base.replace(/\{\{id\}\}/g, emote.id))
        };
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
  }.bind(this), function _bttve_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly("Channel " + cname + ":" + cid + " has no BTTV emotes");
    }
  });

  this._bttv_global_emotes = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVAllEmotes(), function _bttv_all_emotes_cb(json) {
    var url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
    var _iteratorNormalCompletion12 = true;
    var _didIteratorError12 = false;
    var _iteratorError12 = undefined;

    try {
      for (var _iterator12 = json.emotes[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
        var emote = _step12.value;

        this._bttv_global_emotes[emote.code] = {
          'id': emote.id,
          'code': emote.code,
          'channel': emote.channel,
          'image-type': emote.imageType,
          'url': Util.URL(url_base.replace('{{id}}', emote.id))
        };
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
  }.bind(this), function _bttve_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly("Channel " + cname + ":" + cid + " has no BTTV emotes");
    }
  });
};

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges = function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.AllBadges(), function _badges_cb(json) {
    var _iteratorNormalCompletion13 = true;
    var _didIteratorError13 = false;
    var _iteratorError13 = undefined;

    try {
      for (var _iterator13 = Object.keys(json["badge_sets"])[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
        var badge_name = _step13.value;

        this._global_badges[badge_name] = json["badge_sets"][badge_name];
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
  }.bind(this), {}, false);
  if (this._enable_ffz) {
    this._api.GetSimpleCB(Twitch.URL.FFZBadgeUsers(), function _ffz_bades_cb(resp) {
      var _iteratorNormalCompletion14 = true;
      var _didIteratorError14 = false;
      var _iteratorError14 = undefined;

      try {
        for (var _iterator14 = Object.values(resp.badges)[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
          var badge = _step14.value;

          this._ffz_badges[badge.id] = badge;
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

      var _iteratorNormalCompletion15 = true;
      var _didIteratorError15 = false;
      var _iteratorError15 = undefined;

      try {
        for (var _iterator15 = Object.entries(resp.users)[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
          var _ref13 = _step15.value;

          var _ref14 = _slicedToArray(_ref13, 2);

          var badge_nr = _ref14[0];
          var users = _ref14[1];

          this._ffz_badge_users[badge_nr] = users;
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
    }.bind(this));
  }
};

/* Private: Build a faux PRIVMSG event from the chat message given */
TwitchClient.prototype._buildChatEvent = function _TwitchClient__buildChatEvent(chobj, message) {
  var flag_obj = {};
  var emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
  var chstr = Twitch.FormatChannel(chobj);
  var userstate = this._self_userstate[chstr] || {};
  var msg = message;

  /* Construct the parsed flags object */
  flag_obj["badge-info"] = userstate["badge-info"];
  flag_obj["badges"] = userstate["badges"];
  if (!flag_obj["badges"]) {
    flag_obj["badges"] = [];
  }
  flag_obj["color"] = userstate["color"];
  flag_obj["subscriber"] = userstate["subscriber"];
  flag_obj["mod"] = userstate["mod"];
  flag_obj["vip"] = userstate["vip"] || null;
  flag_obj["broadcaster"] = userstate["broadcaster"] || null;
  flag_obj["display-name"] = userstate["display-name"];
  flag_obj["emotes"] = emote_obj;
  flag_obj["id"] = Util.Random.uuid();
  flag_obj["user-id"] = this._self_userid;
  flag_obj["room-id"] = this._rooms[chobj.channel].id;
  flag_obj["tmi-sent-ts"] = new Date().getTime();
  flag_obj["turbo"] = 0;
  flag_obj["user-type"] = "";
  flag_obj["__synthetic"] = 1;

  /* Construct the formatted flags string */
  var flag_arr = [];
  var addFlag = function addFlag(n, v) {
    var t = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    /* Undefined and null values are treated as empty strings */
    var val = v ? v : "";
    /* If specified, apply the function to the value */
    if (typeof t === "function") {
      val = t(val);
    }
    /* if t(val) returns null or undefined, skip the flag */
    if (typeof val !== "undefined" && val !== null) {
      flag_arr.push(n + "=" + val);
    }
  };
  var addObjFlag = function addObjFlag(n) {
    return addFlag(n, flag_obj[n]);
  };
  if (flag_obj["badges"]) {
    var badges = [];
    var _iteratorNormalCompletion16 = true;
    var _didIteratorError16 = false;
    var _iteratorError16 = undefined;

    try {
      for (var _iterator16 = flag_obj["badges"][Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
        var _ref15 = _step16.value;

        var _ref16 = _slicedToArray(_ref15, 2);

        var b = _ref16[0];
        var r = _ref16[1];

        badges.push(b + "/" + r);
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

    addFlag("badges", badges.join(","));
  } else {
    addFlag("badges", "");
  }
  addObjFlag("color");
  addObjFlag("display-name");
  addObjFlag("subscriber");
  addObjFlag("mod");
  if (flag_obj["vip"]) {
    addObjFlag("vip");
  }
  if (flag_obj["broadcaster"]) {
    addObjFlag("broadcaster");
  }
  addFlag("emotes", Twitch.FormatEmoteFlag(flag_obj["emotes"]));
  addObjFlag("id");
  addObjFlag("user-id");
  addObjFlag("room-id");
  addObjFlag("tmi-sent-ts");
  addObjFlag("turbo");
  addObjFlag("user-type");
  addObjFlag("__synthetic");
  addFlag("__synthetic", "1");
  var flag_str = flag_arr.join(";");

  /* Build the raw and parsed objects */
  var user = userstate["display-name"].toLowerCase();
  var useruri = ":" + user + "!" + user + "@" + user + ".tmi.twitch.tv";
  var channel = Twitch.FormatChannel(chobj);
  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  var raw_line = "@" + flag_str + " " + useruri + " PRIVMSG " + channel + " :";

  /* Handle /me */
  if (msg.startsWith('/me ')) {
    msg = msg.substr('/me '.length);
    raw_line += '\x01ACTION ' + msg + '\x01';
    flag_obj.action = true;
  } else {
    raw_line += msg;
  }

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, {
    cmd: "PRIVMSG",
    flags: flag_obj,
    user: Twitch.ParseUser(useruri),
    channel: chobj,
    message: msg,
    synthetic: true /* mark the event as synthetic */
  });
};

/* End private functions section 0}}} */

/* General status functions {{{0 */

/* Obtain connection status information */
TwitchClient.prototype.ConnectionStatus = function _TwitchClient_ConnectionStatus() {
  return {
    endpoint: this._endpoint,
    capabilities: Util.JSONClone(this._capabilities),
    open: this._is_open,
    connected: this.Connected(),
    identified: this._has_clientid,
    authed: this.IsAuthed()
  };
};

/* Return whether or not we're connected to Twitch */
TwitchClient.prototype.Connected = function _TwitchClient_Connected() {
  return this._connected;
};

/* Return whether or not FFZ support is enabled */
TwitchClient.prototype.FFZEnabled = function _TwitchClient_FFZEnabled() {
  return this._enable_ffz;
};

/* Return whether or not BTTV support is enabled */
TwitchClient.prototype.BTTVEnabled = function _TwitchClient_BTTVEnabled() {
  return this._enable_bttv;
};

TwitchClient.prototype.SelfUserState = function _TwitchClient_SelfUserState() {
  var obj = Util.JSONClone(this._self_userstate);
  obj.userid = this._self_userid;
  return obj;
};

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

      if (test_cap === cap || cap.endsWith('/' + test_cap.replace(/^\//, ""))) {
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
  return userid === this._self_userid;
};

/* End of general status functions 0}}} */

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

  var msg = reason;
  if (!reason) {
    var cname = Twitch.FormatChannel(this._ensureChannel(channel));
    msg = "Timed out by " + this._username + " from " + cname + " for " + duration;
  }
  this.SendMessage(channel, "/timeout " + user + " " + duration + " \"" + msg + "\"");
};

/* Un-timeout the specific user in the specified channel */
TwitchClient.prototype.UnTimeout = function _TwitchClient_UnTimeout(channel, user) {
  this.SendMessage(channel, "/untimeout " + user);
};

/* Ban the specific user from the specified channel */
TwitchClient.prototype.Ban = function _TwitchClient_Ban(channel, user) {
  var reason = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  var msg = reason;
  if (!reason) {
    var cname = Twitch.FormatChannel(this._ensureChannel(channel));
    msg = "Banned from " + cname + " by " + this._username;
  }
  this.SendMessage(channel, "/ban " + user + " " + msg);
};

/* Unban the specific user from the specified channel */
TwitchClient.prototype.UnBan = function _TwitchClient_UnBan(channel, user) {
  this.SendMessage(channel, "/unban " + user);
};

/* End of role and moderation functions 0}}} */

/* Channel functions {{{0 */

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel = function _TwitchClient_JoinChannel(channel) {
  var ch = this._ensureChannel(channel).channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) === -1) {
      this.send("JOIN " + ch);
      this._channels.push(ch);
    } else {
      Util.Warn("JoinChannel: Already in " + ch);
    }
  } else if (this._pending_channels.indexOf(ch) === -1) {
    this._pending_channels.push(ch);
  }
};

/* Request the client to leave the channel specified */
TwitchClient.prototype.LeaveChannel = function _TwitchClient_LeaveChannel(channel) {
  var ch = this._ensureChannel(channel).channel;
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
  var ch = this._ensureChannel(channel).channel;
  return this._is_open && this._channels.indexOf(ch) > -1;
};

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels = function _TwitchClient_GetJoinedChannels() {
  return this._channels;
};

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo = function _TwitchClient_GetChannelInfo(channel) {
  var cname = this._ensureChannel(channel).channel;
  return this._rooms[cname] || {};
};

/* End channel functions 0}}} */

/* Functions related to cheers and emotes {{{0 */

/* Return whether or not the given word is a cheer for the given channel */
TwitchClient.prototype.IsCheer = function _TwitchClient_IsCheer(channel, word) {
  var cname = this._ensureChannel(channel).channel;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    var _iteratorNormalCompletion18 = true;
    var _didIteratorError18 = false;
    var _iteratorError18 = undefined;

    try {
      for (var _iterator18 = Object.keys(this._channel_cheers[cname])[Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
        var name = _step18.value;

        if (word.match(this._channel_cheers[cname][name].word_pattern)) {
          return true;
        }
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
  }
  return false;
};

/* Return all of the cheers found in the message */
TwitchClient.prototype.FindCheers = function _TwitchClient_FindCheers(channel, message) {
  var matches = [];
  var parts = message.split(" ");
  var offset = 0;
  var cname = this._ensureChannel(channel).channel;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    var _iteratorNormalCompletion19 = true;
    var _didIteratorError19 = false;
    var _iteratorError19 = undefined;

    try {
      for (var _iterator19 = Object.entries(this._channel_cheers[cname])[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
        var _ref17 = _step19.value;

        var _ref18 = _slicedToArray(_ref17, 2);

        var name = _ref18[0];
        var cheer = _ref18[1];

        if (message.search(cheer.line_pattern) > -1) {
          var _iteratorNormalCompletion20 = true;
          var _didIteratorError20 = false;
          var _iteratorError20 = undefined;

          try {
            for (var _iterator20 = parts[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
              var token = _step20.value;

              var m = token.match(cheer.word_pattern);
              if (m) {
                var num_bits = Number.parseInt(m[2]);
                matches.push({
                  cheer: cheer,
                  name: m[1],
                  cheername: name,
                  bits: num_bits,
                  start: offset,
                  end: offset + token.length
                });
              }
              offset += token.length + 1;
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

/* Return the emotes the client is allowed to use */
TwitchClient.prototype.GetEmotes = function _TwitchClient_GetEmotes() {
  var emotes = {};
  var _iteratorNormalCompletion21 = true;
  var _didIteratorError21 = false;
  var _iteratorError21 = undefined;

  try {
    for (var _iterator21 = Object.entries(this._self_emotes)[Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
      var _ref19 = _step21.value;

      var _ref20 = _slicedToArray(_ref19, 2);

      var k = _ref20[0];
      var v = _ref20[1];

      emotes[v] = this.GetEmote(k);
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

  return emotes;
};

/* Return the URL to the image for the emote and size specified (id or name) */
TwitchClient.prototype.GetEmote = function _TwitchClient_GetEmote(emote_id) {
  var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "1.0";

  if (typeof emote_id === "number" || ("" + emote_id).match(/^[0-9]+$/)) {
    return Twitch.URL.Emote(emote_id, size);
  } else {
    var _iteratorNormalCompletion22 = true;
    var _didIteratorError22 = false;
    var _iteratorError22 = undefined;

    try {
      for (var _iterator22 = Object.entries(this._self_emotes)[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
        var _ref21 = _step22.value;

        var _ref22 = _slicedToArray(_ref21, 2);

        var k = _ref22[0];
        var v = _ref22[1];

        if (v === emote_id) {
          return Twitch.URL.Emote(k, size);
        }
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
  }
};

/* Obtain the FFZ emotes for a channel */
TwitchClient.prototype.GetFFZEmotes = function _TwitchClient_GetFFZEmotes(channel) {
  return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
};

/* Obtain global BTTV emotes */
TwitchClient.prototype.GetGlobalBTTVEmotes = function _TwitchClient_GetGlobalBTTVEmotes() {
  return this._bttv_global_emotes;
};

/* Obtain the BTTV emotes for the channel specified */
TwitchClient.prototype.GetBTTVEmotes = function _TwitchClient_GetBTTVEmotes(channel) {
  var ch = Twitch.FormatChannel(channel);
  if (this._bttv_channel_emotes[ch]) {
    return this._bttv_channel_emotes[ch];
  } else {
    Util.Log("Channel", channel, "has no BTTV emotes stored");
    return {};
  }
};

/* End of functions related to cheers and emotes 0}}} */

/* Functions for sending messages {{{0 */

/* Send a message to the channel specified */
TwitchClient.prototype.SendMessage = function _TwitchClient_SendMessage(channel, message) {
  var bypassFaux = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var cobj = this._ensureChannel(channel);
  var cname = Twitch.FormatChannel(cobj);
  var msg = Util.EscapeSlashes(message.trim());
  if (this._connected && this._authed) {
    this.send("PRIVMSG " + cobj.channel + " :" + msg);
    /* Dispatch a faux "Message Received" event */
    if (!bypassFaux) {
      if (this._self_userstate[Twitch.FormatChannel(cobj)]) {
        Util.FireEvent(this._buildChatEvent(cname, msg));
      } else {
        Util.Error("No USERSTATE given for channel " + cname);
      }
    }
  } else {
    Util.Warn("Unable to send \"" + msg + "\" to " + cname + ": not connected or not authed");
  }
};

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll = function _TwitchClient_SendMessageToAll(message) {
  if (this._connected) {
    var _iteratorNormalCompletion23 = true;
    var _didIteratorError23 = false;
    var _iteratorError23 = undefined;

    try {
      for (var _iterator23 = this._channels[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
        var ch = _step23.value;

        this.SendMessage(ch, message);
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
  /* Prevent sequential duplicates */
  if (this._history.length === 0 || message !== this._history[0]) {
    this._history.unshift(message);
    while (this.GetHistoryLength() > this.GetHistoryMax()) {
      this._history.pop();
    }
  }
};

/* Obtain the history of sent messages */
TwitchClient.prototype.GetHistory = function _TwitchClient_GetHistory() {
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

/* Asset and API functions {{{0 */

/* Return the data for the given clip slug */
TwitchClient.prototype.GetClip = function _TwitchClient_GetClip(slug) {
  return new Promise(function _getclip_promise(resolve, reject) {
    this._api.GetCB(Twitch.URL.Clip(slug), function _getclip_resp(resp) {
      resolve(resp["data"][0]);
    }, reject);
  }.bind(this));
};

/* Return information on the given game ID */
TwitchClient.prototype.GetGame = function _TwitchClient_GetGame(game_id) {
  return new Promise(function _getgame_promise(resolve, reject) {
    this._api.GetCB(Twitch.URL.Game(game_id), function _getgame_clip(resp) {
      resolve(resp["data"][0]);
    }, reject);
  }.bind(this));
};

/* Return true if the badge specified is a global badge */
TwitchClient.prototype.IsGlobalBadge = function _TwitchClient_IsGlobalBadge(badge_name) {
  var badge_version = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  if (badge_name in this._global_badges) {
    if (badge_version === null) {
      return Object.keys(this._global_badges[badge_name].versions).length > 0;
    } else if (badge_version in this._global_badges[badge_name].versions) {
      if (this._global_badges[badge_name].versions[badge_version]) {
        return true;
      }
    }
  }
  return false;
};

/* Return true if the badge specified exists as a channel badge */
TwitchClient.prototype.IsChannelBadge = function _TwitchClient_IsChannelBadge(channel, badge_name) {
  var badge_num = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  var c = this._ensureChannel(channel).channel;
  if (c in this._channel_badges) {
    if (badge_name in this._channel_badges[c]) {
      var badge = this._channel_badges[c][badge_name];
      if (badge && (badge_num === null || badge[badge_num])) {
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
    var bver = badge_version;
    if (badge_version === null) {
      bver = Object.keys(this._global_badges[badge_name].versions).min();
    }
    if (this._global_badges[badge_name].versions.hasOwnProperty(bver)) {
      return this._global_badges[badge_name].versions[bver];
    }
  }
  return {};
};

/* Returns Object {
 *   image_url_1x: url,
 *   image_url_2x: url,
 *   image_url_4x: url
 * }
 * Returns the first badge if badge_num is null
 */
TwitchClient.prototype.GetChannelBadge = function _TwitchClient_GetChannelBadge(channel, badge_name) {
  var badge_num = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  var cobj = this._ensureChannel(channel);
  if (this.IsChannelBadge(cobj, badge_name, badge_num)) {
    var b = this._channel_badges[cobj.channel][badge_name];
    var idxs = Object.keys(b).sort();
    if (badge_num !== null) {
      return b[badge_num];
    } else if (idxs.length > 0) {
      return b[idxs[0]];
    }
  }
  return null;
};

/* Obtain all of the global badges */
TwitchClient.prototype.GetGlobalBadges = function _TwitchClient_GetGlobalBadges() {
  return Util.JSONClone(this._global_badges);
};

/* Obtain all of the channel badges for the specified channel */
TwitchClient.prototype.GetChannelBadges = function _TwitchClient_GetChannelBadges(channel) {
  var cobj = this._ensureChannel(channel);
  if (this._channel_badges.hasOwnProperty(cobj.channel)) {
    return Util.JSONClone(this._channel_badges[cobj.channel]);
  }
  return {};
};

/* End of asset handling functions 0}}} */

/* Websocket callbacks {{{0 */

/* Callback: called when the websocket opens */
TwitchClient.prototype._onWebsocketOpen = function _TwitchClient__onWebsocketOpen(name, pass) {
  this.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  if (name && pass) {
    this._username = name;
  } else {
    this._username = "justinfan" + Math.floor(Math.random() * 999999);
  }
  if (pass) {
    this.send("PASS " + (pass.indexOf("oauth:") === 0 ? "" : "oauth:") + pass);
    this.send("NICK " + name);
  } else {
    this.send("NICK " + this._username);
  }
  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = this._pending_channels[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      var i = _step24.value;

      this.JoinChannel(i);
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

  this._pending_channels = [];
  this._getGlobalBadges();
  Util.FireEvent(new TwitchEvent("OPEN", null, { "has-clientid": this._has_clientid }));
};

/* Callback: called when the websocket receives a message */
TwitchClient.prototype._onWebsocketMessage = function _TwitchClient__onWebsocketMessage(ws_event) {
  var _this3 = this;

  var lines = ws_event.data.trim().split("\r\n");
  /* Log the lines to the debug console */
  if (lines.length === 1) {
    Util.LogOnly("ws recv> \"" + lines[0] + "\"");
  } else {
    var _iteratorNormalCompletion25 = true;
    var _didIteratorError25 = false;
    var _iteratorError25 = undefined;

    try {
      for (var _iterator25 = Object.entries(lines)[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
        var _ref23 = _step25.value;

        var _ref24 = _slicedToArray(_ref23, 2);

        var i = _ref24[0];
        var l = _ref24[1];

        var n = Number.parseInt(i) + 1;
        if (l.trim().length > 0) Util.LogOnly("ws recv/" + n + "> \"" + l + "\"");
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

  var _loop = function _loop(line) {
    /* Ignore empty lines */
    if (line.trim() === '') {
      return "continue";
    }

    var result = Twitch.ParseIRCMessage(line);

    /* Fire twitch-message for every line received */
    Util.FireEvent(new TwitchEvent("MESSAGE", line, result));

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
      _this3._ensureRoom(result.channel);
      cname = result.channel.channel;
      cstr = Twitch.FormatChannel(result.channel);
      room = _this3._rooms[cname];
      if (result.flags && result.flags["room-id"]) {
        roomid = result.flags["room-id"];
      }
    }

    /* Handle each command that could be returned */
    switch (result.cmd) {
      case "PING":
        _this3.send("PONG :" + result.server);
        break;
      case "ACK":
        _this3._connected = true;
        _this3._capabilities = result.flags;
        break;
      case "TOPIC":
        break;
      case "NAMES":
        var _iteratorNormalCompletion27 = true;
        var _didIteratorError27 = false;
        var _iteratorError27 = undefined;

        try {
          for (var _iterator27 = result.usernames[Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
            var user = _step27.value;

            _this3._onJoin(result.channel, user);
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

        break;
      case "JOIN":
        _this3._onJoin(result.channel, result.user);
        break;
      case "PART":
        _this3._onPart(result.channel, result.user);
        break;
      case "RECONNECT":
        _this3.Connect();
        break;
      case "MODE":
        if (result.modeflag === "+o") {
          _this3._onOp(result.channel, result.user);
        } else if (result.modeflag === "-o") {
          _this3._onDeOp(result.channel, result.user);
        }
        break;
      case "PRIVMSG":
        {
          var event = new TwitchChatEvent(line, result);
          if (!room.userInfo.hasOwnProperty(result.user)) {
            room.userInfo[result.user] = {};
          }
          if (!event.flags.badges) event.flags.badges = [];
          if (_this3._enable_ffz) {
            var _iteratorNormalCompletion28 = true;
            var _didIteratorError28 = false;
            var _iteratorError28 = undefined;

            try {
              for (var _iterator28 = Object.entries(_this3._ffz_badge_users)[Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
                var _ref25 = _step28.value;

                var _ref26 = _slicedToArray(_ref25, 2);

                var badge_nr = _ref26[0];
                var users = _ref26[1];

                if (users.indexOf(result.user) > -1) {
                  var ffz_badges = event.flags['ffz-badges'];
                  if (!ffz_badges) ffz_badges = [];
                  ffz_badges.push(_this3._ffz_badges[badge_nr]);
                  event.flags['ffz-badges'] = ffz_badges;
                }
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
          var ui = room.userInfo[result.user];
          ui.ismod = event.ismod;
          ui.issub = event.issub;
          ui.isvip = event.isvip;
          ui.userid = event.flags['user-id'];
          ui.uuid = event.flags['id'];
          ui.badges = event.flags['badges'];
          Util.FireEvent(event);
        }break;
      case "WHISPER":
        break;
      case "USERSTATE":
        if (!_this3._self_userstate.hasOwnProperty(cstr)) {
          _this3._self_userstate[cstr] = {};
        }
        var _iteratorNormalCompletion29 = true;
        var _didIteratorError29 = false;
        var _iteratorError29 = undefined;

        try {
          for (var _iterator29 = Object.entries(result.flags)[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
            var _ref27 = _step29.value;

            var _ref28 = _slicedToArray(_ref27, 2);

            var key = _ref28[0];
            var val = _ref28[1];

            _this3._self_userstate[cstr][key] = val;
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

        break;
      case "ROOMSTATE":
        room.id = roomid;
        room.channel = result.channel;
        if (_this3._authed) {
          _this3._getRooms(cname, roomid);
        }
        if (!_this3._no_assets) {
          _this3._getChannelBadges(cname, roomid);
          _this3._getChannelCheers(cname, roomid);
          if (_this3._enable_ffz) {
            _this3._getFFZEmotes(cname, roomid);
          }
          if (_this3._enable_bttv) {
            _this3._getBTTVEmotes(cname, roomid);
          }
        }
        _this3._api.GetCB(Twitch.URL.Stream(roomid), function _stream_cb(resp) {
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
        });
        break;
      case "USERNOTICE":
        if (result.sub_kind === "SUB") {
          Util.FireEvent(new TwitchSubEvent("SUB", line, result));
        } else if (result.sub_kind === "RESUB") {
          Util.FireEvent(new TwitchSubEvent("RESUB", line, result));
        } else if (result.sub_kind === "GIFTSUB") {
          Util.FireEvent(new TwitchSubEvent("GIFTSUB", line, result));
        } else if (result.sub_kind === "ANONGIFTSUB") {
          Util.FireEvent(new TwitchSubEvent("ANONGIFTSUB", line, result));
        } else if (result.israid) {
          Util.FireEvent(new TwitchEvent("RAID", line, result));
        } else if (result.isritual && result.ritual_kind === "new_chatter") {
          Util.FireEvent(new TwitchEvent("NEWUSER", line, result));
        } else if (result.ismysterygift) {
          Util.FireEvent(new TwitchSubEvent("MYSTERYGIFT", line, result));
        } else if (result.isrewardgift) {
          Util.FireEvent(new TwitchSubEvent("REWARDGIFT", line, result));
        } else if (result.isupgrade) {
          var command = "OTHERUSERNOTICE";
          if (result.isgiftupgrade) {
            command = "GIFTUPGRADE";
          } else if (result.isprimeupgrade) {
            command = "PRIMEUPGRADE";
          } else if (result.isanongiftupgrade) {
            command = "ANONGIFTUPGRADE";
          }
          Util.FireEvent(new TwitchEvent(command, line, result));
        } else {
          Util.FireEvent(new TwitchEvent("OTHERUSERNOTICE", line, result));
        }
        break;
      case "GLOBALUSERSTATE":
        _this3._self_userid = result.flags['user-id'];
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
        Util.Error("Unhandled event:", result, line);
        break;
    }

    /* Obtain emotes the client is able to use */
    if (result.cmd === "USERSTATE" || result.cmd === "GLOBALUSERSTATE") {
      if (result.flags && result.flags["emote-sets"]) {
        var eset_url = Twitch.URL.EmoteSet(result.flags["emote-sets"].join(','));
        _this3._api.GetCB(eset_url, function _emoteset_cb(json) {
          var _iteratorNormalCompletion30 = true;
          var _didIteratorError30 = false;
          var _iteratorError30 = undefined;

          try {
            for (var _iterator30 = Object.keys(json["emoticon_sets"])[Symbol.iterator](), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
              var eset = _step30.value;
              var _iteratorNormalCompletion31 = true;
              var _didIteratorError31 = false;
              var _iteratorError31 = undefined;

              try {
                for (var _iterator31 = json["emoticon_sets"][eset][Symbol.iterator](), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
                  var edef = _step31.value;

                  this._self_emotes[edef.id] = edef.code;
                }
              } catch (err) {
                _didIteratorError31 = true;
                _iteratorError31 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion31 && _iterator31.return) {
                    _iterator31.return();
                  }
                } finally {
                  if (_didIteratorError31) {
                    throw _iteratorError31;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError30 = true;
            _iteratorError30 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion30 && _iterator30.return) {
                _iterator30.return();
              }
            } finally {
              if (_didIteratorError30) {
                throw _iteratorError30;
              }
            }
          }
        }.bind(_this3));
      }
    }
  };

  var _iteratorNormalCompletion26 = true;
  var _didIteratorError26 = false;
  var _iteratorError26 = undefined;

  try {
    for (var _iterator26 = lines[Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
      var line = _step26.value;

      var _ret = _loop(line);

      if (_ret === "continue") continue;
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
};

/* Callback: called when the websocket receives an error */
TwitchClient.prototype._onWebsocketError = function _TwitchClient__onWebsocketError(event) {
  Util.Error(event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
};

/* Callback: called when the websocket is closed */
TwitchClient.prototype._onWebsocketClose = function _TwitchClient__onWebsocketClose(event) {
  var _iteratorNormalCompletion32 = true;
  var _didIteratorError32 = false;
  var _iteratorError32 = undefined;

  try {
    for (var _iterator32 = this._channels[Symbol.iterator](), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
      var chobj = _step32.value;

      if (this._pending_channels.indexOf(chobj) === -1) {
        this._pending_channels.push(chobj);
      }
    }
  } catch (err) {
    _didIteratorError32 = true;
    _iteratorError32 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion32 && _iterator32.return) {
        _iterator32.return();
      }
    } finally {
      if (_didIteratorError32) {
        throw _iteratorError32;
      }
    }
  }

  this._channels = [];
  Util.Log("WebSocket Closed", event);
  Util.FireEvent(new TwitchEvent("CLOSE", event));
};

/* End websocket callbacks 0}}} */

/* Twitch utilities {{{0 */

var Twitch = {};

/* Escape sequences {{{1 */

Twitch.FLAG_ESCAPE_RULES = [
/* escaped character, escaped regex, raw character, raw regex */
["\\s", /\\s/g, " ", / /g], ["\\:", /\\:/g, ";", /;/g], ["\\r", /\\r/g, "\r", /\r/g], ["\\n", /\\n/g, "\n", /\n/g], ["\\\\", /\\\\/g, "\\", /\\/g]];

/* End escape sequences 1}}} */

/* API URL definitions {{{1 */

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";
Twitch.Badges = "https://badges.twitch.tv/v1/badges";

/* Store URLs to specific asset APIs */
Twitch.URL = {};

Twitch.URL.Rooms = function (cid) {
  return Twitch.Kraken + "/chat/" + cid + "/rooms";
};
Twitch.URL.Stream = function (cid) {
  return Twitch.Kraken + "/streams?channel=" + cid;
};
Twitch.URL.Clip = function (slug) {
  return Twitch.Helix + "/clips?id=" + slug;
};
Twitch.URL.Game = function (id) {
  return Twitch.Helix + "/games?id=" + id;
};

Twitch.URL.ChannelBadges = function (cid) {
  return Twitch.Badges + "/channels/" + cid + "/display?language=en";
};
Twitch.URL.Badges = function (cid) {
  return Twitch.Kraken + "/chat/" + cid + "/badges";
};
Twitch.URL.AllBadges = function () {
  return "https://badges.twitch.tv/v1/badges/global/display";
};
Twitch.URL.Cheer = function (prefix, tier) {
  var scheme = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "dark";
  var size = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 1;
  return "https://d3aqoihi2n8ty8.cloudfront.net/actions/" + prefix + "/" + scheme + "/animated/" + tier + "/" + size + ".gif";
};
Twitch.URL.Cheers = function (cid) {
  return Twitch.Kraken + "/bits/actions?channel_id=" + cid;
};
Twitch.URL.AllCheers = function () {
  return Twitch.Kraken + "/bits/actions";
};
Twitch.URL.Emote = function (eid) {
  var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '1.0';
  return Twitch.JTVNW + "/emoticons/v1/" + eid + "/" + size;
};
Twitch.URL.EmoteSet = function (eset) {
  return Twitch.Kraken + "/chat/emoticon_images?emotesets=" + eset;
};

Twitch.URL.FFZAllEmotes = function () {
  return Twitch.FFZ + "/emoticons";
};
Twitch.URL.FFZEmotes = function (cid) {
  return Twitch.FFZ + "/room/id/" + cid;
};
Twitch.URL.FFZEmote = function (eid) {
  return Twitch.FFZ + "/emote/" + eid;
};
Twitch.URL.FFZBadges = function () {
  return Twitch.FFZ + "/_badges";
};
Twitch.URL.FFZBadgeUsers = function () {
  return Twitch.FFZ + "/badges";
};

Twitch.URL.BTTVAllEmotes = function () {
  return Twitch.BTTV + "/emotes";
};
Twitch.URL.BTTVEmotes = function (cname) {
  return Twitch.BTTV + "/channels/" + cname;
};
Twitch.URL.BTTVEmote = function (eid) {
  return Twitch.BTTV + "/emote/" + eid + "/1x";
};

/* End API URL definitions 1}}} */

/* Abstract XMLHttpRequest to `url -> callback` and `url -> Promise` systems */
Twitch.API = function _Twitch_API(global_headers, private_headers) {
  var onerror = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  this.GetSimpleCB = function _Twitch_API_GetSimple(url, callback) {
    var errorcb = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var req = new XMLHttpRequest();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          Util.Warn(this);
        }
      }
    };
    req.open("GET", url);
    req.send();
  };

  /* GET url, optionally adding private headers, using callbacks */
  this.GetCB = function _Twitch_API_Get(url, callback) {
    var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var add_private = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var errorcb = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;

    var req = new XMLHttpRequest();
    var callerStack = Util.GetStack();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          Util.WarnOnly("Failed to get \"" + url + "\" stack=", callerStack);
          Util.WarnOnly(url, this);
        }
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    var _iteratorNormalCompletion33 = true;
    var _didIteratorError33 = false;
    var _iteratorError33 = undefined;

    try {
      for (var _iterator33 = Object.keys(global_headers)[Symbol.iterator](), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
        var key = _step33.value;

        req.setRequestHeader(key, global_headers[key]);
      }
    } catch (err) {
      _didIteratorError33 = true;
      _iteratorError33 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion33 && _iterator33.return) {
          _iterator33.return();
        }
      } finally {
        if (_didIteratorError33) {
          throw _iteratorError33;
        }
      }
    }

    var _iteratorNormalCompletion34 = true;
    var _didIteratorError34 = false;
    var _iteratorError34 = undefined;

    try {
      for (var _iterator34 = Object.keys(headers)[Symbol.iterator](), _step34; !(_iteratorNormalCompletion34 = (_step34 = _iterator34.next()).done); _iteratorNormalCompletion34 = true) {
        var _key2 = _step34.value;

        req.setRequestHeader(_key2, headers[_key2]);
      }
    } catch (err) {
      _didIteratorError34 = true;
      _iteratorError34 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion34 && _iterator34.return) {
          _iterator34.return();
        }
      } finally {
        if (_didIteratorError34) {
          throw _iteratorError34;
        }
      }
    }

    if (add_private) {
      var _iteratorNormalCompletion35 = true;
      var _didIteratorError35 = false;
      var _iteratorError35 = undefined;

      try {
        for (var _iterator35 = Object.keys(private_headers)[Symbol.iterator](), _step35; !(_iteratorNormalCompletion35 = (_step35 = _iterator35.next()).done); _iteratorNormalCompletion35 = true) {
          var _key3 = _step35.value;

          req.setRequestHeader(_key3, private_headers[_key3]);
        }
      } catch (err) {
        _didIteratorError35 = true;
        _iteratorError35 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion35 && _iterator35.return) {
            _iterator35.return();
          }
        } finally {
          if (_didIteratorError35) {
            throw _iteratorError35;
          }
        }
      }
    }
    req.send();
  };
};

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  return user.replace(/^:/, "").split('!')[0];
};

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  if (typeof channel === "string") {
    var chobj = {
      channel: "",
      room: null,
      roomuid: null
    };
    var parts = channel.split(':');
    if (parts.length === 1) {
      chobj.channel = parts[0];
    } else if (parts.length === 3) {
      chobj.channel = parts[0];
      chobj.room = parts[1];
      chobj.roomuid = parts[2];
    } else {
      Util.Warn("ParseChannel: " + channel + " not in expected format");
      chobj.channel = parts[0];
    }
    if (chobj.channel.indexOf('#') !== 0) {
      chobj.channel = '#' + chobj.channel;
    }
    return chobj;
  } else if (channel && channel.channel) {
    return Twitch.ParseChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("ParseChannel: don't know how to parse", channel);
    return { channel: "GLOBAL", room: null, roomuid: null };
  }
};

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof channel === "string") {
    var _cname = channel.toLowerCase();
    if (_cname === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room) {
        _cname += ':' + room;
      }
      if (roomuid) {
        _cname += ':' + roomuid;
      }
      if (_cname.indexOf('#') !== 0) {
        _cname = '#' + _cname;
      }
      return _cname;
    }
  } else if (channel && typeof channel.channel === "string") {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel, room, roomuid);
    return "" + channel;
  }
};

/* Parse Twitch flag escape sequences */
Twitch.DecodeFlag = function _Twitch_DecodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion36 = true;
  var _didIteratorError36 = false;
  var _iteratorError36 = undefined;

  try {
    for (var _iterator36 = Twitch.FLAG_ESCAPE_RULES[Symbol.iterator](), _step36; !(_iteratorNormalCompletion36 = (_step36 = _iterator36.next()).done); _iteratorNormalCompletion36 = true) {
      var row = _step36.value;

      result = result.replace(row[1], row[2]);
    }
  } catch (err) {
    _didIteratorError36 = true;
    _iteratorError36 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion36 && _iterator36.return) {
        _iterator36.return();
      }
    } finally {
      if (_didIteratorError36) {
        throw _iteratorError36;
      }
    }
  }

  return result;
};

/* Format Twitch flag escape sequences */
Twitch.EncodeFlag = function _Twitch_EncodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion37 = true;
  var _didIteratorError37 = false;
  var _iteratorError37 = undefined;

  try {
    for (var _iterator37 = Twitch.FLAG_ESCAPE_RULES.reverse()[Symbol.iterator](), _step37; !(_iteratorNormalCompletion37 = (_step37 = _iterator37.next()).done); _iteratorNormalCompletion37 = true) {
      var row = _step37.value;

      result = result.replace(row[3], row[0]);
    }
  } catch (err) {
    _didIteratorError37 = true;
    _iteratorError37 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion37 && _iterator37.return) {
        _iterator37.return();
      }
    } finally {
      if (_didIteratorError37) {
        throw _iteratorError37;
      }
    }
  }

  return result;
};

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  var result = null;
  if (value.length === 0) {
    result = "";
  } else if (key === "badge-info" || key === "badges") {
    result = [];
    var _iteratorNormalCompletion38 = true;
    var _didIteratorError38 = false;
    var _iteratorError38 = undefined;

    try {
      for (var _iterator38 = value.split(',')[Symbol.iterator](), _step38; !(_iteratorNormalCompletion38 = (_step38 = _iterator38.next()).done); _iteratorNormalCompletion38 = true) {
        var badge = _step38.value;

        var _badge$split = badge.split('/'),
            _badge$split2 = _slicedToArray(_badge$split, 2),
            badge_name = _badge$split2[0],
            badge_rev = _badge$split2[1];

        result.push([badge_name, badge_rev]);
      }
    } catch (err) {
      _didIteratorError38 = true;
      _iteratorError38 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion38 && _iterator38.return) {
          _iterator38.return();
        }
      } finally {
        if (_didIteratorError38) {
          throw _iteratorError38;
        }
      }
    }
  } else if (key === "emotes") {
    result = Twitch.ParseEmote(value);
  } else if (key === "emote-sets") {
    result = value.split(',').map(function (e) {
      return Number.parse(e);
    });
  } else {
    result = Twitch.DecodeFlag(value);
  }
  if (typeof result === "string") {
    var temp = Number.parse(result);
    if (!Number.isNaN(temp)) {
      result = temp;
    }
  }
  return result;
};

/* Parse @<flags...> key,value pairs */
Twitch.ParseFlags = function _Twitch_ParseFlags(dataString) {
  /* @key=value;key=value;... */
  var dataStr = dataString.replace(/^@/, "");
  var data = {};
  var _iteratorNormalCompletion39 = true;
  var _didIteratorError39 = false;
  var _iteratorError39 = undefined;

  try {
    for (var _iterator39 = dataStr.split(';')[Symbol.iterator](), _step39; !(_iteratorNormalCompletion39 = (_step39 = _iterator39.next()).done); _iteratorNormalCompletion39 = true) {
      var item = _step39.value;

      var key = item;
      var val = "";
      if (item.indexOf('=') !== -1) {
        var _item$split = item.split('=');

        var _item$split2 = _slicedToArray(_item$split, 2);

        key = _item$split2[0];
        val = _item$split2[1];
      }
      val = Twitch.ParseFlag(key, val);
      data[key] = val;
    }
  } catch (err) {
    _didIteratorError39 = true;
    _iteratorError39 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion39 && _iterator39.return) {
        _iterator39.return();
      }
    } finally {
      if (_didIteratorError39) {
        throw _iteratorError39;
      }
    }
  }

  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  var result = [];
  var _iteratorNormalCompletion40 = true;
  var _didIteratorError40 = false;
  var _iteratorError40 = undefined;

  try {
    for (var _iterator40 = value.split('/')[Symbol.iterator](), _step40; !(_iteratorNormalCompletion40 = (_step40 = _iterator40.next()).done); _iteratorNormalCompletion40 = true) {
      var emote_def = _step40.value;

      var sep_pos = emote_def.indexOf(':');
      var emote_id = Number.parseInt(emote_def.substr(0, sep_pos));
      var _iteratorNormalCompletion41 = true;
      var _didIteratorError41 = false;
      var _iteratorError41 = undefined;

      try {
        for (var _iterator41 = emote_def.substr(sep_pos + 1).split(',')[Symbol.iterator](), _step41; !(_iteratorNormalCompletion41 = (_step41 = _iterator41.next()).done); _iteratorNormalCompletion41 = true) {
          var range = _step41.value;

          var _range$split = range.split('-'),
              _range$split2 = _slicedToArray(_range$split, 2),
              start = _range$split2[0],
              end = _range$split2[1];

          result.push({
            id: emote_id,
            name: null,
            start: Number.parseInt(start),
            end: Number.parseInt(end)
          });
        }
      } catch (err) {
        _didIteratorError41 = true;
        _iteratorError41 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion41 && _iterator41.return) {
            _iterator41.return();
          }
        } finally {
          if (_didIteratorError41) {
            throw _iteratorError41;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError40 = true;
    _iteratorError40 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion40 && _iterator40.return) {
        _iterator40.return();
      }
    } finally {
      if (_didIteratorError40) {
        throw _iteratorError40;
      }
    }
  }

  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  var specs = [];
  var _iteratorNormalCompletion42 = true;
  var _didIteratorError42 = false;
  var _iteratorError42 = undefined;

  try {
    for (var _iterator42 = emotes[Symbol.iterator](), _step42; !(_iteratorNormalCompletion42 = (_step42 = _iterator42.next()).done); _iteratorNormalCompletion42 = true) {
      var emote = _step42.value;

      if (emote.id !== null) {
        specs.push(emote.id + ":" + emote.start + "-" + emote.end);
      }
    }
  } catch (err) {
    _didIteratorError42 = true;
    _iteratorError42 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion42 && _iterator42.return) {
        _iterator42.return();
      }
    } finally {
      if (_didIteratorError42) {
        throw _iteratorError42;
      }
    }
  }

  return specs.join('/');
};

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; dont escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
};

/* Generate emote specifications for the given emotes [eid, ename] */
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes) {
  var escape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var results = [];
  var _iteratorNormalCompletion43 = true;
  var _didIteratorError43 = false;
  var _iteratorError43 = undefined;

  try {
    for (var _iterator43 = emotes[Symbol.iterator](), _step43; !(_iteratorNormalCompletion43 = (_step43 = _iterator43.next()).done); _iteratorNormalCompletion43 = true) {
      var emote_def = _step43.value;

      var _emote_def = _slicedToArray(emote_def, 2),
          eid = _emote_def[0],
          emote = _emote_def[1];

      var pat = Twitch.EmoteToRegex(escape ? RegExp.escape(emote) : emote);
      var arr = void 0;
      while ((arr = pat.exec(msg)) !== null) {
        /* arr = [wholeMatch, matchPart] */
        var start = arr.index + arr[0].indexOf(arr[1]);
        /* -1 to keep consistent with Twitch's off-by-one */
        var end = start + arr[1].length - 1;
        results.push({ id: eid, pat: pat, name: emote, start: start, end: end });
      }
    }
  } catch (err) {
    _didIteratorError43 = true;
    _iteratorError43 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion43 && _iterator43.return) {
        _iterator43.return();
      }
    } finally {
      if (_didIteratorError43) {
        throw _iteratorError43;
      }
    }
  }

  return results;
};

/* Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  var result = { cmd: null };
  var parts = line.split(' ');
  var data = {};
  if (parts[0].startsWith('@')) {
    data = Twitch.ParseFlags(parts[0]);
    parts.shift();
  }
  /* line.substr(line.indexOf(..., line.indexOf(...)) + 1) */
  function argFrom(l, token, refpart) {
    return l.substr(l.indexOf(token, l.indexOf(refpart)) + 1);
  }
  if (parts[0] === "PING") {
    /* "PING :<server>" */
    result.cmd = "PING";
    result.server = parts[1].replace(/^:/, "");
  } else if (parts[1] === "CAP" && parts[2] === "*" && parts[3] === "ACK") {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = "ACK";
    result.operation = "CAP";
    result.server = parts[0].replace(/^:/, "");
    result.flags = line.substr(line.indexOf(':', 1) + 1).split(" ");
  } else if (parts[1] === "375" || parts[1] === "376" || parts[1] === "366") {
    /* 375: Start TOPIC; 376: End TOPIC; 366: End NAMES */
    /* :<server> <code> <username> :<message> */
    result.cmd = "OTHER";
    result.server = parts[0].replace(/^:/, "");
    result.code = parts[1];
  } else if (parts[1].match(/00[1-9]/) || parts[1] === "372") {
    /* :<server> 00[1-4] <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
    result.server = parts[0].replace(/^:/, "");
    result.username = parts[2];
    result.message = parts.slice(3).join(' ').replace(/^:/, "");
  } else if (parts[1] === "353") {
    /* NAMES listing entry */
    /* :<user> 353 <username> <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = Twitch.ParseUser(parts[0].replace(/^:/, ""));
    result.mode = parts[3];
    result.channel = Twitch.ParseChannel(parts[4]);
    result.usernames = parts.slice(5).join(' ').replace(/^:/, "").split(' ');
  } else if (parts[1] === "JOIN" || parts[1] === "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "MODE") {
    /* ":<sender> MODE <channel> <modeflag> <username>" */
    result.cmd = "MODE";
    result.sender = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.modeflag = parts[3];
    result.user = parts[4];
  } else if (parts[1] === "PRIVMSG") {
    /* [@<flags>] :<user> PRIVMSG <channel> :<msg> */
    var msg = argFrom(line, ":", parts[2]);
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    if (msg.startsWith('\x01ACTION ')) {
      result.flags.action = true;
      result.message = msg.strip('\x01').substr('ACTION '.length);
    } else {
      result.flags.action = false;
      result.message = msg;
    }
  } else if (parts[1] === "WHISPER") {
    result.cmd = "WHISPER";
    result.flags = data;
    result.user = data["display-name"];
    result.sender = Twitch.ParseUser(parts[0]);
    result.recipient = Twitch.ParseUser(parts[2]);
    result.message = argFrom(line, ":", "WHISPER");
  } else if (parts[1] === "USERSTATE") {
    /* [@<flags>] :<server> USERSTATE <channel> */
    result.cmd = "USERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.username = data["display-name"];
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "ROOMSTATE") {
    /* [@<flags>] :<server> ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "USERNOTICE") {
    /* [@<flags>] :<server> USERNOTICE <channel> */
    /* [@<flags>] :<server> USERNOTICE <channel> :<message> */
    result.cmd = "USERNOTICE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.message = argFrom(line, ":", parts[2]);
    }
    result.sub_kind = TwitchSubEvent.FromMsgID(result.flags["msg-id"]);
    result.issub = result.sub_kind !== null;
    result.israid = result.flags["msg-id"] === "raid";
    result.isritual = result.flags["msg-id"] === "ritual";
    result.ismysterygift = result.flags["msg-id"] === "submysterygift";
    result.isrewardgift = result.flags["msg-id"] === "rewardgift";
    result.isgiftupgrade = result.flags["msg-id"] === "giftpaidupgrade";
    result.isprimeupgrade = result.flags["msg-id"] === "primepaidupgrade";
    result.isanongiftupgrade = result.flags["msg-id"] === "anongiftpaidupgrade";
    result.isupgrade = result.flags["msg-id"].endsWith("paidupgrade");
    if (result.israid) {
      result.viewer_count = result.flags["msg-param-viewerCount"];
      result.raider = result.flags["msg-param-displayName"];
      result.raid_user = result.flags["msg-param-login"];
    }
    if (result.isritual) {
      result.ritual_kind = result.flags["msg-param-ritual-name"];
    }
  } else if (parts[1] === "GLOBALUSERSTATE") {
    /* "[@<flags>] :server GLOBALUSERSTATE\r\n" */
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
  } else if (parts[1] === "CLEARCHAT") {
    /* "[@<flags>] :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
    result.cmd = "CLEARCHAT";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.user = argFrom(line, ":", parts[2]);
    }
  } else if (parts[1] === "CLEARMSG") {
    /* "[@<flags>] :<server> CLEARMSG <channel> :<message>\r\n" */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "HOSTTARGET") {
    /* ":<server> HOSTTARGET <channel> :<user> -\r\n" */
    result.cmd = "HOSTTARGET";
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = parts[3].replace(/^:/, "");
  } else if (parts[1] === "NOTICE") {
    /* "[@<flags>] :<server> NOTICE <channel> :<message>\r\n" */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "421") {
    /* Error */
    /* ":<server> 421 <user> <command> :<message>\r\n" */
    result.cmd = "ERROR";
    result.server = parts[0].replace(/^:/, "");
    result.user = Twitch.ParseUser(parts[2]);
    result.command = parts[3];
    result.message = argFrom(line, ":", parts[3]);
  } else {
    Util.Warn("OnWebsocketMessage: unknown message:", parts);
  }
  /* Ensure result.flags has values defined by badges */
  if (result.flags && result.flags.badges) {
    var _iteratorNormalCompletion44 = true;
    var _didIteratorError44 = false;
    var _iteratorError44 = undefined;

    try {
      for (var _iterator44 = result.flags.badges[Symbol.iterator](), _step44; !(_iteratorNormalCompletion44 = (_step44 = _iterator44.next()).done); _iteratorNormalCompletion44 = true) {
        var badge_def = _step44.value;

        var badge_name = badge_def[0];
        /* let badge_rev = badge_def[1]; */
        if (badge_name === "broadcaster") {
          result.flags.broadcaster = 1;
          result.flags.mod = 1;
        }
        if (badge_name === "subscriber") {
          result.flags.subscriber = 1;
        }
        if (badge_name === "moderator") {
          result.flags.mod = 1;
        }
      }
    } catch (err) {
      _didIteratorError44 = true;
      _iteratorError44 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion44 && _iterator44.return) {
          _iterator44.return();
        }
      } finally {
        if (_didIteratorError44) {
          throw _iteratorError44;
        }
      }
    }
  }
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  var pats = [['oauth:', /oauth:[\w]+/g], ['OAuth ', /OAuth [\w]+/g]];
  var result = msg;
  var _iteratorNormalCompletion45 = true;
  var _didIteratorError45 = false;
  var _iteratorError45 = undefined;

  try {
    for (var _iterator45 = pats[Symbol.iterator](), _step45; !(_iteratorNormalCompletion45 = (_step45 = _iterator45.next()).done); _iteratorNormalCompletion45 = true) {
      var _ref29 = _step45.value;

      var _ref30 = _slicedToArray(_ref29, 2);

      var name = _ref30[0];
      var pat = _ref30[1];

      if (result.search(pat)) {
        result = result.replace(pat, name + "<removed>");
      }
    }
  } catch (err) {
    _didIteratorError45 = true;
    _iteratorError45 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion45 && _iterator45.return) {
        _iterator45.return();
      }
    } finally {
      if (_didIteratorError45) {
        throw _iteratorError45;
      }
    }
  }

  return msg;
};

/* End Twitch utilities 0}}} */