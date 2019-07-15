
var mocha = require("mocha");
var assert = require("assert");

try {
  window;
}
catch (e) {
  global.window = global;
  global.navigator = {};
  global.location = {};
  global.location.pathname = "test/harness.js";
  global.location.protocol = "file:";
  global.localStorage = {};
}

var Util = require("../utility.js").Util;
var Client = require("../client.js");

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
      assert.equal(Math.clamp(1, 5, 5), 5, "below");
      assert.equal(Math.clamp(1, 0, 2), 1, "in");
      assert.equal(Math.clamp(5, 0, 2), 2, "above");
      assert.ok(Number.isNaN(Math.clamp(NaN, 0, 0)), "nan");
    });
    it("should define Array.any", function() {
      assert.ok([false,false,true].any(), "normal");
      assert.ok([0, NaN, 1].any(), "any with NaN");
      assert.ok(![].any(), "empty any is false");
    });
    it("should define Array.all", function() {
      assert.ok(![].all(), "empty array is false");
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
    /* TODO: RegExp.escape */
    /* TODO: Array.extend */
    /* TODO: Array.min (with/without key func) */
    /* TODO: Array.max (with/without key func) */
    /* TODO: Array.range (with/without dflt) */
    /* TODO: String.strip (with/without chars) */
    /* TODO: String.escape */
    /* TODO: String.map */
    /* TODO: String.equalsLowerCase */
    /* TODO: String.equalsUpperCase */
    /* TODO: String.transform */
    /* TODO: String.xor */
    /* TODO: String.toTitleCase */
  });
  describe("Array and sequence functions", function() {
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
  });
  describe("Event handling", function() {
  });
  describe("Parsing, formatting, and string functions", function() {
  });
  describe("Configuration and localStorage functions", function() {
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

/* Test client.js */
describe("Client", function() {

});

