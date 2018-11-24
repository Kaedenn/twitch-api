
var Util = {};

/* Number of stack frames to omit from the top of the backtrace */
Util.StackTrim = 0;
Util.StackTrimEnd = 0;

/* Obtain a stacktrace */
Util.GetStack = function _Util_GetStack() {
  var lines = [];
  try { throw new Error(); } catch (e) { lines = e.stack.trim().split("\n"); }
  lines.shift(); /* Discard _Util_GetStack */
  for (var i = 0; i < Util.StackTrim; ++i) {
    lines.shift();
  }
  for (var i = 0; i < Util.StackTrimEnd; ++i) {
    lines.pop();
  }
  return lines;
}

/* Parse a given stacktrace */
Util.ParseStack = function _Util_ParseStack(lines) {
  var frames = [];
  for (var line of lines) {
    frames.push(Util.ParseFrame(line));
  }
  return frames;
}

/* Parse a given stack frame */
Util.ParseFrame = function _Util_ParseFrame(frame) {
  var m = frame.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/);
  return {name: m[1], file: m[2], line: parseInt(m[3]), column: parseInt(m[4])};
}

/* Split a path into <dir>/<file> parts */
Util.SplitPath = function _Util_SplitPath(path) {
  if (path.indexOf('/') > -1) {
    return [path.substr(0, path.lastIndexOf('/')),
            path.substr(path.lastIndexOf('/')+1)];
  } else {
    return ["", path];
  }
}

/* Join a directory and a filename */
Util.JoinPath = function _Util_JoinPath(dir, file) {
  if (dir) {
    return [dir, file].join('/');
  } else {
    return file;
  }
}

/* Strip a common prefix from an array of paths */
Util.StripCommonPrefix = function _Util_StripCommonPrefix(paths) {
  var pieces = [];
  for (var path of paths) {
    var path = (new URL(path)).pathname;
    var [dir, file] = Util.SplitPath(path);
    pieces.push([dir.split('/'), file]);
  }
  /* Find the longest item */
  var ref_path = null;
  var len = 0;
  for (var piece of pieces) {
    if (piece[0].length > len) {
      len = piece[0].length;
      /* Copy to protect from modification below */
      ref_path = piece[0].slice(0);
    }
  }
  /* Strip the common prefix */
  for (var i = 0; i < ref_path.length; ++i) {
    if (pieces.every((p) => (p[0][0] == ref_path[i]))) {
      for (var piece of pieces) { piece[0] = piece[0].slice(1); }
    }
  }
  /* Join the paths back together */
  return pieces.map((v) => Util.JoinPath(v[0].join('/'), v[1]));
}

/* Format stack frames for output */
Util.FormatStack = function _Util_FormatStack(stack) {
  /* Strip out the common prefix directory */
  var paths = [];
  for (var frame of stack) {
    paths.push(frame.file);
  }
  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length == paths.length);
  var result = [];
  for (var i = 0; i < paths.length; ++i) {
    result.push(`${stack[i].name}@${paths[i]}:${stack[i].line}:${stack[i].column}`);
  }
  return result.join("\n");
}

/* (internal) Output args to a console using the given func  */
Util._toConsole = function _Util__toConsole(func, args) {
  var stack = Util.ParseStack(Util.GetStack());
  stack.shift(); /* Discard Util._toConsole */
  stack.shift(); /* Discard Util._toConsole caller */
  console.group("From " + Util.FormatStack(stack));
  func.apply(console, args);
  console.groupEnd();
}

/* Log messages, warnings, and errors to the console */
Util.LogOnly = function _Util_LogOnly() { console.log.apply(console, arguments); }
Util.Log = function _Util_Log() { Util._toConsole(console.log, arguments); }
Util.Warn = function _Util_Warn() { Util._toConsole(console.warn, arguments); }
Util.Error = function _Util_Error() { Util._toConsole(console.error, arguments); }

/* Convert an arguments object to an Array instance */
Util.ArgsToArray = function _Util_ArgsToArray(argobj) {
  return Array.of.apply(Array, argobj);
}

