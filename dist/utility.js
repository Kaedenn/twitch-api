"use strict";

/* TODO:
 * Rename Logger functions: "" -> "Stack", "Only" -> ""
 *  Logger.${Sev} -> Logger.${Sev}Stack
 *  Logger.${Sev}Only -> Logger.${Sev}
 *  Logger.${Sev}OnlyOnce -> Logger.${Sev}Once
 * Color replacement API (see KapChat)
 */

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

/* Special browser identification {{{0 */

Util.Browser = function () {
  function _Util_Browser() {
    _classCallCheck(this, _Util_Browser);
  }

  _createClass(_Util_Browser, null, [{
    key: "IsTesla",
    get: function get() {
      return navigator.userAgent.search(/\bTesla\b/) > -1;
    }
  }, {
    key: "IsOBS",
    get: function get() {
      return Boolean(window.obssource);
    }
  }]);

  return _Util_Browser;
}();

/* End of special browser identification 0}}} */

/* Portability considerations {{{0 */

Util.Defined = function _Util_Defined(identifier) {
  if (identifier.match(/^[$\w]+$/)) {
    try {
      new Function("return " + identifier)();
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

/* End portability code 0}}} */

/* Standard object additions and polyfills {{{0 */

/* Drop-in polyfills */
(function (G) {
  function polyfillIf(obj, cond, attr, val) {
    if (cond) {
      obj[attr] = val;
    }
  }
  function polyfill(obj, attr, val) {
    polyfillIf(obj, !obj[attr], attr, val);
  }

  /* console */

  polyfill(G, "console", {});
  polyfill(G.console, "assert", function _console_assert(cond) {
    if (!cond) {
      G.console.error("Assertion failed: " + cond);
    }
  });
  polyfill(G.console, "group", function _console_group(name) {
    G.console.log(">>> " + name);
  });
  polyfill(G.console, "groupEnd", function _console_groupEnd() {});

  /* Math */

  /* Calculates the divmod of the values given */
  polyfill(Math, "divmod", function _Math_divmod(r, n) {
    return [n / r, n % r];
  });

  /* Restrict a value to a given range */
  polyfill(Math, "clamp", function _Math_clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  });
})(window);

/* Return true if any of the values satisfy the function given */
if (typeof Array.prototype.any !== "function") {
  Array.prototype.any = function _Array_any(func) {
    if (!func) func = function func(b) {
      return b ? true : false;
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
}

/* Return true if all of the values satisfy the function given */
if (typeof Array.prototype.all !== "function") {
  Array.prototype.all = function _Array_all(func) {
    if (!func) func = function func(b) {
      return b ? true : false;
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
}

/* Array.concat polyfill: concatenate two or more arrays */
if (typeof Array.prototype.concat !== "function") {
  Array.prototype.concat = function _Array_concat() {
    var result = [];
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (var _iterator3 = this[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
        var i = _step3.value;

        result.push(i);
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

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
      for (var _iterator4 = args[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
        var seq = _step4.value;
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = seq[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var _i = _step5.value;

            result.push(_i);
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

    return result;
  };
}

/* Append one or more arrays, in-place */
Array.prototype.extend = function _Array_extend() {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = args[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var seq = _step6.value;
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = seq[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var i = _step7.value;

          this.push(i);
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

/* Obtain the maximal element from an array */
Array.prototype.max = function _Array_max(cmp) {
  if (!(cmp instanceof Function)) {
    cmp = function cmp(x) {
      return x;
    };
  }
  if (this.length === 0) {
    return undefined;
  }
  if (this.length === 1) {
    return this[0];
  }
  var max_value = cmp(this[0]);
  var max_elem = this[0];
  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = this[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var e = _step8.value;

      if (cmp(e) > max_value) {
        max_elem = e;
        max_value = cmp(e);
      }
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

  return max_elem;
};

/* Obtain the minimal element from an array */
Array.prototype.min = function _Array_min(cmp) {
  if (!(cmp instanceof Function)) {
    cmp = function cmp(x) {
      return x;
    };
  }
  if (this.length === 0) {
    return undefined;
  }
  if (this.length === 1) {
    return this[0];
  }
  var min_value = cmp(this[0]);
  var min_elem = this[0];
  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = this[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var e = _step9.value;

      if (cmp(e) < min_value) {
        min_elem = e;
        min_value = cmp(e);
      }
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

  return min_elem;
};

/* Construct an empty array with a specific number of entries */
Array.range = function _Array_range(nelem) {
  var dflt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var a = [];
  for (var i = 0; i < nelem; ++i) {
    a.push(dflt);
  }return a;
};

/* Remove `chrs` from the beginning and end of the string */
String.prototype.strip = function _String_strip(chrs) {
  var chars = [];
  if (chrs && chrs.length > 0) {
    var _iteratorNormalCompletion10 = true;
    var _didIteratorError10 = false;
    var _iteratorError10 = undefined;

    try {
      for (var _iterator10 = chrs[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
        var c = _step10.value;

        chars.push(c);
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
  } else {
    chars = [' ', '\r', '\n'];
  }
  var si = 0;
  var ei = this.length - 1;
  while (si < this.length && chars.indexOf(this[si]) > -1) {
    si += 1;
  }
  while (ei > 0 && chars.indexOf(this[ei]) > -1) {
    ei -= 1;
  }
  return si < ei ? this.substring(si, ei + 1) : "";
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

/* Implement Array.map for strings */
String.prototype.map = function _String_map(func) {
  var result = "";
  var _iteratorNormalCompletion11 = true;
  var _didIteratorError11 = false;
  var _iteratorError11 = undefined;

  try {
    for (var _iterator11 = this[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
      var ch = _step11.value;

      result += func(ch);
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

  return result;
};

/* Ensure String.trimStart is present */
if (typeof "".trimStart !== "function") {
  String.prototype.trimStart = function () {
    var i = 0;
    while (i < this.length && this[i] === ' ') {
      i += 1;
    }
    return i === 0 ? this : this.substr(i);
  };
}

/* Ensure String.trimEnd is present */
if (typeof "".trimEnd !== "function") {
  String.prototype.trimEnd = function () {
    var i = this.length - 1;
    while (i > 0 && this[i] === ' ') {
      i -= 1;
    }
    return this.substr(0, i + 1);
  };
}

/* Ensure String.trim is present */
if (typeof "".trim !== "function") {
  String.prototype.trim = function () {
    return this.trimStart().trimEnd();
  };
}

/* Create function to compare two strings as lower-case */
String.prototype.equalsLowerCase = function _String_equalsLowerCase(str) {
  var s1 = this.toLowerCase();
  var s2 = str.toLowerCase();
  return s1 === s2;
};

/* Create function to compare two strings as upper-case */
String.prototype.equalsUpperCase = function _String_equalsUpperCase(str) {
  var s1 = this.toUpperCase();
  var s2 = str.toUpperCase();
  return s1 === s2;
};

/* Map the numeric transformation over the string's characters */
String.prototype.transform = function _String_transform(func) {
  var result = [];
  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = this[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var ch = _step12.value;

      result.push(String.fromCharCode(func(ch.charCodeAt(0))));
    }
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

  return result.join("");
};

/* Per-character XOR with the byte given  */
String.prototype.xor = function _String_xor(byte) {
  return this.transform(function (i) {
    return i ^ byte;
  });
};

/* Escape a string for use in regex */
if (typeof RegExp.escape !== "function") {
  RegExp.escape = function _RegExp_escape(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
}

/* End standard object additions 0}}} */

/* Array and sequence functions {{{0 */

/* Return true if the object is an array */
Util.IsArray = function _Util_IsArray(value) {
  /* Values are considered "arrays" if value[Symbol.iterator] is a function
   * and that object is not a string */
  if (typeof value === "string") return false;
  if (value && typeof value[Symbol.iterator] === "function") {
    return true;
  } else {
    return false;
  }
};

/* Zip two (or more) sequences together */
Util.Zip = function _Util_Zip() {
  var curr = [];
  var max_len = 0;
  /* Make sure everything's an array, calculate the max length */

  for (var _len3 = arguments.length, sequences = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
    sequences[_key3] = arguments[_key3];
  }

  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = sequences[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var seq = _step13.value;

      var seq_array = Array.from(seq);
      max_len = Math.max(seq_array.length, max_len);
      curr.push(seq_array);
    }
    /* Ensure all arrays have the same size */
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

  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = curr[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var _seq = _step14.value;

      while (_seq.length < max_len) {
        _seq.push(undefined);
      }
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
    var p = 'http:';
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
      var _iteratorNormalCompletion15 = true;
      var _didIteratorError15 = false;
      var _iteratorError15 = undefined;

      try {
        for (var _iterator15 = Object.entries(this._args)[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
          var _ref = _step15.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var k = _ref2[0];
          var v = _ref2[1];

          init[k] = v;
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

      var _iteratorNormalCompletion16 = true;
      var _didIteratorError16 = false;
      var _iteratorError16 = undefined;

      try {
        for (var _iterator16 = Object.entries(this._headers)[Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
          var _ref3 = _step16.value;

          var _ref4 = _slicedToArray(_ref3, 2);

          var _k = _ref4[0];
          var _v = _ref4[1];

          init.headers[_k] = _v;
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
          if (this.readyState === XMLHttpRequest.DONE) {
            resolve(JSON.parse(this.responseText));
          }
        };
        r.onerror = function _XHR_onerror(e) {
          e._stacktrace = stack;
          reject(e);
        };
        r.open(parms.method || "GET", url);
        var _iteratorNormalCompletion17 = true;
        var _didIteratorError17 = false;
        var _iteratorError17 = undefined;

        try {
          for (var _iterator17 = Object.entries(this._headers)[Symbol.iterator](), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
            var _ref5 = _step17.value;

            var _ref6 = _slicedToArray(_ref5, 2);

            var k = _ref6[0];
            var v = _ref6[1];

            r.setRequestHeader(k, v);
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

        r.send(parms.body || null);
      }.bind(this));
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
      var self = this;
      this.fetchAsync(url, parms).then(function _fetchCB_then(json) {
        onSuccess(json, self);
      }).catch(function _fetchCB_catch() {
        for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }

        onError(args, self);
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
    var _iteratorNormalCompletion18 = true;
    var _didIteratorError18 = false;
    var _iteratorError18 = undefined;

    try {
      for (var _iterator18 = paths[Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
        var path = _step18.value;

        path = new URL(path).pathname;

        var _Util$SplitPath = Util.SplitPath(path),
            _Util$SplitPath2 = _slicedToArray(_Util$SplitPath, 2),
            dir = _Util$SplitPath2[0],
            file = _Util$SplitPath2[1];

        pieces.push([dir.split('/'), file]);
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
  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = pieces[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var piece = _step19.value;

      if (piece[0].length > len) {
        len = piece[0].length;
        /* Copy to protect from modification below */
        ref_path = piece[0].slice(0);
      }
    }
    /* Strip the common prefix */
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

  if (ref_path !== null) {
    var _loop = function _loop(i) {
      if (pieces.every(function (p) {
        return p[0][0] === ref_path[i];
      })) {
        var _iteratorNormalCompletion20 = true;
        var _didIteratorError20 = false;
        var _iteratorError20 = undefined;

        try {
          for (var _iterator20 = pieces[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
            var _piece = _step20.value;
            _piece[0] = _piece[0].slice(1);
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

/* End URL handling 0}}} */

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
  var _iteratorNormalCompletion21 = true;
  var _didIteratorError21 = false;
  var _iteratorError21 = undefined;

  try {
    for (var _iterator21 = lines[Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
      var line = _step21.value;

      var frame = {
        text: line,
        name: '???',
        file: window.location.pathname,
        line: 0,
        column: 0
      };
      frame.text = line;
      var m = null;
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

  return frames;
};

/* Format stack frames for output */
Util.FormatStack = function _Util_FormatStack(stack) {
  /* Strip out the common prefix directory */
  var paths = [];
  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = stack[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var frame = _step22.value;

      paths.push(frame.file);
    }
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

  paths = Util.StripCommonPrefix(paths);
  console.assert(stack.length === paths.length);
  var result = [];
  for (var i = 0; i < paths.length; ++i) {
    if (stack[i].name === "???") {
      result.push(stack[i].text);
    } else {
      result.push(stack[i].name + "@" + paths[i] + ":" + stack[i].line + ":" + stack[i].column);
    }
  }
  return result.join("\n");
};

/* Logger object */

var LoggerUtility = function () {
  function LoggerUtility() {
    _classCallCheck(this, LoggerUtility);

    this._hooks = {};
    this._filters = {};
    this._logged_messages = {};
    var _iteratorNormalCompletion23 = true;
    var _didIteratorError23 = false;
    var _iteratorError23 = undefined;

    try {
      for (var _iterator23 = Object.values(LoggerUtility.SEVERITIES)[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
        var v = _step23.value;

        this._hooks[v] = [];
        this._filters[v] = [];
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
  }

  /* (internal) Output args to a console using the given func  */


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
        console.error("Logger: invalid severity " + sev);
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

    /* Add a filter function for the given severity. Messages returning `false`
     * will be shown; ones returning `true` will be filtered out.
     * Overloads:
     *   add_filter(function, sev="ALL")
     *     `function` will be called with one argument: [log_arg1, log_arg2, ...]
     *   add_filter(regex, sev="ALL")
     *     Filter if regex matches log_args.toString()
     *   add_filter(string, sev="ALL")
     *     Filter if log_args.toString().indexOf(string) > -1 */

  }, {
    key: "add_filter",
    value: function add_filter(filter_obj) {
      var sev = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "ALL";

      if (!this._assert_sev(sev)) {
        return false;
      }
      var func = function func() {
        return false;
      };
      if (filter_obj instanceof RegExp) {
        func = function func(args) {
          return ("" + args).match(filter_obj);
        };
      } else if (typeof filter_obj === "string") {
        func = function func(args) {
          return ("" + args).indexOf(filter_obj) > -1;
        };
      } else {
        func = filter_obj;
      }
      this._filters[this._sev_value(sev)].push(func);
    }

    /* Test whether the message is filtered */

  }, {
    key: "should_filter",
    value: function should_filter(message_args, severity) {
      var sev = this._sev_value(severity);
      var _iteratorNormalCompletion24 = true;
      var _didIteratorError24 = false;
      var _iteratorError24 = undefined;

      try {
        for (var _iterator24 = Object.entries(this._filters)[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
          var _ref7 = _step24.value;

          var _ref8 = _slicedToArray(_ref7, 2);

          var key = _ref8[0];
          var filters = _ref8[1];

          if (key >= sev) {
            var _iteratorNormalCompletion25 = true;
            var _didIteratorError25 = false;
            var _iteratorError25 = undefined;

            try {
              for (var _iterator25 = filters[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
                var filter = _step25.value;

                if (filter(message_args)) {
                  return true;
                }
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
          }
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

  }, {
    key: "do_log",
    value: function do_log(sev, argobj) {
      var stacktrace = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var log_once = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

      var val = this._sev_value(sev);
      if (!this.severity_enabled(sev)) {
        return;
      }
      if (this.should_filter(argobj, sev)) {
        return;
      }
      if (log_once) {
        var argstr = JSON.stringify(argobj);
        var msg_key = JSON.stringify([val, argstr]);
        if (this._logged_messages[msg_key]) {
          return;
        } else {
          this._logged_messages[msg_key] = 1;
        }
      }
      var _iteratorNormalCompletion26 = true;
      var _didIteratorError26 = false;
      var _iteratorError26 = undefined;

      try {
        for (var _iterator26 = this._hooks[val][Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
          var hook = _step26.value;

          var args = [sev, stacktrace].concat(Util.ArgsToArray(argobj));
          hook.apply(hook, args);
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

      var func = LoggerUtility.FUNCTION_MAP[val];
      if (stacktrace) {
        Util.PushStackTrimBegin(Math.max(Util.GetStackTrimBegin(), 1));
        LoggerUtility._toConsole(func, argobj);
        Util.PopStackTrimBegin();
      } else {
        func.apply(console, argobj);
      }
    }

    /* Convert the arguments given to a single string */

  }, {
    key: "stringify",
    value: function stringify() {
      var result = [];

      for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
        args[_key5] = arguments[_key5];
      }

      var _iteratorNormalCompletion27 = true;
      var _didIteratorError27 = false;
      var _iteratorError27 = undefined;

      try {
        for (var _iterator27 = args[Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
          var arg = _step27.value;

          if (arg === null) result.push("null");else if (typeof arg === "undefined") result.push("undefined");else if (typeof arg === "string") result.push(JSON.stringify(arg));else if (typeof arg === "number") result.push("" + arg);else if (typeof arg === "boolean") result.push("" + arg);else if ((typeof arg === "undefined" ? "undefined" : _typeof(arg)) === "symbol") result.push(arg.toString());else if (typeof arg === "function") {
            result.push(("" + arg).replace(/\n/, "\\n"));
          } else {
            result.push(JSON.stringify(arg));
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

      return result.join(" ");
    }

    /* Log the arguments given with a stacktrace */

  }, {
    key: "Trace",
    value: function Trace() {
      for (var _len6 = arguments.length, args = Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {
        args[_key6] = arguments[_key6];
      }

      this.do_log("TRACE", args, true, false);
    }
  }, {
    key: "Debug",
    value: function Debug() {
      for (var _len7 = arguments.length, args = Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {
        args[_key7] = arguments[_key7];
      }

      this.do_log("DEBUG", args, true, false);
    }
  }, {
    key: "Info",
    value: function Info() {
      for (var _len8 = arguments.length, args = Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {
        args[_key8] = arguments[_key8];
      }

      this.do_log("INFO", args, true, false);
    }
  }, {
    key: "Warn",
    value: function Warn() {
      for (var _len9 = arguments.length, args = Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {
        args[_key9] = arguments[_key9];
      }

      this.do_log("WARN", args, true, false);
    }
  }, {
    key: "Error",
    value: function Error() {
      for (var _len10 = arguments.length, args = Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {
        args[_key10] = arguments[_key10];
      }

      this.do_log("ERROR", args, true, false);
    }

    /* Log the arguments given without a stacktrace */

  }, {
    key: "TraceOnly",
    value: function TraceOnly() {
      for (var _len11 = arguments.length, args = Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {
        args[_key11] = arguments[_key11];
      }

      this.do_log("TRACE", args, false, false);
    }
  }, {
    key: "DebugOnly",
    value: function DebugOnly() {
      for (var _len12 = arguments.length, args = Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {
        args[_key12] = arguments[_key12];
      }

      this.do_log("DEBUG", args, false, false);
    }
  }, {
    key: "InfoOnly",
    value: function InfoOnly() {
      for (var _len13 = arguments.length, args = Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {
        args[_key13] = arguments[_key13];
      }

      this.do_log("INFO", args, false, false);
    }
  }, {
    key: "WarnOnly",
    value: function WarnOnly() {
      for (var _len14 = arguments.length, args = Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {
        args[_key14] = arguments[_key14];
      }

      this.do_log("WARN", args, false, false);
    }
  }, {
    key: "ErrorOnly",
    value: function ErrorOnly() {
      for (var _len15 = arguments.length, args = Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {
        args[_key15] = arguments[_key15];
      }

      this.do_log("ERROR", args, false, false);
    }

    /* Log the arguments given with a stacktrace, once */

  }, {
    key: "TraceOnce",
    value: function TraceOnce() {
      for (var _len16 = arguments.length, args = Array(_len16), _key16 = 0; _key16 < _len16; _key16++) {
        args[_key16] = arguments[_key16];
      }

      this.do_log("TRACE", args, true, true);
    }
  }, {
    key: "DebugOnce",
    value: function DebugOnce() {
      for (var _len17 = arguments.length, args = Array(_len17), _key17 = 0; _key17 < _len17; _key17++) {
        args[_key17] = arguments[_key17];
      }

      this.do_log("DEBUG", args, true, true);
    }
  }, {
    key: "InfoOnce",
    value: function InfoOnce() {
      for (var _len18 = arguments.length, args = Array(_len18), _key18 = 0; _key18 < _len18; _key18++) {
        args[_key18] = arguments[_key18];
      }

      this.do_log("INFO", args, true, true);
    }
  }, {
    key: "WarnOnce",
    value: function WarnOnce() {
      for (var _len19 = arguments.length, args = Array(_len19), _key19 = 0; _key19 < _len19; _key19++) {
        args[_key19] = arguments[_key19];
      }

      this.do_log("WARN", args, true, true);
    }
  }, {
    key: "ErrorOnce",
    value: function ErrorOnce() {
      for (var _len20 = arguments.length, args = Array(_len20), _key20 = 0; _key20 < _len20; _key20++) {
        args[_key20] = arguments[_key20];
      }

      this.do_log("ERROR", args, true, true);
    }

    /* Log the arguments given without a stacktrace, once */

  }, {
    key: "TraceOnlyOnce",
    value: function TraceOnlyOnce() {
      for (var _len21 = arguments.length, args = Array(_len21), _key21 = 0; _key21 < _len21; _key21++) {
        args[_key21] = arguments[_key21];
      }

      this.do_log("TRACE", args, false, true);
    }
  }, {
    key: "DebugOnlyOnce",
    value: function DebugOnlyOnce() {
      for (var _len22 = arguments.length, args = Array(_len22), _key22 = 0; _key22 < _len22; _key22++) {
        args[_key22] = arguments[_key22];
      }

      this.do_log("DEBUG", args, false, true);
    }
  }, {
    key: "InfoOnlyOnce",
    value: function InfoOnlyOnce() {
      for (var _len23 = arguments.length, args = Array(_len23), _key23 = 0; _key23 < _len23; _key23++) {
        args[_key23] = arguments[_key23];
      }

      this.do_log("INFO", args, false, true);
    }
  }, {
    key: "WarnOnlyOnce",
    value: function WarnOnlyOnce() {
      for (var _len24 = arguments.length, args = Array(_len24), _key24 = 0; _key24 < _len24; _key24++) {
        args[_key24] = arguments[_key24];
      }

      this.do_log("WARN", args, false, true);
    }
  }, {
    key: "ErrorOnlyOnce",
    value: function ErrorOnlyOnce() {
      for (var _len25 = arguments.length, args = Array(_len25), _key25 = 0; _key25 < _len25; _key25++) {
        args[_key25] = arguments[_key25];
      }

      this.do_log("ERROR", args, false, true);
    }
  }], [{
    key: "_toConsole",
    value: function _toConsole(func, args) {
      var stack = Util.ParseStack(Util.GetStack());
      stack.shift(); /* Discard _toConsole */
      stack.shift(); /* Discard _toConsole caller */
      console.group("From " + Util.FormatStack(stack));
      func.apply(console, args);
      console.groupEnd();
    }

    /* Map severity name to severity number */

  }, {
    key: "SEVERITIES",
    get: function get() {
      return { ALL: 6, ERROR: 5, WARN: 4, INFO: 3, DEBUG: 2, TRACE: 1 };
    }

    /* Map severity number to console function */

  }, {
    key: "FUNCTION_MAP",
    get: function get() {
      var map = {};
      map[LoggerUtility.SEVERITIES.ALL] = console.debug;
      map[LoggerUtility.SEVERITIES.ERROR] = console.error;
      map[LoggerUtility.SEVERITIES.WARN] = console.warn;
      map[LoggerUtility.SEVERITIES.INFO] = console.info;
      map[LoggerUtility.SEVERITIES.DEBUG] = console.debug;
      map[LoggerUtility.SEVERITIES.TRACE] = console.trace;
      return map;
    }
  }]);

  return LoggerUtility;
}();

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
      if (rgbtuple.length === 4 && rgbtuple[3] !== undefined) {
        var a = Number(rgbtuple[3]);a = Number.isNaN(a) ? 0 : a;
        res.push(a);
      }
      this._cache[color] = res;
      return res;
    }
  }], [{
    key: "parse",
    value: function parse(color) {
      var failQuiet = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

      if (Util._ColorParser === null) {
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


Util.Color = function () {
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
      for (var _len26 = arguments.length, args = Array(_len26), _key26 = 0; _key26 < _len26; _key26++) {
        args[_key26] = arguments[_key26];
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
      for (var _len27 = arguments.length, args = Array(_len27), _key27 = 0; _key27 < _len27; _key27++) {
        args[_key27] = arguments[_key27];
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
    for (var _len28 = arguments.length, args = Array(_len28), _key28 = 0; _key28 < _len28; _key28++) {
      args[_key28] = arguments[_key28];
    }

    _classCallCheck(this, _Util_Color);

    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 255;
    /* Handle Color([...]) -> Color(...) */
    if (args.length === 1 && args[0] instanceof Array) {
      args = args[0];
    }
    if (args.length === 1) {
      /* Handle Color(Color) and Color("string") */
      var arg = args[0];
      if (arg instanceof Util.Color) {
        var _ref9 = [arg.r, arg.g, arg.b, arg.a];
        this.r = _ref9[0];
        this.g = _ref9[1];
        this.b = _ref9[2];
        this.a = _ref9[3];

        this.scale = arg.scale;
      } else if (typeof arg === "string" || arg instanceof String) {
        var _ColorParser$parse = ColorParser.parse(arg),
            _ColorParser$parse2 = _slicedToArray(_ColorParser$parse, 4),
            r = _ColorParser$parse2[0],
            g = _ColorParser$parse2[1],
            b = _ColorParser$parse2[2],
            a = _ColorParser$parse2[3];

        var _ref10 = [r, g, b, a];
        this.r = _ref10[0];
        this.g = _ref10[1];
        this.b = _ref10[2];
        this.a = _ref10[3];
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

      if (args.length === 4) this.a = args[3];
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
     *    rgb1 -> hsl -> rgb2 => rgb1 === rgb2
     *  Case 2:
     *    rgba1 -> hsla -> rgba2 => rgba1 === rgba2
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

      return [r, g, b, this.a];
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

/* Parse a CSS color.
 * Overloads
 *  Util.ParseCSSColor('css color spec')
 *  Util.ParseCSSColor([r, g, b])
 *  Util.ParseCSSColor([r, g, b, a])
 *  Util.ParseCSSColor(r, g, b[, a]) */
Util.ParseCSSColor = function _Util_ParseCSSColor() {
  for (var _len29 = arguments.length, color = Array(_len29), _key29 = 0; _key29 < _len29; _key29++) {
    color[_key29] = arguments[_key29];
  }

  var r = 0,
      g = 0,
      b = 0,
      a = 0;
  if (color.length === 1) {
    color = color[0];
  }
  if (typeof color === "string") {
    var _ColorParser$parse3 = ColorParser.parse(color);

    var _ColorParser$parse4 = _slicedToArray(_ColorParser$parse3, 4);

    r = _ColorParser$parse4[0];
    g = _ColorParser$parse4[1];
    b = _ColorParser$parse4[2];
    a = _ColorParser$parse4[3];
  } else if ((typeof color === "undefined" ? "undefined" : _typeof(color)) === "object") {
    if (color.length === 3 || color.length === 4) {
      r = color[0];
      g = color[1];
      b = color[2];
      if (color.length === 4) {
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
  for (var _len30 = arguments.length, args = Array(_len30), _key30 = 0; _key30 < _len30; _key30++) {
    args[_key30] = arguments[_key30];
  }

  var color = Util.ParseCSSColor(args.length === 1 ? args[0] : args);
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
  return l1 < l2 ? (l2 + 0.05) / (l1 + 0.05) : (l1 + 0.05) / (l2 + 0.05);
};

/* Determine which color contrasts the best with the given color
 * Overloads:
 *  Util.GetMaxContrast(color, c1, c2, c3, ...)
 *  Util.GetMaxContrast(color, [c1, c2, c3, ...]) */
Util.GetMaxContrast = function _Util_GetMaxContrast(c1) {
  for (var _len31 = arguments.length, colors = Array(_len31 > 1 ? _len31 - 1 : 0), _key31 = 1; _key31 < _len31; _key31++) {
    colors[_key31 - 1] = arguments[_key31];
  }

  var best_color = null;
  var best_contrast = null;
  if (colors.length === 1 && Util.IsArray(colors[0])) {
    colors = colors[0];
  }
  var _iteratorNormalCompletion28 = true;
  var _didIteratorError28 = false;
  var _iteratorError28 = undefined;

  try {
    for (var _iterator28 = colors[Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
      var c = _step28.value;

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

  return best_color;
};

/* End color handling 0}}} */

/* PRNG (Pseudo-Random Number Generator) {{{0 */

Util.RandomGenerator = function () {
  function _Util_Random(disable_crypto) {
    _classCallCheck(this, _Util_Random);

    this._crypto = null;
    if (disable_crypto) {
      Util.Warn("Forcibly disabling crypto");
    } else {
      this._crypto = this._getCrypto();
    }
  }

  _createClass(_Util_Random, [{
    key: "_getCrypto",
    value: function _getCrypto() {
      if (Util.Defined("crypto")) {
        if (new Function("return crypto.getRandomValues")()) {
          return new Function("return crypto")();
        }
      }
      if (Util.Defined("msCrypto")) {
        return new Function("return msCrypto")();
      }
      Util.Error("Failed to get secure PRNG; falling back to Math.random");
      return null;
    }

    /* Obtain Uint8Array of random values using crypto */

  }, {
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
      var _iteratorNormalCompletion29 = true;
      var _didIteratorError29 = false;
      var _iteratorError29 = undefined;

      try {
        for (var _iterator29 = bytes[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
          var byte = _step29.value;
          h += this.numToHex(byte);
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
      parts.forEach(function (_ref11) {
        var _ref12 = _slicedToArray(_ref11, 2),
            s = _ref12[0],
            l = _ref12[1];

        return result.push(h.substr(s, l));
      });
      return result.join("-");
    }
  }]);

  return _Util_Random;
}();

Util.Random = new Util.RandomGenerator();

/* End PRNG 0}}} */

/* Event handling {{{0 */

Util._events = {};
Util._events_default = null;

/* Bind a function to an event by name */
Util.Bind = function _Util_Bind(evname, evcallback) {
  if (!Util._events[evname]) Util._events[evname] = [];
  Util._events[evname].push(evcallback);
};

/* Call a function if an event is unbound */
Util.BindDefault = function _Util_BindDefault(callback) {
  Util._events_default = callback;
};

/* Unbind a callback from an event */
Util.Unbind = function _Util_Unbind(evname, evcallback) {
  if (Util._events[evname]) {
    var i = Util._events[evname].indexOf(evcallback);
    if (i > -1) {
      Util._events[evname] = Util._events[evname].filter(function (e) {
        return e !== evcallback;
      });
      return true;
    }
  }
  return false;
};

/* Fire an event: dispatchEvent with a _stacktrace attribute  */
Util.FireEvent = function _Util_FireEvent(e) {
  var fired = false;
  /* Add a stacktrace to the event for debugging reasons */
  e._stacktrace = Util.ParseStack(Util.GetStack());
  /* Discard the Util.FireEvent stack frame */
  e._stacktrace.shift();
  /* Fire the event across all the bound functions */
  if (Util._events[e.type]) {
    var _iteratorNormalCompletion30 = true;
    var _didIteratorError30 = false;
    var _iteratorError30 = undefined;

    try {
      for (var _iterator30 = Util._events[e.type][Symbol.iterator](), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
        var f = _step30.value;

        f(e);
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

/* Characters requiring HTML escaping (used by String.escape) */
Util.EscapeChars = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "&": "&amp;"
};

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
  var _ref13 = [date.getFullYear(), date.getMonth(), date.getDay()],
      y = _ref13[0],
      m = _ref13[1],
      d = _ref13[2];
  var _ref14 = [date.getHours(), date.getMinutes(), date.getSeconds()],
      h = _ref14[0],
      mi = _ref14[1],
      s = _ref14[2];

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
  if (time % 60 !== 0) {
    parts.unshift(time % 60 + "s");
  }
  time = Math.floor(time / 60);
  if (time > 0) {
    if (time % 60 !== 0) {
      parts.unshift(time % 60 + "m");
    }
    time = Math.floor(time / 60);
  }
  if (time > 0) {
    parts.unshift(time + "h");
  }
  return parts.join(" ");
};

/* Decode flags ("0101" or "5d" little endian) into an array of bits */
Util.DecodeFlags = function _Util_DecodeFlags(f) {
  var nbits = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var bits = [];
  if (f.match(/^[01]+$/)) {
    var _iteratorNormalCompletion31 = true;
    var _didIteratorError31 = false;
    var _iteratorError31 = undefined;

    try {
      for (var _iterator31 = f[Symbol.iterator](), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
        var c = _step31.value;

        bits.push(c === "1");
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
  } else if (f.match(/^[1-9][0-9]*d$/)) {
    var num = Number.parseInt(f.substr(0, f.length - 1));
    for (var n = 0; 1 << n < num; ++n) {
      bits.push((1 << n & num) !== 0);
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
  return bits.map(function (b) {
    return b ? "1" : "0";
  }).join("");
};

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
  var result = "";
  var _iteratorNormalCompletion32 = true;
  var _didIteratorError32 = false;
  var _iteratorError32 = undefined;

  try {
    for (var _iterator32 = Util.Zip(Util.StringToCodes(str), str)[Symbol.iterator](), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
      var _ref15 = _step32.value;

      var _ref16 = _slicedToArray(_ref15, 2);

      var cn = _ref16[0];
      var ch = _ref16[1];

      if (cn < 0x20) result = result.concat(Util.EscapeCharCode(cn));else if (ch === '\\') result = result.concat('\\\\');else result = result.concat(ch);
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

  return result;
};

/* Split a string by the tokens given; all tokens must be present.
 *   matchfunc: function to apply to the matched segments */
Util.SplitByMatches = function _Util_SplitByMatches(str, matches) {
  var matchfunc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  var result = [];
  var pos = 0;
  var _iteratorNormalCompletion33 = true;
  var _didIteratorError33 = false;
  var _iteratorError33 = undefined;

  try {
    for (var _iterator33 = matches[Symbol.iterator](), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
      var match = _step33.value;

      var mpos = str.indexOf(match, pos);
      result.push(str.substr(pos, mpos - pos));
      if (matchfunc) {
        result.push(matchfunc(match));
      } else {
        result.push(match);
      }
      pos = mpos + match.length;
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

  if (pos < str.length) {
    result.push(str.substr(pos));
  }
  return result;
};

/* Clone an object using JSON */
Util.JSONClone = function _Util_JSONClone(obj) {
  return JSON.parse(JSON.stringify(obj));
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
    var key = JSON.parse(window.localStorage.getItem(Util.__wscfg));
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
Util.GetWebStorage = function _Util_GetWebStorage() {
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
    return {};
  }
  function parseArgs() {
    var k = null;
    var o = {};
    if (arguments.length === 1) {
      if (typeof (arguments.length <= 0 ? undefined : arguments[0]) === "string") {
        k = arguments.length <= 0 ? undefined : arguments[0];
      } else {
        o = arguments.length <= 0 ? undefined : arguments[0];
      }
    } else if (arguments.length >= 2) {
      k = arguments.length <= 0 ? undefined : arguments[0];
      o = arguments.length <= 1 ? undefined : arguments[1];
    }
    if (k === null) {
      k = Util.GetWebStorageKey();
    }
    return [k, o];
  }

  var _parseArgs = parseArgs.apply(undefined, arguments),
      _parseArgs2 = _slicedToArray(_parseArgs, 2),
      key = _parseArgs2[0],
      opts = _parseArgs2[1];

  if (!key) {
    Util.Error("Util.GetWebStorage called without a key configured");
  } else {
    var v = window.localStorage.getItem(key);
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
Util.SetWebStorage = function _Util_SetWebStorage() {
  var key = null;
  var value = null;
  var opts = {};
  if (!Util._ws_enabled) {
    Util.WarnOnly("Local Storage disabled");
  }
  if (arguments.length === 1) {
    key = Util.GetWebStorageKey();
    value = arguments.length <= 0 ? undefined : arguments[0];
  } else if (arguments.length === 2) {
    key = (arguments.length <= 0 ? undefined : arguments[0]) === null ? Util.GetWebStorageKey() : arguments.length <= 0 ? undefined : arguments[0];
    value = arguments.length <= 1 ? undefined : arguments[1];
  } else if (arguments.length === 3) {
    key = (arguments.length <= 0 ? undefined : arguments[0]) === null ? Util.GetWebStorageKey() : arguments.length <= 0 ? undefined : arguments[0];
    value = arguments.length <= 1 ? undefined : arguments[1];
    opts = arguments.length <= 2 ? undefined : arguments[2];
  }
  if (key === null) {
    Util.Error("Util.SetWebStorage called without a key configured");
  } else {
    window.localStorage.setItem(key, Util.StorageFormat(value, opts));
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
  Util.SetWebStorage(key, new_v);
};

/* Parse a raw localStorage string using the options given */
Util.StorageParse = function _Util_StorageParse(s) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var str = s;
  var use_json = true;
  if (Util.IsArray(opts)) {
    var _iteratorNormalCompletion34 = true;
    var _didIteratorError34 = false;
    var _iteratorError34 = undefined;

    try {
      for (var _iterator34 = opts[Symbol.iterator](), _step34; !(_iteratorNormalCompletion34 = (_step34 = _iterator34.next()).done); _iteratorNormalCompletion34 = true) {
        var o = _step34.value;

        if (o === "b64") str = window.atob(str);
        if (o === "xor") s = s.xor(127);
        if (o === "bs") s = s.transform(function (i) {
          return (i & 15) * 16 + (i & 240) / 16;
        });
        if (o.match(/^x[1-9][0-9]*/)) s = s.xor(Number(o.substr(1)));
        if (typeof o === "function") s = o(s);
        if (o === "nojson") use_json = false;
      }
    } catch (err) {
      _didIteratorError34 = true;
      _iteratorError34 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion34 && _iterator34.return) {
          _iterator34.return();
        }
      } finally {
        if (_didIteratorError34) {
          throw _iteratorError34;
        }
      }
    }
  }
  return use_json ? JSON.parse(s) : s;
};

/* Format an object for storing into localStorage */
Util.StorageFormat = function _Util_StorageFormat(obj) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var s = JSON.stringify(obj);
  if (Util.IsArray(opts)) {
    var _iteratorNormalCompletion35 = true;
    var _didIteratorError35 = false;
    var _iteratorError35 = undefined;

    try {
      for (var _iterator35 = opts[Symbol.iterator](), _step35; !(_iteratorNormalCompletion35 = (_step35 = _iterator35.next()).done); _iteratorNormalCompletion35 = true) {
        var o = _step35.value;

        if (o === "b64") s = window.btoa(s);
        if (o === "xor") s = s.xor(127);
        if (o === "bs") s = s.transform(function (i) {
          return (i & 15) * 16 + (i & 240) / 16;
        });
        if (o.match(/^x[1-9][0-9]*/)) s = s.xor(Number(o.substr(1)));
        if (typeof o === "function") s = o(s);
      }
    } catch (err) {
      _didIteratorError35 = true;
      _iteratorError35 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion35 && _iterator35.return) {
          _iterator35.return();
        }
      } finally {
        if (_didIteratorError35) {
          throw _iteratorError35;
        }
      }
    }
  }
  return s;
};

/* Disables localStorage suppport entirely */
Util.DisableLocalStorage = function _Util_DisableLocalStorage() {
  Util._ws_enabled = false;
  function wsapi_wrapper(f) {
    Util.Warn("Function is disabled", f);
    return null;
  }
  Util.GetWebStorageKey = wsapi_wrapper(Util.GetWebStorageKey);
  Util.SetWebStorageKey = wsapi_wrapper(Util.SetWebStorageKey);
  Util.GetWebStorage = wsapi_wrapper(Util.GetWebStorage);
  Util.SetWebStorage = wsapi_wrapper(Util.SetWebStorage);
  Util.StorageAppend = wsapi_wrapper(Util.StorageAppend);
  Util.StorageParse = wsapi_wrapper(Util.StorageParse);
  Util.StorageFormat = wsapi_wrapper(Util.StorageFormat);
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
Util.ParseQueryString = function _Util_ParseQueryString(query) {
  if (!query) query = window.location.search;
  if (query.startsWith('?')) query = query.substr(1);
  var obj = {};
  var _iteratorNormalCompletion36 = true;
  var _didIteratorError36 = false;
  var _iteratorError36 = undefined;

  try {
    for (var _iterator36 = query.split('&')[Symbol.iterator](), _step36; !(_iteratorNormalCompletion36 = (_step36 = _iterator36.next()).done); _iteratorNormalCompletion36 = true) {
      var part = _step36.value;

      if (part.indexOf('=') === -1) {
        obj[part] = true;
      } else if (part.startsWith('base64=')) {
        var val = decodeURIComponent(part.substr(part.indexOf('=') + 1));
        var _iteratorNormalCompletion37 = true;
        var _didIteratorError37 = false;
        var _iteratorError37 = undefined;

        try {
          for (var _iterator37 = Object.entries(Util.ParseQueryString(atob(val)))[Symbol.iterator](), _step37; !(_iteratorNormalCompletion37 = (_step37 = _iterator37.next()).done); _iteratorNormalCompletion37 = true) {
            var _ref17 = _step37.value;

            var _ref18 = _slicedToArray(_ref17, 2);

            var k = _ref18[0];
            var v = _ref18[1];

            obj[k] = v;
          }
        } catch (err) {
          _didIteratorError37 = true;
          _iteratorError37 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion37 && _iterator37.return) {
              _iterator37.return();
            }
          } finally {
            if (_didIteratorError37) {
              throw _iteratorError37;
            }
          }
        }
      } else {
        var key = part.substr(0, part.indexOf('='));
        var _val = part.substr(part.indexOf('=') + 1);
        _val = decodeURIComponent(_val);
        if (_val.length === 0) _val = false;else if (_val === "true") _val = true;else if (_val === "false") _val = false;else if (_val.match(/^[+-]?[1-9][0-9]*$/)) _val = parseInt(_val);else if (_val.match(/^[-+]?(?:[0-9]*\.[0-9]+|[0-9]+)$/)) _val = parseFloat(_val);else if (_val === "null") _val = null;
        obj[key] = _val;
      }
    }
  } catch (err) {
    _didIteratorError36 = true;
    _iteratorError36 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion36 && _iterator36.return) {
        _iterator36.return();
      }
    } finally {
      if (_didIteratorError36) {
        throw _iteratorError36;
      }
    }
  }

  return obj;
};

/* Format a query string (including leading "?") */
Util.FormatQueryString = function _Util_FormatQueryString(query) {
  var parts = [];
  var _iteratorNormalCompletion38 = true;
  var _didIteratorError38 = false;
  var _iteratorError38 = undefined;

  try {
    for (var _iterator38 = Object.entries(query)[Symbol.iterator](), _step38; !(_iteratorNormalCompletion38 = (_step38 = _iterator38.next()).done); _iteratorNormalCompletion38 = true) {
      var _ref19 = _step38.value;

      var _ref20 = _slicedToArray(_ref19, 2);

      var k = _ref20[0];
      var v = _ref20[1];

      var key = encodeURIComponent(k);
      var val = encodeURIComponent(v);
      parts.push(key + "=" + val);
    }
  } catch (err) {
    _didIteratorError38 = true;
    _iteratorError38 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion38 && _iterator38.return) {
        _iterator38.return();
      }
    } finally {
      if (_didIteratorError38) {
        throw _iteratorError38;
      }
    }
  }

  return "?" + parts.join("&");
};

/* End query string handling 0}}} */

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
  return Util.BoxContains(x, y, rect.left, rect.top, rect.right, rect.bottom);
};

/* Return whether or not the position is over the HTML element */
Util.PointIsOn = function _Util_PointIsOn(x, y, elem) {
  if (elem && elem.jquery) {
    var _iteratorNormalCompletion39 = true;
    var _didIteratorError39 = false;
    var _iteratorError39 = undefined;

    try {
      for (var _iterator39 = elem[Symbol.iterator](), _step39; !(_iteratorNormalCompletion39 = (_step39 = _iterator39.next()).done); _iteratorNormalCompletion39 = true) {
        var e = _step39.value;

        if (Util.PointIsOn(x, y, e)) {
          return true;
        }
      }
    } catch (err) {
      _didIteratorError39 = true;
      _iteratorError39 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion39 && _iterator39.return) {
          _iterator39.return();
        }
      } finally {
        if (_didIteratorError39) {
          throw _iteratorError39;
        }
      }
    }
  } else {
    var rects = elem.getClientRects();
    var _iteratorNormalCompletion40 = true;
    var _didIteratorError40 = false;
    var _iteratorError40 = undefined;

    try {
      for (var _iterator40 = rects[Symbol.iterator](), _step40; !(_iteratorNormalCompletion40 = (_step40 = _iterator40.next()).done); _iteratorNormalCompletion40 = true) {
        var rect = _step40.value;

        if (Util.RectContains(x, y, rect)) {
          return true;
        }
      }
    } catch (err) {
      _didIteratorError40 = true;
      _iteratorError40 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion40 && _iterator40.return) {
          _iterator40.return();
        }
      } finally {
        if (_didIteratorError40) {
          throw _iteratorError40;
        }
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
  var _iteratorNormalCompletion41 = true;
  var _didIteratorError41 = false;
  var _iteratorError41 = undefined;

  try {
    for (var _iterator41 = document.styleSheets[Symbol.iterator](), _step41; !(_iteratorNormalCompletion41 = (_step41 = _iterator41.next()).done); _iteratorNormalCompletion41 = true) {
      var ss = _step41.value;

      if (ss.href.endsWith("/" + filename.replace(/^\//, ""))) {
        return ss;
      }
    }
  } catch (err) {
    _didIteratorError41 = true;
    _iteratorError41 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion41 && _iterator41.return) {
        _iterator41.return();
      }
    } finally {
      if (_didIteratorError41) {
        throw _iteratorError41;
      }
    }
  }

  return null;
};

/* Given a stylesheet, obtain a rule definition by name */
Util.CSS.GetRule = function _Util_CSS_GetRule(css, rule_name) {
  var _iteratorNormalCompletion42 = true;
  var _didIteratorError42 = false;
  var _iteratorError42 = undefined;

  try {
    for (var _iterator42 = css.cssRules[Symbol.iterator](), _step42; !(_iteratorNormalCompletion42 = (_step42 = _iterator42.next()).done); _iteratorNormalCompletion42 = true) {
      var rule = _step42.value;

      if (rule.selectorText === rule_name) {
        return rule;
      }
    }
  } catch (err) {
    _didIteratorError42 = true;
    _iteratorError42 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion42 && _iterator42.return) {
        _iterator42.return();
      }
    } finally {
      if (_didIteratorError42) {
        throw _iteratorError42;
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

/* Obtain the value of the given property
 * Overloads
 *  Util.CSS.GetProperty(prop)
 *  Util.CSS.GetProperty(elem, prop) */
Util.CSS.GetProperty = function _Util_CSS_GetProperty() {
  var e = document.documentElement;
  var p = arguments.length <= 0 ? undefined : arguments[0];
  if (arguments.length > 1) {
    e = arguments.length <= 0 ? undefined : arguments[0];
    p = arguments.length <= 1 ? undefined : arguments[1];
  }
  return getComputedStyle(e).getPropertyValue(p).trim();
};

/* Set the property to the value giveni
 * Overloads
 *  Util.CSS.SetProperty(prop, value)
 *  Util.CSS.SetProperty(elem, prop, value) */
Util.CSS.SetProperty = function _Util_CSS_SetProperty() {
  var e = document.documentElement;
  var p = arguments.length <= 0 ? undefined : arguments[0];
  var v = arguments.length <= 1 ? undefined : arguments[1];
  if (arguments.length > 2) {
    e = arguments.length <= 0 ? undefined : arguments[0];
    p = arguments.length <= 1 ? undefined : arguments[1];
    v = arguments.length <= 2 ? undefined : arguments[2];
  }
  e.style.setProperty(p, v);
};

/* End CSS functions 0}}} */

/* DOM functions {{{0 */

/* Add the javascript file to the document's <head> */
Util.AddScript = function _Util_AddScript(src) {
  var s = document.createElement("script");
  s.setAttribute("type", "text/javascript");
  s.setAttribute("src", src);
  document.head.appendChild(s);
};

/* Walk a DOM tree searching for nodes matching the predicate given */
Util.SearchTree = function _Util_SearchTree(root, pred) {
  var results = [];
  /* Accept jQuery elements and element sets */
  if (root && root.jquery) {
    var _iteratorNormalCompletion43 = true;
    var _didIteratorError43 = false;
    var _iteratorError43 = undefined;

    try {
      for (var _iterator43 = root[Symbol.iterator](), _step43; !(_iteratorNormalCompletion43 = (_step43 = _iterator43.next()).done); _iteratorNormalCompletion43 = true) {
        var e = _step43.value;

        results = results.concat(Util.SearchTree(e, pred));
      }
    } catch (err) {
      _didIteratorError43 = true;
      _iteratorError43 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion43 && _iterator43.return) {
          _iterator43.return();
        }
      } finally {
        if (_didIteratorError43) {
          throw _iteratorError43;
        }
      }
    }
  } else if (pred(root)) {
    results.push(root);
  } else if (root.childNodes && root.childNodes.length > 0) {
    var _iteratorNormalCompletion44 = true;
    var _didIteratorError44 = false;
    var _iteratorError44 = undefined;

    try {
      for (var _iterator44 = root.childNodes[Symbol.iterator](), _step44; !(_iteratorNormalCompletion44 = (_step44 = _iterator44.next()).done); _iteratorNormalCompletion44 = true) {
        var _e2 = _step44.value;

        results = results.concat(Util.SearchTree(_e2, pred));
      }
    } catch (err) {
      _didIteratorError44 = true;
      _iteratorError44 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion44 && _iterator44.return) {
          _iterator44.return();
        }
      } finally {
        if (_didIteratorError44) {
          throw _iteratorError44;
        }
      }
    }
  }
  return results;
};

/* Convert a string, number, boolean, URL, or Element to an Element */
Util.CreateNode = function _Util_CreateNode(obj) {
  if (obj instanceof Element) {
    return obj;
  } else if (["string", "number", "boolean"].indexOf(typeof obj === "undefined" ? "undefined" : _typeof(obj)) > -1) {
    return new Text("" + obj);
  } else if (obj instanceof URL) {
    var a = document.createElement('a');
    a.setAttribute("href", obj.href);
    a.setAttribute("target", "_blank");
    a.textContent = obj.href;
    return a;
  } else {
    Util.Warn("Not sure how to create a node from", obj);
    return new Text(JSON.stringify(obj));
  }
};

/* Obtain a node's HTML */
Util.GetHTML = function _Util_GetHTML(node) {
  if (node.outerHTML) {
    return node.outerHTML;
  } else if (typeof node.nodeValue === "string") {
    return ("" + node.nodeValue).escape();
  } else if (node.nodeValue) {
    return ("" + node.nodeValue).escape();
  } else {
    return "" + node;
  }
};

/* Ensure the absolute offset displays entirely on-screen */
Util.ClampToScreen = function _Util_ClampToScreen(offset) {
  if (offset.top < 0) offset.top = 0;
  if (offset.left < 0) offset.left = 0;
  if (offset.left + offset.width > window.innerWidth) {
    offset.left = window.innerWidth - offset.width;
  }
  if (offset.top + offset.height > window.innerHeight) {
    offset.top = window.innerHeight - offset.height;
  }
};

/* End DOM functions 0}}} */

/* Miscellaneous functions {{{0 */

/* Wrap window.open */
Util.Open = function _Util_Open(url, id, attrs) {
  var a = [];
  var _iteratorNormalCompletion45 = true;
  var _didIteratorError45 = false;
  var _iteratorError45 = undefined;

  try {
    for (var _iterator45 = Object.entries(attrs)[Symbol.iterator](), _step45; !(_iteratorNormalCompletion45 = (_step45 = _iterator45.next()).done); _iteratorNormalCompletion45 = true) {
      var _ref21 = _step45.value;

      var _ref22 = _slicedToArray(_ref21, 2);

      var k = _ref22[0];
      var v = _ref22[1];

      a.push(k + "=" + v);
    }
  } catch (err) {
    _didIteratorError45 = true;
    _iteratorError45 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion45 && _iterator45.return) {
        _iterator45.return();
      }
    } finally {
      if (_didIteratorError45) {
        throw _iteratorError45;
      }
    }
  }

  return window.open(url, id, a.join(","));
};

/* Get a value from an object by path: "key1.key2" -> o[key1][key2] */
Util.ObjectGet = function _Util_ObjectGet(obj, path) {
  var items = path.split(".");
  var cobj = obj;
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
  var items = path.split(".");
  var cobj = obj;
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
  var items = path.split(".");
  var cobj = obj;
  while (items.length > 0) {
    if (cobj.hasOwnProperty(items[0])) {
      cobj = cobj[items.shift()];
    } else {
      return false;
    }
  }
  return true;
};

/* End miscellaneous functions 0}}} */