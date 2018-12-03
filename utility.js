
/* Add a few things to the native classes */
String.prototype._stripFrom = function _String__stripFrom(chrs, from) {
  var d = (from > 0 ? 1 : -1);
  var i = (from > 0 ? 0 : this.length - 1);
  if (!chrs) {
    chrs = [' ', '\r', '\n'];
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
String.prototype.strip = function _String_strip(chrs) {
  return this._stripFrom(chrs, 1)._stripFrom(chrs, -1);
}

/* Remove `chrs` from the beginning of the string */
String.prototype.lstrip = function _String_lstrip(chrs) {
  return this._stripFrom(chrs, 1);
}

/* Remove `chrs` from the end of the string */
String.prototype.rstrip = function _String_rstrip(chrs) {
  return this._stripFrom(chrs, -1);
}

/* Escape a string for proper HTML printing */
String.prototype.escape = function _String_escape() {
  var result = this;
  result = result.replace(/&/g, '&amp;');
  result = result.replace(/</g, '&lt;');
  result = result.replace(/>/g, '&gt;');
  result = result.replace(/"/g, '&quot;');
  result = result.replace(/'/g, '&apos;');
  return result;
}

/* Obtain an escaped version of the string, akin to Object.toSource() */
String.prototype.repr = function _String_repr() {
  var m = this.toSource().match(/^\(new String\((.*)\)\)$/);
  if (m) {
    return m[1];
  }
}

/* Split a string at most N times, returning the tokens and the rest of the
 * string, such that STR.split_n(sep, n).join(sep) === STR */
String.prototype.split_n = function _String_split_n(sep, num) {
  var cnt = 0;
  var results = [];
  var temp = this;
  while (temp.indexOf(sep) > -1 && cnt < num) {
    cnt += 1;
    results.push(temp.substr(0, temp.indexOf(sep)));
    temp = temp.substr(temp.indexOf(sep) + sep.length);
  }
  if (temp.length > 0) {
    results.push(temp);
  }
  return results;
}

/* General Utilities */
var Util = {
  LEVEL_TRACE: 2,
  LEVEL_DEBUG: 1,
  LEVEL_OFF: 0,
  DebugLevel: 0,
  _stack_trim_begin_level: [0],
  _stack_trim_end_level: [0]
};

/* Save the current top-stack trim level and push a new value to use */
Util.PushStackTrimBegin = function _Util_PushStackTrimBegin(level) {
  Util._stack_trim_begin_level.push(level);
}

/* Restore the saved top-stack trim level */
Util.PopStackTrimBegin = function _Util_PopStackTrimBegin() {
  if (Util._stack_trim_begin_level.length > 1) {
    Util._stack_trim_begin_level.pop();
  }
}

/* Save the current bottom-stack trim level and push a new value to use */
Util.PushStackTrimEnd = function _Util_PushStackTrimEnd(level) {
  Util._stack_trim_end_level.push(level);
}

/* Restore the saved bottom-stack trim level */
Util.PopStackTrimEnd = function _Util_PopStackTrimEnd() {
  if (Util._stack_trim_end_level.length > 1) {
    Util._stack_trim_end_level.pop();
  }
}

/* Get the current top-stack trim level */
Util.GetStackTrimBegin = function _Util_GetStackTrimBegin() {
  return Util._stack_trim_begin_level[Util._stack_trim_begin_level.length-1];
}

/* Get the current bottom-stack trim level */
Util.GetStackTrimEnd = function _Util_GetStackTrimEnd() {
  return Util._stack_trim_end_level[Util._stack_trim_end_level.length-1];
}

/* Obtain a stacktrace, applying the current stack trim levels */
Util.GetStack = function _Util_GetStack() {
  var lines = [];
  try { throw new Error(); } catch (e) { lines = e.stack.trim().split("\n"); }
  lines.shift(); /* Discard _Util_GetStack */
  for (var i = 0; i < Util.GetStackTrimBegin(); ++i) {
    lines.shift();
  }
  for (var i = 0; i < Util.GetStackTrimEnd(); ++i) {
    lines.pop();
  }
  return lines;
}

/* Parse a given stacktrace */
Util.ParseStack = function _Util_ParseStack(lines) {
  var frames = [];
  for (var line of lines) {
    var m = line.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/);
    var frame = {};
    frame.name = m[1];
    frame.file = m[2];
    frame.line = parseInt(m[3]);
    frame.column = parseInt(m[4]);
    frames.push(frame);
  }
  return frames;
}

/* Split a path into <dirname>/<basename> parts */
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
  try {
    for (var path of paths) {
      var path = (new URL(path)).pathname;
      var [dir, file] = Util.SplitPath(path);
      pieces.push([dir.split('/'), file]);
    }
  }
  catch (e) {
    if (e.message.match(/is not a valid URL/)) {
      /* Not a valid URL; bail */
      return paths;
    } else {
      /* Something else; re-raise */
      throw e;
    }
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
  if (ref_path !== null) {
    for (var i = 0; i < ref_path.length; ++i) {
      if (pieces.every((p) => (p[0][0] == ref_path[i]))) {
        for (var piece of pieces) { piece[0] = piece[0].slice(1); }
      }
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

/* Print the given arguments to the console.
 * If DebugLevel >= TRACE, output with a stacktrace */
Util.Debug = function _Util_Debug(...args) {
  var func = null;
  Util.PushStackTrimBegin(Math.max(Util.GetStackTrimBegin(), 1));
  if (Util.DebugLevel >= Util.LEVEL_TRACE) {
    func = Util.Log;
  } else if (Util.DebugLevel >= Util.LEVEL_DEBUG) {
    func = Util.LogOnly;
  }
  if (func)
    func.apply(func, args);
  Util.PopStackTrimBegin();
}

/* Output the given arguments to the console, without a stacktrace */
Util.LogOnly = function _Util_LogOnly() { console.log.apply(console, arguments); }

/* Output the given arguments to the console */
Util.Log = function _Util_Log() { Util._toConsole(console.log, arguments); }

/* Output the given arguments as a warning to the console */
Util.Warn = function _Util_Warn() { Util._toConsole(console.warn, arguments); }

/* Output the given arguments as an error to the console */
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

/* Zip two (or more) sequences together */
Util.Zip = function _Util_Zip(...sequences) {
  var curr = [];
  var max_len = 0;
  /* Make sure everything's an array, calculate the max length */
  for (var seq of sequences) {
    var seq_array = Array.from(seq);
    max_len = Math.max(seq_array.length, max_len);
    curr.push(seq_array);
  }
  /* Ensure all arrays have the same size */
  for (var seq of curr) {
    while (seq.length < max_len) {
      seq.push(undefined);
    }
  }
  result = [];
  /* Perform the zip operation */
  for (var i = 0; i < max_len; ++i) {
    var row = Array.from(curr, () => undefined);
    for (var j = 0; j < curr.length; ++j) {
      row[j] = curr[j][i];
    }
    result.push(row);
  }
  /* And we're done */
  return result;
}

/* Convert a string to an array of character codes */
Util.StringToCodes = function _Util_StringToCodes(str) {
  var result = [];
  for (var i = 0; i < str.length; ++i) {
    result.push(str.charCodeAt(i));
  }
  return result;
}

/* Build a character escape sequence for the code given */
Util.EscapeCharCode = function _Util_EscapeCharCode(code) {
  // Handle certain special escape sequences
  var special_chrs = "bfnrtv";
  var special = Util.StringToCodes("\b\f\n\r\t\v");
  if (special.indexOf(code) > -1) {
    return `\\${special_chrs.charAt(special.indexOf(code))}`;
  } else {
    return `\\x${code.toString(16).padStart(2, '0')}`;
  }
}

/* Strip escape characters from a string */
Util.EscapeSlashes = function _Util_EscapeSlashes(str) {
  is_slash = (c) => c == "\\";
  is_ctrl = (c) => c.charCodeAt(0) < ' '.charCodeAt(0);
  var result = "";
  for (var [cn, ch] of Util.Zip(Util.StringToCodes(str), str)) {
    if (cn < 0x20)
      result = result.concat(Util.EscapeCharCode(cn));
    else if (ch == '\\')
      result = result.concat('\\\\');
    else
      result = result.concat(ch);
  }
  return result;
}

/* Parse a query string (with leading ? omitted) with the following rules:
 *  `key` gives {key: true}
 *  `key=` gives {key: false}
 *  `key=true` gives {key: true}
 *  `key=false` gives {key: false}
 *  `key=1` gives {key: 1} for any integer value
 *  `key=1.0` gives {key: 1.0} for any floating-point value
 *  `key=null` gives {key: null}
 */
Util.ParseQueryString = function _Util_ParseQueryString(query) {
  if (!query) query = document.location.search.substr('1');
  var obj = {};
  for (var part of query.split('&')) {
    if (part.indexOf('=') == -1) {
      obj[part] = true;
    } else {
      var key = part.substr(0, part.indexOf('='));
      var val = part.substr(part.indexOf('=')+1);
      if (val.length == 0)
        val = false;
      else if (val.match(/true|false/))
        val = Boolean(val);
      else if (val.match(/^[0-9]+$/))
        val = parseInt(val);
      else if (val.match(/^[0-9]+\.[0-9]+$/))
        val = parseFloat(val);
      else if (val === "null")
        val = null;
      obj[key] = val;
    }
  }
  return obj;
}

