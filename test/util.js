
"use strict";
var assert = require("assert");

var {
  Util,
  Logging,
  ColorParser,
  tinycolor} = require("../utility.js");

Util.DebugLevel = Util.LEVEL_TRACE;

/* Greek "sigma" character: two lower-case variants, one upper-case variant */
const GREEK_SIGMA = "\u03c3";
const GREEK_SIGMA_ALT = "\u03c2";
const GREEK_SIGMA_UC = "\u03a3";

/* Test utility.js */
describe("Util", function() {
  describe("General utilities", function() {
    it("defines Util.ASCII", function() {
      assert.equal(Util.ASCII.length, 128);
      for (let i = 0; i < 128; ++i) {
        assert.equal(Util.ASCII[i], String.fromCharCode(i));
        assert.equal(Util.ASCII[i].charCodeAt(0), i);
      }
    });
    it("defines Util.WSStatus and Util.WSStatusCode", function() {
      /* Both sets must be non-empty */
      assert.ok(Object.entries(Util.WSStatusCode).length > 0);
      assert.ok(Object.entries(Util.WSStatus).length > 0);
      /* Both sets must have the same size */
      assert.equal(Object.entries(Util.WSStatusCode).length,
                   Object.entries(Util.WSStatus).length);
      /* Both sets of keys must be equal */
      assert.deepEqual(Object.keys(Util.WSStatusCode).sort(),
                       Object.keys(Util.WSStatus).sort());
      /* Both sets must have something for every code */
      for (let k of Object.keys(Util.WSStatusCode)) {
        assert.ok(Util.WSStatusCode[k]);
        assert.ok(Util.WSStatus[k]);
      }
    });
    it("defines Util.StringEscapeChars", function() {
      /* Has known escape sequences */
      assert.equal(Util.StringEscapeChars["\b"], "b");
      assert.equal(Util.StringEscapeChars["\f"], "f");
      assert.equal(Util.StringEscapeChars["\n"], "n");
      assert.equal(Util.StringEscapeChars["\r"], "r");
      assert.equal(Util.StringEscapeChars["\t"], "t");
      assert.equal(Util.StringEscapeChars["\v"], "v");
      /* Has no additional items */
      assert.equal(Object.keys(Util.StringEscapeChars).length, 6);
    });
    it("defines Util.EscapeChars", function() {
      /* TODO: verify content without rewriting content? */
      /* Has no additional items */
      assert.equal(Object.keys(Util.EscapeChars).length, 5);
    });
    it("defines Util.SetFunctionName", function() {
      /* Allow function to fail without failing the test */
      function f() { }
      assert.ok(Util.SetFunctionName);
      assert.doesNotThrow(() => Util.SetFunctionName(f, "foo", true));
    });
  });
  describe("Polyfills and addons", function() {
    it("should have Util defined", function() {
      assert.ok(Util, "Util object exists");
    });
    it("defines Math.divmod", function() {
      let [div, mod] = Math.divmod(2, 10);
      assert.equal(div, 5);
      assert.equal(mod, 0);
    });
    it("defines Math.clamp", function() {
      assert.equal(Math.clamp(1, 5, 5), 5);
      assert.equal(Math.clamp(1, 0, 2), 1);
      assert.equal(Math.clamp(5, 0, 2), 2);
      assert.ok(Number.isNaN(Math.clamp(NaN, 0, 0)));
    });
    it("defines Array.any", function() {
      assert.ok([false, false, true].any());
      assert.ok([0, NaN, 1].any());
      assert.ok(![null, NaN, "", false, 0].any());
      assert.ok(![].any());
    });
    it("defines Array.all", function() {
      assert.ok(![].all());
      assert.ok([1, 2].all());
      assert.ok(![0, 1].all());
      assert.ok(![null, true].all());
    });
    it("defines Array.concat", function() {
      assert.ok([].concat([]) instanceof Array);
      assert.deepEqual([1,2,3].concat([4,5,6]), [1,2,3,4,5,6]);
      assert.deepEqual([].concat([1,2,3]), [1,2,3]);
      assert.deepEqual([1,2,3].concat([]), [1,2,3]);
    });
    it("defines String.trimStart, String.trimEnd", function() {
      assert.equal(" asd ".trimStart(), "asd ");
      assert.equal(" asd ".trimEnd(), " asd");
      assert.equal(" asd ".trim(), "asd");
    });
    it("defines RegExp.escape", function() {
      assert.equal(RegExp.escape("foo()bar"), "foo\\(\\)bar");
      assert.equal(RegExp.escape("[.*+?]"), "\\[\\.\\*\\+\\?\\]");
      for (let ch of "[].*+?^${}()|[]\\") {
        assert.equal(RegExp.escape(ch), "\\" + ch);
      }
      assert.equal(RegExp.escape("somethingwithoutsymbols"), "somethingwithoutsymbols");
    });
    it("defines Array.extend", function() {
      const base = [1, 2, 3];
      let a1 = Array.of(...base);
      let a2 = [4, 5, 6];
      a1.extend(a2);
      assert.deepEqual(a1, [1, 2, 3, 4, 5, 6]);
      a1 = []; a1.extend(a2);
      assert.deepEqual(a1, [4, 5, 6]);
      a1 = []; a1.extend([]);
      assert.deepEqual(a1, []);
      a1 = Array.of(...base); a1.extend(base);
      assert.deepEqual(a1, base.concat(base));
    });
    /* TODO: Array.min (with/without key func) */
    /* TODO: Array.max (with/without key func) */
    /* TODO: Array.range (with/without dflt) */
    it("defines String.is<class>", function() {
      assert.ok("123".isdigit());
      assert.ok(!"abc".isdigit());
      assert.ok("abc".isalpha());
      assert.ok(!"123".isalpha());
      assert.ok("asd123".isalnum());
      assert.ok(!" ".isalnum());
      assert.ok(" \r\n\v\t".isspace());
      assert.ok(GREEK_SIGMA.islower());
      assert.ok(GREEK_SIGMA_ALT.islower());
      assert.ok(GREEK_SIGMA_UC.isupper());
    });
    it("defines String.strip", function() {
      assert.equal(" asd ".strip(), "asd");
      assert.equal("asd".strip(), "asd");
      assert.equal(" \r\n\v\tasd \r\n\v\t".strip(), "asd");
      assert.equal(" \r\n\v\tasd\r\n\v\t ".strip(" "), "\r\n\v\tasd\r\n\v\t");
      assert.equal(" foo ".strip(), " foo ".strip(" "));
      assert.equal("123foo123".strip("123"), "foo");
    });
    it("defines String.escape", function() {
      assert.equal("<tag>".escape(), "&lt;tag&gt;");
      assert.equal("<tag val=\"v1&v2\"></tag>".escape(),
                   "&lt;tag val=&quot;v1&amp;v2&quot;&gt;&lt;/tag&gt;");
      assert.equal("\"'\"".escape(), "&quot;&apos;&quot;");
      for (let [c, e] of Object.entries(Util.EscapeChars)) {
        assert.equal(c.escape(), e);
      }
    });
    /* TODO: String.map */
    it("defines String.equalsLowerCase", function() {
      assert.ok("foo".equalsLowerCase("FOO"));
      assert.ok("FOO".equalsLowerCase("FOO"));
      assert.ok("FOO".equalsLowerCase("foo"));
      assert.ok(!"FOO".equalsLowerCase("FOOO"));
      assert.ok(GREEK_SIGMA.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(!GREEK_SIGMA_ALT.equalsLowerCase(GREEK_SIGMA_UC));
    });
    it("defines String.equalsUpperCase", function() {
      assert.ok("foo".equalsUpperCase("FOO"));
      assert.ok("FOO".equalsUpperCase("FOO"));
      assert.ok("FOO".equalsUpperCase("foo"));
      assert.ok(!"FOO".equalsUpperCase("FOOO"));
      assert.ok(GREEK_SIGMA.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(!GREEK_SIGMA_ALT.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(GREEK_SIGMA.equalsUpperCase(GREEK_SIGMA_ALT));
    });
    it("defines String.transform", function() {
      assert.equal("asd".transform((b) => b), "asd");
      assert.equal("asd".transform((b) => b+1), "bte");
      assert.equal("asd".transform((b) => b-32), "ASD");
      assert.equal("aaa".transform((b) => b+2), "ccc");
      assert.equal("asd".transform((b) => 0), "\0\0\0");
      assert.equal("asd".transform((b) => b/2), "092");
      assert.equal("asd".transform((b) => 97), "aaa");
    });
    it("defines String.xor", function() {
      assert.equal("foo".xor(1).xor(1), "foo");
      assert.equal("foo".xor(0), "foo");
      assert.equal("f".xor(255), String.fromCharCode("f".charCodeAt(0) ^ 255));
    });
    it("defines String.toTitleCase", function() {
      assert.equal("foo bar".toTitleCase(), "Foo Bar");
      assert.equal("".toTitleCase(), "");
      assert.equal("FOO BAR".toTitleCase(), "Foo Bar");
      assert.equal("foo_bar".toTitleCase(), "Foo_bar");
    });
  });
  describe("Array and sequence functions", function() {
    it("defines Util.ToArray", function() {
      /* TODO */
    });
    it("defines Util.Zip", function() {
      const a = [1, 2, 3];
      const b = ["a", "b", "c"];
      assert.deepEqual(Util.Zip(a, a), [[1, 1], [2, 2], [3, 3]]);
      assert.deepEqual(Util.Zip(a, b), [[1, "a"], [2, "b"], [3, "c"]]);
      assert.deepEqual(Util.Zip(b, b), [["a", "a"], ["b", "b"], ["c", "c"]]);
      assert.deepEqual(Util.Zip(a), [[1], [2], [3]]);
      assert.deepEqual(Util.Zip(a, a, a), [[1, 1, 1], [2, 2, 2], [3, 3, 3]]);
    });
    it("defines Util.ArgsToArray", function() {
      function f() { return Util.ArgsToArray(arguments); }
      assert.deepEqual(f(), []);
      assert.deepEqual(f(f), [f]);
      assert.deepEqual(f(f, null), [f, null]);
      assert.deepEqual(f([1, 2], 1, 2), [[1, 2], 1, 2]);
    });
  });
  describe("URL handling", function() {
    it("defines Util.URL_REGEX", function() {
      /* TODO: fix Util.URL_REGEX and rewrite tests
      const match = (u) => Util.URL_REGEX.test(u);
      assert.ok(match("http://example.com"));
      assert.ok(match("http://example.com/"));
      assert.ok(match("http://example.com/?a=b#section.c"));
      assert.ok(match("http://example.com?a=b#section.c"));
      assert.ok(match("file:///foo"));
      assert.ok(match("https://www.example.com"));
      assert.ok(!match("notasite"));
      */
    });
    it("defines Util.URL", function() {
      /* TODO */
    });
    it("defines Util.SplitPath", function() {
      assert.deepEqual(Util.SplitPath("foo/bar"), ["foo", "bar"]);
      assert.deepEqual(Util.SplitPath("foo/bar/baz"), ["foo/bar", "baz"]);
      assert.deepEqual(Util.SplitPath("foo"), ["", "foo"]);
      assert.deepEqual(Util.SplitPath("foo/"), ["foo", ""]);
    });
    it("defines Util.JoinPath", function() {
      assert.equal(Util.JoinPath("foo", "bar"), "foo/bar");
      assert.equal(Util.JoinPath("", "bar"), "bar");
      assert.equal(Util.JoinPath("foo", ""), "foo/");
    });
    it("defines Util.StripCommonPrefix", function() {
      /* TODO */
    });
  });
  /* Section "Error handling" tested below */
  describe("Logging", function() {
    function foo() {
      function bar() {
        Util.Throw(Error, "test");
        throw new Error("fallback");
      }
      bar();
    }
    it("defines Util.Throw with stack handling", function() {
      let err = null;
      try { foo(); } catch (e) { err = e; }
      assert.ok(err);
      assert.ok(err instanceof Error);
      assert.ok(err.message.startsWith("test"));
      assert.ok(err._stack_raw);
      assert.ok(err._stack);
      assert.ok(err._stack.length > 0);
      assert.ok(err._stacktrace);
      assert.ok(err._stacktrace.length > 0);
      assert.equal(err._stacktrace[0].name, "bar");
      assert.ok(err._stacktrace[0].file.indexOf("/twitch-api/") > -1);
      assert.ok(err._stacktrace[0].file.endsWith(".js"));
      assert.equal(err._stacktrace[0].file, __filename);
      assert.equal(err._stacktrace[1].name, "foo");
      /* TODO: ParseStack */
      /* TODO: FormatStack */
      /* TODO: Stack trimming */
    });
    it("provides debug levels", function() {
      Util.PushDebugLevel(Util.LEVEL_DEBUG);
      assert.equal(Util.DebugLevel, Util.LEVEL_DEBUG);
      assert.ok(Util.LEVEL_OFF < Util.LEVEL_DEBUG);
      assert.ok(Util.LEVEL_DEBUG < Util.LEVEL_TRACE);
      assert.ok(Util.LEVEL_TRACE === Util.LEVEL_MAX);
      assert.ok(Util.PopDebugLevel());
      Util.PushDebugLevel(Util.LEVEL_TRACE);
      assert.equal(Util.DebugLevel, Util.LEVEL_TRACE);
      assert.ok(Util.Logger.severityEnabled("ALL"));
      assert.ok(Util.Logger.severityEnabled("ERROR"));
      assert.ok(Util.Logger.severityEnabled("WARN"));
      assert.ok(Util.Logger.severityEnabled("INFO"));
      assert.ok(Util.Logger.severityEnabled("DEBUG"));
      assert.ok(Util.Logger.severityEnabled("TRACE"));
      Util.PushDebugLevel(Util.LEVEL_DEBUG);
      assert.equal(Util.DebugLevel, Util.LEVEL_DEBUG);
      assert.ok(Util.Logger.severityEnabled("ERROR"));
      assert.ok(Util.Logger.severityEnabled("WARN"));
      assert.ok(Util.Logger.severityEnabled("INFO"));
      assert.ok(Util.Logger.severityEnabled("DEBUG"));
      assert.ok(!Util.Logger.severityEnabled("TRACE"));
      Util.PopDebugLevel();
      assert.equal(Util.DebugLevel, Util.LEVEL_TRACE);
      Util.PopDebugLevel();
      /* TODO: actually log things */
    });
    it("provides hooks", function() {
      /* TODO */
    });
    it("provides filters", function() {
      /* TODO */
    });
    it("logs with/without stacks", function() {
      /* TODO */
    });
    it("logs once (with/without stacks)", function() {
      /* TODO */
    });
  });
  describe("Color handling", function() {
    const C = (...args) => new Util.Color(...args);
    const black = new Util.Color(0, 0, 0);
    const white = new Util.Color(255, 255, 255);
    it("can parse colors", function() {
      assert.ok(typeof tinycolor !== "undefined");
      assert.ok(Util.ColorParser.parse);
      assert.ok(Util.ColorParser.parse("red"));
      assert.ok(Util.ColorParser.parse("rebeccapurple"));
      assert.ok(Util.ColorParser.parse("#000000"));
      assert.ok(Util.ColorParser.parse("#00000000"));
      assert.ok(Util.ColorParser.parse("#aabbcc"));
      assert.ok(Util.ColorParser.parse("#aabbccdd"));
      assert.throws(() => Util.ColorParser.parse("lemon"));
    });
    it("can convert colors to different formats", function() {
      /* TODO */
    });
    it("defines Color object", function() {
      let red = new Util.Color("red");
      assert.equal(black.hex, "#000000");
      assert.equal(white.hex, "#ffffff");
      assert.deepEqual(black.rgb, [0, 0, 0]);
      assert.deepEqual(white.rgb, [255, 255, 255]);
      assert.deepEqual(black.rgba, [0, 0, 0, 255]);
      assert.deepEqual(white.rgba, [255, 255, 255, 255]);
      assert.deepEqual(C(black).rgba, [0, 0, 0, 255]);
      assert.deepEqual(C().rgba, [0, 0, 0, 255]);
      assert.deepEqual(C(0, 0, 0, 0).rgba, [0, 0, 0, 0]);
      assert.deepEqual(C([0, 0, 0]).rgba, [0, 0, 0, 255]);
      assert.deepEqual(C([0, 0, 0, 127]).rgba, [0, 0, 0, 127]);
      assert.deepEqual(C("#ff0000").rgba, [255, 0, 0, 255]);
      assert.ok(red.equals("#ff0000"));
      assert.ok(red.equals("#ff0000ff"));
      assert.ok(red.equals("rgb(255, 0, 0)"));
      assert.ok(red.equals("rgba(255, 0, 0, 1)"));
      assert.ok(red.equals("hsl(0, 1, 0.5)"));
      assert.ok(red.equals("hsla(0, 1, 0.5, 1)"));
      assert.throws(() => C("notacolor"));
      assert.deepEqual(red.rgb_1, [1, 0, 0]);
      assert.deepEqual(red.rgba_1, [1, 0, 0, 1]);
      assert.deepEqual(red.hsl, [0, 1, 0.5]);
      assert.deepEqual(red.hsla, [0, 1, 0.5, 1]);
      assert.equal(red.r, 255);
      assert.equal(red.g, 0);
      assert.equal(red.b, 0);
      assert.equal(red.a, 255);
      assert.equal(red.r_1, 1);
      assert.equal(red.g_1, 0);
      assert.equal(red.b_1, 0);
      assert.equal(red.a_1, 1);
      /* TODO: yiq */
      assert.equal(white.inverted().hex, "#000000");
      assert.equal(black.inverted().hex, "#ffffff");
      assert.equal(red.inverted().hex, "#00ffff");
      assert.equal(red.inverted().inverted().hex, "#ff0000");
      assert.equal(C("#7f7f7f").inverted().hex, "#808080");
      assert.equal(C("#808080").inverted().hex, "#7f7f7f");
    });
    it("supports color modification", function() {
      let c = new Util.Color("yellow");
      assert.equal(c.hex, "#ffff00");
      c.hue = 0;
      assert.equal(c.hex, "#ff0000");
      c.saturation = 0;
      /* This causes the hue to be lost */
      assert.equal(c.hex, "#808080");
      c.saturation = 1;
      c.luminance = 0;
      assert.equal(c.hex, "#000000");
      c.luminance = 1;
      assert.equal(c.hex, "#ffffff");
      c.rgba = [0, 0, 0, 255];
      assert.equal(c.hex, "#000000");
      c.rgba = [255, 255, 255, 255];
      assert.equal(c.hex, "#ffffff");
    });
    it("can calculate relative luminances", function() {
      /* TODO: more relative luminance coverage */
      assert.equal(white.getRelativeLuminance(), 1);
      assert.equal(black.getRelativeLuminance(), 0);
      assert.equal(Util.RelativeLuminance(white), 1);
      assert.equal(Util.RelativeLuminance(black), 0);
      assert.equal(Util.RelativeLuminance("white"), 1);
      assert.equal(Util.RelativeLuminance("black"), 0);
      assert.equal(Util.RelativeLuminance("rgba(0, 0, 0, 255)"), 0);
      assert.equal(Util.RelativeLuminance("hsl(0, 1, 1)"), 1);
    });
    it("can calculate contrast ratios", function() {
      /* TODO: contrast ratio */
      /* TODO */
    });
    it("can maximize contrast", function() {
      /* TODO */
    });
  });
  describe("PRNG", function() {
    it("defines numToHex", function() {
      assert.equal(Util.Random.numToHex(0), "00");
      assert.equal(Util.Random.numToHex(8), "08");
      assert.equal(Util.Random.numToHex(12), "0c");
      assert.equal(Util.Random.numToHex(255), "ff");
      assert.equal(Util.Random.numToHex(256, 4), "0100");
    });
    it("defines hex<N> functions", function() {
      assert.equal(typeof(Util.Random.hex8()), "string");
      assert.equal(typeof(Util.Random.hex16()), "string");
      assert.equal(typeof(Util.Random.hex32()), "string");
      assert.equal(typeof(Util.Random.hex64()), "string");
    });
    it("defines int<N> functions", function() {
      assert.equal(typeof(Util.Random.int8()), "number");
      assert.equal(typeof(Util.Random.int16()), "number");
      assert.equal(typeof(Util.Random.int32()), "number");
      assert.equal(typeof(Util.Random.int64()), "number");
    });
    it("defines uuid", function() {
      const uuid_len = 16 * 2 + 4;
      assert.equal(Util.Random.uuid().length, uuid_len);
    });
    it("defines uniform", function() {
      const minv = 10;
      const maxv = 11;
      const rv = Util.Random.uniform(minv, maxv);
      assert.ok(minv <= rv && rv <= maxv);
    });
  });
  describe("Event handling", function() {
    /* TODO */
  });
  describe("Parsing, formatting, and string functions", function() {
    it("defines Util.IsNumber", function() {
      assert.equal(typeof(Util.ParseNumber("NaN")), "number");
      assert.ok(Util.IsNumber("1"));
      assert.ok(Util.IsNumber("0"));
      assert.ok(Util.IsNumber("NaN"));
      assert.ok(Util.IsNumber("Infinity"));
      assert.ok(Util.IsNumber("-Infinity"));
      assert.ok(Util.IsNumber("-0"));
      assert.ok(!Util.IsNumber("0x1a0", 2));
      assert.ok(!Util.IsNumber("0x1a0", 8));
      assert.ok(!Util.IsNumber("0x1a0", 10));
      assert.ok(Util.IsNumber("0x1a0", 16));
      assert.ok(!Util.IsNumber("07", 2));
      assert.ok(Util.IsNumber("07", 8));
      assert.ok(!Util.IsNumber("07asd", 8));
      assert.ok(!Util.IsNumber("08", 2));
      assert.ok(!Util.IsNumber("08", 8));
      assert.ok(Util.IsNumber("08", 10));
      assert.ok(!Util.IsNumber("asd08", 10));
      assert.ok(Util.IsNumber("1e4"));
      assert.ok(Util.IsNumber("1.2e4"));
    });
    it("defines Util.ParseNumber", function() {
      const tests = {
        "1": 1,
        "0": 0,
        "-1": -1,
        "-0": 0,
        "Infinity": Infinity,
        "-Infinity": -Infinity,
        "true": true,
        "false": false,
        "1e4": 10000,
        "1.0e4": 10000.0
      };
      for (let [k, v] of Object.entries(tests)) {
        assert.equal(Util.ParseNumber(k), v);
      }
      assert.ok(Number.isNaN(Util.ParseNumber("NaN")));
    });
    it("defines Util.EscapeWithMap", function() {
      /* TODO */
    });
    it("defines Util.Pad", function() {
      assert.equal(Util.Pad(1, 2), "01");
      assert.equal(Util.Pad(1, 1), "1");
      assert.equal(Util.Pad(10, 1), "10");
      assert.equal(Util.Pad(0, 2), "00");
      assert.equal(Util.Pad(1, 2, "-"), "-1");
      assert.equal(Util.Pad(1, 1, "-"), "1");
      assert.equal(Util.Pad(10, 1, "-"), "10");
      assert.equal(Util.Pad(0, 2, "-"), "-0");
    });
    it("defines Util.StringToCodes", function() {
      /* TODO */
    });
    it("defines Util.FormatDate", function() {
      /* TODO */
    });
    it("defines Util.FormatInterval", function() {
      /* TODO */
    });
    it("defines Util.DecodeFlags", function() {
      /* TODO */
    });
    it("defines Util.EncodeFlags", function() {
      /* TODO */
    });
    it("defines Util.EscapeCharCode", function() {
      /* TODO */
    });
    it("defines Util.EscapeSlashes", function() {
      /* TODO */
    });
    it("defines Util.StringToRegExp", function() {
      /* TODO */
    });
    it("defines Util.JSONClone", function() {
      /* TODO */
    });
  });
  describe("Configuration and localStorage functions", function() {
    it("supports get/set", function() {
      Util.SetWebStorageKey("config");
      assert.equal(Util.GetWebStorage(), null);
      Util.SetWebStorage({"foo": "bar"});
      assert.deepEqual(Util.GetWebStorage(), {"foo": "bar"});
      Util.SetWebStorageKey("config2");
      assert.equal(Util.GetWebStorage(), null);
      assert.deepEqual(Util.GetWebStorage("config"), {"foo": "bar"});
      /* TODO: local storage parser options: b64, xor, bs, etc */
      /* TODO: StorageAppend */
      /* TODO: StorageParse, StorageFormat direct tests */
      /* TODO: DisableLocalStorage tests */
    });
    /* TODO */
  });
  describe("Query String handling", function() {
    it("parses query strings", function() {
      let tests = {
        "?foo=bar": {"foo": "bar"},
        "?foo=": {"foo": false},
        "?foo=1": {"foo": 1},
        "?foo=true": {"foo": true},
        "?foo=false": {"foo": false},
        "?foo=bar%20baz": {"foo": "bar baz"},
        "?foo": {"foo": true},
        "?foo=bar&bar=baz": {"foo": "bar", "bar": "baz"},
        "?foo=bar&foo=baz": {"foo": "baz"},
        "?foo=1e4": {"foo": 1e4},
        "?foo=1x12": {"foo": "1x12"},
        "?foo=bar=baz": {"foo": "bar=baz"}
      };
      /* base64: simple */
      tests[`?base64=${btoa("?foo=bar")}`] = {"foo": "bar"};
      /* base64: with non-base64 value */
      tests[`?bar=baz&base64=${btoa("?foo=bar")}`] = {"foo": "bar", "bar": "baz"};
      /* base64: overriding */
      tests[`?foo=baz&base64=${btoa("?foo=bar")}`] = {"foo": "bar"};
      tests[`?base64=${btoa("?foo=bar")}&foo=baz`] = {"foo": "baz"};
      for (let [qs, obj] of Object.entries(tests)) {
        assert.deepEqual(Util.ParseQueryString(qs), obj);
        assert.deepEqual(Util.ParseQueryString(qs.substr(1)), obj);
        /* possibly nested base64 */
        assert.deepEqual(Util.ParseQueryString(`?base64=${btoa(qs)}`), obj);
      }
    });
    it("formats query strings", function() {
      /* TODO */
    });
  });
  describe("Point-box functions", function() {
    it("defines {Box,Rect}Contains", function() {
      let box = [0, 0, 100, 100];
      let rect = {left: 0, top: 0, right: 100, bottom: 100};
      assert.ok(Util.BoxContains(0, 0, ...box));
      assert.ok(Util.BoxContains(100, 0, ...box));
      assert.ok(Util.BoxContains(0, 100, ...box));
      assert.ok(Util.BoxContains(100, 100, ...box));
      assert.ok(Util.BoxContains(50, 50, ...box));
      assert.ok(!Util.BoxContains(50, 101, ...box));
      assert.ok(Util.RectContains(0, 0, rect));
      assert.ok(Util.RectContains(100, 0, rect));
      assert.ok(Util.RectContains(0, 100, rect));
      assert.ok(Util.RectContains(100, 100, rect));
      assert.ok(Util.RectContains(50, 50, rect));
      assert.ok(!Util.RectContains(50, 101, rect));
    });
    /* NOTE: PointIsOn may not be testable */
  });
  describe("CSS functions", function() {
    /* TODO */
  });
  describe("DOM functions", function() {
    /* TODO */
  });
  describe("Miscellaneous functions", function() {
    it("defines Util.Open", function() {
      /* Can't really test Util.Open */
    });
    it("defines Object{Has,Get,Set,Remove}", function() {
      let o = {attr: 1, o: {attr: 2, a: {attr: 3}}};
      assert.equal(Util.ObjectGet(o, "attr"), 1);
      assert.equal(Util.ObjectGet(o, "o.attr"), 2);
      assert.equal(Util.ObjectGet(o, "o.a.attr"), 3);
      assert.ok(Util.ObjectHas(o, "attr"));
      assert.ok(Util.ObjectHas(o, "o.attr"));
      assert.ok(Util.ObjectHas(o, "o.a.attr"));
      Util.ObjectSet(o, "attr", 4);
      Util.ObjectSet(o, "o.attr", 5);
      Util.ObjectSet(o, "o.a.attr", 6);
      assert.equal(Util.ObjectGet(o, "attr"), 4);
      assert.equal(Util.ObjectGet(o, "o.attr"), 5);
      assert.equal(Util.ObjectGet(o, "o.a.attr"), 6);
      assert.deepEqual(o, {attr: 4, o: {attr: 5, a: {attr: 6}}});
      Util.ObjectRemove(o, "o.a.attr");
      assert.ok(!Util.ObjectHas(o, "o.a.attr"));
      assert.deepEqual(o, {attr: 4, o: {attr: 5, a: {}}});
      Util.ObjectRemove(o, "o.a");
      assert.ok(!Util.ObjectHas(o, "o.a"));
      assert.deepEqual(o, {attr: 4, o: {attr: 5}});
      Util.ObjectSet(o, "o", 1);
      assert.deepEqual(o, {attr: 4, o: 1});
    });
    it("defines ObjectDiff", function() {
      let o1 = {attr: 1, attr2: 2};
      let o2 = {attr: 1, attr2: 3};
      let diff = Util.ObjectDiff(o1, o2);
      assert.equal(Object.entries(diff).length, 1);
      assert.deepEqual(diff.attr2, ["value", 2, 3]);
      o1.attr3 = 3;
      o2.attr3 = "3";
      diff = Util.ObjectDiff(o1, o2);
      assert.equal(Object.entries(diff).length, 2);
      assert.deepEqual(diff.attr3, ["type", 3, "3"]);
      o1.attr4 = 4;
      o2.attr5 = 5;
      diff = Util.ObjectDiff(o1, o2);
      assert.equal(Object.entries(diff).length, 4);
      assert.deepEqual(diff.attr4, ["<", 4, null]);
      assert.deepEqual(diff.attr5, [">", null, 5]);
      o1.obj = {attr: 1};
      o2.obj = {attr: 2};
      diff = Util.ObjectDiff(o1, o2);
      assert.deepEqual(diff.obj, ["value", o1.obj, o2.obj]);
    });
    it("defines StyleToObject", function() {
      /* TODO */
    });
  });
  /* Section "Construct global objects" tested indirectly already */
});

/*
 * vim-fold: ^[ ]\+it(
 */

/* globals describe it */
