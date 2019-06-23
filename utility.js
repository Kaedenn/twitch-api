"use strict";

/* TODO:
 * Rename Logger functions: "" -> "Stack", "Only" -> ""
 *  Logger.${Sev} -> Logger.${Sev}Stack
 *  Logger.${Sev}Only -> Logger.${Sev}
 *  Logger.${Sev}OnlyOnce -> Logger.${Sev}Once
 * Color replacement API (see KapChat)
 *
 * Create (monster) configuration class
 *  Tie to query string
 *   Optional argument: rename map (e.g. rename "norec" to "NoAutoReconnect")
 *  Tie to local storage
 *  Tie to specific DOM elements
 *   Changing specific elements -> automatic update of config
 *  Set precedence of certain items over others (qs overrides localStorage, etc)
 *  Set certain items as "no persist"; don't store in localStorage
 *  Live changes (after initial parse) take precedence over query string
 */

/** Generic Utility-ish Functions for the Twitch Chat API
 *
 * Provides the following APIs, among others:
 *
 * Extensions to the standard JavaScript classes (String, Array)
 * Logging functions including stack-trace handling
 * Functions for color arithmetic
 * A random number generator that can generate version 4 UUIDs
 * Shortcut functions for a number of trivial tasks (fireEvent, formatting)
 * Functions for localStorage management
 * Functions for point-in-box calculation
 * Functions for handling location.search (query string) management
 *
 * Citations:
 *  PRNG and UUID generation
 *    https://github.com/kelektiv/node-uuid.git
 *  Color calculations (RGBtoHSL, HSLtoRGB)
 *    https://gist.github.com/vahidk/05184faf3d92a0aa1b46aeaa93b07786
 *  Calculating relative luminance
 *    https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
 *  Calculating contrast ratio
 *    https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
 *  Maximizing contrast
 *    Inspired by https://ux.stackexchange.com/a/107319
 */

/* General Utilities {{{0 */
let Util = {};
Util.__wskey = null;
Util.__wscfg = "kae-twapi-local-key";

/* Everyone needs an ASCII table */
Util.ASCII = "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n" +
             "\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014" +
             "\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d" +
             "\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJK" +
             "LMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u007f";

/* WebSocket status codes */
Util.WSStatusCode = {
  1000: "NORMAL", /* Shutdown successful / regular socket shutdown */
  1001: "GOING_AWAY", /* Browser tab closing */
  1002: "PROTOCOL_ERROR", /* Endpoint received malformed frame */
  1003: "UNSUPPORTED", /* Endpoint received an unsupported frame */
  1005: "NO_STATUS", /* Didn't receive a close status */
  1006: "ABNORMAL", /* Abnormal closing; no close frame received */
  1007: "UNSUPPORTED_PAYLOAD", /* Inconsistent message (e.g. invalid UTF-8) */
  1008: "POLICY_VIOLATION", /* Generic non-1003 non-1009 message */
  1009: "TOO_LARGE", /* Frame was too large */
  1010: "MANDATORY_EXTENSION", /* Server refused a required extension */
  1011: "SERVER_ERROR", /* Internal server error */
  1012: "SERVICE_RESTART", /* Server is restarting */
  1013: "TRY_AGAIN_LATER", /* Server temporarily blocking connections */
  1014: "BAD_GATEWAY", /* Gateway server received an invalid response */
  1015: "TLS_HANDSHAKE_FAIL" /* TLS handshake failure */
};

/* WebSocket status messages */
Util.WSStatus = {
  1000: "Shutdown successful / regular socket shutdown",
  1001: "Browser tab closing",
  1002: "Endpoint received malformed frame",
  1003: "Endpoint received an unsupported frame",
  1005: "Didn't receive a close status",
  1006: "Abnormal closing; no close frame received",
  1007: "Inconsistent message (e.g. invalid UTF-8)",
  1008: "Generic non-1003 non-1009 message",
  1009: "Frame was too large",
  1010: "Server refused a required extension",
  1011: "Internal server error",
  1012: "Server is restarting",
  1013: "Server temporarily blocking connections",
  1014: "Gateway server received an invalid response",
  1015: "TLS handshake failure"
};

/* String escape characters */
Util.StringEscapeChars = {
  "\b": "b",
  "\f": "f",
  "\n": "n",
  "\r": "r",
  "\t": "t",
  "\v": "v"
};

/* Characters requiring HTML escaping (used by String.escape) */
Util.EscapeChars = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "&": "&amp;"
};

/* End of general utilities 0}}} */

/* Portability considerations {{{0 */

/* Return whether or not the variable given exists */
Util.Defined = function _Util_Defined(identifier) {
  /* See if Reflect can find it */
  try {
    if (Reflect.ownKeys(window).indexOf(identifier) > -1) {
      return true;
    }
  }
  catch (e) { /* Nothing to do */ }
  /* See if it's a window property */
  try {
    if (typeof(window[identifier]) !== typeof(void 0)) {
      return true;
    }
  }
  catch (e) { /* Nothing to do */ }
  /* See if it gives an error (only for \w+ literals) */
  if (identifier.match(/^[$\w]+$/)) {
    try {
      (new Function(`return ${identifier}`))();
      return true;
    }
    catch (e) {
      return false;
    }
  }
  return false;
};

/* End portability code 0}}} */

/* Standard object additions and polyfills {{{0 */

