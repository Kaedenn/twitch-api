
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
    return [dir, file].join("/");
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
  return pieces.map((v) => Util.JoinPath(v[0].join("/"), v[1]));
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
Util.Log = function _Util_Log() { Util._toConsole(console.log, arguments); }
Util.Warn = function _Util_Warn() { Util._toConsole(console.warn, arguments); }
Util.Error = function _Util_Error() { Util._toConsole(console.error, arguments); }

/* Twitch utilities */
var Twitch = {};

/* Store known Twitch API URLs */
Twitch.URL = {};
Twitch.URL.Kraken = 'https://api.twitch.tv/kraken';
Twitch.URL.GetRooms = (room) => `${Twitch.URL.Kraken}/chat/${room}/rooms`;

/* Issue a warning message */
Twitch.Warning = function _Twitch_Warning() {
  Util.Warn.apply(Util.Warn, arguments);
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
  if (ch.indexOf('#') == 0) {
    ch = ch.substr(1);
  }
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
 *  "channel" -> "#channel"
 *  "channel", "room", "roomuid" -> "#channel:room:roomuid"
 *  {channel: "channel", room: "room", roomuid: "roomuid"} -> "#channel:room:roomuid"
 */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (type(channel) == 'string') {
    if (channel.indexOf('#') != 0) {
      channel = '#' + channel;
    }
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
    val = val.replace('\\\\s', ' ');
    data[key] = val;
  }
  return data;
}
