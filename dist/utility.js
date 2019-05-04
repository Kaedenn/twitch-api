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

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Util = {};
Util.__wskey = null;
Util.__wscfg = "kae-twapi-local-key";

/* Everyone needs an ASCII table */
Util.ASCII = "\0\x01\x02\x03\x04\x05\x06\x07\b\t\n" + "\x0B\f\r\x0E\x0F\x10\x11\x12\x13\x14" + "\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D" + "\x1E\x1F !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJK" + "LMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7F";

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
  var p_firefox = /\bFirefox\/[0-9.]+\b/;
  var p_chrome = /\bChrome\/[0-9.]+\b/;
  var p_tesla = /\bTesla\b/;
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
};
Util.Browser.Current = Util.Browser.Get();
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
};

/* Return true if any of the values satisfy the function given */
Array.prototype.any = function _Array_any(func) {
  if (!func) func = function _bool(x) {
    !!x;
  };
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = this[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var e = _step.value;

      if (func(e)) {
        return true;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return false;
};

/* Return true if all of the values satisfy the function given */
Array.prototype.all = function _Array_all(func) {
  if (!func) func = function _bool(x) {
    !!x;
  };
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = this[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var e = _step2.value;

      if (!func(e)) {
        return false;
      }
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  return true;
};

/* Obtain the maximal element from an array */
Array.prototype.max = function __Array_max(cmp) {
  if (!(cmp instanceof Function)) {
    cmp = function cmp(x) {
      return x;
    };
  }
  if (this.length == 0) {
    return undefined;
  }
  if (this.length == 1) {
    return this[0];
  }
  var max_value = cmp(this[0]);
  var max_elem = this[0];
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = this[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var e = _step3.value;

      if (cmp(e) > max_value) {
        max_elem = e;
        max_value = cmp(e);
      }
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return max_elem;
};

/* Obtain the minimal element from an array */
Array.prototype.min = function __Array_min(cmp) {
  if (!(cmp instanceof Function)) {
    cmp = function cmp(x) {
      return x;
    };
  }
  if (this.length == 0) {
    return undefined;
  }
  if (this.length == 1) {
    return this[0];
  }
  var min_value = cmp(this[0]);
  var min_elem = this[0];
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = this[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var e = _step4.value;

      if (cmp(e) < min_value) {
        min_elem = e;
        min_value = cmp(e);
      }
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  return min_elem;
};

/* Strip characters from left (pos) or right (neg) */
String.prototype._stripFrom = function _String__stripFrom(chrs, from) {
  var d = from > 0 ? 1 : -1;
  var i = from > 0 ? 0 : this.length - 1;
  if (!chrs) {
    chrs = [' ', '\r', '\n'];
  }
  while (d == 1 && i < this.length || d == -1 && i > 0) {
    if (!chrs.includes(this[i])) {
      break;
    }
    i += d;
  }
  if (d == 1) {
    return this.substr(i);
  } else if (d == -1) {
    return this.substr(0, i + 1);
  }
};

/* Remove `chrs` from the beginning and end of the string */
String.prototype.strip = function _String_strip(chrs) {
  return this._stripFrom(chrs, 1)._stripFrom(chrs, -1);
};

/* Remove `chrs` from the beginning of the string */
String.prototype.lstrip = function _String_lstrip(chrs) {
  return this._stripFrom(chrs, 1);
};

/* Remove `chrs` from the end of the string */
String.prototype.rstrip = function _String_rstrip(chrs) {
  return this._stripFrom(chrs, -1);
};

/* Escape a string for proper HTML printing */
String.prototype.escape = function _String_escape() {
  var result = this;
  result = result.replace(/&/g, '&amp;');
  result = result.replace(/</g, '&lt;');
  result = result.replace(/>/g, '&gt;');
  result = result.replace(/"/g, '&quot;');
  result = result.replace(/'/g, '&apos;');
  return result;
};

/* Obtain an escaped version of the string */
String.prototype.repr = function _String_repr() {
  return JSON.stringify(this);
};

/* Implement Array.map for strings */
String.prototype.map = function _String_map(func) {
  var result = "";
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = this[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var ch = _step5.value;

      result += func(ch);
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5.return) {
        _iterator5.return();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
  }

  return result;
};

/* Implement Array.forEach for strings */
String.prototype.forEach = function _String_forEach(func) {
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = this[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var ch = _step6.value;

      func(ch);
    }
  } catch (err) {
    _didIteratorError6 = true;
    _iteratorError6 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion6 && _iterator6.return) {
        _iterator6.return();
      }
    } finally {
      if (_didIteratorError6) {
        throw _iteratorError6;
      }
    }
  }
};

/* Return a string with the specified character changed */
String.prototype.withCharAt = function _String_withCharAt(chr, pos) {
  var result = this;
  if (pos >= 0 && pos < this.length) {
    result = this.substr(0, pos) + chr + this.substr(pos);
  }
  return result;
};

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
};

/* Ensure String.trimStart is present */
if (typeof "".trimStart != "function") {
  String.prototype.trimStart = function () {
    var i = 0;
    while (i < this.length && this[i] == ' ') {
      i += 1;
    }
    return i == 0 ? this : this.substr(i);
  };
}

/* Ensure String.trimEnd is present */
if (typeof "".trimEnd != "function") {
  String.prototype.trimEnd = function () {
    var i = this.length - 1;
    while (i > 0 && this[i] == ' ') {
      i -= 1;
    }
    return this.substr(0, i + 1);
  };
}

/* Escape a string for use in regex */
RegExp.escape = function _RegExp_escape(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/* End standard object additions 0}}} */

/* URL and URI handling {{{0 */

/* Ensure a URL is formatted properly */
Util.URL = function _Util_URL(url) {
  if (url.startsWith('//')) {
    var p = 'http:';
    if (window.location.protocol == "https:") {
      p = 'https:';
    }
    return p + url;
  }
  return url;
};

/* Converts an XHR onError object to an Error object */
Util.XHRError = function _Util_XHRError(obj) {
  var stack = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var e = JSON.parse(JSON.stringify(obj));
  if (stack !== null) {
    e.stack = stack;
  }
  Object.setPrototypeOf(e, Error.prototype);
  return e;
};

var _Util_API = function () {
  function _Util_API() {
    var headers = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var args = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, _Util_API);

    this._headers = headers || {};
    this._args = args || {};
  }

  /* Return an API object with the arguments given */


  _createClass(_Util_API, [{
    key: "_fetch_native",


    /* Fetch a resource using the native window.fetch API */
    value: function _fetch_native(url, parms) {
      var init = parms || {};
      init.headers = {};
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = Object.entries(this._args)[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var _step7$value = _slicedToArray(_step7.value, 2),
              k = _step7$value[0],
              v = _step7$value[1];

          init[k] = v;
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7.return) {
            _iterator7.return();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
        }
      }

      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = Object.entries(this._headers)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var _step8$value = _slicedToArray(_step8.value, 2),
              k = _step8$value[0],
              v = _step8$value[1];

          init.headers[k] = v;
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }

      return fetch(url, parms).then(function _fetch_then(resp) {
        if (!resp.ok) {
          Util.Throw(Error, url + ": " + resp.status + " " + resp.statusText);
        } else {
          return resp.json();
        }
      });
    }

    /* Fetch a resource using XMLHttpRequest */

  }, {
    key: "_fetch_xhr",
    value: function _fetch_xhr(url, parms) {
      var stack = Util.GetStack();
      return new Promise(function (resolve, reject) {
        var r = new XMLHttpRequest();
        r.onreadystatechange = function _XHR_onreadystatechange() {
          if (this.readyState == XMLHttpRequest.DONE) {
            resolve(JSON.parse(this.responseText));
          }
        };
        r.onerror = function _XHR_onerror(e) {
          e._stacktrace = stack;
          reject(e);
        };
        r.open(parms.method || "GET", url);
        var _iteratorNormalCompletion9 = true;
        var _didIteratorError9 = false;
        var _iteratorError9 = undefined;

        try {
          for (var _iterator9 = Object.entries(this._headers)[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
            var _step9$value = _slicedToArray(_step9.value, 2),
                k = _step9$value[0],
                v = _step9$value[1];

            r.setRequestHeader(k, v);
          }
        } catch (err) {
          _didIteratorError9 = true;
          _iteratorError9 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }
          } finally {
            if (_didIteratorError9) {
              throw _iteratorError9;
            }
          }
        }

        r.send(parms.body || null);
      });
    }

    /* Fetch the given URL with the given parameter object.
     * NOTE: Does no response status code checking */

  }, {
    key: "fetch",
    value: function fetch(url) {
      var parms = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (window.fetch) {
        return this._fetch_native(url, parms);
      } else {
        return this._fetch_xhr(url, parms);
      }
    }
  }, {
    key: "fetchCB",
    value: function fetchCB(url, parms, onSuccess) {
      var onError = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

      onError = onError || Util.Error;
      this.fetchAsync(url, parms).then(function _fetchCB_then(json) {
        onSuccess(json, this);
      }).catch(function _fetchCB_catch() {
        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        onError(args, this);
      });
    }
  }], [{
    key: "withArgs",
    value: function withArgs(args) {
      return new _Util_API(null, args);
    }
  }]);

  return _Util_API;
}();

