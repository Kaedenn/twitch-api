"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 *  Only the first channel-specific sub badge seems to appear; longer-duration
 *  badges don't display.
 *  Inconsistent code:
 *    _ensureChannel().channel vs FormatChannel() ???
 */

/* TODO:
 *  Remove either Twitch.API or Util.API
 *  Fix the following:
 *    Join specific room (JoinChannel only looks at channel.channel)
 *  USERNOTICEs:
 *    rewardgift
 *    giftpaidupgrade
 *      msg-param-promo-gift-total
 *      msg-param-promo-name
 *    anongiftpaidupgrade
 *      msg-param-promo-gift-total
 *      msg-param-promo-name
 *    unraid
 *    bitsbadgetier
 */

/* Twitch utilities {{{0 */

let Twitch = {};

/* Escape sequences {{{1 */

Twitch.FLAG_ESCAPE_RULES = [
  /* escaped character, escaped regex, raw character, raw regex */
  ["\\s", /\\s/g, " ", / /g],
  ["\\:", /\\:/g, ";", /;/g],
  ["\\r", /\\r/g, "\r", /\r/g],
  ["\\n", /\\n/g, "\n", /\n/g],
  ["\\\\", /\\\\/g, "\\", /\\/g]
];

/* End escape sequences 1}}} */

/* API URL definitions {{{1 */

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";

/* Store URLs to specific asset APIs */
Twitch.URL = {};

Twitch.URL.Rooms = (cid) => `${Twitch.Kraken}/chat/${cid}/rooms`;
Twitch.URL.Stream = (cid) => `${Twitch.Kraken}/streams?channel=${cid}`;
Twitch.URL.Clip = (slug) => `${Twitch.Helix}/clips?id=${slug}`;
Twitch.URL.Game = (id) => `${Twitch.Helix}/games?id=${id}`;

Twitch.URL.Badges = (cid) => `${Twitch.Kraken}/chat/${cid}/badges`;
Twitch.URL.AllBadges = () => `https://badges.twitch.tv/v1/badges/global/display`;
Twitch.URL.Cheer = (prefix, tier, scheme="dark", size=1) => `https://d3aqoihi2n8ty8.cloudfront.net/actions/${prefix}/${scheme}/animated/${tier}/${size}.gif`;
Twitch.URL.Cheers = (cid) => `${Twitch.Kraken}/bits/actions?channel_id=${cid}`;
Twitch.URL.AllCheers = () => `${Twitch.Kraken}/bits/actions`;
Twitch.URL.Emote = (eid, size='1.0') => `${Twitch.JTVNW}/emoticons/v1/${eid}/${size}`;
Twitch.URL.EmoteSet = (eset) => `${Twitch.Kraken}/chat/emoticon_images?emotesets=${eset}`;

Twitch.URL.FFZAllEmotes = () => `${Twitch.FFZ}/emoticons`;
Twitch.URL.FFZEmotes = (cid) => `${Twitch.FFZ}/room/id/${cid}`;
Twitch.URL.FFZEmote = (eid) => `${Twitch.FFZ}/emote/${eid}`;
Twitch.URL.FFZBadges = () => `${Twitch.FFZ}/_badges`;
Twitch.URL.FFZBadgeUsers = () => `${Twitch.FFZ}/badges`;

Twitch.URL.BTTVAllEmotes = () => `${Twitch.BTTV}/emotes`;
Twitch.URL.BTTVEmotes = (cname) => `${Twitch.BTTV}/channels/${cname}`;
Twitch.URL.BTTVEmote = (eid) => `${Twitch.BTTV}/emote/${eid}/1x`;

/* End API URL definitions 1}}} */

/* Abstract XMLHttpRequest to `url -> callback` and `url -> Promise` systems */
Twitch.API = function _Twitch_API(global_headers, private_headers, onerror=null) {
  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  this.GetSimpleCB =
  function _Twitch_API_GetSimple(url, callback, errorcb=null) {
    let req = new XMLHttpRequest();
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
  this.GetCB =
  function _Twitch_API_Get(url, callback, headers={}, add_private=false, errorcb=null) {
    let req = new XMLHttpRequest();
    let callerStack = Util.GetStack();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          Util.WarnOnly(`Failed to get "${url}" stack=`, callerStack);
          Util.WarnOnly(url, this);
        }
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    for (let key of Object.keys(global_headers)) {
      req.setRequestHeader(key, global_headers[key]);
    }
    for (let key of Object.keys(headers)) {
      req.setRequestHeader(key, headers[key]);
    }
    if (add_private) {
      for (let key of Object.keys(private_headers)) {
        req.setRequestHeader(key, private_headers[key]);
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
  if (typeof(channel) === "string") {
    let chobj = {
      channel: "",
      room: null,
      roomuid: null
    };
    let parts = channel.split(':');
    if (parts.length === 1) {
      chobj.channel = parts[0];
    } else if (parts.length === 3) {
      chobj.channel = parts[0];
      chobj.room = parts[1];
      chobj.roomuid = parts[2];
    } else {
      Util.Warn(`ParseChannel: ${channel} not in expected format`);
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
    return {channel: "GLOBAL", room: null, roomuid: null};
  }
};

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof(channel) === "string") {
    channel = channel.toLowerCase();
    if (channel === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room) {
        channel += ':' + room;
      }
      if (roomuid) {
        channel += ':' + roomuid;
      }
      if (channel.indexOf('#') !== 0) {
        channel = '#' + channel;
      }
      return channel;
    }
  } else if (channel && typeof(channel.channel) === "string") {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel, room, roomuid);
    return `${channel}`;
  }
};

/* Parse Twitch flag escape sequences */
Twitch.DecodeFlag = function _Twitch_DecodeFlag(value) {
  let result = value;
  for (let row of Twitch.FLAG_ESCAPE_RULES) {
    result = result.replace(row[1], row[2]);
  }
  return result;
};

