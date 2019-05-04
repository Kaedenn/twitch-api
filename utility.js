"use strict";

/** Generic Utility-ish Functions for the Twitch Chat API
 *
 * Provides the following APIs, among others:
 *
 * Extensions to the standard JavaScript classes (String, Array)
 * Logging functions including stack-trace handling
 * Functions for color arithmetic
 * An "improved" random number generator
 * Shortcut functions for a number of trivial tasks (fireEvent, formatting)
 * Functions for localStorage management
 * Functions for point-in-box calculation
 * Functions for handling location.search (query string) management
 * Functions for generating version 4 (random) UUIDs
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

/* TODO:
 * Color replacement API (see KapChat)
 */

/* General Utilities */
let Util = {};
Util.__wskey = null;
Util.__wscfg = "kae-twapi-local-key";

/* Everyone needs an ASCII table */
Util.ASCII = "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n" +
             "\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014" +
             "\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d" +
             "\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJK" +
             "LMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u007f";

/* RegExp for matching URLs */
Util.URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

/* Browser identification {{{0 */

Util.Browser = {};
Util.Browser.FIREFOX = "Firefox";
Util.Browser.CHROME = "Chrome";
Util.Browser.TESLA = "Tesla";
Util.Browser.OBS = "OBS";
Util.Browser.UNKNOWN = "Unknown";
Util.Browser.Get = function _Util_Browser_Get() {
  let p_firefox = /\bFirefox\/[0-9.]+\b/;
  let p_chrome = /\bChrome\/[0-9.]+\b/;
  let p_tesla = /\bTesla\b/;
  if (navigator.userAgent.match(p_firefox)) {
    return Util.Browser.FIREFOX;
  } else if (navigator.userAgent.match(p_chrome)) {
    return Util.Browser.CHROME;
  } else if (navigator.userAgent.match(p_tesla)) {
    return Util.Browser.TESLA;
  } else if (!!window.obssource) {
    return Util.Browser.OBS;
  } else {
    return Util.Browser.UNKNOWN;
  }
}
Util.Browser.Current = Util.Browser.Get()
Util.Browser.IsChrome = Util.Browser.Current == Util.Browser.CHROME;
Util.Browser.IsFirefox = Util.Browser.Current == Util.Browser.FIREFOX;
Util.Browser.IsTesla = Util.Browser.Current == Util.Browser.TESLA;
Util.Browser.IsOBS = Util.Browser.Current == Util.Browser.OBS;

/* End of browser identification 0}}} */

/* Escape characters */
Util.EscapeChars = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "&": "&amp;"
};

/* Standard object (Math, Array, String, RegExp) additions {{{0 */

/* Calculates the divmod of the values given */
Math.divmod = function _Math_divmod(n, r) {
  return [n / r, n % r];
}

/* Return true if any of the values satisfy the function given */
Array.prototype.any = function _Array_any(func) {
  if (!func) func = (function _bool(x) { !!x; });
  for (let e of this) {
    if (func(e)) {
      return true;
    }
  }
  return false;
}

/* Return true if all of the values satisfy the function given */
Array.prototype.all = function _Array_all(func) {
  if (!func) func = (function _bool(x) { !!x; });
  for (let e of this) {
    if (!func(e)) {
      return false;
    }
  }
  return true;
}

/* Obtain the maximal element from an array */
Array.prototype.max = function __Array_max(cmp) {
  if (!(cmp instanceof Function)) { cmp = ((x) => x); }
  if (this.length == 0) { return undefined; }
  if (this.length == 1) { return this[0]; }
  let max_value = cmp(this[0]);
  let max_elem = this[0];
  for (let e of this) {
    if (cmp(e) > max_value) {
      max_elem = e;
      max_value = cmp(e);
    }
  }
  return max_elem;
}

/* Obtain the minimal element from an array */
Array.prototype.min = function __Array_min(cmp) {
  if (!(cmp instanceof Function)) { cmp = ((x) => x); }
  if (this.length == 0) { return undefined; }
  if (this.length == 1) { return this[0]; }
  let min_value = cmp(this[0]);
  let min_elem = this[0];
  for (let e of this) {
    if (cmp(e) < min_value) {
      min_elem = e;
      min_value = cmp(e);
    }
  }
  return min_elem;
}