Util.API = _Util_API;

/* End URL and URI handling 0}}} */

/* Error handling {{{0 */

Util.Throw = function _Util_Throw(type, msg) {
  var e = new type(msg + "\n" + Util.GetStack());
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
Util._stack_trim_begin_level = [0];
Util._stack_trim_end_level = [0];

/* Save the current top-stack trim level and push a new value to use */
Util.PushStackTrimBegin = function _Util_PushStackTrimBegin(level) {
  Util._stack_trim_begin_level.push(level);
};

/* Restore the saved top-stack trim level */
Util.PopStackTrimBegin = function _Util_PopStackTrimBegin() {
  if (Util._stack_trim_begin_level.length > 1) {
    Util._stack_trim_begin_level.pop();
  }
};

/* Save the current bottom-stack trim level and push a new value to use */
Util.PushStackTrimEnd = function _Util_PushStackTrimEnd(level) {
  Util._stack_trim_end_level.push(level);
};

/* Restore the saved bottom-stack trim level */
Util.PopStackTrimEnd = function _Util_PopStackTrimEnd() {
  if (Util._stack_trim_end_level.length > 1) {
    Util._stack_trim_end_level.pop();
  }
};

/* Get the current top-stack trim level */
Util.GetStackTrimBegin = function _Util_GetStackTrimBegin() {
  return Util._stack_trim_begin_level[Util._stack_trim_begin_level.length - 1];
};

/* Get the current bottom-stack trim level */
Util.GetStackTrimEnd = function _Util_GetStackTrimEnd() {
  return Util._stack_trim_end_level[Util._stack_trim_end_level.length - 1];
};

/* Obtain a stacktrace, applying the current stack trim levels */
Util.GetStack = function _Util_GetStack() {
  var lines = [];
  try {
    throw new Error();
  } catch (e) {
    lines = e.stack.trim().split("\n");
  }
  lines.shift(); /* Discard _Util_GetStack */
  for (var i = 0; i < Util.GetStackTrimBegin(); ++i) {
    lines.shift();
  }
  for (var _i2 = 0; _i2 < Util.GetStackTrimEnd(); ++_i2) {
    lines.pop();
  }
  return lines;
};

/* Parse a given stacktrace */
Util.ParseStack = function _Util_ParseStack(lines) {
  var frames = [];
  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = lines[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var line = _step10.value;

      var frame = {
        text: line,
        name: '???',
        file: window.location.pathname,
        line: 0,
        column: 0
      };
      frame.text = line;
      if (Util.Browser.IsChrome) {
        // "[ ]+at (function)\( as \[(function)\]\)? \((file):(line):(column)"
        var m = line.match(/^[ ]* at ([^ ]+)(?: \[as ([\w]+)\])? \((.*):([0-9]+):([0-9]+)\)$/);
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
        var _m = line.match(/([^@]*)@(.*):([0-9]+):([0-9]+)/);
        if (_m == null) {
          Util.ErrorOnly("Failed to parse stack frame", line);
          continue;
        }
        frame = {};
        frame.name = _m[1];
        frame.file = _m[2];
        frame.line = parseInt(_m[3]);
        frame.column = parseInt(_m[4]);
      } else if (Util.Browser.IsOBS) {} else if (Util.Browser.IsTesla) {}
      frames.push(frame);
    }
  } catch (err) {
    _didIteratorError10 = true;
    _iteratorError10 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion10 && _iterator10.return) {
        _iterator10.return();
      }
    } finally {
      if (_didIteratorError10) {
        throw _iteratorError10;
      }
    }
  }

  return frames;
};

/* Split a path into <dirname>/<basename> parts */
Util.SplitPath = function _Util_SplitPath(path) {
  if (path.indexOf('/') > -1) {
    return [path.substr(0, path.lastIndexOf('/')), path.substr(path.lastIndexOf('/') + 1)];
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
  var pieces = [];
  try {
    var _iteratorNormalCompletion11 = true;
    var _didIteratorError11 = false;
    var _iteratorError11 = undefined;

    try {
      for (var _iterator11 = paths[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
        var path = _step11.value;

        path = new URL(path).pathname;

        var _Util$SplitPath = Util.SplitPath(path),
            _Util$SplitPath2 = _slicedToArray(_Util$SplitPath, 2),
            dir = _Util$SplitPath2[0],
            file = _Util$SplitPath2[1];

        pieces.push([dir.split('/'), file]);
      }
    } catch (err) {
      _didIteratorError11 = true;
      _iteratorError11 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion11 && _iterator11.return) {
          _iterator11.return();
        }
      } finally {
        if (_didIteratorError11) {
          throw _iteratorError11;
        }
      }
    }
  } catch (e) {
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
  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = pieces[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var piece = _step12.value;

      if (piece[0].length > len) {
        len = piece[0].length;
        /* Copy to protect from modification below */
        ref_path = piece[0].slice(0);
      }
    }
    /* Strip the common prefix */
  } catch (err) {
    _didIteratorError12 = true;
    _iteratorError12 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion12 && _iterator12.return) {
        _iterator12.return();
      }
    } finally {
      if (_didIteratorError12) {
        throw _iteratorError12;
      }
    }
  }

  if (ref_path !== null) {
    var _loop = function _loop(i) {
      if (pieces.every(function (p) {
        return p[0][0] == ref_path[i];
      })) {
        var _iteratorNormalCompletion13 = true;
        var _didIteratorError13 = false;
        var _iteratorError13 = undefined;

        try {
          for (var _iterator13 = pieces[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
            var piece = _step13.value;
            piece[0] = piece[0].slice(1);
          }
        } catch (err) {
          _didIteratorError13 = true;
          _iteratorError13 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }
          } finally {
            if (_didIteratorError13) {
              throw _iteratorError13;
            }
          }
        }
      }
    };

    for (var i = 0; i < ref_path.length; ++i) {
      _loop(i);
    }
  }
  /* Join the paths back together */
  return pieces.map(function (v) {
    return Util.JoinPath(v[0].join('/'), v[1]);
  });
};

/* Format stack frames for output */
Util.FormatStack = function _Util_FormatStack(stack) {
  /* Strip out the common prefix directory */
  var paths = [];
  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = stack[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var frame = _step14.value;

      paths.push(frame.file);
    }
  } catch (err) {
    _didIteratorError14 = true;
    _iteratorError14 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion14 && _iterator14.return) {
        _iterator14.return();
      }
    } finally {
      if (_didIteratorError14) {
        throw _iteratorError14;
      }
    }
  }

  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length == paths.length);
  var result = [];
  for (var i = 0; i < paths.length; ++i) {
    result.push(stack[i].name + "@" + paths[i] + ":" + stack[i].line + ":" + stack[i].column);
  }
  return result.join("\n");
};

/* (internal) Output args to a console using the given func  */
Util._toConsole = function _Util__toConsole(func, args) {
  var stack = Util.ParseStack(Util.GetStack());
  stack.shift(); /* Discard Util._toConsole */
  stack.shift(); /* Discard Util._toConsole caller */
  console.group("From " + Util.FormatStack(stack));
  func.apply(console, args);
  console.groupEnd();
};