/* Format Twitch flag escape sequences */
Twitch.EncodeFlag = function _Twitch_EncodeFlag(value) {
  let result = value;
  for (let row of Twitch.FLAG_ESCAPE_RULES.reverse()) {
    result = result.replace(row[3], row[0]);
  }
  return result;
};

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  let result = null;
  if (value.length === 0) {
    result = "";
  } else if (key === "badge-info" || key === "badges") {
    result = [];
    for (let badge of value.split(',')) {
      let [badge_name, badge_rev] = badge.split('/');
      result.push([badge_name, badge_rev]);
    }
  } else if (key === "emotes") {
    result = Twitch.ParseEmote(value);
  } else if (key === "emote-sets") {
    result = value.split(',').map(e => Number.parse(e));
  } else {
    result = Twitch.DecodeFlag(value);
  }
  if (typeof(result) === "string") {
    let temp = Number.parse(result);
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
  let data = {};
  for (let item of dataString.split(';')) {
    let key = item;
    let val = "";
    if (item.indexOf('=') !== -1) {
      [key, val] = item.split('=');
    }
    val = Twitch.ParseFlag(key, val);
    data[key] = val;
  }
  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  let result = [];
  for (let emote_def of value.split('/')) {
    let sep_pos = emote_def.indexOf(':');
    let emote_id = Number.parseInt(emote_def.substr(0, sep_pos));
    for (let range of emote_def.substr(sep_pos+1).split(',')) {
      let [start, end] = range.split('-');
      result.push({
        id: emote_id,
        name: null,
        start: Number.parseInt(start),
        end: Number.parseInt(end)
      });
    }
  }
  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  let specs = [];
  for (let emote of emotes) {
    if (emote.id !== null) {
      specs.push(`${emote.id}:${emote.start}-${emote.end}`);
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
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes, escape=false) {
  let results = [];
  for (let emote_def of emotes) {
    let [eid, emote] = emote_def;
    let pat = Twitch.EmoteToRegex(escape ? RegExp.escape(emote) : emote);
    let arr;
    while ((arr = pat.exec(msg)) !== null) {
      /* arr = [wholeMatch, matchPart] */
      let start = arr.index + arr[0].indexOf(arr[1]);
      /* -1 to keep consistent with Twitch's off-by-one */
      let end = start + arr[1].length - 1;
      results.push({id: eid, pat: pat, name: emote, start: start, end: end});
    }
  }
  return results;
};

/* Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  let result = { cmd: null };
  let parts = line.split(' ');
  let data = {};
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
    result.flags = line.substr(line.indexOf(':', 1)+1).split(" ");
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
    let msg = argFrom(line, ":", parts[2]);
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
    result.issub = (result.sub_kind !== null);
    result.israid = (result.flags["msg-id"] === "raid");
    result.isritual = (result.flags["msg-id"] === "ritual");
    result.ismysterygift = (result.flags["msg-id"] === "submysterygift");
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
  } else if (parts[1] === "421") { /* Error */
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
    for (let badge_def of result.flags.badges) {
      let badge_name = badge_def[0];
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
  }
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  let pats = [
    ['oauth:', /oauth:[\w]+/g],
    ['OAuth ', /OAuth [\w]+/g]
  ];
  for (let [name, pat] of pats) {
    if (msg.search(pat)) {
      msg = msg.replace(pat, `${name}<removed>`);
    }
  }
  return msg;
};

/* End Twitch utilities 0}}} */

/* Event classes {{{0 */

/* Base Event object for Twitch events */
class TwitchEvent {
  constructor(type, raw_line, parsed) {
    this._cmd = type;
    this._raw = raw_line || "";
    this._parsed = parsed || {};
    if (!TwitchEvent.COMMANDS.hasOwnProperty(this._cmd)) {
      Util.Error(`Command ${this._cmd} not enumerated in this.COMMANDS`);
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
      this._parsed.channel = {channel: "GLOBAL", room: null, roomuid: null};
    }
  }

  static get COMMANDS() {
    return {
      CHAT: "CHAT",
      PING: "PING",
      ACK: "ACK",
      TOPIC: "TOPIC",
      NAMES: "NAMES",
      JOIN: "JOIN",
      PART: "PART",
      RECONNECT: "RECONNECT",
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
      NEWUSER: "NEWUSER",
      MYSTERYGIFT: "MYSTERYGIFT",
      OTHERUSERNOTICE: "OTHERUSERNOTICE",
      RAID: "RAID",
      OPEN: "OPEN",
      CLOSE: "CLOSE",
      MESSAGE: "MESSAGE",
      ERROR: "ERROR",
      OTHER: "OTHER"
    };
  }

  get type() { return "twitch-" + this._cmd.toLowerCase(); }
  get command() { return this._cmd; }
  get raw_line() { return this._raw; }
  get values() { return this._parsed; }
  has_value(key) { return this._parsed.hasOwnProperty(key); }

  get channel() { return this.values.channel; }
  get message() { return this.values.message; }
  get user() { return this.values.user || this.flags["display-name"]; }
  get name() { return this.flags["display-name"] || this.values.user; }
  get flags() { return this.values.flags; }
  flag(flag) { return this.flags ? this.flags[flag] : null; }

  /* Obtain the first non-falsy value of the listed flags */
  first_flag(...flags) {
    for (let flag of flags) {
      if (this.flags[flag]) {
        return this.flags[flag];
      }
    }
    return null;
  }

  get notice_msgid() {
    if (this._cmd === "NOTICE") {
      if (typeof(this.flags["msg-id"]) === "string") {
        return this.flags["msg-id"];
      }
    }
    return null;
  }

  get notice_class() {
    let msgid = this.notice_msgid;
    if (typeof(msgid) === "string") {
      return msgid.split('_')[0];
    }
    return null;
  }

  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let args = [this._cmd, this._raw, this._parsed];
    return `new ${cls}(${JSON.stringify(args)})`;
  }
}