/* Strip characters from left (pos) or right (neg) */
String.prototype._stripFrom = function _String__stripFrom(chrs, from) {
  let d = (from > 0 ? 1 : -1);
  let i = (from > 0 ? 0 : this.length - 1);
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
  let result = this;
  result = result.replace(/&/g, '&amp;');
  result = result.replace(/</g, '&lt;');
  result = result.replace(/>/g, '&gt;');
  result = result.replace(/"/g, '&quot;');
  result = result.replace(/'/g, '&apos;');
  return result;
}

/* Obtain an escaped version of the string */
String.prototype.repr = function _String_repr() {
  return JSON.stringify(this);
}

/* Implement Array.map for strings */
String.prototype.map = function _String_map(func) {
  let result = "";
  for (let ch of this) {
    result += func(ch);
  }
  return result;
};

/* Implement Array.forEach for strings */
String.prototype.forEach = function _String_forEach(func) {
  for (let ch of this) {
    func(ch);
  }
};

/* Return a string with the specified character changed */
String.prototype.withCharAt = function _String_withCharAt(chr, pos) {
  let result = this;
  if (pos >= 0 && pos < this.length) {
    result = this.substr(0, pos) + chr + this.substr(pos);
  }
  return result;
};

/* Split a string at most N times, returning the tokens and the rest of the
 * string, such that STR.split_n(sep, n).join(sep) === STR */
String.prototype.split_n = function _String_split_n(sep, num) {
  let cnt = 0;
  let results = [];
  let temp = this;
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

/* Escape a string for use in regex */
RegExp.escape = function _RegExp_escape(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* End standard object additions 0}}} */

/* URL and URI handling {{{0 */

/* Ensure a URL is formatted properly */
Util.URL = function _Util_URL(url) {
  if (url.startsWith('//')) {
    let p = 'http:';
    if (window.location.protocol == "https:") {
      p = 'https:';
    }
    return p + url;
  }
  return url;
}

/* Converts an XHR onError object to an Error object */
Util.XHRError = function _Util_XHRError(obj, stack=null) {
  let e = JSON.parse(JSON.stringify(obj));
  if (stack !== null) {
    e.stack = stack;
  }
  Object.setPrototypeOf(e, Error.prototype);
  return e;
}

/* Converts a Response object to an Error object */
Util.ResponseError = function _Util_ResponseError(resp, stack=null) {
  let m = `${resp.status} ${resp.statusText}`;
}

class _Util_API {
  constructor(headers=null, args=null) {
    this._headers = headers || {};
    this._args = args || {};
  }

  /* Return an API object with the arguments given */
  static withArgs(args) { return new _Util_API(null, args); }

  /* Fetch a resource using the native window.fetch API */
  _fetch_native(url, parms) {
    let init = parms || {};
    init.headers = {};
    for (let [k, v] of Object.entries(this._args)) {
      init[k] = v;
    }
    for (let [k, v] of Object.entries(this._headers)) {
      init.headers[k] = v;
    }
    return fetch(url, parms)
      .then(function _fetch_then(resp) {
        if (!resp.ok) {
          throw Util.ResponseError(resp);
        } else {
          return resp.json();
        }
      });
  }

  /* Fetch a resource using XMLHttpRequest */
  _fetch_xhr(url, parms) {
    let stack = Util.GetStack();
    return new Promise(function (resolve, reject) {
      let r = new XMLHttpRequest();
      r.onreadystatechange = function _XHR_onreadystatechange() {
        if (this.readyState == XMLHttpRequest.DONE) {
          resolve(JSON.parse(this.responseText));
        }
      }
      r.onerror = function _XHR_onerror(e) {
        e._stacktrace = stack;
        reject(e);
      }
      r.open(parms.method || "GET", url);
      for (let [k, v] of Object.entries(this._headers)) {
        r.setRequestHeader(k, v);
      }
      r.send(parms.body || null);
    });
  }

  /* Fetch the given URL with the given parameter object.
   * NOTE: Does no response status code checking */
  fetch(url, parms=null) {
    if (window.fetch) {
      return this._fetch_native(url, parms);
    } else {
      return this._fetch_xhr(url, parms);
    }
  }

  fetchCB(url, parms, onSuccess, onError=null) {
    onError = onError || Util.Error;
    this.fetchAsync(url, parms)
      .then(function _fetchCB_then(json) { onSuccess(json, this); })
      .catch(function _fetchCB_catch(...args) { onError(args, this); });
  }
}
Util.API = _Util_API;

/* End URL and URI handling 0}}} */

/* Logging {{{0 */
Util.LEVEL_MIN = 0;
Util.LEVEL_OFF = Util.LEVEL_MIN;
Util.LEVEL_DEBUG = Util.LEVEL_OFF + 1;
Util.LEVEL_TRACE = Util.LEVEL_DEBUG + 1;
Util.LEVEL_MAX = Util.LEVEL_TRACE;
Util.DebugLevel = Util.LEVEL_OFF;
Util._stack_trim_begin_level = [0];
Util._stack_trim_end_level = [0];

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
  let lines = [];
  try { throw new Error(); } catch (e) { lines = e.stack.trim().split("\n"); }
  lines.shift(); /* Discard _Util_GetStack */
  for (let i = 0; i < Util.GetStackTrimBegin(); ++i) {
    lines.shift();
  }
  for (let i = 0; i < Util.GetStackTrimEnd(); ++i) {
    lines.pop();
  }
  return lines;
}