/* Logger object */

var LoggerUtility = function () {
  function LoggerUtility() {
    _classCallCheck(this, LoggerUtility);

    this._hooks = {};
    this._filters = {};
    var _iteratorNormalCompletion15 = true;
    var _didIteratorError15 = false;
    var _iteratorError15 = undefined;

    try {
      for (var _iterator15 = Object.values(LoggerUtility.SEVERITIES)[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
        var v = _step15.value;

        this._hooks[v] = [];
        this._filters[v] = [];
      }
    } catch (err) {
      _didIteratorError15 = true;
      _iteratorError15 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion15 && _iterator15.return) {
          _iterator15.return();
        }
      } finally {
        if (_didIteratorError15) {
          throw _iteratorError15;
        }
      }
    }
  }

  /* Object of severity name to severity number */


  _createClass(LoggerUtility, [{
    key: "_sev_value",


    /* Get the numeric value for the severity given */
    value: function _sev_value(sev) {
      return LoggerUtility.SEVERITIES[sev];
    }

    /* Validate that the given severity exists */

  }, {
    key: "_assert_sev",
    value: function _assert_sev(sev) {
      if (this._hooks[this._sev_value(sev)] === undefined) {
        console.exception("Logger: invalid severity " + sev);
        return false;
      }
      return true;
    }

    /* Hook function(sev, stacktrace, ...args) for the given severity */

  }, {
    key: "add_hook",
    value: function add_hook(fn) {
      var sev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "ALL";

      if (!this._assert_sev(sev)) {
        return false;
      }
      this._hooks[this._sev_value(sev)].push(fn);
      return true;
    }

    /* Add a filter function for the given severity
     * (NOTE: will be called with an array of arguments) */

  }, {
    key: "add_filter",
    value: function add_filter(func) {
      var sev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "ALL";

      if (!this._assert_sev(sev)) {
        return false;
      }
      this._filters[this._sev_value(sev)].push(func);
    }

    /* Test whether the message is filtered */

  }, {
    key: "should_filter",
    value: function should_filter(message_args, severity) {
      var sev = this._sev_value(severity);
      var _iteratorNormalCompletion16 = true;
      var _didIteratorError16 = false;
      var _iteratorError16 = undefined;

      try {
        for (var _iterator16 = Object.entries(this._filters)[Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
          var _step16$value = _slicedToArray(_step16.value, 2),
              key = _step16$value[0],
              filters = _step16$value[1];

          if (key >= sev) {
            var _iteratorNormalCompletion17 = true;
            var _didIteratorError17 = false;
            var _iteratorError17 = undefined;

            try {
              for (var _iterator17 = filters[Symbol.iterator](), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
                var filter = _step17.value;

                if (filter(message_args)) {
                  return true;
                }
              }
            } catch (err) {
              _didIteratorError17 = true;
              _iteratorError17 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion17 && _iterator17.return) {
                  _iterator17.return();
                }
              } finally {
                if (_didIteratorError17) {
                  throw _iteratorError17;
                }
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError16 = true;
        _iteratorError16 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion16 && _iterator16.return) {
            _iterator16.return();
          }
        } finally {
          if (_didIteratorError16) {
            throw _iteratorError16;
          }
        }
      }

      return false;
    }

    /* Return whether or not the given severity is enabled */

  }, {
    key: "severity_enabled",
    value: function severity_enabled(sev) {
      if (!this._assert_sev(sev)) {
        return false;
      }
      var val = this._sev_value(sev);
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

  }, {
    key: "do_log",
    value: function do_log(sev, argobj) {
      var stacktrace = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      if (!this.severity_enabled(sev)) {
        return;
      }
      if (this.should_filter(argobj, sev)) {
        return;
      }
      var val = this._sev_value(sev);
      var _iteratorNormalCompletion18 = true;
      var _didIteratorError18 = false;
      var _iteratorError18 = undefined;

      try {
        for (var _iterator18 = this._hooks[val][Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
          var hook = _step18.value;

          var args = [sev, stacktrace].concat(Util.ArgsToArray(argobj));
          hook.apply(hook, args);
        }
      } catch (err) {
        _didIteratorError18 = true;
        _iteratorError18 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion18 && _iterator18.return) {
            _iterator18.return();
          }
        } finally {
          if (_didIteratorError18) {
            throw _iteratorError18;
          }
        }
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

  }, {
    key: "Trace",
    value: function Trace() {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      this.do_log("TRACE", args, true);
    }
  }, {
    key: "Debug",
    value: function Debug() {
      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      this.do_log("DEBUG", args, true);
    }
  }, {
    key: "Info",
    value: function Info() {
      for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }

      this.do_log("INFO", args, true);
    }
  }, {
    key: "Warn",
    value: function Warn() {
      for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
        args[_key5] = arguments[_key5];
      }

      this.do_log("WARN", args, true);
    }
  }, {
    key: "Error",
    value: function Error() {
      for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
        args[_key6] = arguments[_key6];
      }

      this.do_log("ERROR", args, true);
    }

    /* Log the arguments given without a stacktrace */

  }, {
    key: "TraceOnly",
    value: function TraceOnly() {
      for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
        args[_key7] = arguments[_key7];
      }

      this.do_log("TRACE", args, false);
    }
  }, {
    key: "DebugOnly",
    value: function DebugOnly() {
      for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
        args[_key8] = arguments[_key8];
      }

      this.do_log("DEBUG", args, false);
    }
  }, {
    key: "InfoOnly",
    value: function InfoOnly() {
      for (var _len9 = arguments.length, args = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
        args[_key9] = arguments[_key9];
      }

      this.do_log("INFO", args, false);
    }
  }, {
    key: "WarnOnly",
    value: function WarnOnly() {
      for (var _len10 = arguments.length, args = Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {
        args[_key10] = arguments[_key10];
      }

      this.do_log("WARN", args, false);
    }
  }, {
    key: "ErrorOnly",
    value: function ErrorOnly() {
      for (var _len11 = arguments.length, args = Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {
        args[_key11] = arguments[_key11];
      }

      this.do_log("ERROR", args, false);
    }
  }], [{
    key: "SEVERITIES",
    get: function get() {
      return { ALL: 6, ERROR: 5, WARN: 4, INFO: 3, DEBUG: 2, TRACE: 1 };
    }
  }]);

  return LoggerUtility;
}();

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