/* Twitch utilities */
var Twitch = {};

/* Store known Twitch API URLs */
Twitch.URL = {};
Twitch.URL.Kraken = "https://api.twitch.tv/kraken";
Twitch.URL.GetRooms = (room) => `${Twitch.URL.Kraken}/chat/${room}/rooms`;

/* Issue a warning message */
Twitch.Warning = function _Twitch_Warning() {
  Util.Warn.apply(Util.Warn, arguments);
}

/* Create a request to the Twitch API */
Twitch.API = function _Twitch_API(global_headers) {
  this.Get = function _Twitch_API_get(url, callback, headers={}) {
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
    req.send();
  }
}

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  if (user.indexOf(':') == 0) {
    user = user.substr(1);
  }
  return user.split('!')[0];
}

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  var ch = channel;
  var room, roomuid;
  var parts = ch.split(':');
  if (parts.length == 3) {
    [ch, room, roomuid] = parts;
  } else if (parts.length == 1) {
    ch = parts[0];
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
  if (type(channel) == "string") {
    if (room) {
      channel += ':' + room;
    }
    if (roomuid) {
      channel += ':' + roomuid;
    }
    return channel;
  } else if (channel && channel.channel) {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Twitch.Warning("FormatChannel: don't know how to format", channel, room, roomuid);
    return `${channel}`;
  }
}

Twitch.ParseData = function _Twitch_ParseData(dataString) {
  /* @key=value;key=value;... */
  if (dataString.indexOf('@') == 0) {
    dataString = dataString.substr(1);
  }
  var parts = dataString.split(';');
  var data = {};
  for (var item of dataString.split(';')) {
    var [key, val] = item.split('=');
    val = val.replace("\\\\s", ' ');
    data[key] = val;
  }
  return data;
}

/* Sample responses:
 * CAP-ACK: :tmi.twitch.tv CAP * ACK :twitch.tv/tags twitch.tv/commands twitch.tv/membership
 * PING: PING :tmi.twitch.tv
 * JOIN: :justinfan606313!justinfan606313@justinfan606313.tmi.twitch.tv JOIN #dwangoac
 * PART: ":lordzarano!lordzarano@lordzarano.tmi.twitch.tv PART #dwangoac\r\n"
 * TOPIC: :tmi.twitch.tv 001 justinfan606313 :Welcome, GLHF!
 * TOPIC: :tmi.twitch.tv 002 justinfan606313 :Your host is tmi.twitch.tv
 * TOPIC: :tmi.twitch.tv 003 justinfan606313 :This server is rather new
 * TOPIC: :tmi.twitch.tv 004 justinfan606313 :-
 * TOPIC: :tmi.twitch.tv 375 justinfan606313 :-
 * TOPIC: :tmi.twitch.tv 372 justinfan606313 :You are in a maze of twisty passages, all alike.
 * TOPIC: :tmi.twitch.tv 376 justinfan606313 :>
 * NAMES: ":justinfan673553.tmi.twitch.tv 353 justinfan673553 = #dwangoac :thatguy_ace icedreamstreams devlogic dwangoac angelwind76 ikps chronophylos ninjatomate electricalskateboard themas3212 electroniclogic labmonkey42 sbah darkeyece zironofsetesh tas9000 dragoy_of_fenrir chowbit sodiumchloridelogic digitalmatrixio void_lily lordzarano thebloodyscreen\r\n:justinfan673553.tmi.twitch.tv 353 justinfan673553 = #dwangoac :justinfan673553\r\n:justinfan673553.tmi.twitch.tv 366 justinfan673553 #dwangoac :End of /NAMES list\r\n"
 */

