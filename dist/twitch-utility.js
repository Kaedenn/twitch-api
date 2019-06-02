"use strict";

/* Twitch utilities */

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var Twitch = {};

/* Escape sequences {{{0 */

Twitch.FlagEscapes = [["\\s", /\\s/g, " ", / /g], ["\\:", /\\:/g, ";", /;/g], ["\\r", /\\r/g, "\r", /\r/g], ["\\n", /\\n/g, "\n", /\n/g], ["\\", /\\\\/g, "\\", /\\/g]];

/* End escape sequences 0}}} */

/* API URLs {{{0 */

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
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
Twitch.URL.Clip = function (slug) {
  return Twitch.Helix + "/clips?id=" + slug;
};
Twitch.URL.Game = function (id) {
  return Twitch.Helix + "/games?id=" + id;
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
      if (this.readyState === 4) {
        if (this.status === 200) {
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
      if (this.readyState === 4) {
        if (this.status === 200) {
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
  user = user.replace(/^:/, "");
  return user.split('!')[0];
};

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  var ch = channel;
  var room = null;
  var roomuid = null;
  var parts = ch.split(':');
  if (parts.length === 1) {
    ch = parts[0];
  } else if (parts.length === 3) {
    var _parts = _slicedToArray(parts, 3);

    ch = _parts[0];
    room = _parts[1];
    roomuid = _parts[2];
  } else {
    Util.Warn("ParseChannel: " + ch + " not in expected format");
    ch = parts[0];
  }
  if (ch.indexOf('#') !== 0) {
    ch = '#' + ch;
  }
  return { channel: ch, room: room, roomuid: roomuid };
};

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof room === "undefined") room = null;
  if (typeof roomuid === "undefined") roomuid = null;
  if (typeof channel === "string") {
    channel = channel.toLowerCase();
    if (channel === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room !== null) {
        channel += ':' + room;
      }
      if (roomuid !== null) {
        channel += ':' + roomuid;
      }
      if (channel.indexOf('#') !== 0) {
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

/* Parse Twitch flag escape sequences */
Twitch.DecodeFlag = function _Twitch_DecodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = Twitch.FlagEscapes[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var row = _step4.value;

      result = result.replace(row[1], row[2]);
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

  return result;
};

/* Format Twitch flag escape sequences */
Twitch.EncodeFlag = function _Twitch_EncodeFlag(value) {
  var result = value;
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = Twitch.FlagEscapes[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var row = _step5.value;

      result = result.replace(row[3], row[0]);
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

  return result;
};

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  var result = null;
  if (key === "badge-info" || key === "badges") {
    result = [];
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
      for (var _iterator6 = value.split(',')[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
        var badge = _step6.value;

        var _badge$split = badge.split('/'),
            _badge$split2 = _slicedToArray(_badge$split, 2),
            badge_name = _badge$split2[0],
            badge_rev = _badge$split2[1];

        result.push([badge_name, badge_rev]);
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
  dataString = dataString.replace(/^@/, "");
  var data = {};
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = dataString.split(';')[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var item = _step7.value;

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

  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  var result = [];
  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = value.split('/')[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var emote_def = _step8.value;

      var seppos = emote_def.indexOf(':');
      var emote_id = Number.parseInt(emote_def.substr(0, seppos));
      var _iteratorNormalCompletion9 = true;
      var _didIteratorError9 = false;
      var _iteratorError9 = undefined;

      try {
        for (var _iterator9 = emote_def.substr(seppos + 1).split(',')[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
          var range = _step9.value;

          var _range$split = range.split('-'),
              _range$split2 = _slicedToArray(_range$split, 2),
              start = _range$split2[0],
              end = _range$split2[1];

          result.push({ id: emote_id,
            name: null,
            start: Number.parseInt(start),
            end: Number.parseInt(end) });
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

  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  var specs = [];
  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = emotes[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var emote = _step10.value;

      if (emote.id !== null) {
        specs.push(emote.id + ":" + emote.start + "-" + emote.end);
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
  var _iteratorNormalCompletion11 = true;
  var _didIteratorError11 = false;
  var _iteratorError11 = undefined;

  try {
    for (var _iterator11 = emotes[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
      var emote_def = _step11.value;

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

  return results;
};

/* Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  /* Try parsing with the new object */
  var result = { cmd: null };
  var parts = line.split(' ');
  var data = {};
  if (parts[0].startsWith('@')) {
    data = Twitch.ParseFlags(parts[0]);
    parts.shift();
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
    var msg = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
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
    result.message = line.substr(line.indexOf(':', line.indexOf('WHISPER')) + 1);
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
      result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    } else {
      result.message = "";
    }
    result.sub_kind = TwitchSubEvent.FromMsgID(result.flags["msg-id"]);
    result.issub = result.sub_kind !== null;
    result.israid = result.flags["msg-id"] === "raid";
    result.isritual = result.flags["msg-id"] === "ritual";
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
      result.user = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    }
  } else if (parts[1] === "CLEARMSG") {
    /* "[@<flags>] :<server> CLEARMSG <channel> :<message>\r\n" */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
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
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] === "421") {
    /* Error */
    /* ":<server> 421 <user> <command> :<message>\r\n" */
    result.cmd = "ERROR";
    result.server = parts[0].replace(/^:/, "");
    result.user = Twitch.ParseUser(parts[2]);
    result.command = parts[3];
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[3])) + 1);
  } else {
    Util.Warn("OnWebsocketMessage: unknown message:", parts);
  }
  /* Ensure result.flags has values defined by badges */
  if (result.flags && result.flags.badges) {
    var _iteratorNormalCompletion12 = true;
    var _didIteratorError12 = false;
    var _iteratorError12 = undefined;

    try {
      for (var _iterator12 = result.flags.badges[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
        var badge_def = _step12.value;

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
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  var pats = [['oauth:', /oauth:[\w]+/g], ['OAuth ', /OAuth [\w]+/g]];
  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = pats[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var _ref = _step13.value;

      var _ref2 = _slicedToArray(_ref, 2);

      var name = _ref2[0];
      var pat = _ref2[1];

      if (msg.search(pat)) {
        msg = msg.replace(pat, name + "<removed>");
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

  return msg;
};