var ColorParser = function () {
  function ColorParser() {
    _classCallCheck(this, ColorParser);

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

  _createClass(ColorParser, [{
    key: "_parse",
    value: function _parse(color) {
      if (this._cache[color]) {
        return this._cache[color];
      }
      this._e.style.color = null;
      this._e.style.color = color;
      if (this._e.style.color.length === 0) {
        Util.Throw(TypeError, "ColorParser: Invalid color " + color);
      }
      var rgbstr = getComputedStyle(this._e).color;
      var rgbtuple = [];
      var m = this._rgb_pat.exec(rgbstr) || this._rgba_pat.exec(rgbstr);
      if (m !== null) {
        rgbtuple = m.slice(1);
      } else {
        /* Shouldn't ever happen */
        Util.Throw("Failed to parse computed color " + rgbstr);
      }
      var r = Number(rgbtuple[0]);r = Number.isNaN(r) ? 0 : r;
      var g = Number(rgbtuple[1]);g = Number.isNaN(g) ? 0 : g;
      var b = Number(rgbtuple[2]);b = Number.isNaN(b) ? 0 : b;
      var res = [r, g, b];
      if (rgbtuple.length == 4 && rgbtuple[3] !== undefined) {
        var _a = Number(rgbtuple[3]);_a = Number.isNaN(_a) ? 0 : _a;
        res.push(_a);
      }
      this._cache[color] = res;
      return res;
    }
  }], [{
    key: "parse",
    value: function parse(color) {
      var failQuiet = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      if (Util._ColorParser == null) {
        Util._ColorParser = new ColorParser();
      }
      try {
        return Util._ColorParser._parse(color);
      } catch (e) {
        if (failQuiet) {
          return null;
        } else {
          throw e;
        }
      }
    }
  }]);

  return ColorParser;
}();

/* Class for handling colors and color arithmetic */


var _Util_Color = function () {
  _createClass(_Util_Color, null, [{
    key: "RGBToHSL",

    /* Convert (r, g, b) (0~255) to (h, s, l) (deg, 0~100, 0~100) */
    value: function RGBToHSL(r, g, b) {
      r /= 255;g /= 255;b /= 255;
      var max = Math.max(r, g, b);
      var min = Math.min(r, g, b);
      var d = max - min;
      var h = void 0;
      if (d === 0) h = 0;else if (max === r) h = (g - b) / d % 6;else if (max === g) h = (b - r) / d + 2;else if (max === b) h = (r - g) / d + 4;
      var l = (min + max) / 2;
      var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [h * 60, s, l];
    }

    /* Convert (h, s, l) (deg, 0~100, 0~100) to (r, g, b) (0~255) */

  }, {
    key: "HSLToRGB",
    value: function HSLToRGB(h, s, l) {
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var hp = h / 60.0;
      var x = c * (1 - Math.abs(hp % 2 - 1));
      var rgb1 = void 0;
      if (isNaN(h)) rgb1 = [0, 0, 0];else if (hp <= 1) rgb1 = [c, x, 0];else if (hp <= 2) rgb1 = [x, c, 0];else if (hp <= 3) rgb1 = [0, c, x];else if (hp <= 4) rgb1 = [0, x, c];else if (hp <= 5) rgb1 = [x, 0, c];else if (hp <= 6) rgb1 = [c, 0, x];
      var m = l - c * 0.5;
      var r = Math.round(255 * (rgb1[0] + m));
      var g = Math.round(255 * (rgb1[1] + m));
      var b = Math.round(255 * (rgb1[2] + m));
      return [r, g, b];
    }

    /* Convert (y, i, q) (0~255) to (r, g, b) (0~255) */

  }, {
    key: "YIQToRGB",
    value: function YIQToRGB(y, i, q) {
      var mat = [[1, 0.956, 0.619], [1, -0.272, -0.647], [1, -1.106, 1.703]];
      var r = mat[0][0] * y + mat[0][1] * i + mat[0][2] * q;
      var g = mat[1][0] * y + mat[1][1] * i + mat[1][2] * q;
      var b = mat[2][0] * y + mat[2][1] * i + mat[2][2] * q;
      return [r, g, b];
    }

    /* Convert (r, g, b) (0~255) to (y, i, q) (0~255) */

  }, {
    key: "RGBToYIQ",
    value: function RGBToYIQ(r, g, b) {
      var mat = [[0.299, 0.587, 0.144], [0.5959, -0.2746, -0.3213], [0.2155, -0.5227, 0.3112]];
      var y = mat[0][0] * r + mat[0][1] * g + mat[0][2] * b;
      var i = mat[1][0] * r + mat[1][1] * g + mat[1][2] * b;
      var q = mat[2][0] * r + mat[2][1] * g + mat[2][2] * b;
      return [y, i, q];
    }

    /* Renormalize (r, g, b[, a]) from 0~1 to 0~255 */

  }, {
    key: "Renorm1",
    value: function Renorm1() {
      for (var _len12 = arguments.length, args = Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {
        args[_key12] = arguments[_key12];
      }

      var r = args[0],
          g = args[1],
          b = args[2],
          a = args[3];

      if (a === undefined) {
        return [r / 255, g / 255, b / 255];
      } else {
        return [r / 255, g / 255, b / 255, a / 255];
      }
    }

    /* Renormalize (r, g, b[, a]) from 0~255 to 0~1 */

  }, {
    key: "Renorm255",
    value: function Renorm255() {
      for (var _len13 = arguments.length, args = Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {
        args[_key13] = arguments[_key13];
      }

      var r = args[0],
          g = args[1],
          b = args[2],
          a = args[3];

      if (a === undefined) {
        return [r * 255, g * 255, b * 255];
      } else {
        return [r * 255, g * 255, b * 255, a * 255];
      }
    }

    /* Create a Color object from the hue, saturation, and luminance given */

  }, {
    key: "FromHSL",
    value: function FromHSL(h, s, l) {
      var _Util$Color$HSLToRGB = Util.Color.HSLToRGB(h, s, l),
          _Util$Color$HSLToRGB2 = _slicedToArray(_Util$Color$HSLToRGB, 3),
          r = _Util$Color$HSLToRGB2[0],
          g = _Util$Color$HSLToRGB2[1],
          b = _Util$Color$HSLToRGB2[2];

      return new Util.Color(r, g, b);
    }

    /* Create a Color object from the hue, saturation, luminance, and alpha given */

  }, {
    key: "FromHSLA",
    value: function FromHSLA(h, s, l, a) {
      var _Util$Color$HSLToRGB3 = Util.Color.HSLToRGB(h, s, l),
          _Util$Color$HSLToRGB4 = _slicedToArray(_Util$Color$HSLToRGB3, 3),
          r = _Util$Color$HSLToRGB4[0],
          g = _Util$Color$HSLToRGB4[1],
          b = _Util$Color$HSLToRGB4[2];

      return new Util.Color(r, g, b, a);
    }

    /* Create a Color object from the YIQ values given */

  }, {
    key: "FromYIQ",
    value: function FromYIQ(y, i, q) {
      var _Util$Color$YIQToRGB = Util.Color.YIQToRGB(y, i, q),
          _Util$Color$YIQToRGB2 = _slicedToArray(_Util$Color$YIQToRGB, 3),
          r = _Util$Color$YIQToRGB2[0],
          g = _Util$Color$YIQToRGB2[1],
          b = _Util$Color$YIQToRGB2[2];

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

  }]);

  function _Util_Color() {
    for (var _len14 = arguments.length, args = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
      args[_key14] = arguments[_key14];
    }

    _classCallCheck(this, _Util_Color);

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
      var arg = args[0];
      if (arg instanceof Util.Color) {
        var _ref = [arg.r, arg.g, arg.b, arg.a];
        this.r = _ref[0];
        this.g = _ref[1];
        this.b = _ref[2];
        this.a = _ref[3];

        this.scale = arg.scale;
      } else if (typeof arg == "string" || arg instanceof String) {
        var _ColorParser$parse = ColorParser.parse(arg),
            _ColorParser$parse2 = _slicedToArray(_ColorParser$parse, 4),
            r = _ColorParser$parse2[0],
            g = _ColorParser$parse2[1],
            b = _ColorParser$parse2[2],
            _a2 = _ColorParser$parse2[3];

        var _ref2 = [r, g, b, _a2];
        this.r = _ref2[0];
        this.g = _ref2[1];
        this.b = _ref2[2];
        this.a = _ref2[3];
      } else {
        Util.Throw(TypeError, "Invalid argument \"" + arg + "\" to Color()");
      }
    } else if (args.length >= 3 && args.length <= 4) {
      var _args = args;
      /* Handle Color(r, g, b) and Color(r, g, b, a) */

      var _args2 = _slicedToArray(_args, 3);

      this.r = _args2[0];
      this.g = _args2[1];
      this.b = _args2[2];

      if (args.length == 4) this.a = args[3];
    } else if (args.length > 0) {
      Util.Throw("Invalid arguments \"" + args + "\" to Color()");
    }
  }

  /* Attribute: [r, g, b] */


  _createClass(_Util_Color, [{
    key: "getRelativeLuminance",


    /* Calculate the Relative Luminance */
    value: function getRelativeLuminance() {
      var _rgb_ = _slicedToArray(this.rgb_1, 3),
          r = _rgb_[0],
          g = _rgb_[1],
          b = _rgb_[2];

      function c_to_cx(c) {
        if (c < 0.03928) {
          return c / 12.92;
        } else {
          return Math.pow((c + 0.055) / 1.055, 2.4);
        }
      }
      return 0.2126 * c_to_cx(r) + 0.7152 * c_to_cx(g) + 0.0722 * c_to_cx(b);
    }

    /* Calculate the contrast ratio against the given color */

  }, {
    key: "getConstrastRatioWith",
    value: function getConstrastRatioWith(c2) {
      var l1 = this.getRelativeLuminance();
      var l2 = new Util.Color(c2).getRelativeLuminance();
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

  }, {
    key: "rgb",
    get: function get() {
      return [this.r, this.g, this.b];
    }

    /* Attribute: [r, g, b, a] */

  }, {
    key: "rgba",
    get: function get() {
      return [this.r, this.g, this.b, this.a];
    }

    /* Attribute: [r, g, b] scaled to [0,1] */

  }, {
    key: "rgb_1",
    get: function get() {
      var c = new Util.Color(this.r, this.g, this.b);
      return [c.r / 255, c.g / 255, c.b / 255];
    }

    /* Attribute: [r, g, b, a] scaled to [0,1] */

  }, {
    key: "rgba_1",
    get: function get() {
      var c = new Util.Color(this.r, this.g, this.b, this.a);
      return [c.r / 255, c.g / 255, c.b / 255, c.a / 255];
    }

    /* Attribute: [h, s, l] */

  }, {
    key: "hsl",
    get: function get() {
      return Util.Color.RGBToHSL(this.r, this.g, this.b);
    },
    set: function set(hsl) {
      var _hsl = _slicedToArray(hsl, 3),
          h = _hsl[0],
          s = _hsl[1],
          l = _hsl[2];

      var _Util$Color$HSLToRGB5 = Util.Color.HSLToRGB(h, s, l);

      var _Util$Color$HSLToRGB6 = _slicedToArray(_Util$Color$HSLToRGB5, 3);

      this.r = _Util$Color$HSLToRGB6[0];
      this.g = _Util$Color$HSLToRGB6[1];
      this.b = _Util$Color$HSLToRGB6[2];
    }

    /* Attribute: [h, s, l, a] */

  }, {
    key: "hsla",
    get: function get() {
      var _Util$Color$RGBToHSL = Util.Color.RGBToHSL(this.r, this.g, this.b),
          _Util$Color$RGBToHSL2 = _slicedToArray(_Util$Color$RGBToHSL, 3),
          r = _Util$Color$RGBToHSL2[0],
          g = _Util$Color$RGBToHSL2[1],
          b = _Util$Color$RGBToHSL2[2];

      return [r, g, b, a];
    },
    set: function set(hsla) {
      var _hsla = _slicedToArray(hsla, 4),
          h = _hsla[0],
          s = _hsla[1],
          l = _hsla[2],
          a = _hsla[3];

      var _Util$Color$HSLToRGB7 = Util.Color.HSLToRGB(h, s, l);

      var _Util$Color$HSLToRGB8 = _slicedToArray(_Util$Color$HSLToRGB7, 3);

      this.r = _Util$Color$HSLToRGB8[0];
      this.g = _Util$Color$HSLToRGB8[1];
      this.b = _Util$Color$HSLToRGB8[2];

      this.a = a;
    }

    /* Attribute: hue of [h, s, l] */

  }, {
    key: "hue",
    get: function get() {
      return this.hsl[0];
    },
    set: function set(new_h) {
      var _hsl2 = _slicedToArray(this.hsl, 3),
          h = _hsl2[0],
          s = _hsl2[1],
          l = _hsl2[2];

      h = new_h;

      var _Util$Color$HSLToRGB9 = Util.Color.HSLToRGB(h, s, l);

      var _Util$Color$HSLToRGB10 = _slicedToArray(_Util$Color$HSLToRGB9, 3);

      this.r = _Util$Color$HSLToRGB10[0];
      this.g = _Util$Color$HSLToRGB10[1];
      this.b = _Util$Color$HSLToRGB10[2];
    }

    /* Attribute: saturation of [h, s, l] */

  }, {
    key: "saturation",
    get: function get() {
      return this.hsl[1];
    },
    set: function set(new_s) {
      var _hsl3 = _slicedToArray(this.hsl, 3),
          h = _hsl3[0],
          s = _hsl3[1],
          l = _hsl3[2];

      s = new_s;

      var _Util$Color$HSLToRGB11 = Util.Color.HSLToRGB(h, s, l);

      var _Util$Color$HSLToRGB12 = _slicedToArray(_Util$Color$HSLToRGB11, 3);

      this.r = _Util$Color$HSLToRGB12[0];
      this.g = _Util$Color$HSLToRGB12[1];
      this.b = _Util$Color$HSLToRGB12[2];
    }

    /* Attribute: luminance of [h, s, l] */

  }, {
    key: "luminance",
    get: function get() {
      return this.hsl[2];
    },
    set: function set(new_l) {
      var _hsl4 = _slicedToArray(this.hsl, 3),
          h = _hsl4[0],
          s = _hsl4[1],
          l = _hsl4[2];

      l = new_l;

      var _Util$Color$HSLToRGB13 = Util.Color.HSLToRGB(h, s, l);

      var _Util$Color$HSLToRGB14 = _slicedToArray(_Util$Color$HSLToRGB13, 3);

      this.r = _Util$Color$HSLToRGB14[0];
      this.g = _Util$Color$HSLToRGB14[1];
      this.b = _Util$Color$HSLToRGB14[2];
    }

    /* Attribute: [y, i, q] */

  }, {
    key: "yiq",
    get: function get() {
      return Util.Color.RGBToYIQ(this.r, this.g, this.b);
    },
    set: function set(yiq) {
      var _yiq = _slicedToArray(yiq, 3),
          y = _yiq[0],
          i = _yiq[1],
          q = _yiq[2];

      var _Util$Color$YIQToRGB3 = Util.Color.YIQToRGB(y, i, q);

      var _Util$Color$YIQToRGB4 = _slicedToArray(_Util$Color$YIQToRGB3, 3);

      this.r = _Util$Color$YIQToRGB4[0];
      this.g = _Util$Color$YIQToRGB4[1];
      this.b = _Util$Color$YIQToRGB4[2];
    }
  }]);

  return _Util_Color;
}();

Util.Color = _Util_Color;

/* Parse a CSS color.
 * Overloads
 *  Util.ParseColor('css color spec')
 *  Util.ParseColor([r, g, b])
 *  Util.ParseColor([r, g, b, a])
 *  Util.ParseColor(r, g, b[, a]) */
Util.ParseCSSColor = function _Util_ParseColor() {
  for (var _len15 = arguments.length, color = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
    color[_key15] = arguments[_key15];
  }

  var r = 0,
      g = 0,
      b = 0,
      a = 0;
  if (color.length == 1) {
    color = color[0];
  }
  if (typeof color == "string") {
    var _ColorParser$parse3 = ColorParser.parse(color);

    var _ColorParser$parse4 = _slicedToArray(_ColorParser$parse3, 4);

    r = _ColorParser$parse4[0];
    g = _ColorParser$parse4[1];
    b = _ColorParser$parse4[2];
    a = _ColorParser$parse4[3];
  } else if ((typeof color === "undefined" ? "undefined" : _typeof(color)) == "object") {
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
};

/* Calculate the Relative Luminance of a color.
 * Overloads:
 *  Util.RelativeLuminance('css color spec')
 *  Util.RelativeLuminance([r, g, b])
 *  Util.RelativeLuminance([r, g, b, a])
 *  Util.RelativeLuminance(r, g, b[, a]) */
Util.RelativeLuminance = function _Util_RelativeLuminance() {
  for (var _len16 = arguments.length, args = Array(_len16), _key16 = 0; _key16 < _len16; _key16++) {
    args[_key16] = arguments[_key16];
  }

  var color = Util.ParseCSSColor(args.length == 1 ? args[0] : args);
  var color_rgb = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0];
  function c_to_cx(c) {
    if (c < 0.03928) {
      return c / 12.92;
    } else {
      return Math.pow((c + 0.055) / 1.055, 2.4);
    }
  }
  var l_red = 0.2126 * c_to_cx(color_rgb[0]);
  var l_green = 0.7152 * c_to_cx(color_rgb[1]);
  var l_blue = 0.0722 * c_to_cx(color_rgb[2]);
  return l_red + l_green + l_blue;
};

/* Calculate the Contrast Ratio between two colors */
Util.ContrastRatio = function _Util_ContrastRatio(c1, c2) {
  var l1 = Util.RelativeLuminance(c1);
  var l2 = Util.RelativeLuminance(c2);
  return (l1 + 0.05) / (l2 + 0.05);
};

/* Determine which color contrasts the best with the given color
 * Overloads:
 *  Util.GetMaxContrast(color, c1, c2, c3, ...)
 *  Util.GetMaxContrast(color, [c1, c2, c3, ...]) */
Util.GetMaxConstrast = function _Util_GetMaxContrast(c1) {
  for (var _len17 = arguments.length, colors = Array(_len17 > 1 ? _len17 - 1 : 0), _key17 = 1; _key17 < _len17; _key17++) {
    colors[_key17 - 1] = arguments[_key17];
  }

  var best_color = null;
  var best_contast = null;
  if (colors.length == 1 && Util.IsArray(colors[0])) {
    colors = colors[0];
  }
  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = colors[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var c = _step19.value;

      var contrast = Util.ContrastRatio(c1, c);
      if (best_color === null) {
        best_color = c;
        best_contrast = contrast;
      } else if (contrast > best_contrast) {
        best_color = c;
        best_contrast = contrast;
      }
    }
  } catch (err) {
    _didIteratorError19 = true;
    _iteratorError19 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion19 && _iterator19.return) {
        _iterator19.return();
      }
    } finally {
      if (_didIteratorError19) {
        throw _iteratorError19;
      }
    }
  }

  return best_color;
};

/* End color handling 0}}} */

/* Notification APIs {{{0 */
Util.Notification = function () {
  function _Util_Notification() {
    _classCallCheck(this, _Util_Notification);

    this._enabled = false;
    this._max = 2; /* max simultaneous notifications */
    this._active = {}; /* currently-active notifications */
  }

  _createClass(_Util_Notification, [{
    key: "acquire",
    value: function acquire() {
      if (this.available) {
        this._req_promise = window.Notification.requestPermission();
        this._req_promise.then(function _notif_then(s) {
          if (s === "granted") {
            this._enabled = true;
          } else {
            this._enabled = false;
          }
        }.bind(this));
      }
    }
  }, {
    key: "closeAll",
    value: function closeAll() {/* TODO */}
  }, {
    key: "notify",
    value: function notify(msg) {/* TODO */}
  }, {
    key: "available",
    get: function get() {
      return window.hasOwnProperty("Notification");
    }
  }, {
    key: "max",
    set: function set(m) {
      this._max = m;
    },
    get: function get() {
      return this._max;
    }
  }]);

  return _Util_Notification;
}();

Util.Notify = new Util.Notification();
/* End notification APIs 0}}} */

/* Return true if the given object inherits from the given typename */
Util.IsInstanceOf = function _Object_IsInstanceOf(obj, typename) {
  for (var p = obj; p; p = p.__proto__) {
    if (p.constructor.name == typename) {
      return true;
    }
  }
  return false;
};

/* Return true if the object is an array */
Util.IsArray = function _Util_IsArray(value) {
  /* Values are considered "arrays" if value[Symbol.iterator] is a function
   * and that object is not a string */
  if (typeof value === "string") return false;
  if (value && typeof value[Symbol.iterator] == "function") {
    return true;
  } else {
    return false;
  }
};

/* PRNG (Pseudo-Random Number Generator) {{{0 */
Util.RandomGenerator = function () {
  function _Util_Random(disable_crypto) {
    _classCallCheck(this, _Util_Random);

    this._crypto = null;
    if (disable_crypto) {
      Util.Warn("Forcibly disabling crypto");
    }
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      this._crypto = crypto;
    } else if (typeof msCrypto !== "undefined" && typeof window.msCrypto.getRandomValues == 'function') {
      this._crypto = msCrypto;
    } else {
      console.error("Failed to get secure PRNG; falling back to Math.random");
    }
  }

  /* Obtain Uint8Array of random values using crypto */


  _createClass(_Util_Random, [{
    key: "_genRandCrypto",
    value: function _genRandCrypto(num_bytes) {
      var a = new Uint8Array(num_bytes);
      this._crypto.getRandomValues(a);
      return a;
    }

    /* Obtain Uint8Array of random values using Math.random */

  }, {
    key: "_genRandMath",
    value: function _genRandMath(num_bytes) {
      var a = new Uint8Array(num_bytes);
      var r = 0;
      for (var i = 0; i < num_bytes; ++i) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        a[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }
      return a;
    }
  }, {
    key: "numToHex",
    value: function numToHex(num) {
      var pad = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;

      return num.toString("16").padStart(pad, "0");
    }
  }, {
    key: "bytesToHex",
    value: function bytesToHex(bytes) {
      var h = "";
      var _iteratorNormalCompletion20 = true;
      var _didIteratorError20 = false;
      var _iteratorError20 = undefined;

      try {
        for (var _iterator20 = bytes[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
          var byte = _step20.value;
          h += this.numToHex(byte);
        }
      } catch (err) {
        _didIteratorError20 = true;
        _iteratorError20 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion20 && _iterator20.return) {
            _iterator20.return();
          }
        } finally {
          if (_didIteratorError20) {
            throw _iteratorError20;
          }
        }
      }

      return h;
    }
  }, {
    key: "randBytes",
    value: function randBytes(num_bytes) {
      var encoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      var values = void 0;
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
  }, {
    key: "hex8",
    value: function hex8() {
      return this.randBytes(1, 'hex');
    }
  }, {
    key: "hex16",
    value: function hex16() {
      return this.randBytes(2, 'hex');
    }
  }, {
    key: "hex32",
    value: function hex32() {
      return this.randBytes(4, 'hex');
    }
  }, {
    key: "hex64",
    value: function hex64() {
      return this.randBytes(8, 'hex');
    }
  }, {
    key: "uuid",
    value: function uuid() {
      var a = this.randBytes(16);
      a[6] = a[6] & 0x0f | 0x40;
      a[8] = a[8] & 0x3f | 0x80;
      var h = this.bytesToHex(a);
      var parts = [[0, 8], [8, 4], [12, 4], [16, 4], [20, 12]];
      var result = [];
      parts.forEach(function (_ref3) {
        var _ref4 = _slicedToArray(_ref3, 2),
            s = _ref4[0],
            l = _ref4[1];

        return result.push(h.substr(s, l));
      });
      return result.join("-");
    }
  }]);

  return _Util_Random;
}();

