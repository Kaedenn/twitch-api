
/* Twitch utilities */
var Twitch = {};

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

/* Store known Twitch API URLs */
Twitch.URL = {};
Twitch.URL.Kraken = "https://api.twitch.tv/kraken";
Twitch.URL.GetRooms = (cid) => `${Twitch.URL.Kraken}/chat/${cid}/rooms`;
Twitch.URL.GetChannelBadges = (cid) => `${Twitch.URL.Kraken}/chat/${cid}/badges`;
Twitch.URL.GetAllBadges = () => `https://badges.twitch.tv/v1/badges/global/display`;
Twitch.URL.GetAllEmotes = () => `${Twitch.URL.Kraken}/chat/emoticons`; /* FIXME: CORS */
Twitch.URL.GetAllCheermotes = () => `${Twitch.URL.Kraken}/bits/actions`;

/* Create a request to the Twitch API */
Twitch.API = function _Twitch_API(global_headers, private_headers) {
  this.Get = function _Twitch_API_get(url, callback, headers={}, add_private=false) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        callback(JSON.parse(this.responseText));
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    for (var key of Object.keys(global_headers)) {
      req.setRequestHeader(key, global_headers[key]);
    }
    for (var key of Object.keys(headers)) {
      req.setRequestHeader(key, headers[key]);
    }
    if (add_private) {
      for (var key of Object.keys(private_headers)) {
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
  var ch = channel;
  var room = null;
  var roomuid = null;
  var parts = ch.split(':');
  if (parts.length == 1) {
    ch = parts[0];
  } else if (parts.length == 3) {
    [ch, room, roomuid] = parts;
  } else {
    Twitch.Warning(`ParseChannel: ${ch} not in expected format`);
    ch = parts[0];
  }
  return {channel: ch, room: room, roomuid: roomuid};
}

/* Format each of the following
 *  "channel" -> "channel"
 *  "channel", "room", "roomuid" -> "channel:room:roomuid"
 *  {channel: "channel", room: "room", roomuid: "roomuid"} -> "channel:room:roomuid"
 */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof(channel) == "string") {
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
      return channel;
    }
  } else if (channel && channel.channel) {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Twitch.Warning("FormatChannel: don't know how to format", channel, room, roomuid);
    return `${channel}`;
  }
}

Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  var result = undefined;
  if (value.length == 0) {
    /* Translate empty strings to null */
    result = null;
  } else if (!isNaN(parseInt(value))) {
    /* Translate numeric values to numbers */
    result = parseInt(value);
  } else {
    /* Values requiring special handling */
    switch (key) {
      case "badges":
        result = [];
        for (var badge of value.split(',')) {
          var [badge_name, badge_rev] = badge.split('/');
          badge_rev = parseInt(badge_rev);
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
        result = value.replace("\\\\s", ' ');
        break;
    }
  }
  return result;
}

Twitch.ParseData = function _Twitch_ParseData(dataString) {
  /* @key=value;key=value;... */
  dataString = dataString.lstrip('@');
  var parts = dataString.split(';');
  var data = {};
  for (var item of dataString.split(';')) {
    var [key, val] = item.split('=');
    val = Twitch.ParseFlag(key, val);
    Twitch.DebugCache.add('flags', key);
    Twitch.DebugCache.add('flag-' + key, val);
    data[key] = val;
  }
  return data;
}

Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  var result = [];
  for (var emote_def of value.split('/')) {
    var seppos = emote_def.indexOf(':');
    var emote_id = parseInt(emote_def.substr(0, seppos));
    for (var range of emote_def.substr(seppos+1).split(',')) {
      var [start, end] = range.split('-');
      result.push({id: emote_id, start: parseInt(start), end: parseInt(end)});
    }
  }
  return result;
}

/* PRIVMSG:
 *   Flags:
 *     badges=subscriber/0,bits/1000
 *     color=#0262C1
 *     display-name=Kaedenn_
 *     emotes=
 *     flags=
 *     id=989a3397-f919-4e08-9c62-279e0384bd17
 *     mod=0
 *     room-id=70067886
 *     subscriber=1
 *     tmi-sent-ts=1543265934371
 *     turbo=0
 *     user-id=175437030
 *     user-type=
 */

