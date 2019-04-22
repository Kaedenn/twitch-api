"use strict";

/* Reference information
 *
 * PRIVMSG flags:
 * 'badge-info': "subscriber/12"
 * 'badges': [["moderator", "1"], ["subscriber", "12"], ["bits", "1000"]]
 * 'color': "#0262C1"
 * 'display-name': "Kaedenn_"
 * 'emotes': null
 * 'flags': null
 * 'id': "6d7a2b5e-284d-44a7-8f99-0b910ca11b2b"
 * 'mod': 1
 * 'room-id': 70067886
 * 'subscriber': 1
 * 'tmi-sent-ts': 1555203525573
 * 'turbo': 0
 * 'user-id': 175437030
 * 'user-type': "mod"
 */

/* Twitch utilities */
let Twitch = {};

/* Storage of values used for debugging */
class _Twitch_DebugCache {
  constructor() {
    this.values = {};
  }
  add(set, key) {
    if (!(set in this.values)) {
      this.values[set] = {};
    }
    if (key in this.values[set]) {
      this.values[set][key] += 1;
    } else {
      this.values[set][key] = 1;
    }
  }
  tolist(set) {
    return Object.keys(this.values[set]);
  }
  getall() {
    return this.values;
  }
}
Twitch.DebugCache = new _Twitch_DebugCache();

/* API hosts {{{0 */
Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";
/* Store URLs to specific asset APIs */
Twitch.URL = {};
/* Twitch rooms */
Twitch.URL.Rooms = (cid) => `${Twitch.Kraken}/chat/${cid}/rooms`;
/* Twitch badges */
Twitch.URL.Badges = (cid) => `${Twitch.Kraken}/chat/${cid}/badges`;
Twitch.URL.AllBadges = () => `https://badges.twitch.tv/v1/badges/global/display`;
/* Twitch cheers */
Twitch.URL.Cheer = (prefix, tier, scheme="dark", size=1) => `https://d3aqoihi2n8ty8.cloudfront.net/actions/${prefix}/${scheme}/animated/${tier}/${size}.gif`;
Twitch.URL.Cheers = (cid) => `${Twitch.Kraken}/bits/actions?channel_id=${cid}`;
Twitch.URL.AllCheers = () => `${Twitch.Kraken}/bits/actions`;
/* Twitch emotes */
Twitch.URL.Emote = (eid, size='1.0') => `${Twitch.JTVNW}/emoticons/v1/${eid}/${size}`
Twitch.URL.EmoteSet = (eset) => `${Twitch.Kraken}/chat/emoticon_images?emotesets=${eset}`;
/* FFZ emotes */
Twitch.URL.FFZAllEmotes = () => `${Twitch.FFZ}/emoticons`;
Twitch.URL.FFZEmotes = (cid) => `${Twitch.FFZ}/room/id/${cid}`;
Twitch.URL.FFZEmote = (eid) => `${Twitch.FFZ}/emote/${eid}`;
Twitch.URL.FFZBadges = () => `${Twitch.FFZ}/_badges`;
Twitch.URL.FFZBadgeUsers = () => `${Twitch.FFZ}/badges`;
/* BTTV emotes */
Twitch.URL.BTTVAllEmotes = () => `${Twitch.BTTV}/emotes`;
Twitch.URL.BTTVEmotes = (cname) => `${Twitch.BTTV}/channels/${cname}`;
Twitch.URL.BTTVEmote = (eid) => `${Twitch.BTTV}/emote/${eid}/1x`;
/* End of API hosts 0}}} */