Util.Random = new Util.RandomGenerator();
/* End PRNG 0}}} */

/* Escape the string and return a map of character movements */
Util.EscapeWithMap = function _Util_EscapeWithMap(s) {
  var result = "";
  var map = [];
  var i = 0,
      j = 0;
  while (i < s.length) {
    map.push(j);
    var r = Util.EscapeChars.hasOwnProperty(s[i]) ? Util.EscapeChars[s[i]] : s[i];
    result = result + r;
    i += 1;
    j += r.length;
  }
  return [result, map];
};

/* Convert an arguments object to an Array instance */
Util.ArgsToArray = function _Util_ArgsToArray(argobj) {
  return Array.of.apply(Array, argobj);
};

/* Event handling {{{0 */

Util._events = {};

Util.Bind = function _Util_Bind(evname, evcallback) {
  if (!Util._events[evname]) Util._events[evname] = [];
  Util._events[evname].push(evcallback);
};

Util.Unbind = function _Util_Unbind(evname, evcallback) {
  if (Util._events[evname]) {
    var i = Util._events[evname].indexOf(evcallback);
    if (i > -1) {
      Util._events[evname] = Util._events[evname].filter(function (e) {
        return e != evcallback;
      });
      return true;
    }
  }
  return false;
};

/* Fire an event: dispatchEvent with a _stacktrace attribute  */
Util.FireEvent = function _Util_FireEvent(e) {
  /* Add a stacktrace to the event for debugging reasons */
  e._stacktrace = Util.ParseStack(Util.GetStack());
  /* Discard the Util.FireEvent stack frame */
  e._stacktrace.shift();
  /* Fire the event across all the bound functions */
  if (Util._events[e.type]) {
    var _iteratorNormalCompletion21 = true;
    var _didIteratorError21 = false;
    var _iteratorError21 = undefined;

    try {
      for (var _iterator21 = Util._events[e.type][Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
        var f = _step21.value;

        f(e);
      }
    } catch (err) {
      _didIteratorError21 = true;
      _iteratorError21 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion21 && _iterator21.return) {
          _iterator21.return();
        }
      } finally {
        if (_didIteratorError21) {
          throw _iteratorError21;
        }
      }
    }
  }
  if (e instanceof Event) {
    document.dispatchEvent(e);
  }
};

