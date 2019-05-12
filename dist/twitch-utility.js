"use strict";

/* Twitch utilities */

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Twitch = {};

/* Storage of values used for debugging */

var _Twitch_DebugCache = function () {
  function _Twitch_DebugCache() {
    _classCallCheck(this, _Twitch_DebugCache);

    this.values = {};
  }

  _createClass(_Twitch_DebugCache, [{
    key: "add",
    value: function add(set, key) {
      if (!(set in this.values)) {
        this.values[set] = {};
      }
      if (key in this.values[set]) {
        this.values[set][key] += 1;
      } else {
        this.values[set][key] = 1;
      }
    }
  }, {
    key: "tolist",
    value: function tolist(set) {
      return Object.keys(this.values[set]);
    }
  }, {
    key: "getall",
    value: function getall() {
      return this.values;
    }
  }]);

  return _Twitch_DebugCache;
}();

Twitch.DebugCache = new _Twitch_DebugCache();

/* API URLs {{{0 */

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";

/* Store URLs to specific asset APIs */
Twitch.URL = {};

Twitch.URL.Rooms = function (cid) {
  return Twitch.Kraken + "/chat/" + cid + "/rooms";
};
Twitch.URL.Stream = function (cid) {
  return Twitch.Kraken + "/streams?channel=" + cid;
};
Twitch.URL.Clip = function (str) {
  return Twitch.Kraken + "/clips/" + str;
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

/* End of API URLs 0}}} */

/* Abstract XMLHttpRequest to `url -> callback` and `url -> Promise` systems */
Twitch.API = function _Twitch_API(global_headers, private_headers) {
  var onerror = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  this.GetSimpleCB = function _Twitch_API_GetSimple(url, callback) {
    var errorcb = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var req = new XMLHttpRequest();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState == 4) {
        if (this.status == 200) {
          callback(JSON.parse(this.responseText));
        } else {
          if (errorcb !== null) {
            errorcb(this);
          } else if (this._onerror) {
            this._onerror(this);
          } else {
            Util.Warn(this);
          }
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
      if (this.readyState == 4) {
        if (this.status == 200) {
          callback(JSON.parse(this.responseText));
        } else {
          if (errorcb !== null) {
            errorcb(this);
          } else if (this._onerror) {
            this._onerror(this);
          } else {
            Util.WarnOnly("Failed to get \"" + url + "\" stack=", callerStack);
            Util.WarnOnly(url, this);
          }
        }
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = Object.keys(global_headers)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var key = _step.value;

        req.setRequestHeader(key, global_headers[key]);
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

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = Object.keys(headers)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _key = _step2.value;

        req.setRequestHeader(_key, headers[_key]);
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

    if (add_private) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = Object.keys(private_headers)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var _key2 = _step3.value;

          req.setRequestHeader(_key2, private_headers[_key2]);
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
    }
    req.send();
  };
};

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  user = user.lstrip(':');
  return user.split('!')[0];
};

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  var ch = channel;
  var room = null;
  var roomuid = null;
  var parts = ch.split(':');
  if (parts.length == 1) {
    ch = parts[0];
  } else if (parts.length == 3) {
    var _parts = _slicedToArray(parts, 3);

    ch = _parts[0];
    room = _parts[1];
    roomuid = _parts[2];
  } else {
    Util.Warn("ParseChannel: " + ch + " not in expected format");
    ch = parts[0];
  }
  if (ch.indexOf('#') != 0) {
    ch = '#' + ch;
  }
  return { channel: ch, room: room, roomuid: roomuid };
};

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof room == "undefined") room = null;
  if (typeof roomuid == "undefined") roomuid = null;
  if (typeof channel == "string") {
    channel = channel.toLowerCase();
    if (channel == "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room !== null) {
        channel += ':' + room;
      }
      if (roomuid !== null) {
        channel += ':' + roomuid;
      }
      if (channel.indexOf('#') != 0) {
        channel = '#' + channel;
      }
      return channel;
    }
  } else if (channel && typeof channel.channel === "string") {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel, room, roomuid);
    return "" + channel;
  }
};

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  var result = undefined;
  if (value.length == 0) {
    /* Translate empty strings to null */
    result = null;
  } else if (value.match(/^[0-9]+$/)) {
    /* Translate numeric values to numbers */
    result = parseInt(value);
  } else {
    /* Values requiring special handling */
    switch (key) {
      case "badge-info":
        if (value.length > 0) {
          result = [];
          var _iteratorNormalCompletion4 = true;
          var _didIteratorError4 = false;
          var _iteratorError4 = undefined;

          try {
            for (var _iterator4 = value.split(',')[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              var badge = _step4.value;

              var _badge$split = badge.split('/'),
                  _badge$split2 = _slicedToArray(_badge$split, 2),
                  badge_name = _badge$split2[0],
                  badge_rev = _badge$split2[1];

              result.push([badge_name, badge_rev]);
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
        break;
      case "badges":
        result = [];
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = value.split(',')[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var _badge = _step5.value;

            var _badge$split3 = _badge.split('/'),
                _badge$split4 = _slicedToArray(_badge$split3, 2),
                _badge_name = _badge$split4[0],
                _badge_rev = _badge$split4[1];

            result.push([_badge_name, _badge_rev]);
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

        break;
      case "emotes":
        result = Twitch.ParseEmote(value);
        break;
      case "emote-sets":
        result = value.split(',').map(function (e) {
          return parseInt(e);
        });
        break;
      default:
        result = value;
        result = result.replace(/\\s/g, ' ');
        result = result.replace(/\\:/g, ';');
        result = result.replace(/\\r/g, '\r');
        result = result.replace(/\\n/g, '\n');
        result = result.replace(/\\\\/g, '\\');
        break;
    }
  }
  return result;
};

/* Parse @<flags...> key,value pairs */
Twitch.ParseData = function _Twitch_ParseData(dataString) {
  /* @key=value;key=value;... */
  dataString = dataString.lstrip('@');
  var data = {};
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = dataString.split(';')[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var item = _step6.value;

      var key = item;
      var val = "";
      if (item.indexOf('=') != -1) {
        var _item$split = item.split('=');

        var _item$split2 = _slicedToArray(_item$split, 2);

        key = _item$split2[0];
        val = _item$split2[1];
      }
      val = Twitch.ParseFlag(key, val);
      Twitch.DebugCache.add('flags', key);
      Twitch.DebugCache.add('flag-' + key, val);
      data[key] = val;
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

  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  var result = [];
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = value.split('/')[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var emote_def = _step7.value;

      var seppos = emote_def.indexOf(':');
      var emote_id = parseInt(emote_def.substr(0, seppos));
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = emote_def.substr(seppos + 1).split(',')[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var range = _step8.value;

          var _range$split = range.split('-'),
              _range$split2 = _slicedToArray(_range$split, 2),
              start = _range$split2[0],
              end = _range$split2[1];

          result.push({ id: emote_id,
            name: null,
            start: parseInt(start),
            end: parseInt(end) });
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

  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  var specs = [];
  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = emotes[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var emote = _step9.value;

      if (emote.id !== null) {
        specs.push(emote.id + ":" + emote.start + "-" + emote.end);
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

  return specs.join('/');
};

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; dont escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
};

/* Generate emote specifications for the given emotes [eid, ename] */
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes) {
  var results = [];
  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = emotes[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var emote_def = _step10.value;

      var _emote_def = _slicedToArray(emote_def, 2),
          eid = _emote_def[0],
          emote = _emote_def[1];

      var pat = Twitch.EmoteToRegex(emote);
      var arr = void 0;
      while ((arr = pat.exec(msg)) !== null) {
        /* arr = [wholeMatch, matchPart] */
        var start = arr.index + arr[0].indexOf(arr[1]);
        /* -1 to keep consistent with Twitch's off-by-one */
        var end = start + arr[1].length - 1;
        results.push({ id: eid, name: emote, start: start, end: end });
      }
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

  return results;
};

/* Object containing logic for parsing and interpreting Twitch IRC messages */
Twitch.IRC = {
  /* Regex for parsing incoming Twitch IRC messages; all messages should parse */
  Messages: {
    PING: [
    /* "PING :<server>\r\n" */ /* Verified */
    /^PING :(.*)(?:\r\n)?$/, { server: 1 }],
    ACK: [
    /* ":<server> CAP * ACK :<flags...>\r\n" */
    /^:([^ ]+) CAP \* (ACK) :(.*)(?:\r\n)?$/, { server: 1, operation: 2, flags: 3 }],
    TOPIC: [
    /* ":<server> <code> <username> :<message>\r\n" */ /* Verified */
    /^:([^ ]+) ((?:00[1-9])|(?:372)) ([^ ]+) :(.*)(?:\r\n)?$/, { server: 1, code: 2, username: 3, message: 4 }],
    NAMES: [
    /* ":<login> 353 <username> <modechr> <channel> :<users...>\r\n" */ /* Verified */
    /^:([^ ]+) 353 ([^ ]+) ([^ ]+) (#[^ ]+) :(.*)(?:\r\n)?$/, { user: 1, modechr: 3, channel: 4, users: 5 }],
    JOIN: [
    /* ":<name>!<user>@<user>.<host> JOIN <channel>\r\n" */ /* Verified */
    /^:([^ ]+) JOIN (#[^ ]+)(?:\r\n)?$/, { user: 1, channel: 2 }],
    PART: [
    /* ":<name>!<user>@<user>.<host> PART <channel>\r\n" */ /* Verified */
    /^:([^ ]+) PART (#[^ ]+)(?:\r\n)?$/, { user: 1, channel: 2 }],
    MODE: [
    /* ":<user> MODE <channel> <modeop> <users...>\r\n" */ /* Verified */
    /^:([^ ]+) MODE (#[^ ]+) ([+-]\w) (.*)(?:\r\n)?$/, { sender: 1, channel: 2, modeflag: 3, user: 4 }],
    PRIVMSG: [
    /* "@<flags> :<user> PRIVMSG <channel> :<message>\r\n" */ /* Verified */
    /^@([^ ]+) :([^ ]+) PRIVMSG (#[^ ]+) :(.*)(?:\r\n)?$/, { flags: 1, user: 2, channel: 3, message: 4 }],
    WHISPER: [
    /* @<flags> :<name>!<user>@<user>.<host> WHISPER <recipient> :<message>\r\n */
    /^@([^ ]+) :([^!]+)!([^@]+)@([^ ]+) WHISPER ([^ ]+) :(.*)(?:\r\n)?$/, { flags: 1, sender: 2, recipient: 6, message: 7 }],
    USERSTATE: [
    /* "@<flags> :<server> USERSTATE <channel>\r\n" */ /* Verified */
    /^@([^ ]+) :([^ ]+) USERSTATE (#[^ ]+)(?:\r\n)?$/, { flags: 1, server: 2, channel: 3 }],
    ROOMSTATE: [
    /* "@<flags> :<server> ROOMSTATE <channel>\r\n" */ /* Verified */
    /^@([^ ]+) :([^ ]+) ROOMSTATE (#[^ ]+)(?:\r\n)?$/, { flags: 1, server: 2, channel: 3 }],
    USERNOTICE: [
    /* "@<flags> :<server> USERNOTICE <channel>[ :<message>]\r\n" */
    /^@([^ ]+) :([^ ]+) USERNOTICE (#[^ ]+)(?: :(.*))?(?:\r\n)?$/, { flags: 1, server: 2, channel: 3, message: 4 }],
    GLOBALUSERSTATE: [
    /* "@<flags> :<server> GLOBALUSERSTATE \r\n" */
    /^@([^ ]+) :([^ ]+) GLOBALUSERSTATE(?:\r\n)?$/, { flags: 1, server: 2 }],
    CLEARCHAT: [
    /* "@<flags> :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
    /^@([^ ]+) :([^ ]+) CLEARCHAT (#[^ ]+)(?: :(.*))?(?:\r\n)?$/, { flags: 1, server: 2, channel: 3, user: 4 }],
    CLEARMSG: [
    /* "@<flags> :<server> CLEARMSG <channel> :<message>\r\n" */
    /^@([^ ]+) :([^ ]+) CLEARMSG (#[^ ]+) :(.*)(?:\r\n)?$/, { flags: 1, server: 2, channel: 3, message: 4 }],
    HOSTTARGET: [
    /* ":<server> HOSTTARGET <channel> :<hosting-user> -\r\n" */
    /^([^ ]+) HOSTTARGET (#[^ ]+) :([^ ]+).*(?:\r\n)?$/, { server: 1, channel: 2, user: 3, message: 4 }],
    NOTICE: [
    /* "@<flags> :<server> NOTICE <channel> :<message>\r\n" */
    /^(?:@([^ ]+) )?:([^ ]+) NOTICE ([^ ]+) :(.*)(?:\r\n)?$/, { flags: 1, server: 2, channel: 3, message: 4 }],
    ERROR: [
    /* ":<server> 421 <user> <command> :<message>\r\n" */
    /^:([^ ]+) (421) ([^ ]+) ([^ ]+) :(.*)(?:\r\n)?$/, { server: 1, user: 2, command: 3, message: 4 }],
    /* Line patterns to ignore */
    Ignore: [
    /* Start of TOPIC listing */
    /^:([^ ]+) (375) ([^ ]+) :-(?:\r\n)?$/,
    /* End of TOPIC listing */
    /^:([^ ]+) (376) ([^ ]+) :>(?:\r\n)?$/,
    /* Start/end of TOPIC listing, end of NAMES listing */
    /^:[^ ]+ (?:37[56]|366) [^ ]+ #[^ ]+ :.*(?:\r\n)?$/]
  },

  /* Return true if the line should be silently ignored */
  ShouldIgnore: function _Twitch_IRC_ShouldIgnore(line) {
    var _iteratorNormalCompletion11 = true;
    var _didIteratorError11 = false;
    var _iteratorError11 = undefined;

    try {
      for (var _iterator11 = Twitch.IRC.Messages.Ignore[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
        var pat = _step11.value;

        if (line.match(pat)) {
          return true;
        }
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

    return false;
  },

  /* Message-specific extra parsing */
  ParseSpecial: {
    /* PRIVMSG: Handle /me */
    'PRIVMSG': function _Twitch_IRC_ParseSpecial_PRIVMSG(obj) {
      var msg = obj.message;
      if (msg.startsWith("\x01ACTION ") && msg.endsWith('\x01')) {
        obj.fields.action = true;
        obj.fields.message = msg.strip('\x01').substr("ACTION ".length);
      } else {
        obj.fields.action = false;
      }
    },
    /* USERSTATE: Add user attribute */
    'USERSTATE': function _Twitch_IRC_ParseSpecial_USERSTATE(obj) {
      if (obj.fields.flags && obj.fields.flags['display-name']) {
        obj.fields.username = obj.fields.flags['display-name'];
      }
    },
    /* USERNOTICE: Handle sub notices */
    'USERNOTICE': function _Twitch_IRC_ParseSpecial_USERNOTICE(obj) {
      var fields = obj.fields;
      var flags = fields.flags;
      fields.issub = false;
      fields.sub_kind = null;
      fields.sub_user = null;
      fields.sub_gifting_user = null;
      fields.sub_months = null;
      fields.sub_plan = null;
      fields.sub_plan_name = null;
      if (flags && flags["msg-id"]) {
        switch (flags["msg-id"]) {
          case "sub":
            fields.issub = true;
            fields.sub_kind = flags["msg-id"].toUpperCase();
            fields.sub_user = flags["login"];
            fields.sub_months = flags["msg-param-sub-months"];
            fields.sub_total_months = flags["msg-param-cumulative-months"];
            fields.sub_plan = flags["msg-param-sub-plan"];
            fields.sub_plan_name = flags["msg-param-sub-plan-name"];
            break;
          case "resub":
            fields.issub = true;
            fields.sub_kind = flags["msg-id"].toUpperCase();
            fields.sub_user = flags["login"];
            fields.sub_months = flags["msg-param-sub-months"];
            fields.sub_total_months = flags["msg-param-cumulative-months"];
            fields.sub_plan = flags["msg-param-sub-plan"];
            fields.sub_plan_name = flags["msg-param-sub-plan-name"];
            break;
          case "subgift":
            fields.issub = true;
            fields.sub_kind = flags["msg-id"].toUpperCase();
            fields.sub_user = flags["msg-param-recipient-user-name"];
            fields.sub_months = flags["msg-param-sub-months"];
            fields.sub_total_months = flags["msg-param-cumulative-months"];
            fields.sub_plan = flags["msg-param-sub-plan"];
            fields.sub_plan_name = flags["msg-param-sub-plan-name"];
            break;
          case "anonsubgift":
            fields.issub = true;
            fields.sub_kind = flags["msg-id"].toUpperCase();
            fields.sub_user = flags["msg-param-recipient-user-name"];
            fields.sub_months = flags["msg-param-sub-months"];
            fields.sub_total_months = flags["msg-param-cumulative-months"];
            fields.sub_plan = flags["msg-param-sub-plan"];
            fields.sub_plan_name = flags["msg-param-sub-plan-name"];
            break;
          case "raid":
            /* TODO */
            /* msg-param-displayName - raiding user
             * msg-param-login - raiding user's username
             * msg-param-viewerCount - number of viewers */
            break;
        }
      }
    }
  },

  /* Parse the given line into an object defined by Twitch.IRC.Messages */
  Parse: function _Twitch_IRC_Parse(line) {
    if (Twitch.IRC.ShouldIgnore(line)) {
      return null;
    }
    var cmd = null;
    var pattern = null;
    var match = null;
    var rules = null;
    var _iteratorNormalCompletion12 = true;
    var _didIteratorError12 = false;
    var _iteratorError12 = undefined;

    try {
      for (var _iterator12 = Object.entries(Twitch.IRC.Messages)[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
        var _ref = _step12.value;

        var _ref2 = _slicedToArray(_ref, 2);

        var pn = _ref2[0];
        var pr = _ref2[1];

        var _pr = _slicedToArray(pr, 2),
            pat = _pr[0],
            patrules = _pr[1];

        if (pn == "Ignore") continue;
        if ((match = line.match(pat)) !== null) {
          cmd = pn;
          pattern = pat;
          rules = patrules;
          break;
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

    if (cmd == null) {
      /* Failed to parse line! */
      Util.Error("Failed to parse IRC message", line);
      return null;
    }
    /* Construct a response */
    var resp = {
      cmd: cmd,
      line: line,
      patinfo: [pattern, match],
      fields: {},
      message: null
    };
    if (rules.hasOwnProperty("message")) {
      resp.message = match[rules.message];
    }
    var _iteratorNormalCompletion13 = true;
    var _didIteratorError13 = false;
    var _iteratorError13 = undefined;

    try {
      for (var _iterator13 = Object.entries(rules)[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
        var _ref3 = _step13.value;

        var _ref4 = _slicedToArray(_ref3, 2);

        var fn = _ref4[0];
        var fi = _ref4[1];

        /* Perform special parsing on specific items */
        if (["username", "user", "login"].includes(fn)) {
          /* Parse a username */
          resp.fields[fn] = Twitch.ParseUser(match[fi]);
        } else if (fn == "channel") {
          resp.fields[fn] = Twitch.ParseChannel(match[fi]);
        } else if (fn == "capabilities") {
          resp.fields[fn] = match[fi].split(" ");
        } else if (fn == "users") {
          resp.fields[fn] = match[fi].split(" ");
        } else if (fn == "flags") {
          resp.fields[fn] = Twitch.ParseData(match[fi]); /* FIXME: undefined */
          /*TypeError: dataString is undefined[Learn More] twitch-utility.js:240:3
              _Twitch_ParseData https://kaedenn.github.io/twitch-api/twitch-utility.js:240
              _Twitch_IRC_Parse https://kaedenn.github.io/twitch-api/twitch-utility.js:547
              _TwitchClient_OnWebsocketMessage https://kaedenn.github.io/twitch-api/client.js:1028
              onmessage https://kaedenn.github.io/twitch-api/client.js:252
          */
        } else {
          resp.fields[fn] = match[fi];
        }
      }
      /* Handle special parsing */
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

    if (Twitch.IRC.ParseSpecial[cmd]) {
      Twitch.IRC.ParseSpecial[cmd](resp);
    }
    return resp;
  }

  /* (TODO: REMOVE) Parse a line received through the Twitch websocket */
};Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  /* Try parsing with the new object */
  var result = { cmd: null };
  var parts = line.split(' ');
  var data = {};
  if (parts[0].startsWith('@')) {
    data = Twitch.ParseData(parts[0]);
    parts.shift();
  }
  if (parts[0] == "PING") {
    /* "PING :<server>" */
    result.cmd = "PING";
    result.server = parts[1].lstrip(':');
  } else if (parts[1] == "CAP" && parts[2] == "*" && parts[3] == "ACK") {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = "ACK";
    result.operation = "CAP";
    result.server = parts[0].lstrip(':');
    result.flags = line.substr(line.indexOf(':', 1) + 1).split(" ");
  } else if (parts[1] == "375" || parts[1] == "376" || parts[1] == "366") {
    /* 375: Start TOPIC; 376: End TOPIC; 366: End NAMES */
    /* :<server> <code> <username> :<message> */
    result.cmd = "OTHER";
    result.server = parts[0].lstrip(':');
    result.code = parts[1];
  } else if (parts[1].match(/00[1-9]/) || parts[1] == "372") {
    /* :<server> 00[1-4] <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
    result.server = parts[0].lstrip(':');
    result.username = parts[2];
    result.message = parts.slice(3).join(' ').lstrip(':');
  } else if (parts[1] == "353") {
    /* NAMES listing entry */
    /* :<user> 353 <username> <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = Twitch.ParseUser(parts[0].lstrip(':'));
    result.mode = parts[3];
    result.channel = Twitch.ParseChannel(parts[4]);
    result.usernames = parts.slice(5).join(' ').lstrip(':').split(' ');
  } else if (parts[1] == "JOIN" || parts[1] == "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "MODE") {
    /* ":<sender> MODE <channel> <modeflag> <username>" */
    result.cmd = "MODE";
    result.sender = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.modeflag = parts[3];
    result.user = parts[4];
  } else if (parts[1] == "PRIVMSG") {
    /* [@<flags>] :<user> PRIVMSG <channel> :<msg> */
    var msg = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    if (msg.startsWith('\x01ACTION ')) {
      result.action = true;
      result.message = msg.strip('\x01').substr('ACTION '.length);
    } else {
      result.action = false;
      result.message = msg;
    }
  } else if (parts[1] == "WHISPER") {
    result.cmd = "WHISPER";
    result.flags = data;
    result.user = data["display-name"];
    result.sender = Twitch.ParseUser(parts[0]);
    result.recipient = Twitch.ParseUser(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf('WHISPER')) + 1);
  } else if (parts[1] == "USERSTATE") {
    /* [@<flags>] :<server> USERSTATE <channel> */
    result.cmd = "USERSTATE";
    result.flags = data;
    result.server = parts[0].lstrip(':');
    result.username = data["display-name"];
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "ROOMSTATE") {
    /* [@<flags>] :<server> ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = data;
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "USERNOTICE") {
    /* [@<flags>] :<server> USERNOTICE <channel> */
    /* [@<flags>] :<server> USERNOTICE <channel> :<message> */
    result.cmd = "USERNOTICE";
    result.flags = data;
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    result.issub = false;
    result.sub_kind = null;
    result.sub_user = null;
    result.sub_gifting_user = null;
    result.sub_months = null;
    if (result.flags["msg-id"]) {
      if (result.flags.hasOwnProperty('msg-param-cumulative-months')) {
        result.sub_total_months = result.flags['msg-param-cumulative-months'];
      }
      if (result.flags.hasOwnProperty('msg-param-streak-months')) {
        result.sub_streak_months = result.flags['msg-param-streak-months'];
      }
      if (result.flags.hasOwnProperty('msg-param-sub-plan-name')) {
        result.sub_plan = result.flags['msg-param-sub-plan-name'];
      }
      switch (result.flags["msg-id"]) {
        case "sub":
          result.issub = true;
          result.sub_kind = "SUB";
          result.sub_user = result.flags["login"];
          result.sub_months = result.sub_total_months;
          result.sub_total_months = result.flags["msg-param-cumulative-months"];
          break;
        case "resub":
          result.issub = true;
          result.sub_kind = "RESUB";
          result.sub_user = result.flags["login"];
          result.sub_months = result.sub_total_months;
          result.sub_total_months = result.flags["msg-param-cumulative-months"];
          break;
        case "subgift":
          result.issub = true;
          result.sub_kind = "GIFTSUB";
          result.sub_gifting_user = result.flags["login"];
          result.sub_user = result.flags["msg-param-recipient-user-name"];
          result.sub_months = result.sub_total_months;
          result.sub_total_months = result.flags["msg-param-cumulative-months"];
          break;
        case "anonsubgift":
          result.issub = true;
          result.sub_kind = "ANONGIFTSUB";
          result.sub_gifting_user = result.flags["login"];
          result.sub_user = result.flags["msg-param-recipient-user-name"];
          result.sub_months = result.sub_total_months;
          result.sub_total_months = result.flags["msg-param-cumulative-months"];
          break;
      }
    }
  } else if (parts[1] == "GLOBALUSERSTATE") {
    /* "[@<flags>] :server GLOBALUSERSTATE\r\n" */
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0].lstrip(':');
  } else if (parts[1] == "CLEARCHAT") {
    /* "[@<flags>] :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
    result.cmd = "CLEARCHAT";
    result.flags = data;
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.user = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    }
  } else if (parts[1] == "CLEARMSG") {
    /* "[@<flags>] :<server> CLEARMSG <channel> :<message>\r\n" */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] == "HOSTTARGET") {
    /* ":<server> HOSTTARGET <channel> :<user> -\r\n" */
    result.cmd = "HOSTTARGET";
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = parts[3].lstrip(":");
  } else if (parts[1] == "NOTICE") {
    /* "[@<flags>] :<server> NOTICE <channel> :<message>\r\n" */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] == "421") {
    /* Error */
    /* ":<server> 421 <user> <command> :<message>\r\n" */
    result.cmd = "ERROR";
    result.server = parts[0].lstrip(':');
    result.user = Twitch.ParseUser(parts[2]);
    result.command = parts[3];
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[3])) + 1);
  } else {
    Util.Warn("OnWebsocketMessage: unknown message:", parts);
  }
  /* Ensure result.flags has values defined by badges */
  if (result.flags && result.flags.badges) {
    var _iteratorNormalCompletion14 = true;
    var _didIteratorError14 = false;
    var _iteratorError14 = undefined;

    try {
      for (var _iterator14 = result.flags.badges[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
        var badge_def = _step14.value;

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
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  var pats = [['oauth:', /oauth:[\w]+/g], ['OAuth ', /OAuth [\w]+/g]];
  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = pats[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var _ref5 = _step15.value;

      var _ref6 = _slicedToArray(_ref5, 2);

      var name = _ref6[0];
      var pat = _ref6[1];

      if (msg.search(pat)) {
        msg = msg.replace(pat, name + "<removed>");
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

  return msg;
};

/* Mark the Twitch Utility API as loaded */
Twitch.API_Loaded = true;
document.dispatchEvent(new Event("twapi-twutil-loaded"));