/* Abstract XMLHttpRequest to a simple url -> callback system */
Twitch.API = function _Twitch_API(global_headers, private_headers, onerror=null) {
  this._onerror = onerror;

  /* GET url, without headers */
  this.GetSimple =
  function _Twitch_API_GetSimple(url, callback, errorcb=null) {
    let req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4) {
        if (this.status == 200) {
          callback(JSON.parse(this.responseText));
        } else {
          if (errorcb !== null) {
            errorcb(this);
          } else if (this._onerror) {
            this._onerror(this);
          } else {
            console.warn(this);
          }
        }
      }
    }
    req.open("GET", url);
    req.send();
  };

  /* GET url, adding any given headers, optionally adding private headers */
  this.Get =
  function _Twitch_API_Get(url, callback, headers={}, add_private=false, errorcb=null) {
    let req = new XMLHttpRequest();
    let callerStack = Util.GetStack();
    req.onreadystatechange = function() {
      if (this.readyState == 4) {
        if (this.status == 200) {
          callback(JSON.parse(this.responseText));
        } else {
          if (errorcb !== null) {
            errorcb(this);
          } else if (this._onerror) {
            this._onerror(this);
          } else {
            Util.WarnOnly(`Failed to get "${url}" stack=`, callerStack);
            Util.WarnOnly(url, this);
          }
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
  }
}

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  user = user.lstrip(':');
  return user.split('!')[0];
}

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  let ch = channel;
  let room = null;
  let roomuid = null;
  let parts = ch.split(':');
  if (parts.length == 1) {
    ch = parts[0];
  } else if (parts.length == 3) {
    [ch, room, roomuid] = parts;
  } else {
    Twitch.Warning(`ParseChannel: ${ch} not in expected format`);
    ch = parts[0];
  }
  if (ch.indexOf('#') != 0) {
    ch = '#' + ch;
  }
  return {channel: ch, room: room, roomuid: roomuid};
}

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof(room) == "undefined") room = null;
  if (typeof(roomuid) == "undefined") roomuid = null;
  if (typeof(channel) == "string") {
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
  } else if (channel && channel.channel) {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Twitch.Warning("FormatChannel: don't know how to format", channel, room, roomuid);
    return `${channel}`;
  }
}

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  let result = undefined;
  if (value.length == 0) {
    /* Translate empty strings to null */
    result = null;
  } else if (value.match(/^[0-9]+$/)) {
    /* Translate numeric values to numbers */
    result = parseInt(value);
  } else {
    /* Values requiring special handling */
    switch (key) {
      case "badges":
        result = [];
        for (let badge of value.split(',')) {
          let [badge_name, badge_rev] = badge.split('/');
          result.push([badge_name, badge_rev]);
        }
        break;
      case "emotes":
        result = Twitch.ParseEmote(value);
        break;
      case "emote-sets":
        result = value.split(',').map(e => parseInt(e));
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
}

/* Parse @<flags...> key,value pairs */
Twitch.ParseData = function _Twitch_ParseData(dataString) {
  /* @key=value;key=value;... */
  dataString = dataString.lstrip('@');
  let parts = dataString.split(';');
  let data = {};
  for (let item of dataString.split(';')) {
    let key = item;
    let val = "";
    if (item.indexOf('=') != -1) {
      [key, val] = item.split('=');
    }
    val = Twitch.ParseFlag(key, val);
    Twitch.DebugCache.add('flags', key);
    Twitch.DebugCache.add('flag-' + key, val);
    data[key] = val;
  }
  return data;
}

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  let result = [];
  for (let emote_def of value.split('/')) {
    let seppos = emote_def.indexOf(':');
    let emote_id = parseInt(emote_def.substr(0, seppos));
    for (let range of emote_def.substr(seppos+1).split(',')) {
      let [start, end] = range.split('-');
      result.push({id: emote_id,
                   name: null,
                   start: parseInt(start),
                   end: parseInt(end)});
    }
  }
  return result;
}

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  let specs = [];
  for (let emote of emotes) {
    if (emote.id !== null) {
      specs.push(`${emote.id}:${emote.start}-${emote.end}`);
    }
  }
  return specs.join('/');
}

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; dont escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
}

/* Generate emote specifications for the given emotes [eid, ename] */
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes) {
  let results = [];
  for (let emote_def of emotes) {
    let [eid, emote] = emote_def;
    let pat = Twitch.EmoteToRegex(emote);
    let arr;
    while ((arr = pat.exec(msg)) !== null) {
      /* arr = [wholeMatch, matchPart] */
      let start = arr.index + arr[0].indexOf(arr[1]);
      /* -1 to keep consistent with Twitch's off-by-one */
      let end = start + arr[1].length - 1;
      results.push({id: eid, name: emote, start: start, end: end});
    }
  }
  return results;
}