Twitch.IRCMessages = {
  /* "PING :<server>\r\n" */
  PING: /^PING :(.*)(?:\r\n)?$/,
  /* ":<server> CAP * ACK :<capabilities...>\r\n" */
  ACK: /^:([^ ]+) CAP \* ACK :(.*)(?:\r\n)?$/,
  /* ":<server> <code> <username> :<message>\r\n" */
  TOPIC: /^:([^ ]+) (10[1-9]|372) ([^ ]+) :(.*)(?:\r\n)?$/,
  /* ":<server> 353 <username> <modechr> <channel> :<users...>\r\n" */
  NAMES: /^:([^ ]+) 373 ([^ ]+) ([^ ]+) (\#[^ ]+) :(.*)(?:\r\n)?$/,
  /* ":<name>!<user>@<user>.<host> JOIN <channel>\r\n" */
  JOIN: /^:([^ ]+) JOIN (\#[^ ]+)(?:\r\n)?$/,
  /* ":<name>!<user>@<user>.<host> PART <channel>\r\n" */
  PART: /^:([^ ]+) PART (\#[^ ]+)(?:\r\n)?$/,
  /* ":<user> MODE <channel> <modeop> <users...>\r\n" */
  MODE: /^:([^ ]+) MODE (\#[^ ]+) ([+-]\w) (.*)(?:\r\n)?$/,
  /* "@<flags> :<user> PRIVMSG <channel> :<message>\r\n" */
  PRIVMSG: /^@([^ ]+) :([^ ]+) PRIVMSG (\#[^ ]+) :(.*)(?:\r\n)?$/,
  /* "@<flags> :<server> USERSTATE <channel>\r\n" */
  USERSTATE: /^@([^ ]+) :([^ ]+) USERSTATE (\#[^ ]+)(?:\r\n)?$/,
  /* "@<flags> :<server> ROOMSTATE <channel>\r\n" */
  ROOMSTATE: /^@([^ ]+) :([^ ]+) ROOMSTATE (\#[^ ]+)(?:\r\n)?$/,
  /* "@<flags> :<server> USERNOTICE <channel>[ :<message>]\r\n" */
  USERNOTICE: /^@([^ ]+) :([^ ]+) USERNOTICE (\#[^ ]+)(?: :(.*))?(?:\r\n)?$/,
  Ignore: [
    /* Start/end of TOPIC listing, end of NAMES listing */
    /^:[^ ]+ (?:37[56]|366) [^ ]+ \#[^ ]+ :.*(?:\r\n)?$/
  ]
};

Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  /* Try parsing with the new object */
  var ign = false;
  for (var pat of Twitch.IRCMessages.Ignore) {
    if (line.match(pat)) {
      console.log('Ignore>', line);
      ign = true;
    }
  }
  if (!ign) {
    for (var cmd of Object.keys(Twitch.IRCMessages)) {
      if (cmd == "Ignore") continue;
      var m = line.match(Twitch.IRCMessages[cmd]);
      if (m) {
        console.log('msg>', cmd, line, m);
      }
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
    result.arg = parts[1];
  } else if (line.indexOf("CAP * ACK") > -1) {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = "ACK";
    result.operation = "CAP";
    result.server = parts[0].replace(/^:/, "");
    result.flags = line.substr(line.indexOf(':', 1)+1).split();
  } else if (parts[1] == "375" || parts[1] == "376") {
    /* 375: Start TOPIC listing
     * 376: End TOPIC listing */
    /* :<server> <code> <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
  } else if (parts[1].match(/00[1-9]/) || parts[1] == "372") {
    /* :<server> 00[1-4] <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
    result.server = parts[0].replace(/^:/, "");
    result.username = parts[2];
    result.message = parts.slice(3).join(' ').substr(1);
  } else if (parts[1] == "353") {
    /* NAMES listing entry */
    /* :<user> 353 <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = parts[0].replace(/^:/, "");
    result.mode = parts[2];
    result.channel = Twitch.ParseChannel(parts[3]);
    result.usernames = parts.splice(4).join(' ').substr(1);
  } else if (parts[1] == "366") {
    /* End of NAMES listing */
    result.cmd = "OTHER";
  } else if (parts[1] == "JOIN" || parts[1] == "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "MODE") {
    /* ":<user> MODE <channel> <modset> " */
    result.cmd = "MODE";
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.modeset = parts.splice(2);
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
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0];
  } else {
    Twitch.Warning("OnWebsocketMessage: unknown message:", parts);
  }
  return result;
}