/* End event handling 0}}} */

/* Zip two (or more) sequences together */
Util.Zip = function _Util_Zip() {
  var curr = [];
  var max_len = 0;
  /* Make sure everything's an array, calculate the max length */

  for (var _len18 = arguments.length, sequences = Array(_len18), _key18 = 0; _key18 < _len18; _key18++) {
    sequences[_key18] = arguments[_key18];
  }

  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = sequences[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var seq = _step22.value;

      var seq_array = Array.from(seq);
      max_len = Math.max(seq_array.length, max_len);
      curr.push(seq_array);
    }
    /* Ensure all arrays have the same size */
  } catch (err) {
    _didIteratorError22 = true;
    _iteratorError22 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion22 && _iterator22.return) {
        _iterator22.return();
      }
    } finally {
      if (_didIteratorError22) {
        throw _iteratorError22;
      }
    }
  }

  var _iteratorNormalCompletion23 = true;
  var _didIteratorError23 = false;
  var _iteratorError23 = undefined;

  try {
    for (var _iterator23 = curr[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
      var _seq = _step23.value;

      while (_seq.length < max_len) {
        _seq.push(undefined);
      }
    }
  } catch (err) {
    _didIteratorError23 = true;
    _iteratorError23 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion23 && _iterator23.return) {
        _iterator23.return();
      }
    } finally {
      if (_didIteratorError23) {
        throw _iteratorError23;
      }
    }
  }

  var result = [];
  /* Perform the zip operation */
  for (var i = 0; i < max_len; ++i) {
    var row = Array.from(curr, function () {
      return undefined;
    });
    for (var j = 0; j < curr.length; ++j) {
      row[j] = curr[j][i];
    }
    result.push(row);
  }
  /* And we're done */
  return result;
};