/* Event object for chat events */
class TwitchChatEvent extends TwitchEvent {
  constructor(raw_line, parsed) {
    super("CHAT", raw_line, parsed);
    this._id = parsed.flags.id;
  }
  get id() {
    return this._id;
  }
  get iscaster() {
    return this.has_badge("broadcaster");
  }
  get ismod() {
    return this.flags.mod || this.has_badge("moderator") || this.iscaster;
  }
  get issub() {
    return this.flags.subscriber || this.has_badge("subscriber");
  }
  get isvip() {
    return this.has_badge("vip");
  }
  has_badge(badge, rev=null) {
    if (!this.flags.badges)
      return false;
    for (let [badge_name, badge_rev] of this.flags.badges) {
      if (badge_name === badge) {
        if (rev !== null) {
          return badge_rev === rev;
        } else {
          return true;
        }
      }
    }
    return false;
  }
  get sub_months() {
    if (this.flags["badge-info"]) {
      for (let [bname, brev] in this.flags["badge-info"]) {
        if (bname === "subscriber") {
          return brev;
        }
      }
    }
    return 0;
  }
  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let raw = JSON.stringify(this._raw);
    let parsed = JSON.stringify(this._parsed);
    return `new ${cls}(${raw},${parsed})`;
  }
}

/* Event object for subscription events */
class TwitchSubEvent extends TwitchEvent {
  constructor(sub_kind, raw_line, parsed) {
    super(sub_kind, raw_line, parsed);
    this._sub_kind = sub_kind;
  }

  get kind() { return this._sub_kind; }
  static get SUB() { return "SUB"; }
  static get RESUB() { return "RESUB"; }
  static get GIFTSUB() { return "GIFTSUB"; }
  static get ANONGIFTSUB() { return "ANONGIFTSUB"; }

  static get PLAN_PRIME() { return "Prime"; }
  static get PLAN_TIER1() { return "1000"; }
  static get PLAN_TIER2() { return "2000"; }
  static get PLAN_TIER3() { return "3000"; }

  static FromMsgID(msgid) {
    if (msgid === "sub") return TwitchSubEvent.SUB;
    if (msgid === "resub") return TwitchSubEvent.RESUB;
    if (msgid === "subgift") return TwitchSubEvent.GIFTSUB;
    if (msgid === "anonsubgift") return TwitchSubEvent.ANONSUBGIFT;
    return null;
  }

  static PlanName(plan_id) {
    let plan = `${plan_id}`;
    if (plan === TwitchSubEvent.PLAN_PRIME) {
      return "Twitch Prime";
    } else if (plan === TwitchSubEvent.PLAN_TIER1) {
      return "Tier 1";
    } else if (plan === TwitchSubEvent.PLAN_TIER2) {
      return "Tier 2";
    } else if (plan === TwitchSubEvent.PLAN_TIER3) {
      return "Tier 3";
    } else {
      return `"${plan}"`;
    }
  }

  /* Methods below apply to all sub kinds */
  get user() {
    let name = this.first_flag('msg-param-login', 'display-name');
    return name || this._parsed.user;
  }

  get plan() { return this.flags['msg-param-sub-plan-name']; }
  get plan_id() { return this.flags['msg-param-sub-plan']; }
  get months() { return this.flags['msg-param-months'] || 0; }
  get total_months() { return this.flags['msg-param-cumulative-months'] || 0; }
  get share_streak() { return this.flags['msg-param-should-share-streak']; }
  get streak_months() { return this.flags['msg-param-streak-months'] || 0; }

  /* Methods below only apply only to gift subs */
  get anonymous() { return this.kind === TwitchSubEvent.ANONGIFTSUB; }
  get recipient() { return this.flags['msg-param-recipient-user-name']; }
  get recipient_id() { return this.flags['msg-param-recipient-id']; }
  get recipient_name() { return this.flags['msg-param-recipient-display-name']; }
}

/* End of event classes section 0}}} */

