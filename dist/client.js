"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 * Emotes like ":-D" show more than one emote (turbo 1, turbo 2, global)
 */

/* TODO/FIXME:
 * Remove _getRooms and room support altogether
 * Change APIs from Kraken to Helix
 *  Twitch.URL.Stream(channelid)
 *    `${Twitch.Helix}/streams?user_id=${channelid}`
 *  Twitch.URL.GlobalCheers()
 *  Twitch.URL.Cheers(channelid)
 *  Twitch.URL.EmoteSet(emoteset)
 */

/* TODO (IMPROVEMENT): Rewrite GetEmote API
 *  Abbreviations:
 *    e_url :== string, emote URL
 *    e_name :== string, emote's name
 *    e_id :== number, emote's numeric id
 *    eset :== number, emote set ID
 *  GetEmote(e_id or e_name, size=default)
 *    e_url
 *  GetGlobalEmote(e_id or e_name, size=default)
 *    e_url
 *  GetChannelEmote(channel, e_id or e_name, size=default)
 *    e_url
 *  GetGlobalEmotes(size=default)
 *    {e_name: e_url}
 *  GetChannelEmotes(channel, size=default)
 *    {e_name: e_url}
 *  GetAllChannelEmotes(size=default)
 *    {channel: {e_name: e_url}}
 *  GetEmoteSets(size=default)
 *    {eset: {e_name: e_url}}
 *  GetEmoteSet(eset, size=default)
 *    {e_name: e_url}
 *  GetEmoteInfo(e_id or e_name)
 *    {e_name: {id: e_id, pattern: emote_pattern, ...}}
 */

/* Container for Twitch utilities */

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Twitch = {};

/* Blacklisted emoteset IDs (loading these give HTTP 503) */
Twitch.BAD_EMOTESET_IDS = ['1825876091', '1590490520', '798691873', '1285844906'];

/* Event classes {{{0 */

/* Base Event object for Twitch events */