Twitch.IRCMessages = {
  /* "PING :<server>\r\n" */ /* Verified */
  PING: /^PING :(.*)(?:\r\n)?$/,
  /* ":<server> CAP * ACK :<capabilities...>\r\n" */ /* Verified */
  ACK: /^:([^ ]+) CAP \* ACK :(.*)(?:\r\n)?$/,
  /* ":<server> <code> <username> :<message>\r\n" */ /* Verified */
  TOPIC: /^:([^ ]+) ((?:00[1-9])|(?:372)) ([^ ]+) :(.*)(?:\r\n)?$/,
  /* ":<server> 353 <username> <modechr> <channel> :<users...>\r\n" */ /* Verified */
  NAMES: /^:([^ ]+) 353 ([^ ]+) ([^ ]+) (\#[^ ]+) :(.*)(?:\r\n)?$/,
  /* ":<name>!<user>@<user>.<host> JOIN <channel>\r\n" */ /* Verified */
  JOIN: /^:([^ ]+) JOIN (\#[^ ]+)(?:\r\n)?$/,
  /* ":<name>!<user>@<user>.<host> PART <channel>\r\n" */ /* Verified */
  PART: /^:([^ ]+) PART (\#[^ ]+)(?:\r\n)?$/,
  /* ":<user> MODE <channel> <modeop> <users...>\r\n" */ /* Verified */
  MODE: /^:([^ ]+) MODE (\#[^ ]+) ([+-]\w) (.*)(?:\r\n)?$/,
  /* "@<flags> :<user> PRIVMSG <channel> :<message>\r\n" */ /* Verified */
  PRIVMSG: /^@([^ ]+) :([^ ]+) PRIVMSG (\#[^ ]+) :(.*)(?:\r\n)?$/,
  /* "@<flags> :<server> USERSTATE <channel>\r\n" */ /* Verified */
  USERSTATE: /^@([^ ]+) :([^ ]+) USERSTATE (\#[^ ]+)(?:\r\n)?$/,
  /* "@<flags> :<server> ROOMSTATE <channel>\r\n" */ /* Verified */
  ROOMSTATE: /^@([^ ]+) :([^ ]+) ROOMSTATE (\#[^ ]+)(?:\r\n)?$/,
  /* "@<flags> :<server> USERNOTICE <channel>[ :<message>]\r\n" */
  USERNOTICE: /^@([^ ]+) :([^ ]+) USERNOTICE (\#[^ ]+)(?: :(.*))?(?:\r\n)?$/,
  /* "@<flags> :<server> GLOBALUSERSTATE \r\n" */
  GLOBALUSERSTATE: /^@([^ ]+) :([^ ]+) GLOBALUSERSTATE(?:\r\n)?$/,
  /* "@<flags> :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
  CLEARCHAT: /^@([^ ]+) :([^ ]+) CLEARCHAT (\#[^ ]+)(?: :(.*))?(?:\r\n)?$/,
  /* ":<server> NOTICE <channel> :<message>\r\n" */
  NOTICE: /^(?:@([^ ]+) )?:([^ ]+) NOTICE ([^ ]+) :(.*)(?:\r\n)?$/,
  /* ":<server> 421 <user> <command> :<message> */
  ERROR: /^:([^ ]+) (421) ([^ ]+) :(.*)(?:\r\n)?$/,
  /* Line patterns to ignore */
  Ignore: [
    /* Start of TOPIC listing */
    /^:([^ ]+) (375) ([^ ]+) :-(?:\r\n)?$/,
    /* End of TOPIC listing */
    /^:([^ ]+) (376) ([^ ]+) :>(?:\r\n)?$/,
    /* Start/end of TOPIC listing, end of NAMES listing */
    /^:[^ ]+ (?:37[56]|366) [^ ]+ \#[^ ]+ :.*(?:\r\n)?$/
  ]
};

/* TODO
 * @ban-duration=1;room-id=70067886;target-user-id=175437030;tmi-sent-ts=1543186839092 :tmi.twitch.tv CLEARCHAT #dwangoac :kaedenn_
 * @badges=premium/1;color=#0262C1;display-name=Kaedenn_;emote-sets=0,113,120,12597,14860,14913,19194,19624,20466,22228,60369,172696;user-id=175437030;user-type= :tmi.twitch.tv GLOBALUSERSTATE
 */

/* TODO: remove */
var parse_counter = {
  Fails: 0,
  Failed: []
};

Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  /* Try parsing with the new object */
  var ign = false;
  for (var pat of Twitch.IRCMessages.Ignore) {
    if (line.match(pat)) {
      ign = true;
    }
  }
  if (!ign) {
    var parsed = false;
    for (var cmd of Object.keys(Twitch.IRCMessages)) {
      if (cmd == "Ignore") continue;
      var m = line.match(Twitch.IRCMessages[cmd]);
      if (m) {
        if (!(cmd in parse_counter)) { parse_counter[cmd] = 0; }
        parse_counter[cmd] += 1;
        parsed = true;
        break;
      }
    }
    if (!parsed) {
      parse_counter.Fails += 1;
      parse_counter.Failed.push(line);
      Twitch.Warning('Regexp parser failed to parse', line);
    }
  }
  var result = { cmd: null };
  var parts = line.split(' ');
  var data = {};
  if (parts[0].startsWith('@')) {
    data = Twitch.ParseData(parts[0]);
    parts.shift();
  }
  if (parts[0] == "PING") {
    /* "PING <server>" */
    result.cmd = "PING";
    result.server = parts[1].lstrip(':');
  } else if (line.indexOf("CAP * ACK") > -1) {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = "ACK";
    result.operation = "CAP";
    result.server = parts[0].lstrip(':');
    result.flags = line.substr(line.indexOf(':', 1)+1).split(" ");
  } else if (parts[1] == "375" || parts[1] == "376" || parts[1] == "366") {
    /* 375: Start TOPIC listing
     * 376: End TOPIC listing
     * 366: End of NAMES listing */
    /* :<server> <code> <username> :<message> */
    result.cmd = "OTHER";
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
    /* :<user> 353 <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = parts[0].lstrip(':');
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
    /* ":<user> MODE <channel> <username> <modeflag>" */
    result.cmd = "MODE";
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.username = parts[3];
    result.modeflag = parts[4];
  } else if (parts[1] == "PRIVMSG") {
    /* [@<flags>] :<user> PRIVMSG <channel> :<msg> */
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] == "USERSTATE") {
    /* [@<flags>] :<server> USERSTATE <channel> */
    result.cmd = "USERSTATE";
    result.flags = data;
    result.username = data["display-name"];
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "ROOMSTATE") {
    /* [@<flags>] :<server> ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = data;
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "USERNOTICE") {
    /* [@<flags>] :<server> USERNOTICE <channel> */
    /* [@<flags>] :<server> USERNOTICE <channel> :<message> */
    result.cmd = "USERNOTICE";
    result.flags = data;
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    result.issub = false;
    result.sub_kind = null;
    result.sub_user = null;
    result.sub_gifting_user = null;
    result.sub_months = null;
    if (result.flags["msg-id"]) {
      switch (result.flags["msg-id"]) {
        case "sub":
          result.issub = true;
          result.sub_kind = "SUB";
          result.sub_user = result.flags["login"];
          result.sub_months = result.flags["msg-param-sub-months"];
          break;
        case "resub":
          result.issub = true;
          result.sub_kind = "RESUB";
          result.sub_user = result.flags["login"];
          result.sub_months = result.flags["msg-param-sub-months"];
          break;
        case "subgift":
          result.issub = true;
          result.sub_kind = "GIFTSUB";
          result.sub_gifting_user = result.flags["login"];
          result.sub_user = result.flags["msg-param-recipient-user-name"];
          result.sub_months = result.flags["msg-param-sub-months"];
          break;
        case "anonsubgift":
          result.issub = true;
          result.sub_kind = "ANONGIFTSUB";
          result.sub_gifting_user = result.flags["login"];
          result.sub_user = result.flags["msg-param-recipient-user-name"];
          result.sub_months = result.flags["msg-param-sub-months"];
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
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.user = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
    }
  } else if (parts[1] == "NOTICE") {
    /* "[@<flags>] :<server> NOTICE <channel> :<message>\r\n" */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].lstrip(':');
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else {
    Twitch.Warning("OnWebsocketMessage: unknown message:", parts);
  }
  return result;
}