/* Number formatting */
Util.Pad = function _Util_Pad(n, digits, padChr) {
  if (padChr === undefined) {
    padChr = '0';
  }
  return new String(n).padStart(digits, padChr);
};

/* Convert a string to an array of character codes */
Util.StringToCodes = function _Util_StringToCodes(str) {
  var result = [];
  for (var i = 0; i < str.length; ++i) {
    result.push(str.charCodeAt(i));
  }
  return result;
};

/* Format a date object to "%Y-%m-%d %H:%M:%S.<ms>" */
Util.FormatDate = function _Util_FormatDate(date) {
  var _ref5 = [date.getFullYear(), date.getMonth(), date.getDay()],
      y = _ref5[0],
      m = _ref5[1],
      d = _ref5[2];
  var _ref6 = [date.getHours(), date.getMinutes(), date.getSeconds()],
      h = _ref6[0],
      mi = _ref6[1],
      s = _ref6[2];

  var ms = date.getMilliseconds();
  var p = [y, Util.Pad(m, 2), Util.Pad(d, 2), Util.Pad(h, 2), Util.Pad(mi, 2), Util.Pad(s, 2), Util.Pad(ms, 3)];
  return p[0] + "-" + p[1] + "-" + p[2] + " " + p[3] + ":" + p[4] + ":" + p[5] + "." + p[6];
};

/* Format an interval in seconds to "Xh Ym Zs" */
Util.FormatInterval = function _Util_FormatInterval(time) {
  var parts = [];
  time = Math.round(time);
  if (time < 0) {
    parts.push('-');
    time *= -1;
  }
  if (time % 60 != 0) {
    parts.unshift(time % 60 + "s");
  }
  time = Math.floor(time / 60);
  if (time > 0) {
    if (time % 60 != 0) {
      parts.unshift(time % 60 + "m");
    }
    time = Math.floor(time / 60);
  }
  if (time > 0) {
    parts.unshift(time + "h");
  }
  return parts.join(" ");
};

/* Special escaping {{{0 */

/* Build a character escape sequence for the code given */
Util.EscapeCharCode = function _Util_EscapeCharCode(code) {
  // Handle certain special escape sequences
  var special_chrs = "bfnrtv";
  var special = Util.StringToCodes("\b\f\n\r\t\v");
  if (special.indexOf(code) > -1) {
    return "\\" + special_chrs.charAt(special.indexOf(code));
  } else {
    return "\\x" + code.toString(16).padStart(2, '0');
  }
};

/* Strip escape characters from a string */
Util.EscapeSlashes = function _Util_EscapeSlashes(str) {
  var is_slash = function is_slash(c) {
    return c == "\\";
  };
  var is_ctrl = function is_ctrl(c) {
    return c.charCodeAt(0) < ' '.charCodeAt(0);
  };
  var result = "";
  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = Util.Zip(Util.StringToCodes(str), str)[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      var _step24$value = _slicedToArray(_step24.value, 2),
          cn = _step24$value[0],
          ch = _step24$value[1];

      if (cn < 0x20) result = result.concat(Util.EscapeCharCode(cn));else if (ch == '\\') result = result.concat('\\\\');else result = result.concat(ch);
    }
  } catch (err) {
    _didIteratorError24 = true;
    _iteratorError24 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion24 && _iterator24.return) {
        _iterator24.return();
      }
    } finally {
      if (_didIteratorError24) {
        throw _iteratorError24;
      }
    }
  }

  return result;
};

/* End special escaping 0}}} */

/* Configuration and localStorage functions {{{0 */

/* Obtain the configured localStorage key */
Util.GetWebStorageKey = function _Util_GetWebStorageKey() {
  if (Util.__wskey !== null) {
    return Util.__wskey;
  }
  var key = JSON.parse(window.localStorage.getItem(Util.__wscfg));
  return key; /* may be null */
};

/* Select the localStorage key to use */
Util.SetWebStorageKey = function _Util_SetWebStorageKey(key) {
  Util.__wskey = key;
  window.localStorage.setItem(Util.__wscfg, JSON.stringify(key));
};

/* Get and decode value, using either the configured key or the one given */
Util.GetWebStorage = function _Util_GetWebStorage() {
  var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

  if (key === null) {
    key = Util.GetWebStorageKey();
  }
  if (key === null) {
    Util.Error("Util.GetWebStorage called without a key configured");
  } else {
    var v = window.localStorage.getItem(key);
    if (v === null) return null;
    if (v === "") return "";
    return JSON.parse(v);
  }
};