/* Parse a given stacktrace */
Util.ParseStack = function _Util_ParseStack(lines) {
  let frames = [];
  for (let line of lines) {
    let frame = {};
    if (Util.Browser.Get() == Util.Browser.CHROME) {
      // "[ ]+at (function)\( as \[(function)\]\)? \((file):(line):(column)"
      let m = line.match(/^[ ]* at ([^ ]+)(?: \[as ([\w]+)\])? \((.*):([0-9]+):([0-9]+)\)$/);
      if (m == null) {
        Util.ErrorOnly("Failed to parse stack frame", line);
        continue;
      }
      frame = {};
      frame.name = m[1];
      frame.actual_name = m[2];
      frame.file = m[3];
      frame.line = parseInt(m[4]);
      frame.column = parseInt(m[5]);
    } else if (Util.Browser.IsFirefox) {
      // "(function)@(file):(line):(column)"
      let m = line.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/);
      if (m == null) {
        Util.ErrorOnly("Failed to parse stack frame", line);
        continue;
      }
      frame = {};
      frame.name = m[1];
      frame.file = m[2];
      frame.line = parseInt(m[3]);
      frame.column = parseInt(m[4]);
    }
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
      if (pieces.every((p) => (p[0][0] == ref_path[i]))) {
        for (let piece of pieces) { piece[0] = piece[0].slice(1); }
      }
    }
  }
  /* Join the paths back together */
  return pieces.map((v) => Util.JoinPath(v[0].join('/'), v[1]));
}

/* Format stack frames for output */
Util.FormatStack = function _Util_FormatStack(stack) {
  /* Strip out the common prefix directory */
  let paths = [];
  for (let frame of stack) {
    paths.push(frame.file);
  }
  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length == paths.length);
  let result = [];
  for (let i = 0; i < paths.length; ++i) {
    result.push(`${stack[i].name}@${paths[i]}:${stack[i].line}:${stack[i].column}`);
  }
  return result.join("\n");
}

/* (internal) Output args to a console using the given func  */
Util._toConsole = function _Util__toConsole(func, args) {
  let stack = Util.ParseStack(Util.GetStack());
  stack.shift(); /* Discard Util._toConsole */
  stack.shift(); /* Discard Util._toConsole caller */
  console.group("From " + Util.FormatStack(stack));
  func.apply(console, args);
  console.groupEnd();
}

/* Logger object */
class LoggerUtility {
  constructor() {
    this._hooks = {};
    this._filters = {};
    for (let v of Object.values(LoggerUtility.SEVERITIES)) {
      this._hooks[v] = [];
      this._filters[v] = [];
    }
  }

  /* Object of severity name to severity number */
  static get SEVERITIES() {
    return {ALL: 6, ERROR: 5, WARN: 4, INFO: 3, DEBUG: 2, TRACE: 1};
  }

  /* Get the numeric value for the severity given */
  _sev_value(sev) {
    return LoggerUtility.SEVERITIES[sev];
  }

