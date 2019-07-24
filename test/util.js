
var mocha = require("mocha");
var assert = require("assert");

var Util = require("../utility.js").Util;
var Client = require("../client.js");

Util.DebugLevel = Util.LEVEL_TRACE;

/* Greek "sigma" character: two lower-case variants, one upper-case variant */
const GREEK_SIGMA = "\u03c3";
const GREEK_SIGMA_ALT = "\u03c2";
const GREEK_SIGMA_UC = "\u03a3";

/* Test utility.js */
describe("Util", function() {
  describe("polyfills and addons", function() {
    it("should have Util defined", function() {
      assert.ok(Util, "Util object exists");
    });
    it("should define Math.divmod", function() {
      let [div, mod] = Math.divmod(2, 10);
      assert.equal(div, 5);
      assert.equal(mod, 0);
    });
    it("should define Math.clamp", function() {
      assert.equal(Math.clamp(1, 5, 5), 5);
      assert.equal(Math.clamp(1, 0, 2), 1);
      assert.equal(Math.clamp(5, 0, 2), 2);
      assert.ok(Number.isNaN(Math.clamp(NaN, 0, 0)));
    });
    it("should define Array.any", function() {
      assert.ok([false, false, true].any());
      assert.ok([0, NaN, 1].any());
      assert.ok(![null, NaN, "", false, 0].any());
      assert.ok(![].any());
    });
    it("should define Array.all", function() {
      assert.ok(![].all());
      assert.ok([1, 2].all());
      assert.ok(![0, 1].all());
      assert.ok(![null, true].all());
    });
    it("should define Array.concat", function() {
      assert.ok([].concat([]) instanceof Array);
      assert.deepEqual([1,2,3].concat([4,5,6]), [1,2,3,4,5,6]);
      assert.deepEqual([].concat([1,2,3]), [1,2,3]);
      assert.deepEqual([1,2,3].concat([]), [1,2,3]);
    });
    it("should define String.trimStart, String.trimEnd", function() {
      assert.equal(" asd ".trimStart(), "asd ");
      assert.equal(" asd ".trimEnd(), " asd");
      assert.equal(" asd ".trim(), "asd");
    });
    it("should define RegExp.escape", function() {
      assert.equal(RegExp.escape("foo()bar"), "foo\\(\\)bar");
      assert.equal(RegExp.escape("[.*+?]"), "\\[\\.\\*\\+\\?\\]");
      for (let ch of "[].*+?^${}()|[]\\") {
        assert.equal(RegExp.escape(ch), "\\" + ch);
      }
      assert.equal(RegExp.escape("somethingwithoutsymbols"), "somethingwithoutsymbols");
    });
    it("should define Array.extend", function() {
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
    /* TODO: String.strip (with/without chars) */
    /* TODO: String.escape */
    it("should define String.escape", function() {
      assert.equal("<tag>".escape(), "&lt;tag&gt;");
      assert.equal("<tag val=\"v1&v2\"></tag>".escape(),
                   "&lt;tag val=&quot;v1&amp;v2&quot;&gt;&lt;/tag&gt;");
      assert.equal("\"'\"".escape(), "&quot;&apos;&quot;");
    });
    /* TODO: String.map */
    it("should define String.equalsLowerCase", function() {
      assert.ok("foo".equalsLowerCase("FOO"));
      assert.ok("FOO".equalsLowerCase("FOO"));
      assert.ok("FOO".equalsLowerCase("foo"));
      assert.ok(!"FOO".equalsLowerCase("FOOO"));
      assert.ok(GREEK_SIGMA.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(!GREEK_SIGMA_ALT.equalsLowerCase(GREEK_SIGMA_UC));
    });
    it("should define String.equalsUpperCase", function() {
      assert.ok("foo".equalsUpperCase("FOO"));
      assert.ok("FOO".equalsUpperCase("FOO"));
      assert.ok("FOO".equalsUpperCase("foo"));
      assert.ok(!"FOO".equalsUpperCase("FOOO"));
      assert.ok(GREEK_SIGMA.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(!GREEK_SIGMA_ALT.equalsLowerCase(GREEK_SIGMA_UC));
      assert.ok(GREEK_SIGMA.equalsUpperCase(GREEK_SIGMA_ALT));
    });
    it("should define String.transform", function() {
      assert.equal("asd".transform((b) => b), "asd");
      assert.equal("asd".transform((b) => b+1), "bte");
      assert.equal("asd".transform((b) => b-32), "ASD");
      assert.equal("aaa".transform((b) => b+2), "ccc");
      assert.equal("asd".transform((b) => 0), "\0\0\0");
      assert.equal("asd".transform((b) => b/2), "092");
      assert.equal("asd".transform((b) => 97), "aaa");
    });
    it("should define String.xor", function() {
      assert.equal("foo".xor(1).xor(1), "foo");
      assert.equal("foo".xor(0), "foo");
      assert.equal("f".xor(255), String.fromCharCode("f".charCodeAt(0) ^ 255));
    });
    it("should define String.toTitleCase", function() {
      assert.equal("foo bar".toTitleCase(), "Foo Bar");
      assert.equal("".toTitleCase(), "");
      assert.equal("FOO BAR".toTitleCase(), "Foo Bar");
      assert.equal("foo_bar".toTitleCase(), "Foo_bar");
    });
  });
  describe("Array and sequence functions", function() {
    it("should define Util.ToArray", function() {
      /* TODO */
    });
    it("should define Util.Zip", function() {
      const a = [1, 2, 3];
      const b = ["a", "b", "c"];
      assert.deepEqual(Util.Zip(a, a), [[1, 1], [2, 2], [3, 3]]);
      assert.deepEqual(Util.Zip(a, b), [[1, "a"], [2, "b"], [3, "c"]]);
      assert.deepEqual(Util.Zip(b, b), [["a", "a"], ["b", "b"], ["c", "c"]]);
      assert.deepEqual(Util.Zip(a), [[1], [2], [3]]);
      assert.deepEqual(Util.Zip(a, a, a), [[1, 1, 1], [2, 2, 2], [3, 3, 3]]);
    });
    it("should define Util.ArgsToArray", function() {
      function f() { return Util.ArgsToArray(arguments); }
      assert.deepEqual(f(), []);
      assert.deepEqual(f(f), [f]);
      assert.deepEqual(f(f, null), [f, null]);
      assert.deepEqual(f([1, 2], 1, 2), [[1, 2], 1, 2]);
    });
  });
  describe("URL handling", function() {
  });
  describe("Error handling", function() {
  });
  describe("Logging", function() {
  });
  describe("Color handling", function() {
  });
  describe("PRNG (Pseudo-Random Number Generator)", function() {
    it("should define numToHex", function() {
      assert.equal(Util.Random.numToHex(0), "00");
      assert.equal(Util.Random.numToHex(8), "08");
      assert.equal(Util.Random.numToHex(12), "0c");
      assert.equal(Util.Random.numToHex(255), "ff");
      assert.equal(Util.Random.numToHex(256, 4), "0100");
    });
    it("should define hex<N> functions", function() {
      assert.equal(typeof(Util.Random.hex8()), "string");
      assert.equal(typeof(Util.Random.hex16()), "string");
      assert.equal(typeof(Util.Random.hex32()), "string");
      assert.equal(typeof(Util.Random.hex64()), "string");
    });
    it("should define int<N> functions", function() {
      assert.equal(typeof(Util.Random.int8()), "number");
      assert.equal(typeof(Util.Random.int16()), "number");
      assert.equal(typeof(Util.Random.int32()), "number");
      assert.equal(typeof(Util.Random.int64()), "number");
    });
    it("should define uuid", function() {
      const uuid_len = 16 * 2 + 4;
      assert.equal(Util.Random.uuid().length, uuid_len);
    });
    it("should define uniform", function() {
      const minv = 10;
      const maxv = 11;
      const rv = Util.Random.uniform(minv, maxv);
      assert.ok(minv <= rv && rv <= maxv);
    });
  });
  describe("Event handling", function() {
  });
  describe("Parsing, formatting, and string functions", function() {
  });
  describe("Configuration and localStorage functions", function() {
    /* NOTE: localStorage may not be implemented */
  });
  describe("Query String handling", function() {
  });
  describe("Point-box functions", function() {
  });
  describe("CSS functions", function() {
  });
  describe("DOM functions", function() {
  });
  describe("Miscellaneous functions", function() {
  });
  describe("Construct global objects", function() {
  });
});