/* JSON encode and store a localStorage value */
Util.SetWebStorage = function _Util_SetWebStorage(value) {
  var key = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  if (key === null) {
    key = Util.GetWebStorageKey();
  }
  if (key === null) {
    Util.Error("Util.SetWebStorage called without a key configured");
  } else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

/* Append a value to the given localStorage key */
Util.StorageAppend = function _Util_StorageAppend(key, value) {
  var v = Util.GetWebStorage(key);
  var new_v = [];
  if (v === null) {
    new_v = [value];
  } else if (!(v instanceof Array)) {
    new_v = [v, value];
  } else {
    new_v = v;
    new_v.push(value);
  }
  Util.SetWebStorage(new_v, key);
};

/* Class for handling configuration */

var ConfigStore = function () {
  function ConfigStore(key) {
    var noPersist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, ConfigStore);

    this._key = key;
    this._config = Util.GetWebStorage(this._key) || {};
    this._persist = {};
    if (Util.IsArray(noPersist)) {
      var _iteratorNormalCompletion25 = true;
      var _didIteratorError25 = false;
      var _iteratorError25 = undefined;

      try {
        for (var _iterator25 = noPersist[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
          var k = _step25.value;

          this._persist[k] = false;
        }
      } catch (err) {
        _didIteratorError25 = true;
        _iteratorError25 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion25 && _iterator25.return) {
            _iterator25.return();
          }
        } finally {
          if (_didIteratorError25) {
            throw _iteratorError25;
          }
        }
      }
    } else if (noPersist !== null) {
      Util.Warn("ConfigStore: noPersist: expected array, got", noPersist);
    }
  }

  _createClass(ConfigStore, [{
    key: "setPersist",
    value: function setPersist(key) {
      var persist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

      this._persist[key] = persist;
    }
  }, {
    key: "getPersists",
    value: function getPersists(key) {
      return this._persist.hasOwnProperty[key] && this._persist[key];
    }
  }, {
    key: "_merge",
    value: function _merge(k, v) {
      this._config[k] = v;
      Util.SetWebStorage(this._config, this._key);
    }
  }, {
    key: "addValue",
    value: function addValue(key, val) {
      this._merge(key, val);
    }
  }, {
    key: "addValues",
    value: function addValues(array) {
      var _iteratorNormalCompletion26 = true;
      var _didIteratorError26 = false;
      var _iteratorError26 = undefined;

      try {
        for (var _iterator26 = array[Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
          var _step26$value = _slicedToArray(_step26.value, 2),
              k = _step26$value[0],
              v = _step26$value[1];

          this.addValue(k, v);
        }
      } catch (err) {
        _didIteratorError26 = true;
        _iteratorError26 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion26 && _iterator26.return) {
            _iterator26.return();
          }
        } finally {
          if (_didIteratorError26) {
            throw _iteratorError26;
          }
        }
      }
    }
  }, {
    key: "addObject",
    value: function addObject(obj) {
      this.addValues(Object.entries(obj));
    }
  }, {
    key: "getValue",
    value: function getValue(k) {
      return this._config[k];
    }
  }]);

  return ConfigStore;
}();

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
  var obj = {};
  var _iteratorNormalCompletion27 = true;
  var _didIteratorError27 = false;
  var _iteratorError27 = undefined;

  try {
    for (var _iterator27 = query.split('&')[Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
      var part = _step27.value;

      if (part.indexOf('=') == -1) {
        obj[part] = true;
      } else if (part.startsWith('base64=')) {
        var val = decodeURIComponent(part.substr(part.indexOf('=') + 1));
        var _iteratorNormalCompletion28 = true;
        var _didIteratorError28 = false;
        var _iteratorError28 = undefined;

        try {
          for (var _iterator28 = Object.entries(Util.ParseQueryString(atob(val)))[Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
            var _step28$value = _slicedToArray(_step28.value, 2),
                k = _step28$value[0],
                v = _step28$value[1];

            obj[k] = v;
          }
        } catch (err) {
          _didIteratorError28 = true;
          _iteratorError28 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion28 && _iterator28.return) {
              _iterator28.return();
            }
          } finally {
            if (_didIteratorError28) {
              throw _iteratorError28;
            }
          }
        }
      } else {
        var key = part.substr(0, part.indexOf('='));
        var _val = part.substr(part.indexOf('=') + 1);
        _val = decodeURIComponent(_val);
        if (_val.length == 0) _val = false;else if (_val == "true") _val = true;else if (_val == "false") _val = false;else if (_val.match(/^[0-9]+$/)) _val = parseInt(_val);else if (_val.match(/^[0-9]+\.[0-9]+$/)) _val = parseFloat(_val);else if (_val === "null") _val = null;
        obj[key] = _val;
      }
    }
  } catch (err) {
    _didIteratorError27 = true;
    _iteratorError27 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion27 && _iterator27.return) {
        _iterator27.return();
      }
    } finally {
      if (_didIteratorError27) {
        throw _iteratorError27;
      }
    }
  }

  return obj;
};

/* Format a query string (including leading "?") */
Util.FormatQueryString = function _Util_FormatQueryString(query) {
  var parts = [];
  var _iteratorNormalCompletion29 = true;
  var _didIteratorError29 = false;
  var _iteratorError29 = undefined;

  try {
    for (var _iterator29 = Object.entries(query)[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
      var _step29$value = _slicedToArray(_step29.value, 2),
          k = _step29$value[0],
          v = _step29$value[1];

      var key = encodeURIComponent(k);
      var val = encodeURIComponent(v);
      parts.push(key + "=" + val);
    }
  } catch (err) {
    _didIteratorError29 = true;
    _iteratorError29 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion29 && _iterator29.return) {
        _iterator29.return();
      }
    } finally {
      if (_didIteratorError29) {
        throw _iteratorError29;
      }
    }
  }

  return "?" + parts.join("&");
};

/* End query string handling 0}}} */

/* Loading scripts {{{0 */

/* Add the javascript file to the document's <head> */
Util.AddScript = function _Util_AddScript(src) {
  var s = document.createElement("script");
  s.setAttribute("type", "text/javascript");
  s.setAttribute("src", src);
  document.head.appendChild(s);
};

/* Add all of the javascript files to the document's <head> */
Util.AddScripts = function _Util_AddScripts(scripts) {
  var _iteratorNormalCompletion30 = true;
  var _didIteratorError30 = false;
  var _iteratorError30 = undefined;

  try {
    for (var _iterator30 = scripts[Symbol.iterator](), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
      var s = _step30.value;

      Util.AddScript(s);
    }
  } catch (err) {
    _didIteratorError30 = true;
    _iteratorError30 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion30 && _iterator30.return) {
        _iterator30.return();
      }
    } finally {
      if (_didIteratorError30) {
        throw _iteratorError30;
      }
    }
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
};

/* Return whether or not the position is over the HTML element */
Util.PointIsOn = function _Util_PointIsOn(x, y, elem) {
  var rects = elem.getClientRects();
  var _iteratorNormalCompletion31 = true;
  var _didIteratorError31 = false;
  var _iteratorError31 = undefined;

  try {
    for (var _iterator31 = rects[Symbol.iterator](), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
      var rect = _step31.value;

      if (Util.RectContains(x, y, rect)) {
        return true;
      }
    }
  } catch (err) {
    _didIteratorError31 = true;
    _iteratorError31 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion31 && _iterator31.return) {
        _iterator31.return();
      }
    } finally {
      if (_didIteratorError31) {
        throw _iteratorError31;
      }
    }
  }

  return false;
};

/* End point-box functions 0}}} */

/* CSS functions {{{0 */

Util.CSS = {};

/* Get a stylesheet by filename */
Util.CSS.GetSheet = function _Util_CSS_GetSheet(filename) {
  var _iteratorNormalCompletion32 = true;
  var _didIteratorError32 = false;
  var _iteratorError32 = undefined;

  try {
    for (var _iterator32 = document.styleSheets[Symbol.iterator](), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
      var ss = _step32.value;

      if (ss.href.endsWith("/" + filename.trimStart('/'))) {
        return ss;
      }
    }
  } catch (err) {
    _didIteratorError32 = true;
    _iteratorError32 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion32 && _iterator32.return) {
        _iterator32.return();
      }
    } finally {
      if (_didIteratorError32) {
        throw _iteratorError32;
      }
    }
  }

  return null;
};

/* Given a stylesheet, obtain a rule definition by name */
Util.CSS.GetRule = function _Util_CSS_GetRule(css, rule_name) {
  var _iteratorNormalCompletion33 = true;
  var _didIteratorError33 = false;
  var _iteratorError33 = undefined;

  try {
    for (var _iterator33 = css.cssRules[Symbol.iterator](), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
      var rule = _step33.value;

      if (rule.selectorText == rule_name) {
        return rule;
      }
    }
  } catch (err) {
    _didIteratorError33 = true;
    _iteratorError33 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion33 && _iterator33.return) {
        _iterator33.return();
      }
    } finally {
      if (_didIteratorError33) {
        throw _iteratorError33;
      }
    }
  }

  return null;
};

/* Given a rule, enumerate the defined properties' names */
Util.CSS.GetPropertyNames = function _Util_CSS_GetPropertyNames(rule) {
  var styles = [];
  for (var i = 0; rule.style[i]; ++i) {
    styles.push(rule.style[i]);
  }
  return styles;
};

/* End CSS functions 0}}} */

/* Mark the Utility API as loaded */
Util.API_Loaded = true;
document.dispatchEvent(new Event("twapi-utility-loaded"));