  /* Validate that the given severity exists */
  _assert_sev(sev) {
    if (this._hooks[this._sev_value(sev)] === undefined) {
      console.exception(`Logger: invalid severity ${sev}`);
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

  /* Add a filter function for the given severity
   * (NOTE: will be called with an array of arguments) */
  add_filter(func, sev="ALL") {
    if (!this._assert_sev(sev)) { return false; }
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
    if (Util.DebugLevel == Util.LEVEL_TRACE) return true;
    if (Util.DebugLevel == Util.LEVEL_DEBUG) {
      return val >= LoggerUtility.SEVERITIES.DEBUG;
    }
    if (Util.DebugLevel == Util.LEVEL_OFF) {
      return val >= LoggerUtility.SEVERITIES.INFO;
    }
    return val >= LoggerUtility.SEVERITIES.WARN;
  }

  /* Log `argobj` with severity `sev`, optionally including a stacktrace */
  do_log(sev, argobj, stacktrace=false) {
    if (!this.severity_enabled(sev)) { return }
    if (this.should_filter(argobj, sev)) { return; }
    let val = this._sev_value(sev);
    for (let hook of this._hooks[val]) {
      let args = [sev, stacktrace].concat(Util.ArgsToArray(argobj));
      hook.apply(hook, args);
    }
    if (stacktrace) {
      Util.PushStackTrimBegin(Math.max(Util.GetStackTrimBegin(), 1));
      switch (val) {
        case LoggerUtility.SEVERITIES.TRACE:
          Util._toConsole(console.log, argobj);
          break;
        case LoggerUtility.SEVERITIES.DEBUG:
          Util._toConsole(console.log, argobj);
          break;
        case LoggerUtility.SEVERITIES.INFO:
          Util._toConsole(console.log, argobj);
          break;
        case LoggerUtility.SEVERITIES.WARN:
          Util._toConsole(console.warn, argobj);
          break;
        case LoggerUtility.SEVERITIES.ERROR:
          Util._toConsole(console.error, argobj);
          break;
      }
      Util.PopStackTrimBegin();
    } else {
      switch (val) {
        case LoggerUtility.SEVERITIES.TRACE:
          console.log.apply(console, argobj);
          break;
        case LoggerUtility.SEVERITIES.DEBUG:
          console.log.apply(console, argobj);
          break;
        case LoggerUtility.SEVERITIES.INFO:
          console.log.apply(console, argobj);
          break;
        case LoggerUtility.SEVERITIES.WARN:
          console.warn.apply(console, argobj);
          break;
        case LoggerUtility.SEVERITIES.ERROR:
          console.error.apply(console, argobj);
          break;
      }
    }
  }

  /* Log the arguments given with a stacktrace */
  Trace(...args) { this.do_log("TRACE", args, true); }
  Debug(...args) { this.do_log("DEBUG", args, true); }
  Info(...args) { this.do_log("INFO", args, true); }
  Warn(...args) { this.do_log("WARN", args, true); }
  Error(...args) { this.do_log("ERROR", args, true); }

  /* Log the arguments given without a stacktrace */
  TraceOnly(...args) { this.do_log("TRACE", args, false); }
  DebugOnly(...args) { this.do_log("DEBUG", args, false); }
  InfoOnly(...args) { this.do_log("INFO", args, false); }
  WarnOnly(...args) { this.do_log("WARN", args, false); }
  ErrorOnly(...args) { this.do_log("ERROR", args, false); }
}

/* Logger instance and shortcut functions */
Util.Logger = new LoggerUtility();
Util.Trace = Util.Logger.Trace.bind(Util.Logger);
Util.Debug = Util.Logger.Debug.bind(Util.Logger);
Util.Log = Util.Logger.Info.bind(Util.Logger);
Util.Warn = Util.Logger.Warn.bind(Util.Logger);
Util.Error = Util.Logger.Error.bind(Util.Logger);
Util.TraceOnly = Util.Logger.TraceOnly.bind(Util.Logger);
Util.DebugOnly = Util.Logger.DebugOnly.bind(Util.Logger);
Util.LogOnly = Util.Logger.InfoOnly.bind(Util.Logger);
Util.WarnOnly = Util.Logger.WarnOnly.bind(Util.Logger);
Util.ErrorOnly = Util.Logger.ErrorOnly.bind(Util.Logger);

/* End logging 0}}} */

/* Color handling {{{0 */

/* Store instance to active color parser */
Util._ColorParser = null;

/* Create a class for parsing colors */
class ColorParser {
  constructor() {
    this._e = document.createElement('div');
    this._e.setAttribute("style", "position: absolute; z-index: -100");
    this._e.setAttribute("id", "color-parser-div");
    this._e.setAttribute("width", "0px");
    this._e.setAttribute("height", "0px");
    document.body.appendChild(this._e);
    this._rgb_pat = /rgb\(([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+)\)/;
    this._rgba_pat = /rgba\(([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+),[ ]*([.\d]+)\)/;
    this._cache = {};
  }
  _parse(color) {
    if (this._cache[color]) {
      return this._cache[color];
    }
    this._e.style.color = null;
    this._e.style.color = color;
    if (this._e.style.color.length === 0) {
      throw new Error(`ColorParser: Invalid color ${color}`);
    }
    let rgbstr = getComputedStyle(this._e).color;
    let rgbtuple = [];
    let m = this._rgb_pat.exec(rgbstr) || this._rgba_pat.exec(rgbstr);
    if (m !== null) {
      rgbtuple = m.slice(1);
    } else {
      /* Shouldn't ever happen */
      throw new Error("Failed to parse computed color", rgbstr);
    }
    let r = Number(rgbtuple[0]); r = Number.isNaN(r) ? 0 : r;
    let g = Number(rgbtuple[1]); g = Number.isNaN(g) ? 0 : g;
    let b = Number(rgbtuple[2]); b = Number.isNaN(b) ? 0 : b;
    let res = [r, g, b];
    if (rgbtuple.length == 4 && rgbtuple[3] !== undefined) {
      let a = Number(rgbtuple[3]); a = Number.isNaN(a) ? 0 : a;
      res.push(a);
    }
    this._cache[color] = res;
    return res;
  }
  static parse(color, failQuiet=false) {
    if (Util._ColorParser == null) {
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
class _Util_Color {
  /* Convert (r, g, b) (0~255) to (h, s, l) (deg, 0~100, 0~100) */
  static RGBToHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let d = max - min;
    let h;
    if (d === 0) h = 0;
    else if (max === r) h = (g - b) / d % 6;
    else if (max === g) h = (b - r) / d + 2;
    else if (max === b) h = (r - g) / d + 4;
    let l = (min + max) / 2;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [h * 60, s, l];
  }

  /* Convert (h, s, l) (deg, 0~100, 0~100) to (r, g, b) (0~255) */
  static HSLToRGB(h, s, l) {
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let hp = h / 60.0;
    let x = c * (1 - Math.abs((hp % 2) - 1));
    let rgb1;
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
    if (a === undefined) {
      return [r / 255, g / 255, b / 255];
    } else {
      return [r / 255, g / 255, b / 255, a / 255];
    }
  }

  /* Renormalize (r, g, b[, a]) from 0~255 to 0~1 */
  static Renorm255(...args) {
    let [r, g, b, a] = args;
    if (a === undefined) {
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
  constructor(...args) {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 255;
    /* Handle Color([...]) -> Color(...) */
    if (args.length == 1 && args[0] instanceof Array) {
      args = args[0];
    }
    if (args.length == 1) {
      /* Handle Color(Color) and Color("string") */
      let arg = args[0];
      if (arg instanceof Util.Color) {
        [this.r, this.g, this.b, this.a] = [arg.r, arg.g, arg.b, arg.a];
        this.scale = arg.scale;
      } else if (typeof(arg) == "string" || arg instanceof String) {
        let [r, g, b, a] = ColorParser.parse(arg);
        [this.r, this.g, this.b, this.a] = [r, g, b, a];
      } else {
        throw new TypeError(`Invalid argument "${arg}" to Color()`);
      }
    } else if (args.length >= 3 && args.length <= 4) {
      /* Handle Color(r, g, b) and Color(r, g, b, a) */
      [this.r, this.g, this.b] = args;
      if (args.length == 4) this.a = args[3];
    } else if (args.length > 0) {
      throw new TypeError(`Invalid arguments "${args}" to Color()`);
    }
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
    return [r, g, b, a];
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
    function c_to_cx(c) {
      if (c < 0.03928) {
        return c / 12.92;
      } else {
        return Math.pow((c+0.055)/1.055, 2.4);
      }
    }
    return 0.2126 * c_to_cx(r) + 0.7152 * c_to_cx(g) + 0.0722 * c_to_cx(b);
  }

  /* Calculate the contrast ratio against the given color */
  getConstrastRatioWith(c2) {
    let l1 = this.getRelativeLuminance();
    let l2 = (new Util.Color(c2)).getRelativeLuminance();
    return (l1 + 0.05) / (l2 + 0.05);
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
   *    rgb1 -> hsl -> rgb2 => rgb1 == rgb2
   *  Case 2:
   *    rgba1 -> hsla -> rgba2 => rgba1 == rgba2
   *  "#ff0000" -> hsl -> "#ff0000"
   */
}
Util.Color = _Util_Color;

/* Parse a CSS color.
 * Overloads
 *  Util.ParseColor('css color spec')
 *  Util.ParseColor([r, g, b])
 *  Util.ParseColor([r, g, b, a])
 *  Util.ParseColor(r, g, b[, a]) */
Util.ParseCSSColor = function _Util_ParseColor(...color) {
  let r = 0, g = 0, b = 0, a = 0;
  if (color.length == 1) { color = color[0]; }
  if (typeof(color) == "string") {
    [r, g, b, a] = ColorParser.parse(color);
  } else if (typeof(color) == "object") {
    if (color.length == 3 || color.length == 4) {
      r = color[0];
      g = color[1];
      b = color[2];
      if (color.length == 4) {
        a = color[4];
      }
    }
  }
  return [r, g, b, a];
}

/* Calculate the Relative Luminance of a color.
 * Overloads:
 *  Util.RelativeLuminance('css color spec')
 *  Util.RelativeLuminance([r, g, b])
 *  Util.RelativeLuminance([r, g, b, a])
 *  Util.RelativeLuminance(r, g, b[, a]) */
Util.RelativeLuminance = function _Util_RelativeLuminance(...args) {
  let color = Util.ParseCSSColor(args.length == 1 ? args[0] : args);
  let color_rgb = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0];
  function c_to_cx(c) {
    if (c < 0.03928) {
      return c / 12.92;
    } else {
      return Math.pow((c+0.055)/1.055, 2.4);
    }
  }
  let l_red = 0.2126 * c_to_cx(color_rgb[0]);
  let l_green = 0.7152 * c_to_cx(color_rgb[1]);
  let l_blue = 0.0722 * c_to_cx(color_rgb[2]);
  return l_red + l_green + l_blue;
}

/* Calculate the Contrast Ratio between two colors */
Util.ContrastRatio = function _Util_ContrastRatio(c1, c2) {
  let l1 = Util.RelativeLuminance(c1);
  let l2 = Util.RelativeLuminance(c2);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* Determine which color contrasts the best with the given color
 * Overloads:
 *  Util.GetMaxContrast(color, c1, c2, c3, ...)
 *  Util.GetMaxContrast(color, [c1, c2, c3, ...]) */
Util.GetMaxConstrast = function _Util_GetMaxContrast(c1, ...colors) {
  let best_color = null;
  let best_contast = null;
  if (colors.length == 1 && Util.IsArray(colors[0])) {
    colors = colors[0];
  }
  for (let c of colors) {
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
}

/* End color handling 0}}} */

/* Notification APIs {{{0 */
Util.Notification = class _Util_Notification {
  constructor() {
    this._enabled = false;
    this._max = 2; /* max simultaneous notifications */
    this._active = {}; /* currently-active notifications */
  }
  get available() { return window.hasOwnProperty("Notification"); }

  acquire() {
    if (this.available) {
      this._req_promise = window.Notification.requestPermission();
      this._req_promise.then((function _notif_then(s) {
        if (s === "granted") {
          this._enabled = true;
        } else {
          this._enabled = false;
        }
      }).bind(this));
    }
  }

  set max(m) { this._max = m; }
  get max() { return this._max; }
  closeAll() { /* TODO */ }
  notify(msg) { /* TODO */ }
}

Util.Notify = new Util.Notification();
/* End notification APIs 0}}} */

/* Return true if the given object inherits from the given typename */
Util.IsInstanceOf = function _Object_IsInstanceOf(obj, typename) {
  for (let p = obj; p; p = p.__proto__) {
    if (p.constructor.name == typename) {
      return true;
    }
  }
  return false;
}

/* Return true if the object is an array */
Util.IsArray = function _Util_IsArray(value) {
  /* Values are considered "arrays" if value[Symbol.iterator] is a function
   * and that object is not a string */
  if (typeof(value) === "string") return false;
  if (value && typeof(value[Symbol.iterator]) == "function") {
    return true;
  } else {
    return false;
  }
}

/* PRNG (Pseudo-Random Number Generator) {{{0 */
Util.RandomGenerator = class _Util_Random {
  constructor(disable_crypto) {
    this._crypto = null;
    if (disable_crypto) {
      Util.Warn("Forcibly disabling crypto");
    }
    if (typeof(crypto) !== 'undefined' && crypto.getRandomValues) {
      this._crypto = crypto;
    } else if (typeof(msCrypto) !== "undefined"
               && typeof window.msCrypto.getRandomValues == 'function') {
      this._crypto = msCrypto;
    } else {
      console.error("Failed to get secure PRNG; falling back to Math.random");
    }
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

  numToHex(num, pad=2) {
    return num.toString("16").padStart(pad, "0");
  }

  bytesToHex(bytes) {
    let h = "";
    for (let byte of bytes) { h += this.numToHex(byte); }
    return h;
  }

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

  hex8() { return this.randBytes(1, 'hex'); }
  hex16() { return this.randBytes(2, 'hex'); }
  hex32() { return this.randBytes(4, 'hex'); }
  hex64() { return this.randBytes(8, 'hex'); }

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

/* Escape the string and return a map of character movements */
Util.EscapeWithMap = function _Util_EscapeWithMap(s) {
  let result = "";
  let map = [];
  let i = 0, j = 0;
  while (i < s.length) {
    map.push(j);
    let r = Util.EscapeChars.hasOwnProperty(s[i]) ? Util.EscapeChars[s[i]] : s[i];
    result = result + r;
    i += 1;
    j += r.length;
  }
  return [result, map];
}

/* Convert an arguments object to an Array instance */
Util.ArgsToArray = function _Util_ArgsToArray(argobj) {
  return Array.of.apply(Array, argobj);
}

/* Fire an event: dispatchEvent with a _stacktrace attribute  */
Util.FireEvent = function _Util_FireEvent(e) {
  /* Add a stacktrace to the event for debugging reasons */
  e._stacktrace = Util.ParseStack(Util.GetStack());
  /* Discard the Util.FireEvent stack frame */
  e._stacktrace.shift();
  document.dispatchEvent(e);
}

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
      seq.push(undefined);
    }
  }
  let result = [];
  /* Perform the zip operation */
  for (let i = 0; i < max_len; ++i) {
    let row = Array.from(curr, () => undefined);
    for (let j = 0; j < curr.length; ++j) {
      row[j] = curr[j][i];
    }
    result.push(row);
  }
  /* And we're done */
  return result;
}

/* Number formatting */
Util.Pad = function _Util_Pad(n, digits, padChr) {
  if (padChr === undefined) {
    padChr = '0';
  }
  return (new String(n)).padStart(digits, padChr);
}

/* Convert a string to an array of character codes */
Util.StringToCodes = function _Util_StringToCodes(str) {
  let result = [];
  for (let i = 0; i < str.length; ++i) {
    result.push(str.charCodeAt(i));
  }
  return result;
}

/* Format a date object to "%Y-%m-%d %H:%M:%S.<ms>" */
Util.FormatDate = function _Util_FormatDate(date) {
  let [y, m, d] = [date.getFullYear(), date.getMonth(), date.getDay()];
  let [h, mi, s] = [date.getHours(), date.getMinutes(), date.getSeconds()];
  let ms = date.getMilliseconds();
  let p = [y, Util.Pad(m, 2), Util.Pad(d, 2),
           Util.Pad(h, 2), Util.Pad(mi, 2), Util.Pad(s, 2),
           Util.Pad(ms, 3)];
  return `${p[0]}-${p[1]}-${p[2]} ${p[3]}:${p[4]}:${p[5]}.${p[6]}`;
}

/* Format an interval in seconds to "Xh Ym Zs" */
Util.FormatInterval = function _Util_FormatInterval(time) {
  let parts = [];
  time = Math.round(time);
  if (time < 0) {
    parts.push('-');
    time *= -1;
  }
  if (time % 60 != 0) { parts.unshift(`${time % 60}s`); }
  time = Math.floor(time / 60);
  if (time > 0) {
    if (time % 60 != 0) { parts.unshift(`${time % 60}m`); }
    time = Math.floor(time / 60);
  }
  if (time > 0) {
    parts.unshift(`${time}h`);
  }
  return parts.join(" ");
}

/* Special escaping {{{0 */

/* Build a character escape sequence for the code given */
Util.EscapeCharCode = function _Util_EscapeCharCode(code) {
  // Handle certain special escape sequences
  let special_chrs = "bfnrtv";
  let special = Util.StringToCodes("\b\f\n\r\t\v");
  if (special.indexOf(code) > -1) {
    return `\\${special_chrs.charAt(special.indexOf(code))}`;
  } else {
    return `\\x${code.toString(16).padStart(2, '0')}`;
  }
}

/* Strip escape characters from a string */
Util.EscapeSlashes = function _Util_EscapeSlashes(str) {
  let is_slash = (c) => c == "\\";
  let is_ctrl = (c) => c.charCodeAt(0) < ' '.charCodeAt(0);
  let result = "";
  for (let [cn, ch] of Util.Zip(Util.StringToCodes(str), str)) {
    if (cn < 0x20)
      result = result.concat(Util.EscapeCharCode(cn));
    else if (ch == '\\')
      result = result.concat('\\\\');
    else
      result = result.concat(ch);
  }
  return result;
}

/* End special escaping 0}}} */

/* Configuration and localStorage functions {{{0 */

/* Obtain the configured localStorage key */
Util.GetWebStorageKey = function _Util_GetWebStorageKey() {
  if (Util.__wskey !== null) {
    return Util.__wskey;
  }
  let key = JSON.parse(window.localStorage.getItem(Util.__wscfg));
  return key; /* may be null */
}

/* Select the localStorage key to use */
Util.SetWebStorageKey = function _Util_SetWebStorageKey(key) {
  Util.__wskey = key;
  window.localStorage.setItem(Util.__wscfg, JSON.stringify(key));
}

/* Get and decode value, using either the configured key or the one given */
Util.GetWebStorage = function _Util_GetWebStorage(key=null) {
  if (key === null) {
    key = Util.GetWebStorageKey();
  }
  if (key === null) {
    Util.Error("Util.GetWebStorage called without a key configured");
  } else {
    let v = window.localStorage.getItem(key);
    if (v === null) return null;
    if (v === "") return "";
    return JSON.parse(v);
  }
}

/* JSON encode and store a localStorage value */
Util.SetWebStorage = function _Util_SetWebStorage(value, key=null) {
  if (key === null) {
    key = Util.GetWebStorageKey();
  }
  if (key === null) {
    Util.Error("Util.SetWebStorage called without a key configured");
  } else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

/* Append a value to the given localStorage key */
Util.StorageAppend = function _Util_StorageAppend(key, value) {
  let v = Util.GetWebStorage(key);
  let new_v = [];
  if (v === null) {
    new_v = [value];
  } else if (!(v instanceof Array)) {
    new_v = [v, value];
  } else {
    new_v = v;
    new_v.push(value);
  }
  Util.SetWebStorage(new_v, key);
}

/* Class for handling configuration */
class ConfigStore {
  constructor(key, noPersist=null) {
    this._key = key;
    this._config = Util.GetWebStorage(this._key) || {};
    this._persist = {};
    if (Util.IsArray(noPersist)) {
      for (let k of noPersist) {
        this._persist[k] = false;
      }
    } else if (noPersist !== null) {
      Util.Warn("ConfigStore: noPersist: expected array, got", noPersist);
    }
  }
  setPersist(key, persist=true) {
    this._persist[key] = persist;
  }
  getPersists(key) {
    return this._persist.hasOwnProperty[key] && this._persist[key];
  }
  _merge(k, v) {
    this._config[k] = v;
    Util.SetWebStorage(this._config, this._key);
  }
  addValue(key, val) {
    this._merge(key, val);
  }
  addValues(array) {
    for (let [k,v] of array) {
      this.addValue(k, v);
    }
  }
  addObject(obj) {
    this.addValues(Object.entries(obj));
  }
  getValue(k) {
    return this._config[k];
  }
}

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
Util.ParseQueryString = function _Util_ParseQueryString(query) {
  if (!query) query = window.location.search;
  if (query.startsWith('?')) query = query.substr(1);
  let obj = {};
  for (let part of query.split('&')) {
    if (part.indexOf('=') == -1) {
      obj[part] = true;
    } else if (part.startsWith('base64=')) {
      let val = decodeURIComponent(part.substr(part.indexOf('=')+1));
      for (let [k, v] of Object.entries(Util.ParseQueryString(atob(val)))) {
        obj[k] = v;
      }
    } else {
      let key = part.substr(0, part.indexOf('='));
      let val = part.substr(part.indexOf('=')+1);
      val = decodeURIComponent(val);
      if (val.length == 0)
        val = false;
      else if (val == "true")
        val = true;
      else if (val == "false")
        val = false;
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

/* Format a query string (including leading "?") */
Util.FormatQueryString = function _Util_FormatQueryString(query) {
  let parts = [];
  for (let [k, v] of Object.entries(query)) {
    let key = encodeURIComponent(k);
    let val = encodeURIComponent(v);
    parts.push(`${key}=${val}`);
  }
  return "?" + parts.join("&");
}

/* End query string handling 0}}} */

/* Loading scripts {{{0 */

/* Add the javascript file to the document's <head> */
Util.AddScript = function _Util_AddScript(src) {
  let s = document.createElement("script");
  s.setAttribute("type", "text/javascript");
  s.setAttribute("src", src);
  document.head.appendChild(s);
};

/* Add all of the javascript files to the document's <head> */
Util.AddScripts = function _Util_AddScripts(scripts) {
  for (let s of scripts) {
    Util.AddScript(s);
  }
};

/* End loading scripts 0}}} */

/* Point-box functions {{{0 */

/* Return whether or not the position is inside the box */
Util.BoxContains = function _Util_BoxContains(x, y, x0, y0, x1, y1) {
  if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
    return true;
  } else {
    return false;
  }
};

/* Return whether or not the position is inside the given DOMRect */
Util.RectContains = function _Util_RectContains(x, y, rect) {
  if (x >= rect.left && x <= rect.right) {
    if (y >= rect.top && y <= rect.bottom) {
      return true;
    }
  }
  return false;
}

/* Return whether or not the position is over the HTML element */
Util.PointIsOn = function _Util_PointIsOn(x, y, elem) {
  let rects = elem.getClientRects();
  for (let rect of rects) {
    if (Util.RectContains(x, y, rect)) {
      return true;
    }
  }
  return false;
};

/* End point-box functions 0}}} */

/* CSS functions {{{0 */

Util.CSS = {};

/* Get a stylesheet by filename */
Util.CSS.GetSheet = function _Util_CSS_GetSheet(filename) {
  for (let ss of document.styleSheets) {
    if (ss.href.endsWith(`/${filename.trimStart('/')}`)) {
      return ss;
    }
  }
  return null;
};

/* Given a stylesheet, obtain a rule definition by name */
Util.CSS.GetRule = function _Util_CSS_GetRule(css, rule_name) {
  for (let rule of css.cssRules) {
    if (rule.selectorText == rule_name) {
      return rule;
    }
  }
  return null;
}

/* Given a rule, enumerate the defined properties' names */
Util.CSS.GetPropertyNames = function _Util_CSS_GetPropertyNames(rule) {
  let styles = [];
  for (let i = 0; rule.style[i]; ++i) {
    styles.push(rule.style[i]);
  }
  return styles;
}

/* End CSS functions 0}}} */

/* Mark the Utility API as loaded */
Util.API_Loaded = true;
document.dispatchEvent(new Event("twapi-utility-loaded"));

