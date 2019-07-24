
"use strict";
var assert = require("assert");
var { JSDOM } = require("jsdom");

var {
  Util,
  Logging,
  ColorParser} = require("../utility.js");

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
      /* Define known escape sequences */
      assert.equal(Util.StringEscapeChars["\b"], "b");
      assert.equal(Util.StringEscapeChars["\f"], "f");
      assert.equal(Util.StringEscapeChars["\n"], "n");
      assert.equal(Util.StringEscapeChars["\r"], "r");
      assert.equal(Util.StringEscapeChars["\t"], "t");
      assert.equal(Util.StringEscapeChars["\v"], "v");
      /* Define no additional items */
      assert.equal(Object.keys(Util.StringEscapeChars).length, 6);
    });
    it("defines Util.EscapeChars", function() {
      /* TODO: verify content without rewriting content? */
      /* Define no additional items */
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
      /* TODO: fix Util.URL_REGEX and rewrite tests */
      /*
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
    /* TODO */
  });
  describe("Error handling", function() {
    /* TODO */
  });
  describe("Logging", function() {
    it("defines Util.Throw", function() {
      /* TODO */
    });
    it("provides debug levels", function() {
      Util.PushDebugLevel(Util.LEVEL_DEBUG);
      assert.equal(Util.DebugLevel, Util.LEVEL_DEBUG);
      assert.ok(Util.LEVEL_OFF < Util.LEVEL_DEBUG);
      assert.ok(Util.LEVEL_DEBUG < Util.LEVEL_TRACE);
      assert.ok(Util.LEVEL_TRACE === Util.LEVEL_MAX);
      assert.ok(Util.PopDebugLevel());
    });
    it("provides stack handling", function() {
      /* TODO */
    });
    it("responds to DebugLevel modifications", function() {
      /* TODO */
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
    it("can parse colors", function() {
      /* FIXME: ColorParser is broken as getComputedStyle() returns color names
      assert.ok(ColorParser.parse("red"));
      */
    });
    /* TODO */
  });
  describe("PRNG (Pseudo-Random Number Generator)", function() {
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
      assert.ok(!Util.IsNumber("1e4"));
    });
    it("defines Util.ParseNumber", function() {
    });
    it("defines Util.EscapeWithMap", function() {
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
    });
    it("defines Util.FormatDate", function() {
    });
    it("defines Util.FormatInterval", function() {
    });
    it("defines Util.DecodeFlags", function() {
    });
    it("defines Util.EncodeFlags", function() {
    });
    it("defines Util.EscapeCharCode", function() {
    });
    it("defines Util.EscapeSlashes", function() {
    });
    it("defines Util.StringToRegExp", function() {
    });
    it("defines Util.JSONClone", function() {
    });
    /* TODO */
  });
  describe("Configuration and localStorage functions", function() {
    /* NOTE: localStorage may not be implemented */
    /* TODO */
  });
  describe("Query String handling", function() {
    /* TODO */
  });
  describe("Point-box functions", function() {
    /* TODO */
  });
  describe("CSS functions", function() {
    /* TODO */
  });
  describe("DOM functions", function() {
    /* TODO */
  });
  describe("Miscellaneous functions", function() {
    /* TODO */
  });
  describe("Construct global objects", function() {
    /* TODO */
  });
});

/* folds: `execute getline(".")`
%g/^[ ]\+it(/norm $zf%
%g/^[ ]\+describe(/norm $zf%
*/

/* globals describe it */