/* TwitchClient constructor definition */
function TwitchClient(opts) {
  let cfg_name = opts.Name;
  let cfg_clientid = opts.ClientID;
  let cfg_pass = opts.Pass;

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
  this._enable_ffz = !opts.NoFFZ;
  this._enable_bttv = !opts.NoBTTV;

  /* Whether or not we were given a clientid */
  this._has_clientid = cfg_clientid && cfg_clientid.length > 0;

  /* Don't load assets (for small testing) */
  this._no_assets = opts.NoAssets ? true : false;

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
  this.get = function _Client_get(k) { return this._kv[k]; };
  this.set = function _Client_set(k, v) { this._kv[k] = v; };
  this.has = function _Client_has(k) { return this._kv.hasOwnProperty(k); };

  /* Handle authentication and password management */
  this._authed = cfg_pass ? true : false;
  let oauth, oauth_header;
  if (this._authed) {
    if (cfg_pass.indexOf("oauth:") !== 0) {
      oauth = `oauth:${cfg_pass}`;
      oauth_header = `OAuth ${cfg_pass}`;
    } else {
      oauth = cfg_pass;
      oauth_header = cfg_pass.replace(/^oauth:/, 'OAuth ');
    }
  }

  /* Construct the Twitch API object */
  let pub_headers = {};
  let priv_headers = {};
  if (this._has_clientid) {
    pub_headers["Client-Id"] = cfg_clientid;
  }
  if (this._authed) {
    priv_headers["Authorization"] = oauth_header;
  }
  this._api = new Twitch.API(pub_headers, priv_headers);

  /* TwitchClient.Connect() */
  this.Connect = (function _TwitchClient_Connect() {
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
    this._ws.onopen = (function _ws_onopen(event) {
      try {
        Util.LogOnly("ws open>", this.url);
        this.client._connected = false;
        this.client._is_open = true;
        this.client._onWebsocketOpen(cfg_name, oauth);
      } catch (e) {
        alert("ws.onopen error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this._ws.onmessage = (function _ws_onmessage(event) {
      try {
        let data = Twitch.StripCredentials(JSON.stringify(event.data));
        Util.TraceOnly('ws recv>', data);
        this.client._onWebsocketMessage(event);
      } catch (e) {
        alert("ws.onmessage error: " + e.toString() + "\n" + e.stack);
        throw e;
      }
    }).bind(this._ws);
    this._ws.onerror = (function _ws_onerror(event) {
      try {
        Util.LogOnly('ws error>', event);
        this.client._connected = false;
        this.client._onWebsocketError(event);
      } catch (e) {
        alert("ws.onerror error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this._ws.onclose = (function _ws_onclose(event) {
      try {
        Util.LogOnly('ws close>', event);
        this.client._connected = false;
        this.client._is_open = false;
        this.client._onWebsocketClose(event);
      } catch (e) {
        alert("ws.onclose error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this.send = (function _TwitchClient_send(m) {
      try {
        this._ws.send(m);
        Util.DebugOnly('ws send>', Twitch.StripCredentials(JSON.stringify(m)));
      } catch (e) {
        alert("this.send error: " + e.toString());
        throw e;
      }
    }).bind(this);

    Util.LogOnly("Connecting to Twitch...");
  }).bind(this);

  Util.LogOnly("Client constructed and ready for action");
}

/* Statics */
TwitchClient.DEFAULT_HISTORY_SIZE = 300;
TwitchClient.DEFAULT_MAX_MESSAGES = 100;

/* Event handling {{{0 */

/* Bind a function to the event specified */
TwitchClient.prototype.bind =
function _TwitchClient_bind(event, callback) {
  Util.Bind(event, callback);
};

/* Bind a function to catch events not bound */
TwitchClient.prototype.bindDefault =
function _TwitchClient_bindDefault(callback) {
  Util.BindDefault(callback);
};

/* Unbind a function from the TwitchChat event specified */
TwitchClient.prototype.unbind =
function _TwitchClient_unbind(event, callback) {
  Util.Unbind(event, callback);
};

/* End event handling 0}}} */

/* Private functions section {{{0 */

/* Return the value of _self_userstate for the given channel and attribute */
TwitchClient.prototype._selfUserState =
function _TwitchClient__selfUserState(channel, value) {
  let ch = Twitch.FormatChannel(channel);
  if (this._self_userstate) {
    if (this._self_userstate[ch]) {
      return this._self_userstate[ch][value];
    }
  }
  return null;
};

/* Private: Ensure the user specified is in reduced form */
TwitchClient.prototype._ensureUser =
function _TwitchClient__ensureUser(user) {
  if (user.indexOf('!') > -1) {
    return Twitch.ParseUser(user);
  } else {
    return user;
  }
};

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureChannel =
function _TwitchClient__ensureChannel(channel) {
  if (typeof(channel) === "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
};

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureRoom =
function _TwitchClient__ensureRoom(channel) {
  channel = this._ensureChannel(channel);
  let cname = channel.channel;
  if (!(cname in this._rooms)) {
    this._rooms[cname] = {
      users: [],        /* Joined users */
      userInfo: {},     /* Joined users' info */
      operators: [],    /* Operators */
      channel: channel, /* Channel object */
      rooms: {},        /* Known rooms */
      id: null,         /* Channel ID */
      online: false,    /* Currently streaming */
      stream: {},       /* Stream status */
      streams: []       /* Stream statuses */
    };
  }
};

/* Private: Called when a user joins a channel */
TwitchClient.prototype._onJoin =
function _TwitchClient__onJoin(channel, user) {
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
TwitchClient.prototype._onPart =
function _TwitchClient__onPart(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  if (this._rooms[cname].users.includes(user)) {
    let idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users.splice(idx, 1);
  }
};

/* Private: Called when the client receives a MODE +o event */
TwitchClient.prototype._onOp =
function _TwitchClient__onOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  if (!this._rooms[cname].operators.includes(user)) {
    this._rooms[cname].operators.push(user);
  }
};

/* Private: Called when the client receives a MODE -o event */
TwitchClient.prototype._onDeOp =
function _TwitchClient__onDeOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  let idx = this._rooms[cname].operators.indexOf(user);
  if (idx > -1) {
    this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
  }
};

/* Private: Load in the extra chatrooms a streamer may or may not have */
TwitchClient.prototype._getRooms =
function _TwitchClient__getRooms(cname, cid) {
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.Rooms(cid), (function _rooms_cb(json) {
    for (let room_def of json["rooms"]) {
      if (!this._rooms[cname].rooms) {
        this._rooms[cname].rooms = {};
      }
      this._rooms[cname].rooms[room_def["name"]] = room_def;
    }
  }).bind(this), {}, true);
};

/* Private: Load in the channel badges for a given channel name and ID */
TwitchClient.prototype._getChannelBadges =
function _TwitchClient__getChannelBadges(cname, cid) {
  this._channel_badges[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get badges; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Badges(cid), (function _badges_cb(json) {
    for (let badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
};

/* Private: Load in the channel cheermotes for a given channel name and ID */
TwitchClient.prototype._getChannelCheers =
function _TwitchClient__getChannelCheers(cname, cid) {
  this._channel_cheers[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get channel cheers; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Cheers(cid), (function _cheers_cb(json) {
    for (let cdef of json.actions) {
      let p = RegExp.escape(cdef.prefix);
      /* Simplify things later by adding the regexps here */
      cdef.word_pattern = new RegExp(`^(${p})([1-9][0-9]*)$`, 'i');
      cdef.line_pattern = new RegExp(`(?:\\b[\\s]|^)(${p})([1-9][0-9]*)(?:\\b|[\\s]|$)`, 'ig');
      this._channel_cheers[cname][cdef.prefix] = cdef;
    }
  }).bind(this), {}, false);
};

/* Private: Load in the global and per-channel FFZ emotes */
TwitchClient.prototype._getFFZEmotes =
function _TwitchClient__getFFZEmotes(cname, cid) {
  this._ffz_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.FFZEmotes(cid), (function _ffz_emotes_cb(json) {
    let ffz = this._ffz_channel_emotes[cname];
    ffz.id = json.room._id;
    ffz.set_id = json.room.set;
    ffz.css = json.room.css;
    ffz.display_name = json.room.display_name;
    ffz.user_name = json.room.id;
    ffz.is_group = json.room.is_group;
    ffz.mod_urls = {};
    if (json.room.mod_urls) {
      for (let [k, v] of Object.entries(json.room.mod_urls)) {
        if (v) {
          ffz.mod_urls[k] = Util.URL(v);
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
      let set_def = json.sets[ffz.set_id];
      ffz.emotes_name = set_def.title;
      ffz.emotes_desc = set_def.description || "";
      ffz.emotes = {};
      for (let v of Object.values(set_def.emoticons)) {
        if (v.hidden) continue;
        ffz.emotes[v.name] = v;
        for (let [size, url] of Object.entries(v.urls)) {
          ffz.emotes[v.name].urls[size] = Util.URL(url);
        }
      }
    }
  }).bind(this), (function _ffze_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly(`Channel ${cname}:${cid} has no FFZ emotes`);
    }
  }));
};

/* Private: Load in the global and per-channel BTTV emotes */
TwitchClient.prototype._getBTTVEmotes =
function _TwitchClient__getBTTVEmotes(cname, cid) {
  this._bttv_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVEmotes(cname.replace(/^#/, "")),
                        (function _bttv_global_emotes_cb(json) {
    let url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
    let bttv = this._bttv_channel_emotes[cname];
    for (let emote of json.emotes) {
      bttv[emote.code] = {
        'id': emote.id,
        'code': emote.code,
        'channel': emote.channel,
        'image-type': emote.imageType,
        'url': Util.URL(url_base.replace(/\{\{id\}\}/g, emote.id))
      };
    }
  }).bind(this), (function _bttve_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly(`Channel ${cname}:${cid} has no BTTV emotes`);
    }
  }));

  this._bttv_global_emotes = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVAllEmotes(),
                        (function _bttv_all_emotes_cb(json) {
    let url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
    for (let emote of json.emotes) {
      this._bttv_global_emotes[emote.code] = {
        'id': emote.id,
        'code': emote.code,
        'channel': emote.channel,
        'image-type': emote.imageType,
        'url': Util.URL(url_base.replace('{{id}}', emote.id))
      };
    }
  }).bind(this), (function _bttve_onerror(resp) {
    if (resp.status === 404) {
      Util.LogOnly(`Channel ${cname}:${cid} has no BTTV emotes`);
    }
  }));
};

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges =
function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.AllBadges(), (function _badges_cb(json) {
    for (let badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
  if (this._enable_ffz) {
    this._api.GetSimpleCB(Twitch.URL.FFZBadgeUsers(), (function _ffz_bades_cb(resp) {
      for (let badge of Object.values(resp.badges)) {
        this._ffz_badges[badge.id] = badge;
      }
      for (let [badge_nr, users] of Object.entries(resp.users)) {
        this._ffz_badge_users[badge_nr] = users;
      }
    }).bind(this));
  }
};

/* Private: Build a faux PRIVMSG event from the chat message given */
TwitchClient.prototype._buildChatEvent =
function _TwitchClient__buildChatEvent(chobj, message) {
  let flag_obj = {};
  let emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
  let chstr = Twitch.FormatChannel(chobj);
  let userstate = this._self_userstate[chstr] || {};

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
  flag_obj["tmi-sent-ts"] = (new Date()).getTime();
  flag_obj["turbo"] = 0;
  flag_obj["user-type"] = "";
  flag_obj["__synthetic"] = 1;

  /* Construct the formatted flags string */
  let flag_arr = [];
  let addFlag = (n, v, t=null) => {
    /* Undefined and null values are treated as empty strings */
    let val = (typeof(v) === "undefined" || v === null) ? "" : v;
    /* If specified, apply the function to the value */
    if (typeof(t) === "function") {
      val = t(val);
    }
    /* if t(val) returns null or undefined, skip the flag */
    if (typeof(val) !== "undefined" && val !== null) {
      flag_arr.push(`${n}=${val}`);
    }
  };
  let addObjFlag = (n) => addFlag(n, flag_obj[n]);
  if (flag_obj["badges"]) {
    let badges = [];
    for (let [b, r] of flag_obj["badges"]) {
      badges.push(`${b}/${r}`);
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
  let flag_str = flag_arr.join(";");

  /* Build the raw and parsed objects */
  let user = userstate["display-name"].toLowerCase();
  let useruri = `:${user}!${user}@${user}.tmi.twitch.tv`;
  let channel = Twitch.FormatChannel(chobj);
  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  let raw_line = `@${flag_str} ${useruri} PRIVMSG ${channel} :`;

  /* Handle /me */
  if (message.startsWith('/me ')) {
    raw_line += '\x01ACTION ' + message + '\x01';
    message = message.substr('/me '.length);
    flag_obj.action = true;
  } else {
    raw_line += message;
  }

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, ({
    cmd: "PRIVMSG",
    flags: flag_obj,
    user: Twitch.ParseUser(useruri),
    channel: chobj,
    message: message,
    synthetic: true /* mark the event as synthetic */
  }));
};

/* End private functions section 0}}} */

/* General status functions {{{0 */

/* Obtain connection status information */
TwitchClient.prototype.ConnectionStatus =
function _TwitchClient_ConnectionStatus() {
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
TwitchClient.prototype.Connected =
function _TwitchClient_Connected() {
  return this._connected;
};

/* Return whether or not FFZ support is enabled */
TwitchClient.prototype.FFZEnabled =
function _TwitchClient_FFZEnabled() {
  return !this._no_assets && this._enable_ffz;
};

/* Return whether or not BTTV support is enabled */
TwitchClient.prototype.BTTVEnabled =
function _TwitchClient_BTTVEnabled() {
  return !this._no_assets && this._enable_bttv;
};

TwitchClient.prototype.SelfUserState =
function _TwitchClient_SelfUserState() {
  let obj = Util.JSONClone(this._self_userstate);
  obj.userid = this._self_userid;
  return obj;
};

/* Return true if the client has been granted the capability specified. Values
 * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
 * following: twitch.tv/tags twitch.tv/commands twitch.tv/membership
 */
TwitchClient.prototype.HasCapability =
function _TwitchClient_HasCapability(test_cap) {
  for (let cap of this._capabilities) {
    if (test_cap === cap || cap.endsWith('/' + test_cap.replace(/^\//, ""))) {
      return true;
    }
  }
  return false;
};

/* Get the client's current username */
TwitchClient.prototype.GetName =
function _TwitchClient_GetName() {
  return this._username;
};

/* Return whether or not the numeric user ID refers to the client itself */
TwitchClient.prototype.IsUIDSelf =
function _TwitchClient_IsUIDSelf(userid) {
  return userid === this._self_userid;
};

/* End of general status functions 0}}} */

/* Role and moderation functions {{{0 */

/* Return whether or not the client is authenticated with an AuthID */
TwitchClient.prototype.IsAuthed =
function _TwitchClient_IsAuthed() {
  return this._authed;
};

/* Return true if the client is a subscriber in the channel given */
TwitchClient.prototype.IsSub =
function _TwitchClient_IsSub(channel) {
  return this._selfUserState(channel, "sub");
};

/* Return true if the client is a VIP in the channel given */
TwitchClient.prototype.IsVIP =
function _TwitchClient_IsVIP(channel) {
  return this._selfUserState(channel, "vip");
};

/* Return true if the client is a moderator in the channel given */
TwitchClient.prototype.IsMod =
function _TwitchClient_IsMod(channel) {
  return this._selfUserState(channel, "mod");
};

/* Return true if the client is the broadcaster for the channel given */
TwitchClient.prototype.IsCaster =
function _TwitchClient_IsCaster(channel) {
  return this._selfUserState(channel, "broadcaster");
};

/* Timeout the specific user in the specified channel */
TwitchClient.prototype.Timeout =
function _TwitchClient_Timeout(channel, user, duration="600s", reason=null) {
  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = `Timed out by ${this._username} from ${channel.channel} for ${duration}`;
  }
  this.SendMessage(channel, `/timeout ${user} ${duration} "${reason}"`);
};

/* Un-timeout the specific user in the specified channel */
TwitchClient.prototype.UnTimeout =
function _TwitchClient_UnTimeout(channel, user) {
  this.SendMessage(channel, `/untimeout ${user}`);
};

/* Ban the specific user from the specified channel */
TwitchClient.prototype.Ban =
function _TwitchClient_Ban(channel, user, reason=null) {
  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = `Banned from ${channel.channel} by ${this._username}`;
  }
  this.SendMessage(channel, `/ban ${user} ${reason}`);
};

/* Unban the specific user from the specified channel */
TwitchClient.prototype.UnBan =
function _TwitchClient_UnBan(channel, user) {
  this.SendMessage(channel, `/unban ${user}`);
};

/* End of role and moderation functions 0}}} */

/* Channel functions {{{0 */

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel =
function _TwitchClient_JoinChannel(channel) {
  let ch = this._ensureChannel(channel).channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) === -1) {
      this.send(`JOIN ${ch}`);
      this._channels.push(ch);
    } else {
      Util.Warn(`JoinChannel: Already in ${ch}`);
    }
  } else if (this._pending_channels.indexOf(ch) === -1) {
    this._pending_channels.push(ch);
  }
};

/* Request the client to leave the channel specified */
TwitchClient.prototype.LeaveChannel =
function _TwitchClient_LeaveChannel(channel) {
  let ch = this._ensureChannel(channel).channel;
  if (this._is_open) {
    let idx = this._channels.indexOf(ch);
    if (idx > -1) {
      this.send(`PART ${ch}`);
      this._channels.splice(idx, 1);
      delete this._rooms[ch]; /* harmless if fails */
    } else {
      Util.Warn(`LeaveChannel: Not in channel ${ch}`);
    }
  }
};

/* Return whether or not the client is in the channel specified */
TwitchClient.prototype.IsInChannel =
function _TwitchClient_IsInChannel(channel) {
  let ch = this._ensureChannel(channel).channel;
  return this._is_open && this._channels.indexOf(ch) > -1;
};

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels =
function _TwitchClient_GetJoinedChannels() {
  return this._channels;
};

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo =
function _TwitchClient_GetChannelInfo(channel) {
  let cname = this._ensureChannel(channel).channel;
  return this._rooms[cname] || {};
};

/* End channel functions 0}}} */

/* Functions related to cheers and emotes {{{0 */

/* Return whether or not the given word is a cheer for the given channel */
TwitchClient.prototype.IsCheer =
function _TwitchClient_IsCheer(channel, word) {
  let cname = this._ensureChannel(channel).channel;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    for (let name of Object.keys(this._channel_cheers[cname])) {
      if (word.match(this._channel_cheers[cname][name].word_pattern)) {
        return true;
      }
    }
  }
  return false;
};

/* Return all of the cheers found in the message */
TwitchClient.prototype.FindCheers =
function _TwitchClient_FindCheers(channel, message) {
  let matches = [];
  let parts = message.split(" ");
  let offset = 0;
  let cname = this._ensureChannel(channel).channel;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    for (let [name, cheer] of Object.entries(this._channel_cheers[cname])) {
      if (message.search(cheer.line_pattern) > -1) {
        for (let token of parts) {
          let m = token.match(cheer.word_pattern);
          if (m) {
            let num_bits = Number.parseInt(m[2]);
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
      }
    }
  }
  return matches;
};

/* Obtain information about a given cheermote */
TwitchClient.prototype.GetCheer =
function _TwitchClient_GetCheer(cname, name) {
  let cheer = null;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    if (this._channel_cheers[cname].hasOwnProperty(name)) {
      cheer = this._channel_cheers[cname][name];
    }
  }
  return cheer;
};

/* Return the emotes the client is allowed to use */
TwitchClient.prototype.GetEmotes =
function _TwitchClient_GetEmotes() {
  let emotes = {};
  for (let [k, v] of Object.entries(this._self_emotes)) {
    emotes[v] = this.GetEmote(k);
  }
  return emotes;
};

/* Return the URL to the image for the emote and size specified (id or name) */
TwitchClient.prototype.GetEmote =
function _TwitchClient_GetEmote(emote_id, size="1.0") {
  if (typeof(emote_id) === "number" || `${emote_id}`.match(/^[0-9]+$/)) {
    return Twitch.URL.Emote(emote_id, size);
  } else {
    for (let [k, v] of Object.entries(this._self_emotes)) {
      if (v === emote_id) {
        return Twitch.URL.Emote(k, size);
      }
    }
  }
};

/* Obtain the FFZ emotes for a channel */
TwitchClient.prototype.GetFFZEmotes =
function _TwitchClient_GetFFZEmotes(channel) {
  return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
};

/* Obtain global BTTV emotes */
TwitchClient.prototype.GetGlobalBTTVEmotes =
function _TwitchClient_GetGlobalBTTVEmotes() {
  return this._bttv_global_emotes;
};

/* Obtain the BTTV emotes for the channel specified */
TwitchClient.prototype.GetBTTVEmotes =
function _TwitchClient_GetBTTVEmotes(channel) {
  let ch = Twitch.FormatChannel(channel);
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
TwitchClient.prototype.SendMessage =
function _TwitchClient_SendMessage(channel, message, bypassFaux=false) {
  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected && this._authed) {
    this.send(`PRIVMSG ${channel.channel} :${message}`);
    /* Dispatch a faux "Message Received" event */
    if (!bypassFaux) {
      if (this._self_userstate[Twitch.FormatChannel(channel)]) {
        Util.FireEvent(this._buildChatEvent(channel, message));
      } else {
        Util.Error(`No USERSTATE given for channel ${channel}`);
      }
    }
  } else {
    let chname = Twitch.FormatChannel(channel);
    Util.Warn(`Unable to send "${message}" to ${chname}: not connected or not authed`);
  }
};

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll =
function _TwitchClient_SendMessageToAll(message) {
  if (this._connected) {
    for (let ch of this._channels) {
      this.SendMessage(ch, message);
    }
  } else {
    Util.Warn(`Unable to send "${message}" to all channels: not connected`);
  }
};

/* Send text to the Twitch servers, bypassing any special logic */
TwitchClient.prototype.SendRaw =
function _TwitchClient_SendRaw(raw_msg) {
  this.send(raw_msg.trimEnd() + "\r\n");
};

/* End of functions for sending messages 0}}} */

/* History functions {{{0 */

/* Add a message to the history of sent messages */
TwitchClient.prototype.AddHistory =
function _TwitchClient_AddHistory(message) {
  /* Prevent sequential duplicates */
  if (this._history.length === 0 || message !== this._history[0]) {
    this._history.unshift(message);
    while (this.GetHistoryLength() > this.GetHistoryMax()) {
      this._history.pop();
    }
  }
};

/* Obtain the history of sent messages */
TwitchClient.prototype.GetHistory =
function _TwitchClient_GetHistory() {
  /* Make a copy to prevent unexpected modification */
  return this._history.map((x) => x);
};

/* Obtain the nth most recently sent message */
TwitchClient.prototype.GetHistoryItem =
function _TwitchClient_GetHistoryItem(n) {
  if (n >= 0 && n < this._history.length) {
    return this._history[n];
  }
  return null;
};

/* Obtain the maximum number of history items */
TwitchClient.prototype.GetHistoryMax =
function _TwitchClient_GetHistoryMax() {
  return this._hist_max;
};

/* Obtain the current number of history items */
TwitchClient.prototype.GetHistoryLength =
function _TwitchClient_GetHistoryLength() {
  return this._history.length;
};

/* End of history functions 0}}} */

/* Asset and API functions {{{0 */

/* Return the data for the given clip slug */
TwitchClient.prototype.GetClip =
function _TwitchClient_GetClip(slug) {
  return new Promise((function(resolve, reject) {
    this._api.GetCB(Twitch.URL.Clip(slug), function(resp) {
      resolve(resp["data"][0]);
    }, reject);
  }).bind(this));
};

/* Return information on the given game ID */
TwitchClient.prototype.GetGame =
function _TwitchClient_GetGame(game_id) {
  return new Promise((function(resolve, reject) {
    this._api.GetCB(Twitch.URL.Game(game_id), function(resp) {
      resolve(resp["data"][0]);
    }, reject);
  }).bind(this));
};

/* Return true if the badge specified is a global badge */
TwitchClient.prototype.IsGlobalBadge =
function _TwitchClient_IsGlobalBadge(badge_name, badge_version=null) {
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
TwitchClient.prototype.IsChannelBadge =
function _TwitchClient_IsChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  if (channel.channel in this._channel_badges) {
    if (badge_name in this._channel_badges[channel.channel]) {
      if (this._channel_badges[channel.channel][badge_name]) {
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
TwitchClient.prototype.GetGlobalBadge =
function _TwitchClient_GetGlobalBadge(badge_name, badge_version=null) {
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
TwitchClient.prototype.GetChannelBadge =
function _TwitchClient_GetChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  return this._channel_badges[channel.channel][badge_name];
};

/* Obtain all of the global badges */
TwitchClient.prototype.GetGlobalBadges =
function _TwitchClient_GetGlobalBadges() {
  return Util.JSONClone(this._global_badges);
};

/* Obtain all of the channel badges for the specified channel */
TwitchClient.prototype.GetChannelBadges =
function _TwitchClient_GetChannelBadges(channel) {
  channel = this._ensureChannel(channel);
  if (this._channel_badges.hasOwnProperty(channel.channel)) {
    return Util.JSONClone(this._channel_badges[channel.channel]);
  }
  return {};
};

/* End of asset handling functions 0}}} */

/* Websocket callbacks {{{0 */

/* Callback: called when the websocket opens */
TwitchClient.prototype._onWebsocketOpen =
function _TwitchClient__onWebsocketOpen(name, pass) {
  this.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  if (name && pass) {
    this._username = name;
  } else {
    this._username = `justinfan${Math.floor(Math.random() * 999999)}`;
  }
  if (pass) {
    this.send(`PASS ${pass.indexOf("oauth:") === 0 ? "" : "oauth:"}${pass}`);
    this.send(`NICK ${name}`);
  } else {
    this.send(`NICK ${this._username}`);
  }
  for (let i of this._pending_channels) {
    this.JoinChannel(i);
  }
  this._pending_channels = [];
  this._getGlobalBadges();
  Util.FireEvent(new TwitchEvent("OPEN", null, {"has-clientid": this._has_clientid}));
};

/* Callback: called when the websocket receives a message */
TwitchClient.prototype._onWebsocketMessage =
function _TwitchClient__onWebsocketMessage(ws_event) {
  let lines = ws_event.data.trim().split("\r\n");
  /* Log the lines to the debug console */
  if (lines.length === 1) {
    Util.LogOnly(`ws recv> "${lines[0]}"`);
  } else {
    for (let [i, l] of Object.entries(lines)) {
      let n = Number.parseInt(i) + 1;
      if (l.trim().length > 0) Util.LogOnly(`ws recv/${n}> "${l}"`);
    }
  }
  for (let line of lines) {
    /* Ignore empty lines */
    if (line.trim() === '') {
      continue;
    }

    let result = Twitch.ParseIRCMessage(line);

    /* Fire twitch-message for every line received */
    Util.FireEvent(new TwitchEvent("MESSAGE", line, result));

    /* Don't handle messages with NULL commands */
    if (!result.cmd) {
      Util.Error('result.cmd is NULL for', result, line);
      continue;
    }

    /* Fire top-level event */
    Util.FireEvent(new TwitchEvent(result.cmd, line, result));

    /* Parse and handle result.channel to simplify code below */
    let cname = null;
    let cstr = null;
    let room = null;
    let roomid = null;
    if (result.channel) {
      this._ensureRoom(result.channel);
      cname = result.channel.channel;
      cstr = Twitch.FormatChannel(result.channel);
      room = this._rooms[cname];
      if (result.flags && result.flags["room-id"]) {
        roomid = result.flags["room-id"];
      }
    }

    /* Handle each command that could be returned */
    switch (result.cmd) {
      case "PING":
        this.send(`PONG :${result.server}`);
        break;
      case "ACK":
        this._connected = true;
        this._capabilities = result.flags;
        break;
      case "TOPIC":
        break;
      case "NAMES":
        for (let user of result.usernames) {
          this._onJoin(result.channel, user);
        }
        break;
      case "JOIN":
        this._onJoin(result.channel, result.user);
        break;
      case "PART":
        this._onPart(result.channel, result.user);
        break;
      case "RECONNECT":
        /* Reconnecting is the responsibility of the driving code */
        break;
      case "MODE":
        if (result.modeflag === "+o") {
          this._onOp(result.channel, result.user);
        } else if (result.modeflag === "-o") {
          this._onDeOp(result.channel, result.user);
        }
        break;
      case "PRIVMSG": {
        let event = new TwitchChatEvent(line, result);
        if (!room.userInfo.hasOwnProperty(result.user)) {
          room.userInfo[result.user] = {};
        }
        if (!event.flags.badges) event.flags.badges = [];
        if (this._enable_ffz) {
          for (let [badge_nr, users] of Object.entries(this._ffz_badge_users)) {
            if (users.indexOf(result.user) > -1) {
              let ffz_badges = event.flags['ffz-badges'];
              if (!ffz_badges) ffz_badges = [];
              ffz_badges.push(this._ffz_badges[badge_nr]);
              event.flags['ffz-badges'] = ffz_badges;
            }
          }
        }
        let ui = room.userInfo[result.user];
        ui.ismod = event.ismod;
        ui.issub = event.issub;
        ui.isvip = event.isvip;
        ui.userid = event.flags['user-id'];
        ui.uuid = event.flags['id'];
        ui.badges = event.flags['badges'];
        Util.FireEvent(event);
      } break;
      case "WHISPER":
        break;
      case "USERSTATE":
        if (!this._self_userstate.hasOwnProperty(cstr)) {
          this._self_userstate[cstr] = {};
        }
        for (let [key, val] of Object.entries(result.flags)) {
          this._self_userstate[cstr][key] = val;
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
        this._api.GetCB(Twitch.URL.Stream(result.flags['room-id']),
                        function _stream_cb(resp) {
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
        } else {
          Util.FireEvent(new TwitchEvent("OTHERUSERNOTICE", line, result));
          Util.Warn("Unknown USERNOTICE type", line, result);
        }
        break;
      case "GLOBALUSERSTATE":
        this._self_userid = result.flags['user-id'];
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
        let eset_str = Twitch.URL.EmoteSet(result.flags["emote-sets"].join(','));
        this._api.GetCB(eset_str, (function _emoteset_cb(json) {
          for (let eset of Object.keys(json["emoticon_sets"])) {
            for (let edef of json["emoticon_sets"][eset]) {
              this._self_emotes[edef.id] = edef.code;
            }
          }
        }).bind(this));
      }
    }
  }
};

/* Callback: called when the websocket receives an error */
TwitchClient.prototype._onWebsocketError =
function _TwitchClient__onWebsocketError(event) {
  Util.Error(event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
};

/* Callback: called when the websocket is closed */
TwitchClient.prototype._onWebsocketClose =
function _TwitchClient__onWebsocketClose(event) {
  for (let chobj of this._channels) {
    if (this._pending_channels.indexOf(chobj) === -1) {
      this._pending_channels.push(chobj);
    }
  }
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  Util.FireEvent(new TwitchEvent("CLOSE", event));
};

/* End websocket callbacks 0}}} */