/* Object containing logic for parsing and interpreting Twitch IRC messages */
Twitch.IRC = {
  /* Regex for parsing incoming Twitch IRC messages; all messages should parse */
  Messages: {
    PING: [
      /* "PING :<server>\r\n" */ /* Verified */
      /^PING :(.*)(?:\r\n)?$/,
      {server: 1}
    ],
    ACK: [
      /* ":<server> CAP * ACK :<flags...>\r\n" */
      /^:([^ ]+) CAP \* (ACK) :(.*)(?:\r\n)?$/,
      {server: 1, operation: 2, flags: 3}
    ],
    TOPIC: [
      /* ":<server> <code> <username> :<message>\r\n" */ /* Verified */
      /^:([^ ]+) ((?:00[1-9])|(?:372)) ([^ ]+) :(.*)(?:\r\n)?$/,
      {server: 1, code: 2, username: 3, message: 4}
    ],
    NAMES: [
      /* ":<login> 353 <username> <modechr> <channel> :<users...>\r\n" */ /* Verified */
      /^:([^ ]+) 353 ([^ ]+) ([^ ]+) (\#[^ ]+) :(.*)(?:\r\n)?$/,
      {user: 1, modechr: 3, channel: 4, users: 5}
    ],
    JOIN: [
      /* ":<name>!<user>@<user>.<host> JOIN <channel>\r\n" */ /* Verified */
      /^:([^ ]+) JOIN (\#[^ ]+)(?:\r\n)?$/,
      {user: 1, channel: 2}
    ],
    PART: [
      /* ":<name>!<user>@<user>.<host> PART <channel>\r\n" */ /* Verified */
      /^:([^ ]+) PART (\#[^ ]+)(?:\r\n)?$/,
      {user: 1, channel: 2}
    ],
    MODE: [
      /* ":<user> MODE <channel> <modeop> <users...>\r\n" */ /* Verified */
      /^:([^ ]+) MODE (\#[^ ]+) ([+-]\w) (.*)(?:\r\n)?$/,
      {sender: 1, channel: 2, modeflag: 3, user: 4},
    ],
    PRIVMSG: [
      /* "@<flags> :<user> PRIVMSG <channel> :<message>\r\n" */ /* Verified */
      /^@([^ ]+) :([^ ]+) PRIVMSG (\#[^ ]+) :(.*)(?:\r\n)?$/,
      {flags: 1, user: 2, channel: 3, message: 4}
    ],
    WHISPER: [
      /* @<flags> :<name>!<user>@<user>.<host> WHISPER <recipient> :<message>\r\n */
      /^@([^ ]+) :([^!]+)!([^@]+)@([^ ]+) WHISPER ([^ ]+) :(.*)(?:\r\n)?$/,
      {flags: 1, sender: 2, recipient: 6, message: 7}
    ],
    USERSTATE: [
      /* "@<flags> :<server> USERSTATE <channel>\r\n" */ /* Verified */
      /^@([^ ]+) :([^ ]+) USERSTATE (\#[^ ]+)(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3}
    ],
    ROOMSTATE: [
      /* "@<flags> :<server> ROOMSTATE <channel>\r\n" */ /* Verified */
      /^@([^ ]+) :([^ ]+) ROOMSTATE (\#[^ ]+)(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3}
    ],
    USERNOTICE: [
      /* "@<flags> :<server> USERNOTICE <channel>[ :<message>]\r\n" */
      /^@([^ ]+) :([^ ]+) USERNOTICE (\#[^ ]+)(?: :(.*))?(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3, message: 4}
    ],
    GLOBALUSERSTATE: [
      /* "@<flags> :<server> GLOBALUSERSTATE \r\n" */
      /^@([^ ]+) :([^ ]+) GLOBALUSERSTATE(?:\r\n)?$/,
      {flags: 1, server: 2}
    ],
    CLEARCHAT: [
      /* "@<flags> :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
      /^@([^ ]+) :([^ ]+) CLEARCHAT (\#[^ ]+)(?: :(.*))?(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3, user: 4}
    ],
    CLEARMSG: [
      /* "@<flags> :<server> CLEARMSG <channel> :<message>\r\n" */
      /^@([^ ]+) :([^ ]+) CLEARMSG (\#[^ ]+) :(.*)(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3, message: 4}
    ],
    HOSTTARGET: [
      /* ":<server> HOSTTARGET <channel> :<hosting-user> -\r\n" */
      /^([^ ]+) HOSTTARGET (\#[^ ]+) :([^ ]+).*(?:\r\n)?$/,
      {server: 1, channel: 2, user: 3, message: 4}
    ],
    NOTICE: [
      /* "@<flags> :<server> NOTICE <channel> :<message>\r\n" */
      /^(?:@([^ ]+) )?:([^ ]+) NOTICE ([^ ]+) :(.*)(?:\r\n)?$/,
      {flags: 1, server: 2, channel: 3, message: 4}
    ],
    ERROR: [
      /* ":<server> 421 <user> <command> :<message>\r\n" */
      /^:([^ ]+) (421) ([^ ]+) ([^ ]+) :(.*)(?:\r\n)?$/,
      {server: 1, user: 2, command: 3, message: 4}
    ],
    /* Line patterns to ignore */
    Ignore: [
      /* Start of TOPIC listing */
      /^:([^ ]+) (375) ([^ ]+) :-(?:\r\n)?$/,
      /* End of TOPIC listing */
      /^:([^ ]+) (376) ([^ ]+) :>(?:\r\n)?$/,
      /* Start/end of TOPIC listing, end of NAMES listing */
      /^:[^ ]+ (?:37[56]|366) [^ ]+ \#[^ ]+ :.*(?:\r\n)?$/
    ]
  },

  /* Return true if the line should be silently ignored */
  ShouldIgnore: function _Twitch_IRC_ShouldIgnore(line) {
    for (let pat of Twitch.IRC.Messages.Ignore) {
      if (line.match(pat)) {
        return true;
      }
    }
    return false;
  },

  /* Message-specific extra parsing */
  ParseSpecial: {
    /* PRIVMSG: Handle /me */
    'PRIVMSG': function _Twitch_IRC_ParseSpecial_PRIVMSG(obj) {
      let msg = obj.message;
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
      let fields = obj.fields;
      let flags = fields.flags;
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
    if (Twitch.IRC.ShouldIgnore(line)) { return null; }
    let cmd = null;
    let pattern = null;
    let match = null;
    let rules = null
    for (let [pn, pr] of Object.entries(Twitch.IRC.Messages)) {
      let [pat, patrules] = pr;
      if (pn == "Ignore") continue;
      if ((match = line.match(pat)) !== null) {
        cmd = pn;
        pattern = pat;
        rules = patrules;
        break;
      }
    }
    if (cmd == null) {
      /* Failed to parse line! */
      Util.Error("Failed to parse IRC message", line);
      return null;
    }
    /* Construct a response */
    let resp = {
      cmd: cmd,
      line: line,
      patinfo: [pattern, match],
      fields: {},
      message: null
    };
    if (rules.hasOwnProperty("message")) {
      resp.message = match[rules.message];
    }
    for (let [fn, fi] of Object.entries(rules)) {
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
    if (Twitch.IRC.ParseSpecial[cmd]) {
      Twitch.IRC.ParseSpecial[cmd](resp);
    }
    return resp;
  }
}

/* (TODO: REMOVE) Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  /* Try parsing with the new object */
  let result = { cmd: null };
  let parts = line.split(' ');
  let data = {};
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
    result.flags = line.substr(line.indexOf(':', 1)+1).split(" ");
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
    let msg = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    if (msg.startsWith('\x01ACTION')) {
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
    result.channel = parts[1];
    result.user = parts[2];
  } else if (parts[1] == "NOTICE") {
    /* "[@<flags>] :<server> NOTICE <channel> :<message>\r\n" */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] == "421") { /* Error */
    /* ":<server> 421 <user> <command> :<message>\r\n" */
    result.cmd = "ERROR";
    result.server = parts[0].lstrip(':');
    result.user = Twitch.ParseUser(parts[2]);
    result.command = parts[3];
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[3])) + 1);
  } else {
    Util.Warn("OnWebsocketMessage: unknown message:", parts);
  }
  return result;
}

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
}

/* Mark the Twitch Utility API as loaded */
Twitch.API_Loaded = true;