/* Drop-in polyfills */
(function _polyfill(G) {
  function polyfillIf(obj, cond, attr, val) {
    if (cond) {
      obj[attr] = val;
    }
  }
  function polyfill(obj, attr, val) {
    polyfillIf(obj, !obj[attr], attr, val);
  }

  polyfill(G, "console", {});
  polyfill(G.console, "assert", function _console_assert(cond) {
    if (!cond) { G.console.error(`Assertion failed: ${cond}`); }
  });
  polyfill(G.console, "group", function _console_group(name) {
    G.console.log(">>> " + name);
  });
  polyfill(G.console, "groupEnd", function _console_groupEnd() { });

  /* Calculates the divmod of the values given */
  polyfill(Math, "divmod", function _Math_divmod(r, n) {
    return [n / r, n % r];
  });

  /* Restrict a value to a given range */
  polyfill(Math, "clamp", function _Math_clamp(value, min, max) {
    return (value < min ? min : (value > max ? max : value));
  });

  /* Return true if any of the values satisfy the function given */
  polyfill(Array.prototype, "any", function _Array_any(func) {
    let f = func ? func : (b) => Boolean(b);
    for (let e of this) {
      if (f(e)) {
        return true;
      }
    }
    return false;
  });

  /* Return true if all of the values satisfy the function given */
  polyfill(Array.prototype, "all", function _Array_all(func) {
    let f = func ? func : (b) => Boolean(b);
    for (let e of this) {
      if (!f(e)) {
        return false;
      }
    }
    return true;
  });

  /* Concatenate two or more arrays */
  polyfill(Array.prototype, "concat", function _Array_concat(...args) {
    let result = [];
    for (let i of this) {
      result.push(i);
    }
    for (let seq of args) {
      for (let i of seq) {
        result.push(i);
      }
    }
    return result;
  });

  /* Ensure String.trimStart is present */
  polyfill(String.prototype, "trimStart", function _String_trimStart() {
    let i = 0;
    while (i < this.length && this[i] === ' ') {
      i += 1;
    }
    return i === 0 ? this : this.substr(i);
  });

  /* Ensure String.trimEnd is present */
  polyfill(String.prototype, "trimEnd", function _String_trimEnd() {
    let i = this.length-1;
    while (i > 0 && this[i] === ' ') {
      i -= 1;
    }
    return this.substr(0, i+1);
  });

  /* Ensure String.trim is present */
  polyfill(String.prototype, "trim", function _String_trim() {
    return this.trimStart().trimEnd();
  });

  /* Escape regex characters in a string */
  polyfill(RegExp, "escape", function _RegExp_escape(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

})(window);

/* Append one or more arrays, in-place */
Array.prototype.extend = function _Array_extend(...args) {
  for (let seq of args) {
    for (let i of seq) {
      this.push(i);
    }
  }
};

/* Obtain the maximal element from an array */
Array.prototype.max = function _Array_max(cmp) {
  let key = (x) => x;
  if (cmp instanceof Function || typeof(cmp) === "function") {
    key = cmp;
  }
  if (this.length === 0) { return; }
  if (this.length === 1) { return this[0]; }
  let max_value = null;
  let max_elem = null;
  for (let e of this) {
    let val = key(e);
    if (max_value === null || val > max_value) {
      max_elem = e;
      max_value = val;
    }
  }
  return max_elem;
};

/* Obtain the minimal element from an array */
Array.prototype.min = function _Array_min(cmp) {
  let key = (x) => x;
  if (cmp instanceof Function || typeof(cmp) === "function") {
    key = cmp;
  }
  if (this.length === 0) { return; }
  if (this.length === 1) { return this[0]; }
  let min_value = null;
  let min_elem = null;
  for (let e of this) {
    let val = key(e);
    if (min_value === null || val < min_value) {
      min_elem = e;
      min_value = val;
    }
  }
  return min_elem;
};

/* Construct an empty array with a specific number of entries */
Array.range = function _Array_range(nelem, dflt=null) {
  let a = [];
  for (let i = 0; i < nelem; ++i) a.push(dflt);
  return a;
};

/* Remove `chrs` from the beginning and end of the string */
String.prototype.strip = function _String_strip(chrs) {
  let chars = [];
  if (chrs && chrs.length > 0) {
    for (let c of chrs) {
      chars.push(c);
    }
  } else {
    chars = [' ', '\r', '\n'];
  }
  let si = 0;
  let ei = this.length - 1;
  while (si < this.length && chars.indexOf(this[si]) > -1) {
    si += 1;
  }
  while (ei > 0 && chars.indexOf(this[ei]) > -1) {
    ei -= 1;
  }
  return si < ei ? this.substring(si, ei+1) : "";
};

/* Escape a string for proper HTML printing */
String.prototype.escape = function _String_escape() {
  let result = this;
  result = result.replace(/&/g, '&amp;');
  result = result.replace(/</g, '&lt;');
  result = result.replace(/>/g, '&gt;');
  result = result.replace(/"/g, '&quot;');
  result = result.replace(/'/g, '&apos;');
  return result;
};

/* Implement Array.map for strings */
String.prototype.map = function _String_map(func) {
  let result = "";
  for (let ch of this) {
    result += func(ch);
  }
  return result;
};

/* Create function to compare two strings as lower-case */
String.prototype.equalsLowerCase = function _String_equalsLowerCase(str) {
  let s1 = this.toLowerCase();
  let s2 = str.toLowerCase();
  return s1 === s2;
};

/* Create function to compare two strings as upper-case */
String.prototype.equalsUpperCase = function _String_equalsUpperCase(str) {
  let s1 = this.toUpperCase();
  let s2 = str.toUpperCase();
  return s1 === s2;
};

/* Map the numeric transformation over the string's characters */
String.prototype.transform = function _String_transform(func) {
  let result = [];
  for (let ch of this) {
    result.push(String.fromCharCode(func(ch.charCodeAt(0))));
  }
  return result.join("");
};

/* Per-character XOR with the byte given  */
String.prototype.xor = function _String_xor(byte) {
  return this.transform((i) => i^byte);
};

/* Title-case a string (akin to Python's str.title function) */
String.prototype.toTitleCase = function _String_toTitleCase() {
  return this.replace(/\b[a-z]/g, (c) => c.toUpperCase());
};

/* Parse a number (calling Util.ParseNumber) */
Number.parse = function _Number_parse(str, base=10) {
  return Util.ParseNumber(str,base);
};

/* End standard object additions 0}}} */

/* Array and sequence functions {{{0 */

/* Return true if the object is an array */
Util.IsArray = function _Util_IsArray(value) {
  /* Values are considered "arrays" if value[Symbol.iterator] is a function
   * and that object is not a string */
  if (typeof(value) === "string") {
    return false;
  } else if (value && typeof(value[Symbol.iterator]) === "function") {
    return true;
  } else {
    return false;
  }
};

/* Zip two (or more) sequences together */
Util.Zip = function _Util_Zip(...sequences) {
  let curr = [];
  let max_len = 0;
  /* Make sure everything's an array, calculate the max length */
  for (let seq of sequences) {
    let seq_array = Array.from(seq);
    max_len = Math.max(seq_array.length, max_len);
    curr.push(seq_array);
  }
  /* Ensure all arrays have the same size */
  for (let seq of curr) {
    while (seq.length < max_len) {
      seq.push(null);
    }
  }
  let result = [];
  /* Perform the zip operation */
  for (let i = 0; i < max_len; ++i) {
    let row = Array.from(curr, () => null);
    for (let j = 0; j < curr.length; ++j) {
      row[j] = curr[j][i];
    }
    result.push(row);
  }
  /* And we're done */
  return result;
};

/* Convert an arguments object to an Array */
Util.ArgsToArray = function _Util_ArgsToArray(argobj) {
  return Array.of.apply(Array, argobj);
};

/* End array and sequence functions 0}}} */

/* URL handling {{{0 */

/* RegExp for matching URLs */
Util.URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

/* Ensure a URL is formatted properly */
Util.URL = function _Util_URL(url) {
  if (url.startsWith('//')) {
    let p = 'http:';
    if (window.location.protocol === "https:") {
      p = 'https:';
    }
    return p + url;
  } else if (!url.match(/^[\w-]+:/)) {
    if (window.location.protocol === "https:") {
      return "https://" + url;
    } else {
      return "http://" + url;
    }
  }
  return url;
};

/* Split a path into <dirname>/<basename> parts */
Util.SplitPath = function _Util_SplitPath(path) {
  if (path.indexOf('/') > -1) {
    return [path.substr(0, path.lastIndexOf('/')),
            path.substr(path.lastIndexOf('/')+1)];
  } else {
    return ["", path];
  }
};

/* Join a directory and a filename */
Util.JoinPath = function _Util_JoinPath(dir, file) {
  if (dir) {
    return [dir, file].join('/');
  } else {
    return file;
  }
};

/* Strip a common prefix from an array of paths */
Util.StripCommonPrefix = function _Util_StripCommonPrefix(paths) {
  let pieces = [];
  try {
    for (let path of paths) {
      path = (new URL(path)).pathname;
      let [dir, file] = Util.SplitPath(path);
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
  let ref_path = null;
  let len = 0;
  for (let piece of pieces) {
    if (piece[0].length > len) {
      len = piece[0].length;
      /* Copy to protect from modification below */
      ref_path = piece[0].slice(0);
    }
  }
  /* Strip the common prefix */
  if (ref_path !== null) {
    for (let i = 0; i < ref_path.length; ++i) {
      if (pieces.every((p) => (p[0][0] === ref_path[i]))) {
        for (let piece of pieces) {
          piece[0] = piece[0].slice(1);
        }
      }
    }
  }
  /* Join the paths back together */
  return pieces.map((v) => Util.JoinPath(v[0].join('/'), v[1]));
};

/* End URL handling 0}}} */

/* Error handling {{{0 */

Util.Throw = function _Util_Throw(type, msg) {
  let e = new (type)(msg + "\n" + Util.GetStack());
  e._stack_raw = e.stack;
  e._stack = Util.GetStack();
  e._stacktrace = Util.ParseStack(Util.GetStack()) || [];
  e._stacktrace.shift();
  throw e;
};

/* End error handling 0}}} */

/* Logging {{{0 */

Util.LEVEL_MIN = 0;
Util.LEVEL_OFF = Util.LEVEL_MIN;
Util.LEVEL_DEBUG = Util.LEVEL_OFF + 1;
Util.LEVEL_TRACE = Util.LEVEL_DEBUG + 1;
Util.LEVEL_MAX = Util.LEVEL_TRACE;
Util.DebugLevel = Util.LEVEL_OFF;
Util._stack_trim_level = [0];

/* Save the current top-stack trim level and push a new value to use */
Util.PushStackTrimBegin = function _Util_PushStackTrimBegin(level) {
  Util._stack_trim_level.push(level);
};

/* Restore the saved top-stack trim level */
Util.PopStackTrimBegin = function _Util_PopStackTrimBegin() {
  if (Util._stack_trim_level.length > 1) {
    Util._stack_trim_level.pop();
  }
};

/* Get the current top-stack trim level */
Util.GetStackTrimBegin = function _Util_GetStackTrimBegin() {
  return Util._stack_trim_level[Util._stack_trim_level.length-1];
};

/* Obtain a stacktrace, applying the current stack trim levels */
Util.GetStack = function _Util_GetStack() {
  let lines = [];
  try { throw new Error(); } catch (e) { lines = e.stack.trim().split("\n"); }
  lines.shift(); /* Discard _Util_GetStack */
  for (let i = 0; i < Util.GetStackTrimBegin(); ++i) {
    lines.shift();
  }
  return lines;
};

/* Parse a given stacktrace */
Util.ParseStack = function _Util_ParseStack(lines) {
  let frames = [];
  for (let line of lines) {
    let frame = {
      text: line,
      name: '???',
      file: window.location.pathname,
      line: 0,
      column: 0
    };
    frame.text = line;
    let m = null;
    if ((m = line.match(/^[ ]*at ([^ ]+)(?: \[as ([\w]+)\])? \((.*):([0-9]+):([0-9]+)\)$/)) !== null) {
      // Chrome: "[ ]+at (function)\( as \[(function)\]\)? \((file):(line):(column)"
      frame = {};
      frame.name = m[1];
      frame.actual_name = m[2];
      frame.file = m[3];
      frame.line = parseInt(m[4]);
      frame.column = parseInt(m[5]);
    } else if ((m = line.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/)) !== null) {
      // Firefox "(function)@(file):(line):(column)"
      frame = {};
      frame.name = m[1];
      frame.file = m[2];
      frame.line = parseInt(m[3]);
      frame.column = parseInt(m[4]);
    } else {
      /* OBS: /^[ ]*at ([^ ]+) \((.*):([0-9]+):([0-9]+)\)/ */
      /* TODO: OBS, Tesla stacktrace parsing */
    }
    frames.push(frame);
  }
  return frames;
};

/* Format stack frames for output */
Util.FormatStack = function _Util_FormatStack(stack) {
  /* Strip out the common prefix directory */
  let paths = [];
  for (let frame of stack) {
    paths.push(frame.file);
  }
  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length === paths.length);
  let result = [];
  for (let i = 0; i < paths.length; ++i) {
    if (stack[i].name === "???") {
      result.push(stack[i].text);
    } else {
      result.push(`${stack[i].name}@${paths[i]}:${stack[i].line}:${stack[i].column}`);
    }
  }
  return result.join("\n");
};

/* Logger object */
class LoggerUtility {
  constructor() {
    this._hooks = {};
    this._filters = {};
    this._logged_messages = {};
    for (let v of Object.values(LoggerUtility.SEVERITIES)) {
      this._hooks[v] = [];
      this._filters[v] = [];
    }
  }

  /* (internal) Output args to a console using the given func  */
  static _toConsole(func, args) {
    let stack = Util.ParseStack(Util.GetStack());
    stack.shift(); /* Discard _toConsole */
    stack.shift(); /* Discard _toConsole caller */
    console.group("From " + Util.FormatStack(stack));
    func.apply(console, args);
    console.groupEnd();
  }

  /* Map severity name to severity number */
  static get SEVERITIES() {
    return {ALL: 6, ERROR: 5, WARN: 4, INFO: 3, DEBUG: 2, TRACE: 1};
  }

  /* Map severity number to console function */
  static get FUNCTION_MAP() {
    let map = {};
    map[LoggerUtility.SEVERITIES.ALL] = console.debug;
    map[LoggerUtility.SEVERITIES.ERROR] = console.error;
    map[LoggerUtility.SEVERITIES.WARN] = console.warn;
    map[LoggerUtility.SEVERITIES.INFO] = console.log;
    map[LoggerUtility.SEVERITIES.DEBUG] = console.info;
    map[LoggerUtility.SEVERITIES.TRACE] = console.debug;
    return map;
  }

  /* Get the numeric value for the severity given */
  _sev_value(sev) {
    return LoggerUtility.SEVERITIES[sev];
  }

  /* Validate that the given severity exists */
  _assert_sev(sev) {
    if (!this._hooks.hasOwnProperty(this._sev_value(sev))) {
      console.error(`Logger: invalid severity ${sev}`);
      return false;
    }
    return true;
  }

  /* Hook function(sev, stacktrace, ...args) for the given severity */
  add_hook(fn, sev="ALL") {
    if (!this._assert_sev(sev)) { return false; }
    this._hooks[this._sev_value(sev)].push(fn);
    return true;
  }

  /* Add a filter function for the given severity. Messages returning `false`
   * will be shown; ones returning `true` will be filtered out.
   * Overloads:
   *   add_filter(function, sev="ALL")
   *     `function` will be called with one argument: [log_arg1, log_arg2, ...]
   *   add_filter(regex, sev="ALL")
   *     Filter if regex matches log_args.toString()
   *   add_filter(string, sev="ALL")
   *     Filter if log_args.toString().indexOf(string) > -1 */
  add_filter(filter_obj, sev="ALL") {
    if (!this._assert_sev(sev)) { return false; }
    let func = function _false() { return false; };
    if (filter_obj instanceof RegExp) {
      func = (args) => `${args}`.match(filter_obj);
    } else if (typeof(filter_obj) === "string") {
      func = (args) => `${args}`.indexOf(filter_obj) > -1;
    } else {
      func = filter_obj;
    }
    this._filters[this._sev_value(sev)].push(func);
  }

  /* Test whether the message is filtered */
  should_filter(message_args, severity) {
    let sev = this._sev_value(severity);
    for (let [key, filters] of Object.entries(this._filters)) {
      if (key >= sev) {
        for (let filter of filters) {
          if (filter(message_args)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /* Return whether or not the given severity is enabled */
  severity_enabled(sev) {
    if (!this._assert_sev(sev)) { return false; }
    let val = this._sev_value(sev);
    if (Util.DebugLevel === Util.LEVEL_TRACE) return true;
    if (Util.DebugLevel === Util.LEVEL_DEBUG) {
      return val >= LoggerUtility.SEVERITIES.DEBUG;
    }
    if (Util.DebugLevel === Util.LEVEL_OFF) {
      return val >= LoggerUtility.SEVERITIES.INFO;
    }
    return val >= LoggerUtility.SEVERITIES.WARN;
  }

  /* Log `argobj` with severity `sev`, optionally including a stacktrace */
  do_log(sev, argobj, stacktrace=false, log_once=false) {
    let val = this._sev_value(sev);
    if (!this.severity_enabled(sev)) { return; }
    if (this.should_filter(argobj, sev)) { return; }
    if (log_once) {
      let argstr = JSON.stringify(argobj);
      let msg_key = JSON.stringify([val, argstr]);
      if (this._logged_messages[msg_key]) {
        return;
      } else {
        this._logged_messages[msg_key] = 1;
      }
    }
    for (let hook of this._hooks[val]) {
      let args = [sev, stacktrace].concat(Util.ArgsToArray(argobj));
      hook.apply(hook, args);
    }
    let func = LoggerUtility.FUNCTION_MAP[val];
    if (stacktrace) {
      Util.PushStackTrimBegin(Math.max(Util.GetStackTrimBegin(), 1));
      LoggerUtility._toConsole(func, argobj);
      Util.PopStackTrimBegin();
    } else {
      func.apply(console, argobj);
    }
  }

  /* Convert the arguments given to a single string */
  stringify(...args) {
    let result = [];
    for (let arg of args) {
      if (arg === null) result.push("null");
      else if (typeof(arg) === "undefined") result.push("(undefined)");
      else if (typeof(arg) === "string") result.push(arg);
      else if (typeof(arg) === "number") result.push(`${arg}`);
      else if (typeof(arg) === "boolean") result.push(`${arg}`);
      else if (typeof(arg) === "symbol") result.push(arg.toString());
      else if (typeof(arg) === "function") {
        result.push(`${arg}`.replace(/\n/, "\\n"));
      } else {
        result.push(JSON.stringify(arg));
      }
    }
    return result.join(" ");
  }

  /* Log the arguments given with a stacktrace */
  Trace(...args) { this.do_log("TRACE", args, true, false); }
  Debug(...args) { this.do_log("DEBUG", args, true, false); }
  Info(...args) { this.do_log("INFO", args, true, false); }
  Warn(...args) { this.do_log("WARN", args, true, false); }
  Error(...args) { this.do_log("ERROR", args, true, false); }

  /* Log the arguments given without a stacktrace */
  TraceOnly(...args) { this.do_log("TRACE", args, false, false); }
  DebugOnly(...args) { this.do_log("DEBUG", args, false, false); }
  InfoOnly(...args) { this.do_log("INFO", args, false, false); }
  WarnOnly(...args) { this.do_log("WARN", args, false, false); }
  ErrorOnly(...args) { this.do_log("ERROR", args, false, false); }

  /* Log the arguments given with a stacktrace, once */
  TraceOnce(...args) { this.do_log("TRACE", args, true, true); }
  DebugOnce(...args) { this.do_log("DEBUG", args, true, true); }
  InfoOnce(...args) { this.do_log("INFO", args, true, true); }
  WarnOnce(...args) { this.do_log("WARN", args, true, true); }
  ErrorOnce(...args) { this.do_log("ERROR", args, true, true); }

  /* Log the arguments given without a stacktrace, once */
  TraceOnlyOnce(...args) { this.do_log("TRACE", args, false, true); }
  DebugOnlyOnce(...args) { this.do_log("DEBUG", args, false, true); }
  InfoOnlyOnce(...args) { this.do_log("INFO", args, false, true); }
  WarnOnlyOnce(...args) { this.do_log("WARN", args, false, true); }
  ErrorOnlyOnce(...args) { this.do_log("ERROR", args, false, true); }
}

/* Logger instance  */
Util.Logger = new LoggerUtility();

/* Log with stacktrace */
Util.Trace = Util.Logger.Trace.bind(Util.Logger);
Util.Debug = Util.Logger.Debug.bind(Util.Logger);
Util.Log = Util.Logger.Info.bind(Util.Logger);
Util.Info = Util.Logger.Info.bind(Util.Logger);
Util.Warn = Util.Logger.Warn.bind(Util.Logger);
Util.Error = Util.Logger.Error.bind(Util.Logger);

/* Log without stacktrace */
Util.TraceOnly = Util.Logger.TraceOnly.bind(Util.Logger);
Util.DebugOnly = Util.Logger.DebugOnly.bind(Util.Logger);
Util.LogOnly = Util.Logger.InfoOnly.bind(Util.Logger);
Util.InfoOnly = Util.Logger.InfoOnly.bind(Util.Logger);
Util.WarnOnly = Util.Logger.WarnOnly.bind(Util.Logger);
Util.ErrorOnly = Util.Logger.ErrorOnly.bind(Util.Logger);

/* Log once with stacktrace */
Util.TraceOnce = Util.Logger.TraceOnce.bind(Util.Logger);
Util.DebugOnce = Util.Logger.DebugOnce.bind(Util.Logger);
Util.LogOnce = Util.Logger.InfoOnce.bind(Util.Logger);
Util.InfoOnce = Util.Logger.InfoOnce.bind(Util.Logger);
Util.WarnOnce = Util.Logger.WarnOnce.bind(Util.Logger);
Util.ErrorOnce = Util.Logger.ErrorOnce.bind(Util.Logger);

/* Log once without stacktrace */
Util.TraceOnlyOnce = Util.Logger.TraceOnlyOnce.bind(Util.Logger);
Util.DebugOnlyOnce = Util.Logger.DebugOnlyOnce.bind(Util.Logger);
Util.LogOnlyOnce = Util.Logger.InfoOnlyOnce.bind(Util.Logger);
Util.InfoOnlyOnce = Util.Logger.InfoOnlyOnce.bind(Util.Logger);
Util.WarnOnlyOnce = Util.Logger.WarnOnlyOnce.bind(Util.Logger);
Util.ErrorOnlyOnce = Util.Logger.ErrorOnlyOnce.bind(Util.Logger);

/* End logging 0}}} */

/* Color handling {{{0 */

/* Store instance to active color parser */
Util._ColorParser = null;

/* Class for parsing colors */
class ColorParser {
  constructor() {
    this._cache = {};
    /* Create the color parser div */
    this._e = document.createElement('div');
    this._e.setAttribute("style", "position: absolute; z-index: -100");
    this._e.setAttribute("id", "color-parser-div");
    this._e.setAttribute("width", "0px");
    this._e.setAttribute("height", "0px");
    document.body.appendChild(this._e);
    /* Define parsing regexes */
    this._rgb_pat = /rgb\(([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+)\)/;
    this._rgba_pat = /rgba\(([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+)\)/;
  }

  _parse(color) {
    if (this._cache[color]) {
      return this._cache[color];
    }
    this._e.style.color = null;
    this._e.style.color = color;
    if (this._e.style.color.length === 0) {
      Util.Throw(TypeError, `ColorParser: Invalid color ${color}`);
    }
    let rgbstr = getComputedStyle(this._e).color;
    let rgbtuple = [];
    let m = this._rgb_pat.exec(rgbstr) || this._rgba_pat.exec(rgbstr);
    if (m !== null) {
      rgbtuple = m.slice(1);
    } else {
      /* Shouldn't ever happen unless getComputedStyle breaks */
      Util.Throw(`Failed to parse computed color ${rgbstr}`);
    }
    let r = Number(rgbtuple[0]); r = Number.isNaN(r) ? 0 : r;
    let g = Number(rgbtuple[1]); g = Number.isNaN(g) ? 0 : g;
    let b = Number(rgbtuple[2]); b = Number.isNaN(b) ? 0 : b;
    let res = [r, g, b];
    if (rgbtuple.length === 4 && rgbtuple[3]) {
      let a = Number(rgbtuple[3]); a = Number.isNaN(a) ? 0 : a;
      res.push(a);
    }
    this._cache[color] = res;
    return res;
  }

  static parse(color, failQuiet=false) {
    if (Util._ColorParser === null) {
      Util._ColorParser = new ColorParser();
    }
    try {
      return Util._ColorParser._parse(color);
    }
    catch (e) {
      if (failQuiet) {
        return null;
      } else {
        throw e;
      }
    }
  }
}

/* Class for handling colors and color arithmetic */
Util.Color = class _Util_Color {
  /* Convert (r, g, b) (0~255) to (h, s, l) (deg, 0~100, 0~100) */
  static RGBToHSL(r, g, b) {
    let [r0, g0, b0] = [r / 255, g / 255, b / 255];
    let max = Math.max(r0, g0, b0);
    let min = Math.min(r0, g0, b0);
    let d = max - min;
    let h = 0;
    if (d === 0) h = 0;
    else if (max === r0) h = (g0 - b0) / d % 6;
    else if (max === g0) h = (b0 - r0) / d + 2;
    else if (max === b0) h = (r0 - g0) / d + 4;
    let l = (min + max) / 2;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h * 60, s, l];
  }

  /* Convert (h, s, l) (deg, 0~100, 0~100) to (r, g, b) (0~255) */
  static HSLToRGB(h, s, l) {
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let hp = h / 60.0;
    let x = c * (1 - Math.abs((hp % 2) - 1));
    let rgb1 = [0, 0, 0];
    if (isNaN(h)) rgb1 = [0, 0, 0];
    else if (hp <= 1) rgb1 = [c, x, 0];
    else if (hp <= 2) rgb1 = [x, c, 0];
    else if (hp <= 3) rgb1 = [0, c, x];
    else if (hp <= 4) rgb1 = [0, x, c];
    else if (hp <= 5) rgb1 = [x, 0, c];
    else if (hp <= 6) rgb1 = [c, 0, x];
    let m = l - c * 0.5;
    let r = Math.round(255 * (rgb1[0] + m));
    let g = Math.round(255 * (rgb1[1] + m));
    let b = Math.round(255 * (rgb1[2] + m));
    return [r, g, b];
  }

  /* Convert (y, i, q) (0~255) to (r, g, b) (0~255) */
  static YIQToRGB(y, i, q) {
    let mat = [[1, 0.956, 0.619],
               [1, -0.272, -0.647],
               [1, -1.106, 1.703]];
    let r = mat[0][0] * y + mat[0][1] * i + mat[0][2] * q;
    let g = mat[1][0] * y + mat[1][1] * i + mat[1][2] * q;
    let b = mat[2][0] * y + mat[2][1] * i + mat[2][2] * q;
    return [r, g, b];
  }

  /* Convert (r, g, b) (0~255) to (y, i, q) (0~255) */
  static RGBToYIQ(r, g, b) {
    let mat = [[0.299, 0.587, 0.144],
               [0.5959, -0.2746, -0.3213],
               [0.2155, -0.5227, 0.3112]];
    let y = mat[0][0] * r + mat[0][1] * g + mat[0][2] * b;
    let i = mat[1][0] * r + mat[1][1] * g + mat[1][2] * b;
    let q = mat[2][0] * r + mat[2][1] * g + mat[2][2] * b;
    return [y, i, q];
  }

  /* Renormalize (r, g, b[, a]) from 0~1 to 0~255 */
  static Renorm1(...args) {
    let [r, g, b, a] = args;
    if (args.length < 4) {
      return [r / 255, g / 255, b / 255];
    } else {
      return [r / 255, g / 255, b / 255, a / 255];
    }
  }

  /* Renormalize (r, g, b[, a]) from 0~255 to 0~1 */
  static Renorm255(...args) {
    let [r, g, b, a] = args;
    if (args.length < 4) {
      return [r * 255, g * 255, b * 255];
    } else {
      return [r * 255, g * 255, b * 255, a * 255];
    }
  }

  /* Create a Color object from the hue, saturation, and luminance given */
  static FromHSL(h, s, l) {
    let [r, g, b] = Util.Color.HSLToRGB(h, s, l);
    return new Util.Color(r, g, b);
  }

  /* Create a Color object from the hue, saturation, luminance, and alpha given */
  static FromHSLA(h, s, l, a) {
    let [r, g, b] = Util.Color.HSLToRGB(h, s, l);
    return new Util.Color(r, g, b, a);
  }

  /* Create a Color object from the YIQ values given */
  static FromYIQ(y, i, q) {
    let [r, g, b] = Util.Color.YIQToRGB(y, i, q);
    return new Util.Color(r, g, b);
  }

  /* Overloads
   *  Color()
   *  Color(Color)
   *  Color(int, int, int)
   *  Color(int, int, int, int)
   *  Color(array)
   *  Color(string)
   */
  constructor(...argList) {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 255;
    let args = argList;
    /* Handle Color([...]) -> Color(...) */
    if (args.length === 1 && args[0] instanceof Array) {
      args = args[0];
    }
    if (args.length === 1) {
      /* Handle Color(Color) and Color("string") */
      let arg = args[0];
      if (arg instanceof Util.Color) {
        [this.r, this.g, this.b, this.a] = [arg.r, arg.g, arg.b, arg.a];
        this.scale = arg.scale;
      } else if (typeof(arg) === "string") {
        let [r, g, b, a] = ColorParser.parse(arg);
        [this.r, this.g, this.b, this.a] = [r, g, b, a];
      } else {
        Util.Throw(TypeError, `Invalid argument "${arg}" to Color()`);
      }
    } else if (args.length >= 3 && args.length <= 4) {
      /* Handle Color(r, g, b) and Color(r, g, b, a) */
      [this.r, this.g, this.b] = args;
      if (args.length === 4) this.a = args[3];
    } else if (args.length > 0) {
      Util.Throw(`Invalid arguments "${args}" to Color()`);
    }
  }

  /* Attribute: hex color code */
  get hex() {
    let r = this.r.toString(16).padStart(2, "0");
    let g = this.g.toString(16).padStart(2, "0");
    let b = this.b.toString(16).padStart(2, "0");
    let a = this.a !== 255 ? `${this.a}`.toString(16).padStart(2, "0") : "";
    return `#${r}${g}${b}${a}`;
  }

  /* Attribute: [r, g, b] */
  get rgb() { return [this.r, this.g, this.b]; }

  /* Attribute: [r, g, b, a] */
  get rgba() { return [this.r, this.g, this.b, this.a]; }

  /* Attribute: [r, g, b] scaled to [0,1] */
  get rgb_1() {
    let c = new Util.Color(this.r, this.g, this.b);
    return [c.r / 255, c.g / 255, c.b / 255];
  }

  /* Attribute: [r, g, b, a] scaled to [0,1] */
  get rgba_1() {
    let c = new Util.Color(this.r, this.g, this.b, this.a);
    return [c.r / 255, c.g / 255, c.b / 255, c.a / 255];
  }

  /* Attribute: [h, s, l] */
  get hsl() { return Util.Color.RGBToHSL(this.r, this.g, this.b); }
  set hsl(hsl) {
    let [h, s, l] = hsl;
    [this.r, this.g, this.b] = Util.Color.HSLToRGB(h, s, l);
  }

  /* Attribute: [h, s, l, a] */
  get hsla() {
    let [r, g, b] = Util.Color.RGBToHSL(this.r, this.g, this.b);
    return [r, g, b, this.a];
  }
  set hsla(hsla) {
    let [h, s, l, a] = hsla;
    [this.r, this.g, this.b] = Util.Color.HSLToRGB(h, s, l);
    this.a = a;
  }

  /* Attribute: hue of [h, s, l] */
  get hue() { return this.hsl[0]; }
  set hue(new_h) {
    let [h, s, l] = this.hsl;
    h = new_h;
    [this.r, this.g, this.b] = Util.Color.HSLToRGB(h, s, l);
  }

  /* Attribute: saturation of [h, s, l] */
  get saturation() { return this.hsl[1]; }
  set saturation(new_s) {
    let [h, s, l] = this.hsl;
    s = new_s;
    [this.r, this.g, this.b] = Util.Color.HSLToRGB(h, s, l);
  }

  /* Attribute: luminance of [h, s, l] */
  get luminance() { return this.hsl[2]; }
  set luminance(new_l) {
    let [h, s, l] = this.hsl;
    l = new_l;
    [this.r, this.g, this.b] = Util.Color.HSLToRGB(h, s, l);
  }

  /* Attribute: [y, i, q] */
  get yiq() { return Util.Color.RGBToYIQ(this.r, this.g, this.b); }
  set yiq(yiq) {
    let [y, i, q] = yiq;
    [this.r, this.g, this.b] = Util.Color.YIQToRGB(y, i, q);
  }

  /* Calculate the Relative Luminance */
  getRelativeLuminance() {
    let [r, g, b] = this.rgb_1;
    function c2cx(c) {
      if (c < 0.03928) {
        return c / 12.92;
      } else {
        return Math.pow((c + 0.055) / 1.055, 2.4);
      }
    }
    return 0.2126 * c2cx(r) + 0.7152 * c2cx(g) + 0.0722 * c2cx(b);
  }

  /* Calculate the contrast ratio against the given color */
  getConstrastRatioWith(c2) {
    let l1 = this.getRelativeLuminance();
    let l2 = (new Util.Color(c2)).getRelativeLuminance();
    return (l1 + 0.05) / (l2 + 0.05);
  }

  /* Return a color with inverted RGB values */
  inverted() {
    return new Util.Color(255 - this.r, 255 - this.g, 255 - this.b);
  }

  /* Testcases:
   *  Color classes:
   *    Pure: 000, F00, 0F0, 00F, FF0, F0F, 0FF, FFF
   *    Named CSS1:
   *      maroon, red, purple, fuchsia, green, lime
   *      olive, yellow, navy, blue, teal, aqua
   *    Named CSS2:
   *      orange
   *    Named CSS3:
   *    Named CSS4:
   *      rebeccapurple
   *  Case 1:
   *    rgb1 -> hsl -> rgb2 => rgb1 === rgb2
   *  Case 2:
   *    rgba1 -> hsla -> rgba2 => rgba1 === rgba2
   *  "#ff0000" -> hsl -> "#ff0000"
   */
};

/* Calculate the Relative Luminance of a color.
 * Overloads:
 *  Util.RelativeLuminance('css color spec')
 *  Util.RelativeLuminance([r, g, b])
 *  Util.RelativeLuminance([r, g, b, a])
 *  Util.RelativeLuminance(r, g, b[, a]) */
Util.RelativeLuminance = function _Util_RelativeLuminance(...args) {
  let color = ColorParser.parse(args.length === 1 ? args[0] : args);
  let color_rgb = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0];
  function c2cx(c) {
    if (c < 0.03928) {
      return c / 12.92;
    } else {
      return Math.pow((c + 0.055) / 1.055, 2.4);
    }
  }
  let l_red = 0.2126 * c2cx(color_rgb[0]);
  let l_green = 0.7152 * c2cx(color_rgb[1]);
  let l_blue = 0.0722 * c2cx(color_rgb[2]);
  return l_red + l_green + l_blue;
};

/* Calculate the Contrast Ratio between two colors */
Util.ContrastRatio = function _Util_ContrastRatio(c1, c2) {
  let l1 = Util.RelativeLuminance(c1);
  let l2 = Util.RelativeLuminance(c2);
  return (l1 < l2 ? (l2 + 0.05) / (l1 + 0.05) : (l1 + 0.05) / (l2 + 0.05));
};

/* Determine which color contrasts the best with the given color
 * Overloads:
 *  Util.GetMaxContrast(color, c1, c2, c3, ...)
 *  Util.GetMaxContrast(color, [c1, c2, c3, ...]) */
Util.GetMaxContrast = function _Util_GetMaxContrast(c1, ...colors) {
  let best_color = null;
  let best_contrast = null;
  let clist = colors;
  if (colors.length === 1 && Util.IsArray(colors[0])) {
    clist = colors[0];
  }
  for (let c of clist) {
    let contrast = Util.ContrastRatio(c1, c);
    if (best_color === null) {
      best_color = c;
      best_contrast = contrast;
    } else if (contrast > best_contrast) {
      best_color = c;
      best_contrast = contrast;
    }
  }
  return best_color;
};

/* End color handling 0}}} */

/* PRNG (Pseudo-Random Number Generator) {{{0 */

Util.RandomGenerator = class _Util_Random {
  constructor(disable_crypto) {
    this._crypto = null;
    if (disable_crypto) {
      Util.Warn("Forcibly disabling crypto");
    } else {
      this._crypto = this._getCrypto();
    }
  }

  _getCrypto() {
    if (Util.Defined("crypto")) {
      if ((new Function("return crypto.getRandomValues"))()) {
        return (new Function("return crypto"))();
      }
    }
    if (Util.Defined("msCrypto")) {
      return (new Function("return msCrypto"))();
    }
    Util.Error("Failed to get secure PRNG; falling back to Math.random");
    return null;
  }

  /* Obtain Uint8Array of random values using crypto */
  _genRandCrypto(num_bytes) {
    let a = new Uint8Array(num_bytes);
    this._crypto.getRandomValues(a);
    return a;
  }

  /* Obtain Uint8Array of random values using Math.random */
  _genRandMath(num_bytes) {
    let a = new Uint8Array(num_bytes);
    let r = 0;
    for (let i = 0; i < num_bytes; ++i) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      a[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }
    return a;
  }

  /* Convenience function: sprintf %02x */
  numToHex(num, pad=2) {
    return num.toString("16").padStart(pad, "0");
  }

  /* Convenience function: "hexlify" string */
  bytesToHex(bytes) {
    let h = "";
    for (let byte of bytes) { h += this.numToHex(byte); }
    return h;
  }

  /* Generate a sequence of random bytes. Encoding is either hex or
   * none (default) */
  randBytes(num_bytes, encoding=null) {
    let values;
    if (this._crypto !== null) {
      values = this._genRandCrypto(num_bytes);
    } else {
      values = this._genRandMath(num_bytes);
    }
    if (encoding === "hex") {
      return this.bytesToHex(values);
    } else {
      return values;
    }
  }

  /* Return 8, 16, 32, or 64 random bits, as a hex string */
  hex8() { return this.randBytes(1, 'hex'); }
  hex16() { return this.randBytes(2, 'hex'); }
  hex32() { return this.randBytes(4, 'hex'); }
  hex64() { return this.randBytes(8, 'hex'); }

  /* Generate a random UUID */
  uuid() {
    let a = this.randBytes(16);
    a[6] = (a[6] & 0x0f) | 0x40;
    a[8] = (a[8] & 0x3f) | 0x80;
    let h = this.bytesToHex(a);
    let parts = [[0, 8], [8, 4], [12, 4], [16, 4], [20, 12]];
    let result = [];
    parts.forEach(([s, l]) => result.push(h.substr(s, l)));
    return result.join("-");
  }
};

Util.Random = new Util.RandomGenerator();

/* End PRNG 0}}} */

/* Event handling {{{0 */

Util._events = {};
Util._events_default = null;

/* Bind a function to an event by name */
Util.Bind = function _Util_Bind(name, callback) {
  if (!Util._events[name]) Util._events[name] = [];
  Util._events[name].push(callback);
};

/* Call a function if an event is unbound */
Util.BindDefault = function _Util_BindDefault(callback) {
  Util._events_default = callback;
};

/* Unbind a callback from an event */
Util.Unbind = function _Util_Unbind(name, callback) {
  if (Util._events[name]) {
    if (Util._events[name].indexOf(callback) > -1) {
      Util._events[name] = Util._events[name].filter((e) => e !== callback);
      return true;
    }
  }
  return false;
};

/* Fire an event: dispatchEvent with a _stacktrace attribute  */
Util.FireEvent = function _Util_FireEvent(e) {
  let fired = false;
  /* Add a stacktrace to the event for debugging reasons */
  e._stacktrace = Util.ParseStack(Util.GetStack());
  /* Discard the Util.FireEvent stack frame */
  e._stacktrace.shift();
  /* Fire the event across all the bound functions */
  if (Util._events[e.type]) {
    for (let f of Util._events[e.type]) {
      f(e);
    }
    fired = true;
  }
  /* Allow overloading of Event objects */
  if (e instanceof Event) {
    document.dispatchEvent(e);
    fired = true;
  }
  if (!fired && Util._events_default) {
    Util._events_default(e);
  }
};

/* End event handling 0}}} */

/* Parsing, formatting, escaping, and string functions {{{0 */

/* Return whether or not a string is a number */
Util.IsNumber = function _Util_IsNumber(str) {
  let temp = Util.ParseNumber(str);
  return typeof(temp) === "number" && !Number.isNaN(temp);
};

/* Parse a number */
Util.ParseNumber = function _Util_ParseNumber(str, base=10) {
  const validBases = [2, 8, 10, 16];
  if (validBases.indexOf(base) === -1) {
    throw new Error(`Invalid base ${base}; expected one of [2, 8, 10, 16]`);
  }
  if (str === "null") {
    /* Technically not a number, but parse anyway */
    return null;
  } else if (str === "true" || str === "false") {
    /* Technically not a number, but parse anyway */
    return Boolean(str);
  } else if (str === "Infinity") {
    return Infinity;
  } else if (str === "-Infinity") {
    return -Infinity;
  } else if (str === "NaN") {
    return NaN;
  } else if (str.match(/^\d*\.\d+(?:e\d+)?$/)) {
    return Number.parseFloat(str);
  } else if (base === 2 && str.match(/^[+-]?[01]+$/)) {
    return Number.parseInt(str, 2);
  } else if (base === 8 && str.match(/^[+-]?[0-7]+$/)) {
    return Number.parseInt(str, 8);
  } else if (base === 10 && str.match(/^[+-]?(?:0|(?:[1-9]\d*))$/)) {
    return Number.parseInt(str, 10);
  } else if (base === 16 && str.match(/^[+-]?0[Xx][0-9a-fA-F]+$/)) {
    return Number.parseInt(str, 16);
  } else {
    /* Failed to parse */
    return NaN;
  }
};

/* Escape the string and return a map of character movements */
Util.EscapeWithMap = function _Util_EscapeWithMap(s) {
  let result = "";
  let map = [];
  let i = 0, j = 0;
  while (i < s.length) {
    map.push(j);
    let r = s[i];
    if (Util.EscapeChars.hasOwnProperty(s[i])) {
      r = Util.EscapeChars[s[i]];
    }
    result = result + r;
    i += 1;
    j += r.length;
  }
  return [result, map];
};

/* Number formatting */
Util.Pad = function _Util_Pad(n, digits, padChr="0") {
  return `${n}`.padStart(digits, padChr);
};

/* Convert a string to an array of character codes */
Util.StringToCodes = function _Util_StringToCodes(str) {
  let result = [];
  for (let i = 0; i < str.length; ++i) {
    result.push(str.charCodeAt(i));
  }
  return result;
};

/* Format a date object to "%Y-%m-%d %H:%M:%S.<ms>" */
Util.FormatDate = function _Util_FormatDate(date) {
  let pad2 = (n) => Util.Pad(n, 2);
  let [y, m, d] = [date.getFullYear(), date.getMonth(), date.getDay()];
  let [h, mi, s] = [date.getHours(), date.getMinutes(), date.getSeconds()];
  let ms = date.getMilliseconds();
  let ymd = `${y}-${pad2(m)}-${pad2(d)}`;
  let hms = `${pad2(h)}:${pad2(mi)}:${pad2(s)}.${Util.Pad(ms, 3)}`;
  return `${ymd} ${hms}`;
};

/* Format an interval in seconds to "Xh Ym Zs" */
Util.FormatInterval = function _Util_FormatInterval(seconds) {
  let parts = [];
  let time = Math.round(seconds);
  if (time < 0) {
    parts.push('-');
    time *= -1;
  }
  if (time % 60 !== 0) {
    parts.unshift(`${time % 60}s`);
  }
  time = Math.floor(time / 60);
  if (time > 0) {
    if (time % 60 !== 0) {
      parts.unshift(`${time % 60}m`);
    }
    time = Math.floor(time / 60);
  }
  if (time > 0) {
    parts.unshift(`${time}h`);
  }
  return parts.join(" ");
};

/* Decode flags ("0101" or "5d" little endian) into an array of bits */
Util.DecodeFlags = function _Util_DecodeFlags(f, nbits=null) {
  let bits = [];
  if (f.match(/^[01]+$/)) {
    for (let c of f) {
      bits.push(c === "1");
    }
  } else if (f.match(/^[1-9][0-9]*d$/)) {
    let num = Number.parseInt(f.substr(0, f.length-1));
    for (let n = 0; (1 << n) < num; ++n) {
      bits.push(((1 << n) & num) !== 0);
    }
  }
  if (nbits !== null) {
    while (bits.length < nbits) {
      bits.push(false);
    }
  }
  return bits;
};

/* Encode an array of bits into a flag string ("0101") */
Util.EncodeFlags = function _Util_EncodeFlags(bits) {
  return bits.map((b) => (b ? "1" : "0")).join("");
};

/* Build a character escape sequence for the character given */
Util.EscapeCharCode = function _Util_EscapeCharCode(char) {
  // Handle certain special escape sequences
  if (Util.StringEscapeChars.hasOwnProperty(char)) {
    return `\\${Util.StringEscapeChars[char]}`;
  } else {
    return `\\x${char.toString(16).padStart(2, '0')}`;
  }
};

/* Strip escape characters from a string */
Util.EscapeSlashes = function _Util_EscapeSlashes(str) {
  let result = "";
  for (let [cn, ch] of Util.Zip(Util.StringToCodes(str), str)) {
    if (cn < 0x20) {
      result = result.concat(Util.EscapeCharCode(cn));
    } else if (ch === '\\') {
      result = result.concat('\\\\');
    } else {
      result = result.concat(ch);
    }
  }
  return result;
};

/* Clone an object using JSON */
Util.JSONClone = function _Util_JSONClone(obj, opts=null) {
  let result = {};
  if (opts) {
    for (let [k, v] of Object.entries(obj)) {
      if (Util.IsArray(opts.exclude) && opts.exclude.indexOf(k) > -1) {
        continue;
      }
      result[k] = JSON.parse(JSON.stringify(v));
    }
    return result;
  } else {
    return JSON.parse(JSON.stringify(obj));
  }
};

/* End parsing, formatting, escaping, and string functions 0}}} */

/* Configuration and localStorage functions {{{0 */

Util._ws_enabled = true;

/* Obtain the configured localStorage key */
Util.GetWebStorageKey = function _Util_GetWebStorageKey() {
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
  } else {
    if (Util.__wskey !== null) {
      return Util.__wskey;
    }
    let key = JSON.parse(window.localStorage.getItem(Util.__wscfg));
    return key; /* may be null */
  }
};

/* Select the localStorage key to use */
Util.SetWebStorageKey = function _Util_SetWebStorageKey(key) {
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
  } else {
    Util.__wskey = key;
    window.localStorage.setItem(Util.__wscfg, JSON.stringify(key));
  }
};

/* Get and decode value, using either the configured key or the one given */
Util.GetWebStorage = function _Util_GetWebStorage(...args) {
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
    return {};
  }
  let key = null;
  let opts = {};
  if (args.length === 1) {
    if (typeof(args[0]) === "string") {
      key = args[0];
    } else {
      opts = args[0];
    }
  } else if (args.length >= 2) {
    key = args[0];
    opts = args[1];
  }
  if (key === null) {
    key = Util.GetWebStorageKey();
  }
  if (!key) {
    Util.Error("Util.GetWebStorage called without a key configured");
  } else {
    let v = window.localStorage.getItem(key);
    if (v === null) return null;
    if (v === "") return "";
    return Util.StorageParse(v, opts);
  }
};

/* JSON encode and store a localStorage value
 * Overloads:
 *  SetWebStorage(value)
 *  SetWebStorage(key, value)
 *  SetWebStorage(key, value, opts)
 *  SetWebStorage(null, value, opts)
 */
Util.SetWebStorage = function _Util_SetWebStorage(...args) {
  let key = null;
  let value = null;
  let opts = {};
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
  }
  if (args.length === 1) {
    key = Util.GetWebStorageKey();
    value = args[0];
  } else if (args.length === 2) {
    key = args[0] === null ? Util.GetWebStorageKey() : args[0];
    value = args[1];
  } else if (args.length === 3) {
    key = args[0] === null ? Util.GetWebStorageKey() : args[0];
    value = args[1];
    opts = args[2];
  }
  if (key === null) {
    Util.Error("Util.SetWebStorage called without a key configured");
  } else {
    window.localStorage.setItem(key, Util.StorageFormat(value, opts));
  }
};

/* Append a value to the given localStorage key */
Util.StorageAppend = function _Util_StorageAppend(key, value) {
  let v = Util.GetWebStorage(key);
  let new_v = [];
  if (v === null) {
    new_v = [value];
  } else if (!Util.IsArray(v)) {
    new_v = [v, value];
  } else {
    new_v = v;
    new_v.push(value);
  }
  Util.SetWebStorage(key, new_v);
};

/* Parse a raw localStorage string using the options given */
Util.StorageParse = function _Util_StorageParse(s, opts=null) {
  let str = s;
  let use_json = true;
  if (Util.IsArray(opts)) {
    for (let o of opts) {
      if (o === "b64") str = window.atob(str);
      if (o === "xor") str = str.xor(127);
      if (o === "bs") str = str.transform((i) => (i&15)*16+(i&240)/16);
      if (o.match(/^x[1-9][0-9]*/)) str = str.xor(Number(o.substr(1)));
      if (typeof(o) === "function") str = o(str);
      if (o === "nojson") use_json = false;
    }
  }
  return use_json ? JSON.parse(str) : str;
};

/* Format an object for storing into localStorage */
Util.StorageFormat = function _Util_StorageFormat(obj, opts=null) {
  let s = JSON.stringify(obj);
  if (Util.IsArray(opts)) {
    for (let o of opts) {
      if (o === "b64") s = window.btoa(s);
      if (o === "xor") s = s.xor(127);
      if (o === "bs") s = s.transform((i) => (i&15)*16+(i&240)/16);
      if (o.match(/^x[1-9][0-9]*/)) s = s.xor(Number(o.substr(1)));
      if (typeof(o) === "function") s = o(s);
    }
  }
  return s;
};

/* Disables localStorage suppport entirely */
Util.DisableLocalStorage = function _Util_DisableLocalStorage() {
  Util._ws_enabled = false;
  function wsapiWrap(f) {
    Util.Warn("Function is disabled", f);
    return null;
  }
  Util.GetWebStorageKey = wsapiWrap(Util.GetWebStorageKey);
  Util.SetWebStorageKey = wsapiWrap(Util.SetWebStorageKey);
  Util.GetWebStorage = wsapiWrap(Util.GetWebStorage);
  Util.SetWebStorage = wsapiWrap(Util.SetWebStorage);
  Util.StorageAppend = wsapiWrap(Util.StorageAppend);
  Util.StorageParse = wsapiWrap(Util.StorageParse);
  Util.StorageFormat = wsapiWrap(Util.StorageFormat);
};

/* End configuration and localStorage functions 0}}} */

/* Query String handling {{{0 */

/* Parse a query string (with leading ? omitted) with the following rules:
 *  `base64=<value>` results in <value> being Base64 decoded and appended
 *    to the rest of the values.
 *  `key` gives {key: true}
 *  `key=` gives {key: false}
 *  `key=true` gives {key: true}
 *  `key=false` gives {key: false}
 *  `key=1` gives {key: 1} for any integer value
 *  `key=1.0` gives {key: 1.0} for any floating-point value
 *  `key=null` gives {key: null}
 */
Util.ParseQueryString = function _Util_ParseQueryString(queryString=null) {
  let obj = {};
  let split = (part) => {
    if (part.indexOf('=') !== -1) {
      return [
        part.substr(0, part.indexOf('=')),
        decodeURIComponent(part.substr(part.indexOf('=') + 1))
      ];
    } else {
      return [part, "true"];
    }
  };
  let query = (queryString || window.location.search).replace(/^\?/, "");
  for (let part of query.split('&')) {
    let [k, v] = split(part);
    if (k === "base64") {
      let val = split(part)[1];
      for (let [k2, v2] of Object.entries(Util.ParseQueryString(atob(val)))) {
        obj[k2] = v2;
      }
    } else if (v.length === 0) {
      obj[k] = false;
    } else if (v === "true" || v === "false") {
      obj[k] = Boolean(v);
    } else if (v === "null") {
      obj[k] = null;
    } else if (Util.IsNumber(v)) {
      obj[k] = Number.parse(v);
    } else {
      obj[k] = v;
    }
  }
  return obj;
};

/* Format a query string (including leading "?") */
Util.FormatQueryString = function _Util_FormatQueryString(query) {
  let parts = [];
  for (let [k, v] of Object.entries(query)) {
    let key = encodeURIComponent(k);
    let val = encodeURIComponent(v);
    parts.push(`${key}=${val}`);
  }
  return "?" + parts.join("&");
};

/* End query string handling 0}}} */

/* Point-box functions {{{0 */

/* Return whether or not the position is inside the box */
Util.BoxContains = function _Util_BoxContains(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
};

/* Return whether or not the position is inside the given DOMRect */
Util.RectContains = function _Util_RectContains(x, y, rect) {
  return Util.BoxContains(x, y, rect.left, rect.top, rect.right, rect.bottom);
};

/* Return whether or not the position is over the HTML element */
Util.PointIsOn = function _Util_PointIsOn(x, y, elem) {
  if (elem && elem.jquery) {
    for (let e of elem) {
      if (Util.PointIsOn(x, y, e)) {
        return true;
      }
    }
  } else {
    let rects = elem.getClientRects();
    for (let rect of rects) {
      if (Util.RectContains(x, y, rect)) {
        return true;
      }
    }
  }
  return false;
};

/* End point-box functions 0}}} */

/* CSS functions {{{0 */

Util.CSS = {};

/* Get a stylesheet by filename or partial pathname */
Util.CSS.GetSheet = function _Util_CSS_GetSheet(filename) {
  for (let ss of document.styleSheets) {
    if (ss.href.endsWith(`/${filename.replace(/^\//, "")}`)) {
      return ss;
    }
  }
  return null;
};

/* Given a stylesheet, obtain a rule definition by name */
Util.CSS.GetRule = function _Util_CSS_GetRule(css, rule_name) {
  for (let rule of css.cssRules) {
    if (rule.selectorText === rule_name) {
      return rule;
    }
  }
  return null;
};

/* Given a rule, enumerate the defined properties' names */
Util.CSS.GetPropertyNames = function _Util_CSS_GetPropertyNames(rule) {
  let styles = [];
  for (let i = 0; rule.style[i]; ++i) {
    styles.push(rule.style[i]);
  }
  return styles;
};

/* Obtain the value of the given property
 * Overloads
 *  Util.CSS.GetProperty(prop)
 *  Util.CSS.GetProperty(elem, prop) */
Util.CSS.GetProperty = function _Util_CSS_GetProperty(...args) {
  let e = document.documentElement;
  let p = args[0];
  if (args.length > 1) {
    e = args[0];
    p = args[1];
  }
  return getComputedStyle(e).getPropertyValue(p).trim();
};

/* Set the property to the value giveni
 * Overloads
 *  Util.CSS.SetProperty(prop, value)
 *  Util.CSS.SetProperty(elem, prop, value) */
Util.CSS.SetProperty = function _Util_CSS_SetProperty(...args) {
  let e = document.documentElement;
  let p = args[0];
  let v = args[1];
  if (args.length > 2) {
    e = args[0];
    p = args[1];
    v = args[2];
  }
  e.style.setProperty(p, v);
};

/* End CSS functions 0}}} */

/* DOM functions {{{0 */

/* Convert a string, number, boolean, URL, or Element to an Element */
Util.CreateNode = function _Util_CreateNode(obj) {
  if (obj instanceof Element) {
    return obj;
  } else if (["string", "number", "boolean"].indexOf(typeof(obj)) > -1) {
    return new Text(`${obj}`);
  } else if (obj instanceof URL) {
    let a = document.createElement('a');
    a.setAttribute("href", obj.href);
    a.setAttribute("target", "_blank");
    a.textContent = obj.href;
    return a;
  } else {
    Util.Warn("Not sure how to create a node from", obj);
    return new Text(JSON.stringify(obj));
  }
};

/* Ensure the absolute offset displays entirely on-screen */
Util.ClampToScreen = function _Util_ClampToScreen(offset) {
  offset.left = Math.clamp(offset.left, 0, window.innerWidth - offset.width);
  offset.top = Math.clamp(offset.top, 0, window.innerHeight - offset.height);
  return {top: offset.top, left: offset.left};
};

/* End DOM functions 0}}} */

/* Miscellaneous functions {{{0 */

/* Wrap window.open */
Util.Open = function _Util_Open(url, id, attrs) {
  let a = [];
  for (let [k, v] of Object.entries(attrs)) {
    a.push(`${k}=${v}`);
  }
  return window.open(url, id, a.join(","));
};

/* Get a value from an object by path: "key1.key2" -> o[key1][key2] */
Util.ObjectGet = function _Util_ObjectGet(obj, path) {
  let items = path.split(".");
  let cobj = obj;
  while (items.length > 0) {
    if (cobj.hasOwnProperty(items[0])) {
      cobj = cobj[items.shift()];
    } else {
      Util.Error("Object", cobj, "lacks property", items[0]);
      return null;
    }
  }
  return cobj;
};

/* Set an object's value by path: "key1.key2" -> o[key1][key2] */
Util.ObjectSet = function _Util_ObjectSet(obj, path, value) {
  let items = path.split(".");
  let cobj = obj;
  while (items.length > 1) {
    if (cobj.hasOwnProperty(items[0])) {
      cobj = cobj[items.shift()];
    } else {
      Util.Error("Object", cobj, "lacks property", items[0]);
      return null;
    }
  }
  cobj[items[0]] = value;
};

/* Return whether or not an object contains the given path */
Util.ObjectHas = function _Util_ObjectHas(obj, path) {
  let items = path.split(".");
  let cobj = obj;
  while (items.length > 0) {
    if (cobj.hasOwnProperty(items[0])) {
      cobj = cobj[items.shift()];
    } else {
      return false;
    }
  }
  return true;
};

/* Return the (first level) differences between two objects
 *  [<status>, <o1 value>, <o2 value>]
 *  "type": o1 value and o2 value differ in type
 *  "value": o1 value and o2 value differ
 *  "<": o1 key exists but o2 key does not: o2 value is null
 *  ">": o1 key does not exist but o2 key does: o1 value is null */
Util.ObjectDiff = function _Util_ObjectDiff(o1, o2) {
  let all_keys = Object.keys(o1).concat(Object.keys(o2));
  let results = {};
  for (let key of all_keys) {
    let o1_has = Util.ObjectHas(o1, key);
    let o2_has = Util.ObjectHas(o2, key);
    if (o1_has && o2_has) {
      if (o1[key] !== o2[key]) {
        results[key] = ["value", o1[key], o2[key]];
      } else if (typeof(o1[key]) !== typeof(o2[key])) {
        results[key] = ["type", o1[key], o2[key]];
      } else if (typeof(o1[key]) === "object") {
        let o1_val = JSON.stringify(Object.entries(o1[key]).sort());
        let o2_val = JSON.stringify(Object.entries(o2[key]).sort());
        if (o1_val !== o2_val) {
          results[key] = ["value", o1[key], o2[key]];
        }
      }
    } else if (o1_has && !o2_has) {
      results[key] = ["<", o1[key], null];
    } else if (!o1_has && o2_has) {
      results[key] = [">", null, o2[key]];
    }
  }
  return results;
};

/* Convert a CSS2Properties value (getComputedStyle) to an object */
Util.StyleToObject = function _Util_StyleToObject(style) {
  let result = {};
  for (let key of Object.values(style)) {
    result[key] = style[key];
  }
  return result;
};

/* End miscellaneous functions 0}}} */