var TwitchEvent = function () {
  function TwitchEvent(type, raw, parsed) {
    _classCallCheck(this, TwitchEvent);

    this._cmd = type;
    this._raw = raw || "";
    if (!parsed) {
      /* Construct from essentially nothing */
      this._parsed = {};
    } else if (parsed instanceof window.Event) {
      /* Construct from an event */
      this._parsed = {
        event: parsed,
        name: Object.getPrototypeOf(parsed).constructor.name
      };
    } else {
      /* Construct from an object */
      this._parsed = parsed;
    }
    if (TwitchEvent.COMMAND_LIST.indexOf(this._cmd) === -1) {
      Util.Error('Command "' + this._cmd + '" not enumerated in this.COMMANDS');
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

  /* All "twitch-<cmd>" commands; (s) = synthetic */


  _createClass(TwitchEvent, [{
    key: 'flag',


    /* Obtain the named flag */
    value: function flag(_flag) {
      if (this.values.flags) {
        return this.values.flags[_flag];
      }
      return null;
    }

    /* Obtain a "msg-param-" value */

  }, {
    key: 'param',
    value: function param(name) {
      return this.flag("msg-param-" + name);
    }

    /* Obtain the first non-falsy value of the listed flags */

  }, {
    key: 'firstFlag',
    value: function firstFlag() {
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

    /* Return the msg-id, if one is present */

  }, {
    key: 'repr',


    /* Object.prototype.toSource convenience function (for debugging) */
    value: function repr() {
      /* Return a value similar to Object.toSource() */
      var cls = Object.getPrototypeOf(this).constructor.name;
      var args = [this._cmd, this._raw, this._parsed];
      return 'new ' + cls + '(' + JSON.stringify(args) + ')';
    }
  }, {
    key: 'type',
    get: function get() {
      return "twitch-" + this._cmd.toLowerCase();
    }
  }, {
    key: 'command',
    get: function get() {
      return this._cmd;
    }
  }, {
    key: 'raw',
    get: function get() {
      return this._raw;
    }
  }, {
    key: 'values',
    get: function get() {
      return this._parsed;
    }
  }, {
    key: 'userValue',
    get: function get() {
      return this.values.user;
    }
  }, {
    key: 'nameValue',
    get: function get() {
      return this.flags["display-name"];
    }
  }, {
    key: 'channel',
    get: function get() {
      return this.values.channel;
    }
  }, {
    key: 'channelString',
    get: function get() {
      return Twitch.FormatChannel(this.channel);
    }
  }, {
    key: 'message',
    get: function get() {
      return this.values.message;
    }
  }, {
    key: 'flags',
    get: function get() {
      return this.values.flags;
    }

    /* Prefer username over display name */

  }, {
    key: 'user',
    get: function get() {
      return this.userValue || this.nameValue;
    }

    /* Prefer display name over username */

  }, {
    key: 'name',
    get: function get() {
      return this.nameValue || this.userValue;
    }
  }, {
    key: 'noticeMsgId',
    get: function get() {
      if (this._cmd === "NOTICE" && this.flags) {
        if (typeof this.flags["msg-id"] === "string") {
          return this.flags["msg-id"];
        }
      }
      return null;
    }

    /* Return the class of the msg-id, if one is present */

  }, {
    key: 'noticeClass',
    get: function get() {
      var msgid = this.noticeMsgId;
      if (typeof msgid === "string") {
        return msgid.split("_")[0];
      }
      return null;
    }
  }, {
    key: Symbol.toStringTag,
    get: function get() {
      return 'TwitchEvent<' + this._cmd + '>';
    }
  }], [{
    key: 'COMMAND_LIST',
    get: function get() {
      return ["CHAT", /* (s) Received a message from another user */
      "PING", /* Twitch is checking to see if we're still here */
      "ACK", /* Twitch acknowledged our capability request */
      "TOPIC", /* (s) Received a TOPIC message from Twitch */
      "NAMES", /* Received a list of connected users */
      "JOIN", /* User joined a channel */
      "PART", /* User left a channel */
      "JOINED", /* (s) Client joined a channel */
      "PARTED", /* (s) Client left a channel */
      "RECONNECT", /* Twitch requested a reconnect */
      "MODE", /* Twitch set the mode for a user */
      "PRIVMSG", /* Received a message */
      "WHISPER", /* Received a private message */
      "USERSTATE", /* Received user information */
      "ROOMSTATE", /* Received room information */
      "STREAMINFO", /* (s) Received stream information */
      "ASSETLOADED", /* (s) An asset API request resolved */
      "USERNOTICE", /* Received user-centric notice */
      "GLOBALUSERSTATE", /* Received global client user information */
      "CLEARCHAT", /* Moderator cleared the chat */
      "HOSTTARGET", /* Streamer is hosting another streamer */
      "NOTICE", /* Received a notice (error, warning, etc) from Twitch */
      "SUB", /* (s) Someone subscribed */
      "RESUB", /* (s) Someone resubscribed */
      "GIFTSUB", /* (s) Someone gifted a subscription */
      "ANONGIFTSUB", /* (s) Someone gifted a subscription anonymously */
      "NEWUSER", /* (s) A brand new user just said hi */
      "REWARDGIFT", /* (s) Gift rewards have been shared in chat */
      "MYSTERYGIFT", /* (s) Random gift rewards have been shared in chat */
      "GIFTUPGRADE", /* (s) Upgraded a giftsub to a real subscription */
      "PRIMEUPGRADE", /* (s) Upgraded a prime sub to a tiered subscription */
      "ANONGIFTUPGRADE", /* (s) Upgraded an anonymous giftsub */
      "OTHERUSERNOTICE", /* (s) Received an unknown USERNOTICE */
      "RAID", /* (s) Streamer is raiding or was raided by another streamer */
      "OPEN", /* (s) WebSocket opened */
      "CLOSE", /* (s) WebSocket closed */
      "MESSAGE", /* (s) WebSocket received a message */
      "ERROR", /* (s) WebSocket received an error */
      "OTHER" /* Received some unknown event */
      ];
    }

    /* Object for the commands above */

  }, {
    key: 'COMMANDS',
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
    key: 'hasBadge',
    value: function hasBadge(badge) {
      var rev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = this.badges[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _ref = _step3.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var badge_name = _ref2[0];
          var badge_rev = _ref2[1];

          if (badge_name === badge) {
            /* null rev matches all badges with this name */
            return rev === badge_rev || rev === null;
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
    key: 'repr',
    value: function repr() {
      /* Return a value similar to Object.toSource() */
      var cls = Object.getPrototypeOf(this).constructor.name;
      var raw = JSON.stringify(this._raw);
      var parsed = JSON.stringify(this._parsed);
      return 'new ' + cls + '(' + raw + ',' + parsed + ')';
    }
  }, {
    key: 'id',
    get: function get() {
      return this._id;
    }
  }, {
    key: 'iscaster',
    get: function get() {
      return this.hasBadge("broadcaster");
    }
  }, {
    key: 'ismod',
    get: function get() {
      return this.hasBadge("moderator") || this.flags.mod || this.iscaster;
    }
  }, {
    key: 'issub',
    get: function get() {
      return this.hasBadge("subscriber") || this.flags.subscriber;
    }
  }, {
    key: 'isstaff',
    get: function get() {
      return this.hasBadge("staff") || this.flags.staff;
    }
  }, {
    key: 'isvip',
    get: function get() {
      return this.hasBadge("vip");
    }
  }, {
    key: 'badges',
    get: function get() {
      return this.flags.badges || [];
    }
  }, {
    key: 'subMonths',
    get: function get() {
      if (this.flags["badge-info"]) {
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = this.flags["badge-info"][Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var _ref3 = _step4.value;

            var _ref4 = _slicedToArray(_ref3, 2);

            var bname = _ref4[0];
            var brev = _ref4[1];

            if (bname === "subscriber") {
              return brev;
            }
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
      }
      return 0;
    }
  }, {
    key: 'bits',
    get: function get() {
      return typeof this.flags.bits === "number" ? this.flags.bits : 0;
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
    if (TwitchSubEvent.KINDS.indexOf(sub_kind) === -1) {
      Util.Error('Invalid sub kind ' + sub_kind + '; defaulting to "SUB"');
      _this2._sub_kind = TwitchSubEvent.KIND_SUB;
    }
    return _this2;
  }

  /* Known kinds of subscriptions */


  _createClass(TwitchSubEvent, [{
    key: 'kind',


    /* Methods below apply to all sub kinds */
    get: function get() {
      return this._sub_kind;
    }
  }, {
    key: 'user',
    get: function get() {
      return this.param("login") || this.name;
    }
  }, {
    key: 'plan',
    get: function get() {
      return this.param("sub-plan-name");
    }
  }, {
    key: 'plan_id',
    get: function get() {
      return this.param("sub-plan");
    }
  }, {
    key: 'months',
    get: function get() {
      return this.param("months") || 0;
    }
  }, {
    key: 'total_months',
    get: function get() {
      return this.param("cumulative-months") || 0;
    }
  }, {
    key: 'share_streak',
    get: function get() {
      return this.param("should-share-streak");
    }
  }, {
    key: 'streak_months',
    get: function get() {
      return this.param("streak-months") || 0;
    }

    /* Methods below only apply only to gift subs */

  }, {
    key: 'anonymous',
    get: function get() {
      return this.kind === TwitchSubEvent.KIND_ANONGIFTSUB;
    }
  }, {
    key: 'recipient',
    get: function get() {
      return this.param("recipient-user-name");
    }
  }, {
    key: 'recipient_id',
    get: function get() {
      return this.param("recipient-id");
    }
  }, {
    key: 'recipient_name',
    get: function get() {
      return this.param("recipient-display-name");
    }
  }], [{
    key: 'IsKind',
    value: function IsKind(k) {
      return TwitchSubEvent.KINDS.indexOf(k) > -1;
    }

    /* Known subscription tiers */

  }, {
    key: 'IsPlan',
    value: function IsPlan(p) {
      return TwitchSubEvent.PLANS.indexOf(p) > -1;
    }
  }, {
    key: 'KindFromMsgID',
    value: function KindFromMsgID(msgid) {
      if (msgid === "sub") return TwitchSubEvent.KIND_SUB;
      if (msgid === "resub") return TwitchSubEvent.KIND_RESUB;
      if (msgid === "subgift") return TwitchSubEvent.KIND_GIFTSUB;
      if (msgid === "anonsubgift") return TwitchSubEvent.KIND_ANONGIFTSUB;
      return null;
    }
  }, {
    key: 'PlanName',
    value: function PlanName(plan_id) {
      var plan = '' + plan_id;
      if (plan === TwitchSubEvent.PLAN_PRIME) {
        return "Twitch Prime";
      } else if (plan === TwitchSubEvent.PLAN_TIER1) {
        return "Tier 1";
      } else if (plan === TwitchSubEvent.PLAN_TIER2) {
        return "Tier 2";
      } else if (plan === TwitchSubEvent.PLAN_TIER3) {
        return "Tier 3";
      } else {
        return '"' + plan + '"';
      }
    }
  }, {
    key: 'KINDS',
    get: function get() {
      return ["SUB", "RESUB", "GIFTSUB", "ANONGIFTSUB"];
    }
  }, {
    key: 'KIND_SUB',
    get: function get() {
      return "SUB";
    }
  }, {
    key: 'KIND_RESUB',
    get: function get() {
      return "RESUB";
    }
  }, {
    key: 'KIND_GIFTSUB',
    get: function get() {
      return "GIFTSUB";
    }
  }, {
    key: 'KIND_ANONGIFTSUB',
    get: function get() {
      return "ANONGIFTSUB";
    }
  }, {
    key: 'PLANS',
    get: function get() {
      return ["Prime", "1000", "2000", "3000"];
    }
  }, {
    key: 'PLAN_PRIME',
    get: function get() {
      return "Prime";
    }
  }, {
    key: 'PLAN_TIER1',
    get: function get() {
      return "1000";
    }
  }, {
    key: 'PLAN_TIER2',
    get: function get() {
      return "2000";
    }
  }, {
    key: 'PLAN_TIER3',
    get: function get() {
      return "3000";
    }
  }]);

  return TwitchSubEvent;
}(TwitchEvent);

/* End of event classes section 0}}} */

/* Twitch Client class definition */


var TwitchClient = function (_CallbackHandler) {
  _inherits(TwitchClient, _CallbackHandler);

  _createClass(TwitchClient, null, [{
    key: 'DEFAULT_HISTORY_SIZE',
    get: function get() {
      return 300;
    }
  }, {
    key: 'DEFAULT_MAX_MESSAGES',
    get: function get() {
      return 100;
    }

    /* Emote set number for global emotes */

  }, {
    key: 'ESET_GLOBAL',
    get: function get() {
      return 0;
    }

    /* Emote set numbers for Turbo (sets 1, 2, 3, and 4) */

  }, {
    key: 'ESET_TURBO_1',
    get: function get() {
      return 33;
    }
  }, {
    key: 'ESET_TURBO_2',
    get: function get() {
      return 42;
    }
  }, {
    key: 'ESET_TURBO_3',
    get: function get() {
      return 457;
    }
  }, {
    key: 'ESET_TURBO_4',
    get: function get() {
      return 793;
    }

    /* Emote set number for Twitch Prime emotes */

  }, {
    key: 'ESET_PRIME',
    get: function get() {
      return 19194;
    }

    /* Default emote size */

  }, {
    key: 'DEFAULT_EMOTE_SIZE',
    get: function get() {
      return "1.0";
    }

    /* "Rooms" channel */

  }, {
    key: 'CHANNEL_ROOMS',
    get: function get() {
      return "#chatrooms";
    }

    /* Requested capabilities */

  }, {
    key: 'CAPABILITIES',
    get: function get() {
      return ["twitch.tv/tags", "twitch.tv/commands", "twitch.tv/membership"];
    }
  }]);

  function TwitchClient(opts) {
    _classCallCheck(this, TwitchClient);

    var _this3 = _possibleConstructorReturn(this, (TwitchClient.__proto__ || Object.getPrototypeOf(TwitchClient)).call(this, {}));

    var cfg_name = opts.Name;
    var cfg_clientid = opts.ClientID;
    var cfg_pass = opts.Pass;

    /* Core variables */
    _this3._ws = null;
    _this3._is_open = false;
    _this3._connected = false;
    _this3._username = null;
    _this3._connecting = false;

    /* WebSocket endpoint */
    _this3._endpoint = opts.WSURI || "wss://irc-ws.chat.twitch.tv";
    /* List of channels/rooms presently joined */
    _this3._channels = [];
    /* List of channels/rooms about to join once connected to Twitch */
    _this3._pending_channels = opts.Channels || [];
    /* Channel and room information */
    _this3._rooms = {};
    _this3._rooms_byid = {};
    /* History of sent chat messages (recent = first) */
    _this3._history = [];
    /* Maximum history size */
    _this3._hist_max = opts.HistorySize || TwitchClient.DEFAULT_HISTORY_SIZE;
    /* Granted capabilities */
    _this3._capabilities = [];
    /* TwitchClient's userstate information */
    _this3._self_userstate = {};
    /* TwitchClient's userid */
    _this3._self_userid = null;
    /* Emotes the TwitchClient is allowed to use */
    _this3._self_emotes = {}; /* {eid: ename} */
    /* Mapping of emote set to emotes */
    _this3._self_emote_sets = {}; /* {sid: [eid, eid, ...]} */

    /* Extension support */
    _this3._enable_ffz = !opts.NoFFZ || opts.NoAssets;
    _this3._enable_bttv = !opts.NoBTTV || opts.NoAssets;

    /* Whether or not we were given a clientid */
    _this3._has_clientid = cfg_clientid && cfg_clientid.length > 0;

    /* Don't load assets (for small testing) */
    _this3._no_assets = Boolean(opts.NoAssets);

    /* Badge and cheer definitions */
    _this3._channel_badges = {};
    _this3._global_badges = {};
    _this3._channel_cheers = {};
    _this3._global_cheers = {};

    /* Extension emotes */
    _this3._ffz_channel_emotes = {};
    _this3._ffz_badges = {};
    _this3._ffz_badge_users = {};
    _this3._bttv_badges = {}; /* If BTTV adds badges */
    _this3._bttv_global_emotes = {};
    _this3._bttv_channel_emotes = {};

    /* Let the client be used as an arbitrary key-value store */
    _this3._kv = {};
    _this3.get = function _Client_get(k) {
      return this._kv[k];
    };
    _this3.set = function _Client_set(k, v) {
      this._kv[k] = v;
    };
    _this3.has = function _Client_has(k) {
      return this._kv.hasOwnProperty(k);
    };

    /* Handle authentication and password management */
    _this3._authed = cfg_pass ? true : false;
    var oauth = void 0,
        oauth_header = void 0;
    if (_this3._authed) {
      if (cfg_pass.indexOf("oauth:") !== 0) {
        oauth = 'oauth:' + cfg_pass;
        oauth_header = 'OAuth ' + cfg_pass;
      } else {
        oauth = cfg_pass;
        oauth_header = cfg_pass.replace(/^oauth:/, "OAuth ");
      }
    }

    /* Construct the Twitch API object */
    var pub_headers = {};
    var priv_headers = {};
    if (_this3._has_clientid) {
      pub_headers["Client-Id"] = cfg_clientid;
    }
    if (_this3._authed) {
      priv_headers["Authorization"] = oauth_header;
    }
    _this3._api = new Twitch.API(pub_headers, priv_headers);

    /* TwitchClient.Connect(): Returns a Promise  */
    _this3.Connect = function _TwitchClient_Connect() {
      var _this4 = this;

      return new Promise(function (resolve, reject) {
        /* Prevent recursion */
        if (_this4._connecting) {
          Util.Error("Client is already attempting to connect");
          reject(new Error("Client is already attempting to connect"));
        }
        _this4._connecting = true;

        /* Ensure the socket is indeed closed */
        _this4.close();

        /* Store the presently-connected channels as pending */
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = _this4._channels[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var c = _step5.value;

            if (_this4._pending_channels.indexOf(c) === -1) {
              _this4._pending_channels.push(c);
            }
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

        _this4._channels = [];
        _this4._rooms = {};
        _this4._capabilities = [];
        _this4._username = null;
        _this4._is_open = false;
        _this4._connected = false;

        /* Construct the websocket and bind to its events */
        _this4._ws = new WebSocket(_this4._endpoint);
        _this4._ws.client = _this4;
        _this4._ws.onopen = function (event) {
          try {
            Util.LogOnly("ws open>", _this4._ws.url);
            _this4._connecting = false;
            _this4._connected = false;
            _this4._is_open = true;
            _this4._onWebsocketOpen(cfg_name, oauth);
            resolve(_this4);
          } catch (e) {
            Util.Alert("ws.onopen error: " + e.toString());
            reject(e);
          }
        };
        _this4._ws.onmessage = _this4._ws_onmessage.bind(_this4);
        _this4._ws.onerror = _this4._ws_onerror.bind(_this4);
        _this4._ws.onclose = _this4._ws_onclose.bind(_this4);
        _this4.send = function _TwitchClient_send(m) {
          try {
            this._ws.send(m);
            Util.DebugOnly("ws send>", Twitch.StripCredentials(JSON.stringify(m)));
          } catch (e) {
            Util.Alert("this.send error: " + e.toString());
            throw e;
          }
        }.bind(_this4);

        Util.LogOnly("Connecting to Twitch...");
      });
    }.bind(_this3);

    Util.LogOnly("Client constructed and ready for action");
    return _this3;
  }

  /* Private: Event handlers and event handling {{{0 */

  /* ws.onopen bound above due to OAuth usage */

  /* ws.onmessage = _ws_onmessage.bind(this) */


  _createClass(TwitchClient, [{
    key: '_ws_onmessage',
    value: function _ws_onmessage(event) {
      try {
        var data = Twitch.StripCredentials(JSON.stringify(event.data));
        Util.TraceOnly("ws recv>", data);
        this._onWebsocketMessage(event);
      } catch (e) {
        Util.Alert("ws.onmessage error: " + e.toString() + "\n" + e.stack);
        throw e;
      }
    }

    /* ws.onerror = _ws_onerror.bind(this) */

  }, {
    key: '_ws_onerror',
    value: function _ws_onerror(event) {
      try {
        Util.LogOnly("ws error>", event);
        this._connected = false;
        this._onWebsocketError(event);
      } catch (e) {
        Util.Alert("ws.onerror error: " + e.toString());
        throw e;
      }
    }

    /* ws.onclose = _ws_onclose.bind(this) */

  }, {
    key: '_ws_onclose',
    value: function _ws_onclose(event) {
      try {
        Util.TraceOnly("ws close: ", event);
        Util.LogOnly("ws close>");
        this._connected = false;
        this._is_open = false;
        this._onWebsocketClose(event);
      } catch (e) {
        Util.Alert("ws.onclose error: " + e.toString());
        throw e;
      }
    }

    /* Private: fire a TwitchEvent instance */

  }, {
    key: '_fire',
    value: function _fire(event) {
      this.fire(event.type, event);
    }

    /* End event handlers and event handling 0}}} */

    /* Private functions section {{{0 */

    /* Private: Return the channel's userstate value for the given key */

  }, {
    key: '_selfUserState',
    value: function _selfUserState(channel, value) {
      var ch = Twitch.FormatChannel(channel);
      if (this._self_userstate) {
        if (this._self_userstate[ch]) {
          return this._self_userstate[ch][value];
        }
      }
      return null;
    }

    /* Private: Return whether or not the client has the specified badge */

  }, {
    key: '_hasBadge',
    value: function _hasBadge(channel, badge_name) {
      var badges = this._selfUserState(channel, "badges");
      if (badges) {
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = badges[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var badge_def = _step6.value;

            if (badge_def[0] === badge_name) {
              return true;
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
      return false;
    }

    /* Private: Ensure the user specified is in reduced form */

  }, {
    key: '_ensureUser',
    value: function _ensureUser(user) {
      if (user.indexOf("!") > -1) {
        return Twitch.ParseUser(user);
      } else {
        return user;
      }
    }

    /* Private: Ensure the given channel is defined in this._rooms */

  }, {
    key: '_ensureRoom',
    value: function _ensureRoom(channel) {
      var cobj = this.ParseChannel(channel);
      var cname = cobj.channel;
      if (!(cname in this._rooms)) {
        this._rooms[cname] = {
          users: [], /* Joined users */
          userInfo: {}, /* Joined users' info */
          operators: [], /* Operators */
          channel: cobj, /* Channel object */
          cname: cname, /* Channel name */
          rooms: {}, /* Known rooms */
          id: null, /* Channel ID */
          online: false, /* Currently streaming */
          stream: {}, /* Stream status */
          streams: [] /* Stream statuses */
        };
      }
    }

    /* Private: Called when a user joins a channel */

  }, {
    key: '_onJoin',
    value: function _onJoin(channel, userName) {
      var user = this._ensureUser(userName);
      var cobj = this.ParseChannel(channel);
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
    }

    /* Private: Called when a user parts a channel */

  }, {
    key: '_onPart',
    value: function _onPart(channel, userName) {
      var cobj = this.ParseChannel(channel);
      var user = this._ensureUser(userName);
      this._ensureRoom(cobj);
      var cname = cobj.channel;
      if (this._rooms[cname].users.includes(user)) {
        var idx = this._rooms[cname].users.indexOf(user);
        this._rooms[cname].users.splice(idx, 1);
      }
    }

    /* Private: Called when the client receives a MODE +o event */

  }, {
    key: '_onOp',
    value: function _onOp(channel, userName) {
      var cobj = this.ParseChannel(channel);
      var user = this._ensureUser(userName);
      this._ensureRoom(cobj);
      var cname = cobj.channel;
      if (!this._rooms[cname].operators.includes(user)) {
        this._rooms[cname].operators.push(user);
      }
    }

    /* Private: Called when the client receives a MODE -o event */

  }, {
    key: '_onDeOp',
    value: function _onDeOp(channel, userName) {
      var cobj = this.ParseChannel(channel);
      var user = this._ensureUser(userName);
      this._ensureRoom(cobj);
      var cname = cobj.channel;
      var idx = this._rooms[cname].operators.indexOf(user);
      if (idx > -1) {
        this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
      }
    }

    /* Private: Load in the extra chatrooms a streamer may or may not have */

  }, {
    key: '_getRooms',
    value: function _getRooms(cname, cid) {
      var _this5 = this;

      if (this._no_assets) return;
      this._api.Get(Twitch.URL.Rooms(cid), function (json) {
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;
        var _iteratorError7 = undefined;

        try {
          for (var _iterator7 = json["rooms"][Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
            var room_def = _step7.value;

            var room_name = room_def["name"];
            if (!_this5._rooms[cname].rooms) {
              _this5._rooms[cname].rooms = {};
            }
            _this5._rooms[cname].rooms[room_name] = room_def;
            _this5._rooms[cname].rooms[room_name].uid = room_def._id;
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

        _this5._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "rooms"
        }));
      }, {}, true);
    }

    /* Private: Load in the channel badges for a given channel name and ID */

  }, {
    key: '_getChannelBadges',
    value: function _getChannelBadges(cname, cid) {
      var _this6 = this;

      var channel = this.ParseChannel(cname);
      var c = channel.channel;
      this._channel_badges[c] = {};
      this._api.Get(Twitch.URL.ChannelBadges(cid), function (json) {
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
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;
        var _iteratorError8 = undefined;

        try {
          for (var _iterator8 = Object.entries(json.badge_sets)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
            var _ref5 = _step8.value;

            var _ref6 = _slicedToArray(_ref5, 2);

            var badge_name = _ref6[0];
            var bdef = _ref6[1];

            var badge = {};
            var _iteratorNormalCompletion9 = true;
            var _didIteratorError9 = false;
            var _iteratorError9 = undefined;

            try {
              for (var _iterator9 = Object.entries(bdef.versions)[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                var _ref7 = _step9.value;

                var _ref8 = _slicedToArray(_ref7, 2);

                var months = _ref8[0];
                var urls = _ref8[1];

                badge[months] = urls;
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

            _this6._channel_badges[c][badge_name] = badge;
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

        _this6._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "channel_badges"
        }));
      }, {}, false);
    }

    /* Private: Load in the channel cheermotes for a given channel name and ID */

  }, {
    key: '_getChannelCheers',
    value: function _getChannelCheers(cname, cid) {
      var _this7 = this;

      this._channel_cheers[cname] = {};
      this._api.Get(Twitch.URL.Cheers(cid), function (json) {
        var _iteratorNormalCompletion10 = true;
        var _didIteratorError10 = false;
        var _iteratorError10 = undefined;

        try {
          for (var _iterator10 = json.actions[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
            var cdef = _step10.value;

            /* Simplify things later by adding the regex here */
            cdef.pattern = Twitch.CheerToRegex(cdef.prefix);
            _this7._channel_cheers[cname][cdef.prefix] = cdef;
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

        _this7._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "channel_cheers",
          channel: Twitch.ParseChannel(cname),
          channelId: cid
        }));
      }, {}, false);
    }

    /* Private: Load the global cheermotes */

  }, {
    key: '_getGlobalCheers',
    value: function _getGlobalCheers() {
      var _this8 = this;

      this._api.Get(Twitch.URL.GlobalCheers(), function (json) {
        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;
        var _iteratorError11 = undefined;

        try {
          for (var _iterator11 = json.actions[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
            var cdef = _step11.value;

            /* Simplify things later by adding the regex here */
            cdef.pattern = Twitch.CheerToRegex(cdef.prefix);
            _this8._global_cheers[cdef.prefix] = cdef;
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

        _this8._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "global_cheers"
        }));
      }, {}, false);
    }

    /* Private: Load in the global and per-channel FFZ emotes */

  }, {
    key: '_getFFZEmotes',
    value: function _getFFZEmotes(cname, cid) {
      var _this9 = this;

      this._ffz_channel_emotes[cname] = {};
      this._api.GetSimple(Twitch.URL.FFZEmotes(cid), function (json) {
        var ffz = _this9._ffz_channel_emotes[cname];
        ffz.id = json.room.uid;
        ffz.set_id = json.room.set;
        ffz.css = json.room.css;
        ffz.display_name = json.room.display_name;
        ffz.user_name = json.room.id;
        ffz.is_group = json.room.is_group;
        ffz.mod_urls = {};
        if (json.room.mod_urls) {
          var _iteratorNormalCompletion12 = true;
          var _didIteratorError12 = false;
          var _iteratorError12 = undefined;

          try {
            for (var _iterator12 = Object.entries(json.room.mod_urls)[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
              var _ref9 = _step12.value;

              var _ref10 = _slicedToArray(_ref9, 2);

              var k = _ref10[0];
              var v = _ref10[1];

              if (v) {
                ffz.mod_urls[k] = Util.URL(v);
              }
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
          var _iteratorNormalCompletion13 = true;
          var _didIteratorError13 = false;
          var _iteratorError13 = undefined;

          try {
            for (var _iterator13 = Object.values(set_def.emoticons)[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
              var _v = _step13.value;

              if (_v.hidden) continue;
              ffz.emotes[_v.name] = _v;
              var _iteratorNormalCompletion14 = true;
              var _didIteratorError14 = false;
              var _iteratorError14 = undefined;

              try {
                for (var _iterator14 = Object.entries(_v.urls)[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
                  var _ref11 = _step14.value;

                  var _ref12 = _slicedToArray(_ref11, 2);

                  var size = _ref12[0];
                  var url = _ref12[1];

                  ffz.emotes[_v.name].urls[size] = Util.URL(url);
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
        }
        _this9._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "ffz_emotes"
        }));
      }, function (resp) {
        if (resp.status === 404) {
          Util.LogOnly('Channel ' + cname + ':' + cid + ' has no FFZ emotes');
        }
      });
    }

    /* Private: Load in the per-channel BTTV emotes */

  }, {
    key: '_getBTTVEmotes',
    value: function _getBTTVEmotes(cname, cid) {
      var _this10 = this;

      var url = Twitch.URL.BTTVEmotes(cname.replace(/^#/, ""));
      this._bttv_channel_emotes[cname] = {};
      this._api.GetSimple(url, function (json) {
        var url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
        var bttv = _this10._bttv_channel_emotes[cname];
        var _iteratorNormalCompletion15 = true;
        var _didIteratorError15 = false;
        var _iteratorError15 = undefined;

        try {
          for (var _iterator15 = json.emotes[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
            var emote = _step15.value;

            bttv[emote.code] = {
              "id": emote.id,
              "code": emote.code,
              "channel": emote.channel,
              "image-type": emote.imageType,
              "url": Util.URL(url_base.replace(/\{\{id\}\}/g, emote.id))
            };
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

        _this10._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "bttv_channel_emotes"
        }));
      }, function (resp) {
        /* Received an error */
        if (resp.status === 404) {
          Util.LogOnly('Channel ' + cname + ':' + cid + ' has no BTTV emotes');
        } else {
          var rtext = "response: (null)";
          if (resp.response !== null && '' + resp.response !== "") {
            rtext = resp.response;
          }
          Util.WarnOnly('Failed to get BTTV emotes for channel ' + cname + ':' + cid + ': ' + rtext);
        }
      });
    }

    /* Private: Load in the global BTTV emotes */

  }, {
    key: '_getGlobalBTTVEmotes',
    value: function _getGlobalBTTVEmotes() {
      var _this11 = this;

      this._bttv_global_emotes = {};
      this._api.GetSimple(Twitch.URL.BTTVAllEmotes(), function (json) {
        var url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
        var _iteratorNormalCompletion16 = true;
        var _didIteratorError16 = false;
        var _iteratorError16 = undefined;

        try {
          for (var _iterator16 = json.emotes[Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
            var emote = _step16.value;

            _this11._bttv_global_emotes[emote.code] = {
              "id": emote.id,
              "code": emote.code,
              "channel": emote.channel,
              "image-type": emote.imageType,
              "url": Util.URL(url_base.replace("{{id}}", emote.id))
            };
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

        _this11._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "bttv_emotes"
        }));
      }, function (resp) {
        /* Received an error */
        if (resp.response !== null && '' + resp.response !== "") {
          Util.WarnOnly('Failed to get global BTTV emotes: ' + resp.response);
        } else {
          Util.WarnOnly('Failed to get global BTTV emotes: null response (see console)');
        }
      });
    }

    /* Private: Load in the global badges  */

  }, {
    key: '_getGlobalBadges',
    value: function _getGlobalBadges() {
      var _this12 = this;

      this._global_badges = {};
      if (this._no_assets) return;
      this._api.Get(Twitch.URL.AllBadges(), function (json) {
        var _iteratorNormalCompletion17 = true;
        var _didIteratorError17 = false;
        var _iteratorError17 = undefined;

        try {
          for (var _iterator17 = Object.keys(json["badge_sets"])[Symbol.iterator](), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
            var badge_name = _step17.value;

            _this12._global_badges[badge_name] = json["badge_sets"][badge_name];
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

        _this12._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "global_badges"
        }));
      }, {}, false);
      if (this._enable_ffz) {
        this._api.GetSimple(Twitch.URL.FFZBadgeUsers(), function (resp) {
          var _iteratorNormalCompletion18 = true;
          var _didIteratorError18 = false;
          var _iteratorError18 = undefined;

          try {
            for (var _iterator18 = Object.values(resp.badges)[Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
              var badge = _step18.value;

              _this12._ffz_badges[badge.id] = badge;
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

          var _iteratorNormalCompletion19 = true;
          var _didIteratorError19 = false;
          var _iteratorError19 = undefined;

          try {
            for (var _iterator19 = Object.entries(resp.users)[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
              var _ref13 = _step19.value;

              var _ref14 = _slicedToArray(_ref13, 2);

              var badge_nr = _ref14[0];
              var users = _ref14[1];

              _this12._ffz_badge_users[badge_nr] = users;
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

          _this12._fire(new TwitchEvent("ASSETLOADED", "", {
            kind: "ffz_badges"
          }));
        });
      }
    }

    /* Private: Build a faux PRIVMSG event from the chat message given */

  }, {
    key: '_buildChatEvent',
    value: function _buildChatEvent(chobj, message) {
      var flags = {};
      var emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
      var chstr = Twitch.FormatChannel(chobj);
      var userstate = this._self_userstate[chstr] || {};
      var msg = message;

      /* Construct the parsed flags object */
      flags["badge-info"] = userstate["badge-info"];
      flags["badges"] = userstate["badges"] || [];
      flags["color"] = userstate["color"];
      flags["subscriber"] = userstate["subscriber"];
      flags["mod"] = userstate["mod"];
      flags["vip"] = userstate["vip"] || null;
      flags["broadcaster"] = userstate["broadcaster"] || null;
      flags["display-name"] = userstate["display-name"];
      flags["emotes"] = emote_obj;
      flags["id"] = Util.Random.uuid();
      flags["user-id"] = this._self_userid;
      flags["room-id"] = this._rooms[chobj.channel].id;
      flags["tmi-sent-ts"] = new Date().getTime();
      flags["turbo"] = 0;
      flags["user-type"] = "";
      flags["__synthetic"] = 1;

      /* Construct the formatted flags string */
      var flag_arr = [];
      var addFlag = function addFlag(n, v) {
        var val = '' + v;
        if (typeof v === "undefined" || v === null) {
          val = "";
        }
        flag_arr.push(n + '=' + val);
      };

      /* Build and add the rest of the flags */
      addFlag("badges", flags["badges"].map(function (b, r) {
        return b + '/' + r;
      }).join(","));
      addFlag("color", flags["color"]);
      addFlag("display-name", flags["display-name"]);
      addFlag("subscriber", flags["subscriber"]);
      addFlag("mod", flags["mod"]);
      if (flags["vip"]) {
        addFlag("vip", flags["vip"]);
      }
      if (flags["broadcaster"]) {
        addFlag("broadcaster", flags["broadcaster"]);
      }
      addFlag("emotes", Twitch.FormatEmoteFlag(flags["emotes"]));
      addFlag("id", flags["id"]);
      addFlag("user-id", flags["user-id"]);
      addFlag("room-id", flags["room-id"]);
      addFlag("tmi-sent-ts", flags["tmi-sent-ts"]);
      addFlag("turbo", flags["turbo"]);
      addFlag("user-type", flags["user-type"]);
      addFlag("__synthetic", flags["__synthetic"]);
      addFlag("__synthetic", "1");
      var flag_str = flag_arr.join(";");

      /* Build the raw and parsed objects */
      var user = userstate["display-name"].toLowerCase();
      var useruri = ':' + user + '!' + user + '@' + user + '.tmi.twitch.tv';
      var channel = Twitch.FormatChannel(chobj);
      /* @<flags> <useruri> PRIVMSG <channel> :<message> */
      var raw_line = '@' + flag_str + ' ' + useruri + ' PRIVMSG ' + channel + ' :';

      /* Handle /me */
      if (msg.startsWith("/me ")) {
        msg = msg.substr("/me ".length);
        raw_line += "\x01ACTION " + msg + "\x01";
        flags.action = true;
      } else {
        raw_line += msg;
      }

      /* Construct and return the event */
      var event = new TwitchChatEvent(raw_line, {
        cmd: "PRIVMSG",
        flags: flags,
        user: Twitch.ParseUser(useruri),
        channel: chobj,
        message: msg,
        synthetic: true /* mark the event as synthetic */
      });

      /* TFC-Specific logic: handle mod antics
       * This logic only applies when the client is running inside the Twitch
       * Filtered Chat. Yes, this violates encapsulation in multiple ways. The
       * intent here is to set event.flags.bits if mod antics are enabled and
       * the message contains cheer antics. This enables fanfare effects on
       * messages containing antics */
      if (this.get("HTMLGen")) {
        var H = this.get("HTMLGen");
        if (typeof H.hasAntics === "function") {
          if (H.hasAntics(event)) {
            /* genMsgInfo modifies the event in-place */
            H._genMsgInfo(event);
          }
        }
      }
      return event;
    }

    /* End private functions section 0}}} */

    /* General status functions {{{0 */

    /* Forcibly close the socket */

  }, {
    key: 'close',
    value: function close() {
      if (this._ws) {
        this._ws.close();
        this._ws = null;
      }
    }

    /* Return whether or not the client has a websocket */

  }, {
    key: 'GetName',


    /* Get the client's current username */
    value: function GetName() {
      return this._username;
    }
  }, {
    key: 'ConnectionStatus',


    /* Obtain connection status information */
    value: function ConnectionStatus() {
      return {
        endpoint: this._endpoint,
        capabilities: Util.JSONClone(this._capabilities),
        open: this._is_open,
        connected: this.Connected(),
        identified: this._has_clientid,
        authed: this.IsAuthed()
      };
    }
  }, {
    key: 'IsConnecting',


    /* Return whether or not the client is currently trying to connect */
    value: function IsConnecting() {
      return this._connecting;
    }
  }, {
    key: 'Connected',


    /* Return whether or not we're connected to Twitch */
    value: function Connected() {
      return this._connected;
    }
  }, {
    key: 'IsAuthed',


    /* Return whether or not the client is authenticated with an AuthID */
    value: function IsAuthed() {
      return this._authed;
    }
  }, {
    key: 'FFZEnabled',


    /* Return whether or not FFZ support is enabled */
    value: function FFZEnabled() {
      return this._enable_ffz;
    }
  }, {
    key: 'disableFFZ',


    /* Provide API to disable FFZ support entirely */
    value: function disableFFZ() {
      this._enable_ffz = false;
    }

    /* Return whether or not BTTV support is enabled */

  }, {
    key: 'BTTVEnabled',
    value: function BTTVEnabled() {
      return this._enable_bttv;
    }
  }, {
    key: 'disableBTTV',


    /* Provide API to disable BTTV support entirely */
    value: function disableBTTV() {
      this._enable_bttv = false;
    }

    /* Return a copy of the client's userstate */

  }, {
    key: 'SelfUserState',
    value: function SelfUserState() {
      var obj = Util.JSONClone(this._self_userstate);
      obj.userid = this._self_userid;
      return obj;
    }
  }, {
    key: 'HasCapability',


    /* Return true if the client has been granted the capability specified. Values
     * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
     * following: twitch.tv/tags twitch.tv/commands twitch.tv/membership */
    value: function HasCapability(test_cap) {
      var _iteratorNormalCompletion20 = true;
      var _didIteratorError20 = false;
      var _iteratorError20 = undefined;

      try {
        for (var _iterator20 = this._capabilities[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
          var cap = _step20.value;

          if (test_cap === cap || cap.endsWith("/" + test_cap.replace(/^\//, ""))) {
            return true;
          }
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

      return false;
    }

    /* Return whether or not the numeric user ID refers to the client itself */

  }, {
    key: 'IsUIDSelf',
    value: function IsUIDSelf(userid) {
      return userid === this._self_userid;
    }

    /* End of general status functions 0}}} */

    /* Role and moderation functions {{{0 */

    /* Return true if the client is a subscriber in the channel given */

  }, {
    key: 'IsSub',
    value: function IsSub(channel) {
      if (this._selfUserState(channel, "sub")) return true;
      if (this._hasBadge(channel, "subscriber")) return true;
      return false;
    }

    /* Return true if the client is a VIP in the channel given */

  }, {
    key: 'IsVIP',
    value: function IsVIP(channel) {
      if (this._selfUserState(channel, "vip")) return true;
      if (this._hasBadge(channel, "vip")) return true;
      return false;
    }

    /* Return true if the client is a moderator in the channel given */

  }, {
    key: 'IsMod',
    value: function IsMod(channel) {
      if (this._selfUserState(channel, "mod")) return true;
      if (this._hasBadge(channel, "moderator")) return true;
      return false;
    }

    /* Return true if the client is the broadcaster for the channel given */

  }, {
    key: 'IsCaster',
    value: function IsCaster(channel) {
      if (this._selfUserState(channel, "broadcaster")) return true;
      if (this._hasBadge(channel, "broadcaster")) return true;
      return false;
    }

    /* Timeout the specific user in the specified channel */

  }, {
    key: 'Timeout',
    value: function Timeout(channel, user) {
      var duration = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "600s";
      var reason = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

      var msg = reason;
      if (!reason) {
        var cname = Twitch.FormatChannel(this.ParseChannel(channel));
        msg = 'Timed out by ' + this._username + ' from ' + cname + ' for ' + duration;
      }
      this.SendMessage(channel, '/timeout ' + user + ' ' + duration + ' "' + msg + '"');
    }

    /* Un-timeout the specific user in the specified channel */

  }, {
    key: 'UnTimeout',
    value: function UnTimeout(channel, user) {
      this.SendMessage(channel, '/untimeout ' + user);
    }

    /* Ban the specific user from the specified channel */

  }, {
    key: 'Ban',
    value: function Ban(channel, user) {
      var reason = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

      var msg = reason;
      if (!reason) {
        var cname = Twitch.FormatChannel(this.ParseChannel(channel));
        msg = 'Banned from ' + cname + ' by ' + this._username;
      }
      this.SendMessage(channel, '/ban ' + user + ' ' + msg);
    }

    /* Unban the specific user from the specified channel */

  }, {
    key: 'UnBan',
    value: function UnBan(channel, user) {
      this.SendMessage(channel, '/unban ' + user);
    }

    /* End of role and moderation functions 0}}} */

    /* Channel functions {{{0 */

    /* Parse a channel into a channel object */

  }, {
    key: 'ParseChannel',
    value: function ParseChannel(channel) {
      var chobj = Twitch.ParseChannel(channel);
      if (chobj.room && chobj.channel !== TwitchClient.CHANNEL_ROOMS) {
        /* Parse #streamer:roomname strings */
        var _ref15 = [chobj.channel, chobj.room],
            cname = _ref15[0],
            rname = _ref15[1];

        var roomdef = this._rooms[cname];
        if (roomdef && roomdef.rooms && roomdef.rooms[rname]) {
          chobj.channel = TwitchClient.CHANNEL_ROOMS;
          chobj.room = roomdef.id;
          chobj.roomuid = roomdef.rooms[rname].uid;
        } else {
          Util.Warn('Unable to parse room for ' + JSON.stringify(channel));
        }
      }
      return chobj;
    }

    /* Request the client to join the channel specified */

  }, {
    key: 'JoinChannel',
    value: function JoinChannel(channel) {
      var _this13 = this;

      var chobj = this.ParseChannel(channel);
      var cname = Twitch.FormatChannel(chobj);
      var user = chobj.channel.replace(/^#/, "");
      if (this._is_open) {
        if (this._channels.indexOf(cname) === -1) {
          this.send('JOIN ' + cname);
          this._channels.push(cname);
          /* Determine if the channel to join is a real channel */
          this._api.Get(Twitch.URL.User(user), function (r) {
            if (!r || !r.users || r.users.length === 0) {
              Util.Warn(cname + ' doesn\'t seem to be a real channel; leaving');
              _this13.LeaveChannel(channel);
            }
          }, /*headers*/null, /*add_private*/true);
        } else {
          Util.Warn('JoinChannel: Already in ' + cname);
        }
      } else if (this._pending_channels.indexOf(cname) === -1) {
        this._pending_channels.push(cname);
      }
    }

    /* Request the client to leave the channel specified */

  }, {
    key: 'LeaveChannel',
    value: function LeaveChannel(channel) {
      var cname = Twitch.FormatChannel(this.ParseChannel(channel));
      if (this._is_open) {
        var idx = this._channels.indexOf(cname);
        if (idx > -1) {
          this.send('PART ' + cname);
          this._channels.splice(idx, 1);
          delete this._rooms[cname]; /* harmless if fails */
        } else {
          Util.Warn('LeaveChannel: Not in channel ' + cname);
        }
      }
    }

    /* Return whether or not the client is in the channel specified */

  }, {
    key: 'IsInChannel',
    value: function IsInChannel(channel) {
      var cname = Twitch.FormatChannel(this.ParseChannel(channel));
      return this._is_open && this._channels.indexOf(cname) > -1;
    }

    /* Get the list of currently-joined channels */

  }, {
    key: 'GetJoinedChannels',
    value: function GetJoinedChannels() {
      return this._channels;
    }
  }, {
    key: 'GetChannelInfo',


    /* Get information regarding the channel specified */
    value: function GetChannelInfo(channel) {
      var cname = Twitch.FormatChannel(this.ParseChannel(channel));
      return this._rooms[cname] || {};
    }

    /* Get a channel information by streamer ID */

  }, {
    key: 'GetChannelById',
    value: function GetChannelById(cid) {
      var _iteratorNormalCompletion21 = true;
      var _didIteratorError21 = false;
      var _iteratorError21 = undefined;

      try {
        for (var _iterator21 = Object.values(this._rooms)[Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
          var cinfo = _step21.value;

          if (cinfo.id === cid) {
            return cinfo;
          }
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

      return null;
    }

    /* End channel functions 0}}} */

    /* Functions related to cheers and emotes {{{0 */

    /* Return whether or not the given word is a cheer for the given channel */

  }, {
    key: 'IsCheer',
    value: function IsCheer(channel, word) {
      var cname = this.ParseChannel(channel).channel;
      if (this._channel_cheers.hasOwnProperty(cname)) {
        var _iteratorNormalCompletion22 = true;
        var _didIteratorError22 = false;
        var _iteratorError22 = undefined;

        try {
          for (var _iterator22 = Object.keys(this._channel_cheers[cname])[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
            var name = _step22.value;

            if (word.match(this._channel_cheers[cname][name].pattern)) {
              return true;
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
      return false;
    }

    /* Return all of the cheers found in the message */

  }, {
    key: 'FindCheers',
    value: function FindCheers(channel, message) {
      var matches = [];
      var parts = message.split(" ");
      var offset = 0;
      var cname = this.ParseChannel(channel).channel;
      if (this._channel_cheers.hasOwnProperty(cname)) {
        var _iteratorNormalCompletion23 = true;
        var _didIteratorError23 = false;
        var _iteratorError23 = undefined;

        try {
          for (var _iterator23 = Object.entries(this._channel_cheers[cname])[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
            var _ref16 = _step23.value;

            var _ref17 = _slicedToArray(_ref16, 2);

            var name = _ref17[0];
            var cheer = _ref17[1];

            if (message.search(cheer.pattern) > -1) {
              /* Remove the "g" flag */
              var wpat = new RegExp(cheer.pattern, "i");
              var _iteratorNormalCompletion24 = true;
              var _didIteratorError24 = false;
              var _iteratorError24 = undefined;

              try {
                for (var _iterator24 = parts[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
                  var token = _step24.value;

                  var m = token.match(wpat);
                  if (m) {
                    var num_bits = Number.parseInt(m[2]);
                    matches.push({
                      cheer: cheer,
                      name: m[1],
                      cheername: name,
                      bits: num_bits,
                      start: offset,
                      end: offset + token.length,
                      groups: m
                    });
                  }
                  offset += token.length + 1;
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
            }
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
      }
      return matches;
    }

    /* Return whether or not global cheers have been loaded */

  }, {
    key: 'AreCheersLoaded',
    value: function AreCheersLoaded() {
      if (this._global_cheers["Cheer"]) {
        return true;
      } else {
        return false;
      }
    }
  }, {
    key: 'GetCheer',


    /* Obtain information about a given cheermote. Overloads:
     * GetCheer(channel, cheername)
     * GetCheer(cheername) -> GetCheer("GLOBAL", cheername) */
    value: function GetCheer() {
      var cname = "GLOBAL",
          name = null;

      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      if (args.length === 1) {
        var _ref18 = ["GLOBAL", args[0]];
        cname = _ref18[0];
        name = _ref18[1];
      } else if (args.length === 2) {
        cname = args[0];
        name = args[1];
      } else {
        Util.Error("Invalid call to GetCheer([ch], cheer)", args);
        return null;
      }
      var cheer = null;
      if (cname === "GLOBAL") {
        if (this._global_cheers.hasOwnProperty(name)) {
          cheer = this._global_cheers[name];
        }
      } else if (this._channel_cheers.hasOwnProperty(cname)) {
        if (this._channel_cheers[cname].hasOwnProperty(name)) {
          cheer = this._channel_cheers[cname][name];
        }
      }
      return cheer;
    }

    /* Obtain information about a given global cheermote. This is identical to
     * client.GetCheer("GLOBAL", cheerName) */

  }, {
    key: 'GetGlobalCheer',
    value: function GetGlobalCheer(name) {
      return this.GetCheer("GLOBAL", name);
    }

    /* Obtain all cheermotes */

  }, {
    key: 'GetCheers',
    value: function GetCheers() {
      var cheers = { "GLOBAL": this._global_cheers };
      var _iteratorNormalCompletion25 = true;
      var _didIteratorError25 = false;
      var _iteratorError25 = undefined;

      try {
        for (var _iterator25 = Object.entries(this._channel_cheers)[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
          var _ref19 = _step25.value;

          var _ref20 = _slicedToArray(_ref19, 2);

          var cname = _ref20[0];
          var ccheers = _ref20[1];

          cheers[cname] = ccheers;
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

      return cheers;
    }

    /* Return the emotes the client is allowed to use */

  }, {
    key: 'GetEmotes',
    value: function GetEmotes() {
      var size = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : TwitchClient.DEFAULT_EMOTE_SIZE;

      var emotes = {};
      var _iteratorNormalCompletion26 = true;
      var _didIteratorError26 = false;
      var _iteratorError26 = undefined;

      try {
        for (var _iterator26 = Object.entries(this._self_emotes)[Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
          var _ref21 = _step26.value;

          var _ref22 = _slicedToArray(_ref21, 2);

          var k = _ref22[0];
          var v = _ref22[1];

          emotes[v] = this.GetEmote(k, size);
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

      return emotes;
    }

    /* Return the URLs to all of the global emotes */

  }, {
    key: 'GetGlobalEmotes',
    value: function GetGlobalEmotes() {
      var size = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : TwitchClient.DEFAULT_EMOTE_SIZE;

      var emotes = {};
      if (this._self_emote_sets[TwitchClient.ESET_GLOBAL]) {
        var _iteratorNormalCompletion27 = true;
        var _didIteratorError27 = false;
        var _iteratorError27 = undefined;

        try {
          for (var _iterator27 = this._self_emote_sets[TwitchClient.ESET_GLOBAL][Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
            var eid = _step27.value;

            var ename = this._self_emotes[eid] || '' + eid;
            emotes[ename] = this.GetEmote(eid, size);
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
      } else {
        Util.Warn("Unable to get global emotes; are emotes loaded?");
      }
      return emotes;
    }

    /* Return true if the given emote set has emotes loaded */

  }, {
    key: 'isEmoteSetLoaded',
    value: function isEmoteSetLoaded(eset) {
      if (Object.keys(this._self_emote_sets).includes(eset)) {
        if (this._self_emote_sets[eset].length > 0) {
          return true;
        }
      }
      return false;
    }

    /* Load the specified emote set(s); eset can be either a number or a
     * comma-separated sequence of numbers
     * FIXME: Duplicates emotes present in more than one emote set.
     * Emotes in higher emote set take precedence over lower emote sets? */

  }, {
    key: 'AddEmoteSet',
    value: function AddEmoteSet(eset) {
      var _this14 = this;

      /* Don't Get() if all emote set IDs are already loaded */
      var load = false;
      var _iteratorNormalCompletion28 = true;
      var _didIteratorError28 = false;
      var _iteratorError28 = undefined;

      try {
        for (var _iterator28 = ('' + eset).split(",")[Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
          var i = _step28.value;

          if (!this.isEmoteSetLoaded(i)) {
            load = true;
            break;
          }
        }
        /* Don't load blacklisted emotesets (which give 503s) */
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

      if (Twitch.BAD_EMOTESET_IDS.includes('' + eset)) {
        Util.DebugOnly('Not loading eset ' + eset + '; set is blacklisted');
        return;
      }
      if (load) {
        var eset_url = Twitch.URL.EmoteSet(eset);
        this._api.Get(eset_url, function (json) {
          var _iteratorNormalCompletion29 = true;
          var _didIteratorError29 = false;
          var _iteratorError29 = undefined;

          try {
            for (var _iterator29 = Object.entries(json["emoticon_sets"])[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
              var _ref23 = _step29.value;

              var _ref24 = _slicedToArray(_ref23, 2);

              var setnr = _ref24[0];
              var edefs = _ref24[1];

              if (!_this14._self_emote_sets[setnr]) {
                _this14._self_emote_sets[setnr] = [];
              }
              var _iteratorNormalCompletion30 = true;
              var _didIteratorError30 = false;
              var _iteratorError30 = undefined;

              try {
                for (var _iterator30 = edefs[Symbol.iterator](), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
                  var edef = _step30.value;

                  if (!_this14._self_emote_sets[setnr].includes(edef.id)) {
                    _this14._self_emote_sets[setnr].push(edef.id);
                    _this14._self_emotes[edef.id] = edef.code;
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

          _this14._fire(new TwitchEvent("ASSETLOADED", "", {
            kind: "emote_set",
            eset: eset
          }));
        });
      } else {
        Util.DebugOnly("Not loading emote sets " + eset + "; already loaded");
      }
    }

    /* Return the loaded emote sets */

  }, {
    key: 'GetEmoteSets',
    value: function GetEmoteSets() {
      return Util.JSONClone(this._self_emote_sets);
    }

    /* Return the emotes in the given emote set */

  }, {
    key: 'GetEmoteSetEmotes',
    value: function GetEmoteSetEmotes(eset) {
      var emotes = {};
      if (this._self_emote_sets[eset]) {
        emotes = Util.JSONClone(this._self_emote_sets[eset]);
      } else {
        Util.Warn('No such emote set ' + eset);
      }
      return emotes;
    }

    /* Return a promise for the given Twitch emote as an <img> element */

  }, {
    key: 'PromiseEmote',
    value: function PromiseEmote(ename) {
      var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : TwitchClient.DEFAULT_EMOTE_SIZE;

      return Util.PromiseImage(this.GetEmote(ename, size));
    }

    /* Return the name of the given emote ID */

  }, {
    key: 'GetEmoteName',
    value: function GetEmoteName(emote_id) {
      if (this._self_emotes[emote_id]) {
        return this._self_emotes[emote_id];
      } else {
        return null;
      }
    }

    /* Return the ID of the given emote by name */

  }, {
    key: 'GetEmoteID',
    value: function GetEmoteID(emote_name) {
      var _iteratorNormalCompletion31 = true;
      var _didIteratorError31 = false;
      var _iteratorError31 = undefined;

      try {
        for (var _iterator31 = Object.entries(this._self_emotes)[Symbol.iterator](), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
          var _ref25 = _step31.value;

          var _ref26 = _slicedToArray(_ref25, 2);

          var k = _ref26[0];
          var v = _ref26[1];

          if (k === emote_name) {
            return v;
          }
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

      return null;
    }

    /* Return the URL to the image for the emote and size specified (id or name) */

  }, {
    key: 'GetEmote',
    value: function GetEmote(emote_id) {
      var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : TwitchClient.DEFAULT_EMOTE_SIZE;

      if (typeof emote_id === "number" || ('' + emote_id).match(/^[0-9]+$/)) {
        return Twitch.URL.Emote(emote_id, size);
      } else {
        var _iteratorNormalCompletion32 = true;
        var _didIteratorError32 = false;
        var _iteratorError32 = undefined;

        try {
          for (var _iterator32 = Object.entries(this._self_emotes)[Symbol.iterator](), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
            var _ref27 = _step32.value;

            var _ref28 = _slicedToArray(_ref27, 2);

            var k = _ref28[0];
            var v = _ref28[1];

            if (v === emote_id) {
              return Twitch.URL.Emote(k, size);
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
      }
      return null;
    }

    /* Obtain the FFZ emotes for a channel */

  }, {
    key: 'GetFFZEmotes',
    value: function GetFFZEmotes(channel) {
      return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
    }

    /* Obtain global BTTV emotes */

  }, {
    key: 'GetGlobalBTTVEmotes',
    value: function GetGlobalBTTVEmotes() {
      return this._bttv_global_emotes;
    }

    /* Obtain the BTTV emotes for the channel specified */

  }, {
    key: 'GetBTTVEmotes',
    value: function GetBTTVEmotes(channel) {
      var ch = Twitch.FormatChannel(channel);
      if (this._bttv_channel_emotes[ch]) {
        return this._bttv_channel_emotes[ch];
      } else {
        Util.Log("Channel", channel, "has no BTTV emotes stored");
        return {};
      }
    }

    /* End of functions related to cheers and emotes 0}}} */

    /* Functions for sending messages {{{0 */

    /* Send a message to the channel specified */

  }, {
    key: 'SendMessage',
    value: function SendMessage(channel, message) {
      var bypassFaux = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      var cobj = this.ParseChannel(channel);
      var cname = Twitch.FormatChannel(cobj);
      var msg = message.trim();
      if (this._connected && this._authed) {
        this.send('PRIVMSG ' + cobj.channel + ' :' + msg);
        /* Dispatch a faux "Message Received" event */
        if (!bypassFaux) {
          if (this._self_userstate[Twitch.FormatChannel(cobj)]) {
            this._fire(this._buildChatEvent(cobj, msg));
          } else {
            Util.Error('No USERSTATE given for channel ' + cname);
          }
        }
      } else {
        Util.Warn('Unable to send "' + msg + '" to ' + cname + ': not connected or not authed');
      }
    }

    /* Alias for client.SendMessage */

  }, {
    key: 'Send',
    value: function Send(channel, message) {
      var bypassFaux = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      this.SendMessage(channel, message, bypassFaux);
    }

    /* Send a message to every connected channel */

  }, {
    key: 'SendMessageToAll',
    value: function SendMessageToAll(message) {
      var bypassFaux = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      if (this._connected) {
        var _iteratorNormalCompletion33 = true;
        var _didIteratorError33 = false;
        var _iteratorError33 = undefined;

        try {
          for (var _iterator33 = this._channels[Symbol.iterator](), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
            var ch = _step33.value;

            this.SendMessage(ch, message, bypassFaux);
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
      } else {
        Util.Warn('Unable to send "' + message + '" to all channels: not connected');
      }
    }

    /* Alias for client.SendMessageToAll */

  }, {
    key: 'SendToAll',
    value: function SendToAll(message) {
      var bypassFaux = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      this.SendMessageToAll(message, bypassFaux);
    }

    /* Send text to the Twitch servers, bypassing any special logic */

  }, {
    key: 'SendRaw',
    value: function SendRaw(raw_msg) {
      this.send(raw_msg.trimEnd() + "\r\n");
    }

    /* End of functions for sending messages 0}}} */

    /* History functions {{{0 */

    /* Add a message to the history of sent messages */

  }, {
    key: 'AddHistory',
    value: function AddHistory(message) {
      /* Prevent sequential duplicates */
      if (this._history.length === 0 || message !== this._history[0]) {
        this._history.unshift(message);
        while (this.GetHistoryLength() > this.GetHistoryMax()) {
          this._history.pop();
        }
      }
    }

    /* Obtain the history of sent messages */

  }, {
    key: 'GetHistory',
    value: function GetHistory() {
      return Util.JSONClone(this._history);
    }
  }, {
    key: 'GetHistoryItem',


    /* Obtain the nth most recently sent message */
    value: function GetHistoryItem(n) {
      if (n >= 0 && n < this._history.length) {
        return this._history[n];
      }
      return null;
    }

    /* Obtain the maximum number of history items */

  }, {
    key: 'GetHistoryMax',
    value: function GetHistoryMax() {
      return this._hist_max;
    }
  }, {
    key: 'GetHistoryLength',


    /* Obtain the current number of history items */
    value: function GetHistoryLength() {
      return this._history.length;
    }
  }, {
    key: 'GetClip',


    /* End of history functions 0}}} */

    /* Asset and API functions {{{0 */

    /* Return the data for the given clip slug */
    value: function GetClip(slug) {
      return new Promise(function _getclip_promise(resolve, reject) {
        this._api.Get(Twitch.URL.Clip(slug), function _getclip_resp(resp) {
          resolve(resp["data"][0]);
        }, reject);
        this._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "clip",
          slug: slug
        }));
      }.bind(this));
    }

    /* Return information on the given game ID */

  }, {
    key: 'GetGame',
    value: function GetGame(game_id) {
      return new Promise(function _getgame_promise(resolve, reject) {
        this._api.Get(Twitch.URL.Game(game_id), function _getgame_clip(resp) {
          resolve(resp["data"][0]);
        }, reject);
        this._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "game_info",
          game_id: game_id
        }));
      }.bind(this));
    }

    /* Return true if the badge specified is a global badge */

  }, {
    key: 'IsGlobalBadge',
    value: function IsGlobalBadge(badge_name) {
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
    }

    /* Return true if the badge specified exists as a channel badge */

  }, {
    key: 'IsChannelBadge',
    value: function IsChannelBadge(channel, badge_name) {
      var badge_num = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

      var c = this.ParseChannel(channel).channel;
      if (c in this._channel_badges) {
        if (badge_name in this._channel_badges[c]) {
          var badge = this._channel_badges[c][badge_name];
          if (badge && (badge_num === null || badge[badge_num])) {
            return true;
          }
        }
      }
      return false;
    }

    /* Get a global badge by name and number; returns the first badge if
     * badge_num is null */

  }, {
    key: 'GetGlobalBadge',
    value: function GetGlobalBadge(badge_name) {
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
    }

    /* Get a channel badge by name and number; returns the first badge if
     * badge_num is null */

  }, {
    key: 'GetChannelBadge',
    value: function GetChannelBadge(channel, badge_name) {
      var badge_num = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

      var cobj = this.ParseChannel(channel);
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
    }

    /* Obtain all of the global badges */

  }, {
    key: 'GetGlobalBadges',
    value: function GetGlobalBadges() {
      return Util.JSONClone(this._global_badges);
    }

    /* Obtain all of the channel badges for the specified channel */

  }, {
    key: 'GetChannelBadges',
    value: function GetChannelBadges(channel) {
      var cobj = this.ParseChannel(channel);
      if (this._channel_badges.hasOwnProperty(cobj.channel)) {
        return Util.JSONClone(this._channel_badges[cobj.channel]);
      }
      return {};
    }

    /* End of asset handling functions 0}}} */

    /* Websocket callbacks {{{0 */

    /* Called on each (non-empty) line received through the websocket */

  }, {
    key: '_onWebsocketLine',
    value: function _onWebsocketLine(line) {
      var _this15 = this;

      var result = Twitch.ParseIRCMessage(line);

      /* Fire twitch-message for every line received */
      this._fire(new TwitchEvent("MESSAGE", line, result));

      /* Don't handle messages with NULL commands */
      if (!result.cmd) {
        Util.Error("Parser failure: result.cmd is NULL for", result, line);
        return;
      }

      /* Parse and handle result.channel to simplify code below */
      var cname = null;
      var cstr = null;
      var room = null;
      var roomid = null;
      if (result.channel) {
        this._ensureRoom(result.channel);
        cname = result.channel.channel;
        cstr = Twitch.FormatChannel(result.channel);
        room = this._rooms[cname];
        if (result.flags && result.flags["room-id"]) {
          roomid = result.flags["room-id"];
          this._rooms_byid[roomid] = room;
        }
      }

      /* Handle each command that could be returned */
      switch (result.cmd) {
        case "PING":
          this.send('PONG :' + result.server);
          break;
        case "ACK":
          this._connected = true;
          this._capabilities = result.flags;
          /* Load global emotes */
          this.AddEmoteSet(TwitchClient.ESET_GLOBAL);
          /* Obtain global cheermotes */
          this._getGlobalCheers();
          /* Obtain global BTTV emotes */
          if (this._enable_bttv) {
            this._getGlobalBTTVEmotes();
          }
          break;
        case "TOPIC":
          /* No special processing needed */
          break;
        case "NAMES":
          var _iteratorNormalCompletion34 = true;
          var _didIteratorError34 = false;
          var _iteratorError34 = undefined;

          try {
            for (var _iterator34 = result.usernames[Symbol.iterator](), _step34; !(_iteratorNormalCompletion34 = (_step34 = _iterator34.next()).done); _iteratorNormalCompletion34 = true) {
              var user = _step34.value;

              this._onJoin(result.channel, user);
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

          break;
        case "JOIN":
          if (result.user.equalsLowerCase(this._username)) {
            this._fire(new TwitchEvent("JOINED", line, result));
          }
          this._onJoin(result.channel, result.user);
          break;
        case "PART":
          if (result.user.equalsLowerCase(this._username)) {
            this._fire(new TwitchEvent("PARTED", line, result));
          }
          this._onPart(result.channel, result.user);
          break;
        case "RECONNECT":
          this.Connect();
          break;
        case "MODE":
          if (result.modeflag === "+o") {
            this._onOp(result.channel, result.user);
          } else if (result.modeflag === "-o") {
            this._onDeOp(result.channel, result.user);
          }
          break;
        case "PRIVMSG":
          {
            var event = new TwitchChatEvent(line, result);
            if (!room.userInfo.hasOwnProperty(result.user)) {
              room.userInfo[result.user] = {};
            }
            if (!room.users.includes(result.user)) {
              room.users.push(result.user);
            }
            if (!event.flags.badges) event.flags.badges = [];
            if (this._enable_ffz) {
              var _iteratorNormalCompletion35 = true;
              var _didIteratorError35 = false;
              var _iteratorError35 = undefined;

              try {
                for (var _iterator35 = Object.entries(this._ffz_badge_users)[Symbol.iterator](), _step35; !(_iteratorNormalCompletion35 = (_step35 = _iterator35.next()).done); _iteratorNormalCompletion35 = true) {
                  var _ref29 = _step35.value;

                  var _ref30 = _slicedToArray(_ref29, 2);

                  var badge_nr = _ref30[0];
                  var users = _ref30[1];

                  if (users.indexOf(result.user) > -1) {
                    var ffz_badges = event.flags["ffz-badges"];
                    if (!ffz_badges) ffz_badges = [];
                    ffz_badges.push(this._ffz_badges[badge_nr]);
                    event.flags["ffz-badges"] = ffz_badges;
                  }
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
            var ui = room.userInfo[result.user];
            ui.ismod = event.ismod;
            ui.issub = event.issub;
            ui.isvip = event.isvip;
            ui.userid = event.flags["user-id"];
            ui.uuid = event.flags["id"];
            ui.badges = event.flags["badges"];
            this._fire(event);
          }break;
        case "WHISPER":
          /* No special processing needed */
          break;
        case "USERSTATE":
          if (!this._self_userstate.hasOwnProperty(cstr)) {
            this._self_userstate[cstr] = {};
          }
          var _iteratorNormalCompletion36 = true;
          var _didIteratorError36 = false;
          var _iteratorError36 = undefined;

          try {
            for (var _iterator36 = Object.entries(result.flags)[Symbol.iterator](), _step36; !(_iteratorNormalCompletion36 = (_step36 = _iterator36.next()).done); _iteratorNormalCompletion36 = true) {
              var _ref31 = _step36.value;

              var _ref32 = _slicedToArray(_ref31, 2);

              var key = _ref32[0];
              var val = _ref32[1];

              this._self_userstate[cstr][key] = val;
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

          break;
        case "ROOMSTATE":
          room.id = roomid;
          room.channel = result.channel;
          if (this._authed) {
            this._getRooms(cname, roomid);
          }
          if (!this._no_assets) {
            this._getChannelBadges(cname, roomid);
            this._getChannelCheers(cname, roomid);
            if (this._enable_ffz) {
              this._getFFZEmotes(cname, roomid);
            }
            if (this._enable_bttv) {
              this._getBTTVEmotes(cname, roomid);
            }
          }
          if (!Twitch.IsRoom(result.channel)) {
            this._api.Get(Twitch.URL.Stream(roomid), function (resp) {
              if (resp.streams && resp.streams.length > 0) {
                room.stream = resp.streams[0];
                room.streams = resp.streams;
                room.online = true;
              } else {
                room.stream = {};
                room.streams = [];
                room.online = false;
              }
              _this15._fire(new TwitchEvent("STREAMINFO", line, result));
            });
          }
          break;
        case "USERNOTICE":
          if (TwitchSubEvent.IsKind(result.sub_kind)) {
            this._fire(new TwitchSubEvent(result.sub_kind, line, result));
          } else if (result.israid) {
            this._fire(new TwitchEvent("RAID", line, result));
          } else if (result.isritual && result.ritual_kind === "new_chatter") {
            this._fire(new TwitchEvent("NEWUSER", line, result));
          } else if (result.ismysterygift) {
            this._fire(new TwitchEvent("MYSTERYGIFT", line, result));
          } else if (result.isrewardgift) {
            this._fire(new TwitchEvent("REWARDGIFT", line, result));
          } else if (result.isupgrade) {
            var command = "OTHERUSERNOTICE";
            if (result.isgiftupgrade) {
              command = "GIFTUPGRADE";
            } else if (result.isprimeupgrade) {
              command = "PRIMEUPGRADE";
            } else if (result.isanongiftupgrade) {
              command = "ANONGIFTUPGRADE";
            }
            this._fire(new TwitchEvent(command, line, result));
          } else {
            this._fire(new TwitchEvent("OTHERUSERNOTICE", line, result));
          }
          break;
        case "GLOBALUSERSTATE":
          this._self_userid = result.flags["user-id"];
          break;
        case "CLEARCHAT":
          /* No special processing needed */
          break;
        case "CLEARMSG":
          /* No special processing needed */
          break;
        case "HOSTTARGET":
          /* No special processing needed */
          break;
        case "NOTICE":
          /* No special processing needed */
          break;
        case "ERROR":
          /* No special processing needed */
          break;
        case "OTHER":
          /* No special processing needed */
          break;
        default:
          Util.Error("Unhandled event:", result, line);
          break;
      }

      /* Obtain emotes the client is able to use */
      if (result.cmd === "GLOBALUSERSTATE") {
        if (result.flags && result.flags["emote-sets"]) {
          /* Add the sets one at a time in case a set gives an error */
          var _iteratorNormalCompletion37 = true;
          var _didIteratorError37 = false;
          var _iteratorError37 = undefined;

          try {
            for (var _iterator37 = result.flags["emote-sets"].map(function (e) {
              return '' + e;
            })[Symbol.iterator](), _step37; !(_iteratorNormalCompletion37 = (_step37 = _iterator37.next()).done); _iteratorNormalCompletion37 = true) {
              var eset = _step37.value;

              this.AddEmoteSet(eset);
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
        }
      }

      /* Fire top-level event after event was handled */
      this._fire(new TwitchEvent(result.cmd, line, result));
    }

    /* Callback: called when the websocket opens */

  }, {
    key: '_onWebsocketOpen',
    value: function _onWebsocketOpen(name, pass) {
      this.send('CAP REQ :' + TwitchClient.CAPABILITIES.join(" "));
      if (name && pass) {
        this._username = name;
      } else {
        this._username = 'justinfan' + Math.floor(Math.random() * 999999);
      }
      if (pass) {
        this.send('PASS ' + (pass.indexOf("oauth:") === 0 ? "" : "oauth:") + pass);
        this.send('NICK ' + name);
      } else {
        this.send('NICK ' + this._username);
      }
      var _iteratorNormalCompletion38 = true;
      var _didIteratorError38 = false;
      var _iteratorError38 = undefined;

      try {
        for (var _iterator38 = this._pending_channels[Symbol.iterator](), _step38; !(_iteratorNormalCompletion38 = (_step38 = _iterator38.next()).done); _iteratorNormalCompletion38 = true) {
          var i = _step38.value;

          this.JoinChannel(i);
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

      this._pending_channels = [];
      this._getGlobalBadges();
      this._fire(new TwitchEvent("OPEN", "", { "has-clientid": this._has_clientid }));
    }

    /* Callback: called when the websocket receives a message */

  }, {
    key: '_onWebsocketMessage',
    value: function _onWebsocketMessage(event) {
      /* Strip and split the message into lines, discarding empty lines */
      var lines = event.data.trim().split("\r\n").filter(function (l) {
        return l.length > 0;
      });
      /* Log the lines to the debug console */
      if (lines.length === 1) {
        Util.DebugOnly('ws recv> "' + lines[0] + '"');
      } else {
        var _iteratorNormalCompletion39 = true;
        var _didIteratorError39 = false;
        var _iteratorError39 = undefined;

        try {
          for (var _iterator39 = Object.entries(lines)[Symbol.iterator](), _step39; !(_iteratorNormalCompletion39 = (_step39 = _iterator39.next()).done); _iteratorNormalCompletion39 = true) {
            var _ref33 = _step39.value;

            var _ref34 = _slicedToArray(_ref33, 2);

            var i = _ref34[0];
            var l = _ref34[1];

            var n = Number.parseInt(i) + 1;
            if (l.trim().length > 0) Util.DebugOnly('ws recv/' + n + '> "' + l + '"');
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
      }
      /* Process each line */
      var _iteratorNormalCompletion40 = true;
      var _didIteratorError40 = false;
      var _iteratorError40 = undefined;

      try {
        for (var _iterator40 = lines[Symbol.iterator](), _step40; !(_iteratorNormalCompletion40 = (_step40 = _iterator40.next()).done); _iteratorNormalCompletion40 = true) {
          var line = _step40.value;

          this._onWebsocketLine(line);
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
    }

    /* Callback: called when the websocket receives an error */

  }, {
    key: '_onWebsocketError',
    value: function _onWebsocketError(event) {
      Util.Error(event);
      this._fire(new TwitchEvent("ERROR", "", event));
    }

    /* Callback: called when the websocket is closed */

  }, {
    key: '_onWebsocketClose',
    value: function _onWebsocketClose(event) {
      var _iteratorNormalCompletion41 = true;
      var _didIteratorError41 = false;
      var _iteratorError41 = undefined;

      try {
        for (var _iterator41 = this._channels[Symbol.iterator](), _step41; !(_iteratorNormalCompletion41 = (_step41 = _iterator41.next()).done); _iteratorNormalCompletion41 = true) {
          var chobj = _step41.value;

          if (this._pending_channels.indexOf(chobj) === -1) {
            this._pending_channels.push(chobj);
          }
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

      this._channels = [];
      Util.LogOnly("WebSocket Closed", event);
      this._fire(new TwitchEvent("CLOSE", "", event));
    }

    /* End websocket callbacks 0}}} */

  }, {
    key: 'hasSocket',
    get: function get() {
      return this._ws !== null;
    }
  }, {
    key: 'name',
    get: function get() {
      return this.GetName();
    }
  }, {
    key: 'status',
    get: function get() {
      return this.ConnectionStatus();
    }
  }, {
    key: 'connecting',
    get: function get() {
      return this.IsConnecting();
    }
  }, {
    key: 'connected',
    get: function get() {
      return this.Connected();
    }
  }, {
    key: 'authed',
    get: function get() {
      return this._authed;
    }
  }, {
    key: 'ffzEnabled',
    get: function get() {
      return this.FFZEnabled();
    }
  }, {
    key: 'bttvEnabled',
    get: function get() {
      return this.BTTVEnabled;
    }
  }, {
    key: 'userState',
    get: function get() {
      return this.SelfUserState();
    }
  }, {
    key: 'channels',
    get: function get() {
      return this.GetJoinedChannels();
    }
  }, {
    key: 'cheersLoaded',
    get: function get() {
      return this.AreCheersLoaded();
    }
  }, {
    key: 'history',
    get: function get() {
      return this.GetHistory();
    }
  }, {
    key: 'historyMaxSize',
    get: function get() {
      return this.GetHistoryMax();
    }
  }, {
    key: 'historyLength',
    get: function get() {
      return this.GetHistoryLength();
    }
  }, {
    key: Symbol.toStringTag,
    get: function get() {
      return "TwitchClient";
    }
  }]);

  return TwitchClient;
}(CallbackHandler);

/* Twitch message escape sequences */


Twitch.FLAG_ESCAPE_RULES = [
/* escaped character, escaped regex, raw character, raw regex */
["\\s", /\\s/g, " ", / /g], ["\\:", /\\:/g, ";", /;/g], ["\\r", /\\r/g, "\r", /\r/g], ["\\n", /\\n/g, "\n", /\n/g], ["\\\\", /\\\\/g, "\\", /\\/g]];

/* API URL definitions {{{0 */

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
Twitch.V5 = "https://api.twitch.tv/v5";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";
Twitch.Badges = "https://badges.twitch.tv/v1/badges";

/* Store URLs to specific asset APIs */
Twitch.URL = {
  User: function User(uname) {
    return Twitch.Kraken + '/users?login=' + uname;
  },
  Rooms: function Rooms(cid) {
    return Twitch.Kraken + '/chat/' + cid + '/rooms';
  },
  Stream: function Stream(cid) {
    return Twitch.Kraken + '/streams?channel=' + cid;
  },
  Clip: function Clip(slug) {
    return Twitch.Helix + '/clips?id=' + slug;
  },
  Game: function Game(id) {
    return Twitch.Helix + '/games?id=' + id;
  },

  ChannelBadges: function ChannelBadges(cid) {
    return Twitch.Badges + '/channels/' + cid + '/display?language=en';
  },
  AllBadges: function AllBadges() {
    return Twitch.Badges + '/global/display';
  },
  GlobalCheers: function GlobalCheers() {
    return Twitch.Kraken + '/bits/actions';
  },
  Cheers: function Cheers(cid) {
    return Twitch.Kraken + '/bits/actions?channel_id=' + cid;
  },
  Emote: function Emote(eid) {
    var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "1.0";
    return Twitch.JTVNW + '/emoticons/v1/' + eid + '/' + size;
  },
  EmoteSet: function EmoteSet(eset) {
    return Twitch.Kraken + '/chat/emoticon_images?emotesets=' + eset;
  },

  FFZAllEmotes: function FFZAllEmotes() {
    return Twitch.FFZ + '/emoticons';
  },
  FFZEmotes: function FFZEmotes(cid) {
    return Twitch.FFZ + '/room/id/' + cid;
  },
  FFZEmote: function FFZEmote(eid) {
    return Twitch.FFZ + '/emote/' + eid;
  },
  FFZBadges: function FFZBadges() {
    return Twitch.FFZ + '/_badges';
  },
  FFZBadgeUsers: function FFZBadgeUsers() {
    return Twitch.FFZ + '/badges';
  },

  BTTVAllEmotes: function BTTVAllEmotes() {
    return Twitch.BTTV + '/emotes';
  },
  BTTVEmotes: function BTTVEmotes(cname) {
    return Twitch.BTTV + '/channels/' + cname;
  },
  BTTVEmote: function BTTVEmote(eid) {
    return Twitch.BTTV + '/emote/' + eid + '/1x';
  }
};

/* End API URL definitions 0}}} */

/* Abstract XMLHttpRequest */
Twitch.API = function _Twitch_API(global_headers, private_headers) {
  var onerror = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  function doGetSimpleCB(url, callback) {
    var errorcb = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var req = new window.XMLHttpRequest();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          if (this.response !== null && '' + this.response !== "") {
            Util.WarnOnly('Failed to get "' + url + '"; response="' + this.response + '"');
          } else {
            Util.WarnOnly('Failed to get "' + url + '"; response=(null)');
          }
          Util.WarnOnly(this);
        }
      }
    };
    req.open("GET", url);
    req.send();
  }
  this.GetSimple = doGetSimpleCB.bind(this);

  /* GET url, optionally adding private headers, using callbacks */
  function doGetCB(url, callback) {
    var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var add_private = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var errorcb = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;

    var req = new window.XMLHttpRequest();
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
          if (this.response !== null && '' + this.response !== "") {
            Util.WarnOnly('Failed to get "' + url + '"; response="' + this.response + '"; stack=', callerStack);
          } else {
            Util.WarnOnly('Failed to get "' + url + '"; response=(null); stack=', callerStack);
          }
          Util.WarnOnly(url, this);
        }
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    var _iteratorNormalCompletion42 = true;
    var _didIteratorError42 = false;
    var _iteratorError42 = undefined;

    try {
      for (var _iterator42 = Object.keys(global_headers || {})[Symbol.iterator](), _step42; !(_iteratorNormalCompletion42 = (_step42 = _iterator42.next()).done); _iteratorNormalCompletion42 = true) {
        var key = _step42.value;

        req.setRequestHeader(key, global_headers[key]);
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

    var _iteratorNormalCompletion43 = true;
    var _didIteratorError43 = false;
    var _iteratorError43 = undefined;

    try {
      for (var _iterator43 = Object.keys(headers || {})[Symbol.iterator](), _step43; !(_iteratorNormalCompletion43 = (_step43 = _iterator43.next()).done); _iteratorNormalCompletion43 = true) {
        var _key3 = _step43.value;

        req.setRequestHeader(_key3, headers[_key3]);
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

    if (add_private) {
      var _iteratorNormalCompletion44 = true;
      var _didIteratorError44 = false;
      var _iteratorError44 = undefined;

      try {
        for (var _iterator44 = Object.keys(private_headers || {})[Symbol.iterator](), _step44; !(_iteratorNormalCompletion44 = (_step44 = _iterator44.next()).done); _iteratorNormalCompletion44 = true) {
          var _key4 = _step44.value;

          req.setRequestHeader(_key4, private_headers[_key4]);
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
    req.send();
  }
  this.Get = doGetCB.bind(this);

  /* Get url, without headers, returning a promise */
  function doFetchSimple(url) {
    var _this16 = this;

    return new Promise(function (resolve, reject) {
      _this16.GetSimple(url, resolve, reject);
    });
  }
  this.FetchSimple = doFetchSimple.bind(this);

  /* GET url, optionally adding private headers, returning a promise */
  function doFetch(url) {
    var _this17 = this;

    var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var add_private = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    return new Promise(function (resolve, reject) {
      _this17.Get(url, resolve, headers, add_private, reject);
    });
  }
  this.Fetch = doFetch.bind(this);
};

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  return user.replace(/^:/, "").split("!")[0];
};

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  if (typeof channel === "string") {
    var chobj = {
      channel: "",
      room: null,
      roomuid: null
    };
    var parts = channel.split(":");
    if (parts.length === 1) {
      /* #channel */
      chobj.channel = parts[0];
    } else if (parts.length === 2) {
      /* #channel:room-name */
      chobj.channel = parts[0];
      chobj.room = parts[1];
    } else if (parts.length === 3) {
      /* #chatrooms:channel-id:room-uuid */
      chobj.channel = parts[0];
      chobj.room = parts[1];
      chobj.roomuid = parts[2];
    } else {
      Util.Warn('ParseChannel: ' + channel + ' not in expected format');
      chobj.channel = parts[0];
    }
    if (chobj.channel !== "GLOBAL") {
      if (chobj.channel.indexOf("#") !== 0) {
        chobj.channel = "#" + chobj.channel;
      }
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
    var cname = channel.toLowerCase();
    if (cname === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room) {
        cname += ":" + room;
      }
      if (roomuid) {
        cname += ":" + roomuid;
      }
      if (cname.indexOf("#") !== 0) {
        cname = "#" + cname;
      }
      return cname;
    }
  } else if (channel && typeof channel.channel === "string") {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel, room, roomuid);
    return '' + channel;
  }
};

/* Return whether or not the channel object given is a #chatrooms room */
Twitch.IsRoom = function _Twitch_IsRoom(cobj) {
  return cobj.channel === TwitchClient.CHANNEL_ROOMS && cobj.room && cobj.roomuid;
};

/* Format a room with the channel and room IDs given */
Twitch.FormatRoom = function _Twitch_FormatRoom(cid, rid) {
  return '#chatrooms:' + cid + ':' + rid;
};

/* Parse Twitch flag escape sequences */
Twitch.DecodeFlag = function _Twitch_DecodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion45 = true;
  var _didIteratorError45 = false;
  var _iteratorError45 = undefined;

  try {
    for (var _iterator45 = Twitch.FLAG_ESCAPE_RULES[Symbol.iterator](), _step45; !(_iteratorNormalCompletion45 = (_step45 = _iterator45.next()).done); _iteratorNormalCompletion45 = true) {
      var row = _step45.value;

      result = result.replace(row[1], row[2]);
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

  return result;
};

/* Format Twitch flag escape sequences */
Twitch.EncodeFlag = function _Twitch_EncodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion46 = true;
  var _didIteratorError46 = false;
  var _iteratorError46 = undefined;

  try {
    for (var _iterator46 = Twitch.FLAG_ESCAPE_RULES.reverse()[Symbol.iterator](), _step46; !(_iteratorNormalCompletion46 = (_step46 = _iterator46.next()).done); _iteratorNormalCompletion46 = true) {
      var row = _step46.value;

      result = result.replace(row[3], row[0]);
    }
  } catch (err) {
    _didIteratorError46 = true;
    _iteratorError46 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion46 && _iterator46.return) {
        _iterator46.return();
      }
    } finally {
      if (_didIteratorError46) {
        throw _iteratorError46;
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
    var _iteratorNormalCompletion47 = true;
    var _didIteratorError47 = false;
    var _iteratorError47 = undefined;

    try {
      for (var _iterator47 = value.split(",")[Symbol.iterator](), _step47; !(_iteratorNormalCompletion47 = (_step47 = _iterator47.next()).done); _iteratorNormalCompletion47 = true) {
        var badge = _step47.value;

        var _badge$split = badge.split("/"),
            _badge$split2 = _slicedToArray(_badge$split, 2),
            badge_name = _badge$split2[0],
            badge_rev = _badge$split2[1];

        result.push([badge_name, badge_rev]);
      }
    } catch (err) {
      _didIteratorError47 = true;
      _iteratorError47 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion47 && _iterator47.return) {
          _iterator47.return();
        }
      } finally {
        if (_didIteratorError47) {
          throw _iteratorError47;
        }
      }
    }
  } else if (key === "emotes") {
    result = Twitch.ParseEmote(value);
  } else if (key === "emote-sets") {
    result = value.split(",").map(function (e) {
      return Util.ParseNumber(e);
    });
  } else {
    result = Twitch.DecodeFlag(value);
  }
  if (typeof result === "string" && Util.IsNumber(result)) {
    result = Util.ParseNumber(result);
  }
  return result;
};

/* Parse @<flags...> key,value pairs */
Twitch.ParseFlags = function _Twitch_ParseFlags(dataString) {
  /* @key=value;key=value;... */
  var dataStr = dataString.replace(/^@/, "");
  var data = {};
  var _iteratorNormalCompletion48 = true;
  var _didIteratorError48 = false;
  var _iteratorError48 = undefined;

  try {
    for (var _iterator48 = dataStr.split(";")[Symbol.iterator](), _step48; !(_iteratorNormalCompletion48 = (_step48 = _iterator48.next()).done); _iteratorNormalCompletion48 = true) {
      var item = _step48.value;

      var key = item;
      var val = "";
      if (item.indexOf("=") !== -1) {
        var _item$split = item.split("=");

        var _item$split2 = _slicedToArray(_item$split, 2);

        key = _item$split2[0];
        val = _item$split2[1];
      }
      val = Twitch.ParseFlag(key, val);
      data[key] = val;
    }
  } catch (err) {
    _didIteratorError48 = true;
    _iteratorError48 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion48 && _iterator48.return) {
        _iterator48.return();
      }
    } finally {
      if (_didIteratorError48) {
        throw _iteratorError48;
      }
    }
  }

  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  var result = [];
  var _iteratorNormalCompletion49 = true;
  var _didIteratorError49 = false;
  var _iteratorError49 = undefined;

  try {
    for (var _iterator49 = value.split("/")[Symbol.iterator](), _step49; !(_iteratorNormalCompletion49 = (_step49 = _iterator49.next()).done); _iteratorNormalCompletion49 = true) {
      var emote_def = _step49.value;

      var sep_pos = emote_def.indexOf(":");
      var emote_id = Number.parseInt(emote_def.substr(0, sep_pos));
      var _iteratorNormalCompletion50 = true;
      var _didIteratorError50 = false;
      var _iteratorError50 = undefined;

      try {
        for (var _iterator50 = emote_def.substr(sep_pos + 1).split(",")[Symbol.iterator](), _step50; !(_iteratorNormalCompletion50 = (_step50 = _iterator50.next()).done); _iteratorNormalCompletion50 = true) {
          var range = _step50.value;

          var _range$split = range.split("-"),
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
        _didIteratorError50 = true;
        _iteratorError50 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion50 && _iterator50.return) {
            _iterator50.return();
          }
        } finally {
          if (_didIteratorError50) {
            throw _iteratorError50;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError49 = true;
    _iteratorError49 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion49 && _iterator49.return) {
        _iterator49.return();
      }
    } finally {
      if (_didIteratorError49) {
        throw _iteratorError49;
      }
    }
  }

  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  var specs = [];
  var _iteratorNormalCompletion51 = true;
  var _didIteratorError51 = false;
  var _iteratorError51 = undefined;

  try {
    for (var _iterator51 = emotes[Symbol.iterator](), _step51; !(_iteratorNormalCompletion51 = (_step51 = _iterator51.next()).done); _iteratorNormalCompletion51 = true) {
      var emote = _step51.value;

      if (emote.id !== null) {
        specs.push(emote.id + ':' + emote.start + '-' + emote.end);
      }
    }
  } catch (err) {
    _didIteratorError51 = true;
    _iteratorError51 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion51 && _iterator51.return) {
        _iterator51.return();
      }
    } finally {
      if (_didIteratorError51) {
        throw _iteratorError51;
      }
    }
  }

  return specs.join("/");
};

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; dont escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
};

/* Generate a regex from a cheer prefix */
Twitch.CheerToRegex = function _Twitch_CheerToRegex(prefix) {
  var p = RegExp.escape(prefix);
  return new RegExp('(?:\\b[\\s]|^)(' + p + ')([1-9][0-9]*)(?:\\b|[\\s]|$)', "ig");
};

/* Generate emote specifications for the given emotes [eid, ename] */
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes) {
  var escape = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var results = [];
  var _iteratorNormalCompletion52 = true;
  var _didIteratorError52 = false;
  var _iteratorError52 = undefined;

  try {
    for (var _iterator52 = emotes[Symbol.iterator](), _step52; !(_iteratorNormalCompletion52 = (_step52 = _iterator52.next()).done); _iteratorNormalCompletion52 = true) {
      var emote_def = _step52.value;

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
    _didIteratorError52 = true;
    _iteratorError52 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion52 && _iterator52.return) {
        _iterator52.return();
      }
    } finally {
      if (_didIteratorError52) {
        throw _iteratorError52;
      }
    }
  }

  return results;
};

/* Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  var result = { cmd: null };
  var parts = line.split(" ");
  var data = {};
  if (parts[0].startsWith("@")) {
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
    result.flags = line.substr(line.indexOf(":", 1) + 1).split(" ");
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
    result.message = parts.slice(3).join(" ").replace(/^:/, "");
  } else if (parts[1] === "353") {
    /* NAMES listing entry */
    /* :<user> 353 <username> <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = Twitch.ParseUser(parts[0].replace(/^:/, ""));
    result.mode = parts[3];
    result.channel = Twitch.ParseChannel(parts[4]);
    result.usernames = parts.slice(5).join(" ").replace(/^:/, "").split(" ");
  } else if (parts[1] === "JOIN" || parts[1] === "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "MODE") {
    /* :<sender> MODE <channel> <modeflag> <username> */
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
    if (msg.startsWith("\x01ACTION ")) {
      result.flags.action = true;
      result.message = msg.strip("\x01").substr("ACTION ".length);
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
    if (line.indexOf(":", line.indexOf(parts[2])) > -1) {
      result.message = argFrom(line, ":", parts[2]);
    }
    result.sub_kind = TwitchSubEvent.KindFromMsgID(result.flags["msg-id"]);
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
    /* [@<flags>] :server GLOBALUSERSTATE\r\n */
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
  } else if (parts[1] === "CLEARCHAT") {
    /* [@<flags>] :<server> CLEARCHAT <channel>[ :<user>]\r\n */
    result.cmd = "CLEARCHAT";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(":", line.indexOf(parts[2])) > -1) {
      result.user = argFrom(line, ":", parts[2]);
    }
  } else if (parts[1] === "CLEARMSG") {
    /* [@<flags>] :<server> CLEARMSG <channel> :<message>\r\n */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "HOSTTARGET") {
    /* :<server> HOSTTARGET <channel> :<user> -\r\n */
    result.cmd = "HOSTTARGET";
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = parts[3].replace(/^:/, "");
  } else if (parts[1] === "NOTICE") {
    /* [@<flags>] :<server> NOTICE <channel> :<message>\r\n */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "421") {
    /* Error */
    /* :<server> 421 <user> <command> :<message>\r\n */
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
    var _iteratorNormalCompletion53 = true;
    var _didIteratorError53 = false;
    var _iteratorError53 = undefined;

    try {
      for (var _iterator53 = result.flags.badges[Symbol.iterator](), _step53; !(_iteratorNormalCompletion53 = (_step53 = _iterator53.next()).done); _iteratorNormalCompletion53 = true) {
        var badge_def = _step53.value;

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
      _didIteratorError53 = true;
      _iteratorError53 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion53 && _iterator53.return) {
          _iterator53.return();
        }
      } finally {
        if (_didIteratorError53) {
          throw _iteratorError53;
        }
      }
    }
  }
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  var pats = [["oauth:", /oauth:[\w]+/g], ["OAuth ", /OAuth [\w]+/g]];
  var result = msg;
  var _iteratorNormalCompletion54 = true;
  var _didIteratorError54 = false;
  var _iteratorError54 = undefined;

  try {
    for (var _iterator54 = pats[Symbol.iterator](), _step54; !(_iteratorNormalCompletion54 = (_step54 = _iterator54.next()).done); _iteratorNormalCompletion54 = true) {
      var _ref35 = _step54.value;

      var _ref36 = _slicedToArray(_ref35, 2);

      var name = _ref36[0];
      var pat = _ref36[1];

      if (result.match(pat)) {
        result = result.replace(pat, name + '<removed>');
      }
    }
  } catch (err) {
    _didIteratorError54 = true;
    _iteratorError54 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion54 && _iterator54.return) {
        _iterator54.return();
      }
    } finally {
      if (_didIteratorError54) {
        throw _iteratorError54;
      }
    }
  }

  return result;
};

/* Construct the module */
try {
  /* globals module */
  module.exports.TwitchEvent = TwitchEvent;
  module.exports.TwitchChatEvent = TwitchChatEvent;
  module.exports.TwitchSubEvent = TwitchSubEvent;
  module.exports.TwitchClient = TwitchClient;
  module.exports.Twitch = Twitch;
} catch (e) {} /* not running in node; ignore */

/* exported TwitchEvent TwitchChatEvent TwitchSubEvent TwitchClient Twitch */
/* globals CallbackHandler */