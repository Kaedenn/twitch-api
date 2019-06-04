"use strict";

/* Twitch utilities */
let Twitch = {};

/* Escape sequences {{{0 */

Twitch.FLAG_ESCAPE_RULES = [
  ["\\s", /\\s/g, " ", / /g],
  ["\\:", /\\:/g, ";", /;/g],
  ["\\r", /\\r/g, "\r", /\r/g],
  ["\\n", /\\n/g, "\n", /\n/g],
  ["\\\\", /\\\\/g, "\\", /\\/g]
];

/* End escape sequences 0}}} */

/* API URLs {{{0 */

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

/* End of API URLs 0}}} */

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
  let ch = channel;
  let room = null;
  let roomuid = null;
  let parts = ch.split(':');
  if (parts.length === 1) {
    ch = parts[0];
  } else if (parts.length === 3) {
    [ch, room, roomuid] = parts;
  } else {
    Util.Warn(`ParseChannel: ${ch} not in expected format`);
    ch = parts[0];
  }
  if (ch.indexOf('#') !== 0) {
    ch = '#' + ch;
  }
  return {channel: ch, room: room, roomuid: roomuid};
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
    } else {
      result.message = "";
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

