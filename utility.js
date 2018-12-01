
/* Add a few things to the native classes */
String.prototype._stripFrom = function(chrs, from) {
  var d = (from > 0 ? 1 : -1);
  var i = (from > 0 ? 0 : this.length - 1);
  if (!chrs) {
    chrs = [' '];
  }
  while ((d == 1 && i < this.length) || (d == -1 && i > 0)) {
    if (!chrs.includes(this[i])) {
      break;
    }
    i += d;
  }
  if (d == 1) {
    return this.substr(i);
  } else if (d == -1) {
    return this.substr(0, i+1);
  }
}

/* Remove `chrs` from the beginning and end of the string */
String.prototype.strip = function(chrs) {
  return this._stripFrom(chrs, 1)._stripFrom(chrs, -1);
}

/* Remove `chrs` from the beginning of the string */
String.prototype.lstrip = function(chrs) {
  return this._stripFrom(chrs, 1);
}

/* Remove `chrs` from the end of the string */
String.prototype.rstrip = function(chrs) {
  return this._stripFrom(chrs, -1);
}

/* Escape a string for proper HTML printing */
String.prototype.escape = function() {
  var result = this;
  var escape_chars = [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&apos;']
  ]
  for (var [ch, esc] of escape_chars) {
    result = result.replace(ch, esc);
  }
  return result;
}

/* Obtain an escaped version of the string, akin to Object.toSource() */
String.prototype.repr = function() {
  var m = this.toSource().match(/^\(new String\((.*)\)\)$/);
  if (m) {
    return m[1];
  }
}

/* General Utilities */
var Util = {
  LEVEL_TRACE: 2,
  LEVEL_DEBUG: 1,
  LEVEL_OFF: 0,
  DebugLevel: 0
};

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

/* Log debugging information, messages, warnings, and errors to the console */
Util.Trace = function _Util_Trace(...args) {
  if (Util.DebugLevel >= Util.LEVEL_TRACE) {
    Util.LogOnly.apply(Util.LogOnly, args);
  }
}
Util.Debug = function _Util_Debug(...args) {
  if (Util.DebugLevel >= Util.LEVEL_DEBUG) {
    Util.LogOnly.apply(Util.LogOnly, args);
  }
}
Util.LogOnly = function _Util_LogOnly() { console.log.apply(console, arguments); }
Util.Log = function _Util_Log() { Util._toConsole(console.log, arguments); }
Util.Warn = function _Util_Warn() { Util._toConsole(console.warn, arguments); }
Util.Error = function _Util_Error() { Util._toConsole(console.error, arguments); }

/* Convert an arguments object to an Array instance */
Util.ArgsToArray = function _Util_ArgsToArray(argobj) {
  return Array.of.apply(Array, argobj);
}

/* Apply a set of attributes to an HTMLElement */
Util.ApplyAttributes = function _Util_ApplyAttributes(node, attrs, escape=true) {
  for (var [k,v] of Object.entries(attrs)) {
    node.setAttribute(k, escape ? (new String(v)).escape() : v);
  }
}

/* Fire an event */
Util.FireEvent = function _Util_FireEvent(e) {
  e._stacktrace = Util.ParseStack(Util.GetStack());
  e._stacktrace.shift(); /* Discard Util.FireEvent */
  document.dispatchEvent(e);
}

