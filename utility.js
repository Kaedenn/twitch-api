"use strict";

/* Standard object (String, RegExp) additions {{{0 */

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

/* Obtain an escaped version of the string, akin to Object.toSource() */
String.prototype.repr = function _String_repr() {
  let m = this.toSource().match(/^\(new String\((.*)\)\)$/);
  if (m) {
    return m[1];
  }
}

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

/* General Utilities */
let Util = {};

/* Regular expression matching URLs */
Util.URL_REGEX = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

/* Logging {{{0 */
Util.LEVEL_TRACE = 2;
Util.LEVEL_DEBUG = 1;
Util.LEVEL_OFF = 0;
Util.DebugLevel = 0;
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
  let frames = [];
  for (var line of lines) {
    let m = line.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/);
    let frame = {};
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
  let pieces = [];
  try {
    for (var path of paths) {
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
  let paths = [];
  for (var frame of stack) {
    paths.push(frame.file);
  }
  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length == paths.length);
  let result = [];
  for (var i = 0; i < paths.length; ++i) {
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
    for (var v of Object.values(LoggerUtility.SEVERITIES)) {
      this._hooks[v] = [];
    }
  }
  static get SEVERITIES() {
    return {ALL: 6, ERROR: 5, WARN: 4, INFO: 3, DEBUG: 2, TRACE: 1};
  }
  _sev_value(sev) {
    return LoggerUtility.SEVERITIES[sev];
  }
  _assert_sev(sev) {
    if (this._hooks[this._sev_value(sev)] === undefined) {
      console.exception(`LoggerUtility.add_hook: severity ${sev} not known`);
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
  /* Return whether or not the given severity is enabled */
  can_log(sev) {
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
    if (!this.can_log(sev)) { return }
    let val = this._sev_value(sev);
    for (var hook of this._hooks[val]) {
      let args = [sev, stacktrace].concat(Util.ArgsToArray(argobj));
      console.log(`Calling "${hook}" with ${args.length} args (${args.toSource()})`);
      console.log(`argobj = ${argobj.toSource()}`);
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
  Trace(...args) { this.do_log("TRACE", args, true); }
  Debug(...args) { this.do_log("DEBUG", args, true); }
  Info(...args) { this.do_log("INFO", args, true); }
  Warn(...args) { this.do_log("WARN", args, true); }
  Error(...args) { this.do_log("ERROR", args, true); }
  TraceOnly(...args) { this.do_log("TRACE", args, false); }
  DebugOnly(...args) { this.do_log("DEBUG", args, false); }
  InfoOnly(...args) { this.do_log("INFO", args, false); }
  WarnOnly(...args) { this.do_log("WARN", args, false); }
  ErrorOnly(...args) { this.do_log("ERROR", args, false); }
}

/* Logger instance */
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
    this._canvas = document.createElement('canvas');
    this._canvas.width = this._canvas.height = 1;
    this._ctx = this._canvas.getContext('2d');
    this._cache = {};
  }
  do_parse(color) {
    if (this._cache[color]) return this._cache[color];
    this._ctx.clearRect(0, 0, 1, 1);
    this._ctx.fillStyle = color;
    this._ctx.fillRect(0, 0, 1, 1);
    this._cache[color] = this._ctx.getImageData(0, 0, 1, 1).data;
    return this._cache[color];
  }
  static parse(color) {
    if (Util._ColorParser == null) {
      Util._ColorParser = new ColorParser();
    }
    return Util._ColorParser.do_parse(color);
  }
}

/* Class for handling colors and color arithmetic */
class Color {

  /* Convert (r, g, b) (0~255) to (h, s, l) (deg, 0~100, 0~100) */
  static RGBToHSL(r, g, b) {
    /* https://gist.github.com/vahidk/05184faf3d92a0aa1b46aeaa93b07786 */
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
    /* https://gist.github.com/vahidk/05184faf3d92a0aa1b46aeaa93b07786 */
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

  /* Renormalize (r, g, b[, a]) from 0~1 to 0~255 */
  static Renorm1(...args) {
    var [r, g, b, a] = args;
    if (a === undefined) {
      return [r / 255, g / 255, b / 255];
    } else {
      return [r / 255, g / 255, b / 255, a / 255];
    }
  }

  /* Renormalize (r, g, b[, a]) from 0~255 to 0~1 */
  static Renorm255(...args) {
    var [r, g, b, a] = args;
    if (a === undefined) {
      return [r * 255, g * 255, b * 255];
    } else {
      return [r * 255, g * 255, b * 255, a * 255];
    }
  }

  /* Create a Color object from the hue, saturation, and luminance given */
  static FromHSL(h, s, l) {
    let [r, g, b] = Color.HSLToRGB(h, s, l);
    return new Color(r, g, b);
  }

  /* Create a Color object from the hue, saturation, luminance, and alpha given */
  static FromHSLA(h, s, l, a) {
    let [r, g, b] = Color.HSLToRGB(h, s, l);
    return new Color(r, g, b, a);
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
      if (arg instanceof Color) {
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
    let c = new Color(this.r, this.g, this.b);
    return [c.r / 255, c.g / 255, c.b / 255];
  }
  
  /* Attribute: [r, g, b, a] scaled to [0,1] */
  get rgba_1() {
    let c = new Color(this.r, this.g, this.b, this.a);
    return [c.r / 255, c.g / 255, c.b / 255, c.a / 255];
  }
  
  /* Attribute: [h, s, l] */
  get hsl() { return Color.RGBToHSL(this.r, this.g, this.b); }
  set hsl(hsl) {
    let [h, s, l] = hsl;
    [this.r, this.g, this.b] = Color.HSLToRGB(h, s, l);
  }
  
  /* Attribute: [h, s, l, a] */
  get hsla() {
    let [r, g, b] = Color.RGBToHSL(this.r, this.g, this.b);
    return [r, g, b, a];
  }
  set hsla(hsla) {
    let [h, s, l, a] = hsla;
    [this.r, this.g, this.b] = Color.HSLToRGB(h, s, l);
    this.a = a;
  }

  /* Attribute: hue of [h, s, l] */
  get hue() { return this.hsl[0]; }
  set hue(new_h) {
    let [h, s, l] = this.hsl;
    h = new_h;
    [this.r, this.g, this.b] = Color.HSLToRGB(h, s, l);
  }

  /* Attribute: saturation of [h, s, l] */
  get saturation() { return this.hsl[1]; }
  set saturation(new_s) {
    let [h, s, l] = this.hsl;
    s = new_s;
    [this.r, this.g, this.b] = Color.HSLToRGB(h, s, l);
  }

  /* Attribute: luminance of [h, s, l] */
  get luminance() { return this.hsl[2]; }
  set luminance(new_l) {
    let [h, s, l] = this.hsl;
    l = new_l;
    [this.r, this.g, this.b] = Color.HSLToRGB(h, s, l);
  }

  /* Calculate the Relative Luminance */
  getRelativeLuminance() {
    /* https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef */
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
    /* https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef */
    let l1 = this.getRelativeLuminance();
    let l2 = (new Color(c2)).getRelativeLuminance();
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

Util.COLORS = {
  "indigo": "#4b0082",
  "gold": "#ffd700",
  "firebrick": "#b22222",
  "indianred": "#cd5c5c",
  "yellow": "#ffff00",
  "darkolivegreen": "#556b2f",
  "darkseagreen": "#8fbc8f",
  "slategrey": "#708090",
  "darkslategrey": "#2f4f4f",
  "mediumvioletred": "#c71585",
  "mediumorchid": "#ba55d3",
  "chartreuse": "#7fff00",
  "mediumslateblue": "#7b68ee",
  "black": "#000000",
  "springgreen": "#00ff7f",
  "crimson": "#dc143c",
  "lightsalmon": "#ffa07a",
  "brown": "#a52a2a",
  "turquoise": "#40e0d0",
  "olivedrab": "#6b8e23",
  "cyan": "#00ffff",
  "silver": "#c0c0c0",
  "skyblue": "#87ceeb",
  "gray": "#808080",
  "darkturquoise": "#00ced1",
  "goldenrod": "#daa520",
  "darkgreen": "#006400",
  "darkviolet": "#9400d3",
  "darkgray": "#a9a9a9",
  "lightpink": "#ffb6c1",
  "teal": "#008080",
  "darkmagenta": "#8b008b",
  "lightgoldenrodyellow": "#fafad2",
  "lavender": "#e6e6fa",
  "yellowgreen": "#9acd32",
  "thistle": "#d8bfd8",
  "violet": "#ee82ee",
  "navy": "#000080",
  "dimgrey": "#696969",
  "orchid": "#da70d6",
  "blue": "#0000ff",
  "ghostwhite": "#f8f8ff",
  "honeydew": "#f0fff0",
  "cornflowerblue": "#6495ed",
  "darkblue": "#00008b",
  "darkkhaki": "#bdb76b",
  "mediumpurple": "#9370db",
  "cornsilk": "#fff8dc",
  "red": "#ff0000",
  "bisque": "#ffe4c4",
  "slategray": "#708090",
  "darkcyan": "#008b8b",
  "khaki": "#f0e68c",
  "wheat": "#f5deb3",
  "deepskyblue": "#00bfff",
  "rebeccapurple": "#663399",
  "darkred": "#8b0000",
  "steelblue": "#4682b4",
  "aliceblue": "#f0f8ff",
  "lightslategrey": "#778899",
  "gainsboro": "#dcdcdc",
  "mediumturquoise": "#48d1cc",
  "floralwhite": "#fffaf0",
  "coral": "#ff7f50",
  "lightgrey": "#d3d3d3",
  "burlywood": "#deb887",
  "darksalmon": "#e9967a",
  "beige": "#f5f5dc",
  "azure": "#f0ffff",
  "lightsteelblue": "#b0c4de",
  "oldlace": "#fdf5e6",
  "greenyellow": "#adff2f",
  "royalblue": "#4169e1",
  "lightseagreen": "#20b2aa",
  "mistyrose": "#ffe4e1",
  "sienna": "#a0522d",
  "lightcoral": "#f08080",
  "orangered": "#ff4500",
  "navajowhite": "#ffdead",
  "lime": "#00ff00",
  "palegreen": "#98fb98",
  "lightcyan": "#e0ffff",
  "seashell": "#fff5ee",
  "mediumspringgreen": "#00fa9a",
  "fuchsia": "#ff00ff",
  "papayawhip": "#ffefd5",
  "blanchedalmond": "#ffebcd",
  "peru": "#cd853f",
  "aquamarine": "#7fffd4",
  "white": "#ffffff",
  "darkslategray": "#2f4f4f",
  "tomato": "#ff6347",
  "ivory": "#fffff0",
  "dodgerblue": "#1e90ff",
  "lemonchiffon": "#fffacd",
  "chocolate": "#d2691e",
  "orange": "#ffa500",
  "forestgreen": "#228b22",
  "darkgrey": "#a9a9a9",
  "olive": "#808000",
  "mintcream": "#f5fffa",
  "antiquewhite": "#faebd7",
  "darkorange": "#ff8c00",
  "cadetblue": "#5f9ea0",
  "moccasin": "#ffe4b5",
  "limegreen": "#32cd32",
  "saddlebrown": "#8b4513",
  "grey": "#808080",
  "darkslateblue": "#483d8b",
  "lightskyblue": "#87cefa",
  "deeppink": "#ff1493",
  "plum": "#dda0dd",
  "aqua": "#00ffff",
  "darkgoldenrod": "#b8860b",
  "maroon": "#800000",
  "sandybrown": "#f4a460",
  "magenta": "#ff00ff",
  "tan": "#d2b48c",
  "rosybrown": "#bc8f8f",
  "pink": "#ffc0cb",
  "lightblue": "#add8e6",
  "palevioletred": "#db7093",
  "mediumseagreen": "#3cb371",
  "slateblue": "#6a5acd",
  "linen": "#faf0e6",
  "dimgray": "#696969",
  "powderblue": "#b0e0e6",
  "seagreen": "#2e8b57",
  "snow": "#fffafa",
  "mediumblue": "#0000cd",
  "midnightblue": "#191970",
  "paleturquoise": "#afeeee",
  "palegoldenrod": "#eee8aa",
  "whitesmoke": "#f5f5f5",
  "darkorchid": "#9932cc",
  "salmon": "#fa8072",
  "lightslategray": "#778899",
  "lawngreen": "#7cfc00",
  "lightgreen": "#90ee90",
  "lightgray": "#d3d3d3",
  "hotpink": "#ff69b4",
  "lightyellow": "#ffffe0",
  "lavenderblush": "#fff0f5",
  "purple": "#800080",
  "mediumaquamarine": "#66cdaa",
  "green": "#008000",
  "blueviolet": "#8a2be2",
  "peachpuff": "#ffdab9"
};

/* Parse a CSS color.
 * Overloads
 *  Util.ParseColor('css color spec')
 *  Util.ParseColor([r, g, b])
 *  Util.ParseColor([r, g, b, a])
 *  Util.ParseColor(r, g, b[, a]) */
Util.ParseCSSColor = function _Util_ParseColor(color) {
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
  let color = Util.ParseCSSColor(args);
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

/* Determine which color contrasts the best with the given color */
Util.GetMaxConstrast = function _Util_GetBestContrast(c1, ...colors) {
  /* Inspired by https://ux.stackexchange.com/a/107319 */
  let best_color = null;
  let best_contast = null;
  for (var c of colors) {
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

/* Notification APIs */
class _Util_Notification {
  constructor() {
    this._enabled = false;
    this._max = 2; /* max simultaneous notifications */
    this._active = {}; /* currently-active notifications */
    if (this.available) {
      if (Notification.permission === "granted") {
        this._enabled = true;
      } else if (Notification.permission !== "denied") {
        this.acquire();
      } else {
        /* denied outright */
        console.log("Notifications disabled by user");
      }
    }
  }
  get available() { return window.hasOwnProperty("Notification"); }

  acquire() {
    if (this.available) {
      this._req_promise = window.Notification.requestPermission();
      this._req_promise.then(function(s) {
        if (s === "granted") {
          this._enabled = true;
        } else {
          this._enabled = false;
        }
      });
    }
  }

  set max(m) { this._max = m; }
  get max() { return this._max; }
  closeAll() { /* TODO */ }
  notify(msg) { /* TODO */ }

}
Util.Notify = new _Util_Notification();
Util.Notify.Available = window.hasOwnProperty("Notification");
Util.Notify.Enabled = Util.Notify.Available ? Notification.permission === "granted" : false;


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
  let curr = [];
  let max_len = 0;
  /* Make sure everything's an array, calculate the max length */
  for (var seq of sequences) {
    let seq_array = Array.from(seq);
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
    let row = Array.from(curr, () => undefined);
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
  let result = [];
  for (var i = 0; i < str.length; ++i) {
    result.push(str.charCodeAt(i));
  }
  return result;
}

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
  is_slash = (c) => c == "\\";
  is_ctrl = (c) => c.charCodeAt(0) < ' '.charCodeAt(0);
  let result = "";
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
  if (!query) query = window.location.search;
  if (query.startsWith('?')) query = query.substr(1);
  let obj = {};
  for (var part of query.split('&')) {
    if (part.indexOf('=') == -1) {
      obj[part] = true;
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
  var parts = [];
  for (var [k, v] of Object.entries(query)) {
    var key = encodeURIComponent(k);
    var val = encodeURIComponent(v);
    parts.push(`${key}=${val}`);
  }
  return "?" + parts.join("&");
}

/* Add the javascript file to the document's <head> */
Util.AddScript = function _Util_AddScript(src) {
  var s = document.createElement("script");
  s.setAttribute("type", "text/javascript");
  s.setAttribute("src", src);
  document.head.appendChild(s);
};

/* Add all of the javascript files to the document's <head> */
Util.AddScripts = function _Util_AddScripts(scripts) {
  for (var s of scripts) {
    Util.AddScript(s);
  }
};
