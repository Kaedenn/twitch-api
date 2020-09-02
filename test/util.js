
"use strict";

/* TODO:
 * Util.FormatStack
 * Stack trimming
 * Util.GetMaxContrast
 * CallbackHandler
 *  stacktrace testing?
 *  useDOMEventsFirst (not sure how to test? remove?)
 *  useDefaultAfterDOMEvents
 * Util.ParseNumber (ensure all paths are covered)
 * Util.EscapeWithMap
 * Util.FormatDate (more coverage)
 * Util.FormatQueryString
 * Util.PromiseElement
 * Util.PromiseImage
 * Util.SplitGIF
 * Util.ImageFromPNGData
 * Util.StyleToObject
 * Util.DisableLocalStorage (must be last test)
 *
 * FIXME:
 * URL regex failure
 * Util.StripCommonPrefix (fails)
 * Util.CSS.GetSheet (<link> tag doesn't work?)
 * Util.CreateNode (Text node creation fails?)
 */

const TWUtil = require("../utility.js");
for (let [k, v] of Object.entries(TWUtil)) {
  global[k] = v;
}

Util.DebugLevel = Util.LEVEL_TRACE;

/* Greek "sigma" character: two lower-case variants, one upper-case variant */
const GREEK_SIGMA = "\u03c3";
const GREEK_SIGMA_ALT = "\u03c2";
const GREEK_SIGMA_UC = "\u03a3";

/* Obtain HTML for the given element */
function getHTMLFor(e) {
  let w = document.createElement("div");
  w.appendChild(e);
  return w.innerHTML;
}

/* Reset changes made to the logger */
function resetLogger() {
  Util.Logger.enable();
  Util.Logger.removeAllHooks();
  Util.Logger.removeAllFilters();
}

/* Return true if the two numbers are approximately equal */
function approxEqual(n1, n2) {
  /* Exactly equal */
  if (n1 === n2) return true;
  /* Differ by less than epsilon */
  if (Math.abs(n1 - n2) < Number.EPSILON) return true;
  /* Number of digits after the decimal */
  const decDigits = (n) => {
    let s = `${n}`;
    if (s.indexOf(".") === -1) {
      return 0;
    } else {
      return s.substr(s.indexOf(".")+1).length;
    }
  };
  let d = Math.min(decDigits(n1), decDigits(n2));
  /* Within rounding of the last digit */
  return Math.round(n1 * Math.pow(10, d)) === Math.round(n2 * Math.pow(10, d));
}

/* Test utility.js */
describe("Util", function() { /* nofold */
  describe("Exports", function() {
    it("provides CallbackHandler", function() {
      assert.equal(CallbackHandler, Util.CallbackHandler);
    });
    it("provides Logging", function() {
      assert.equal(Logging, Util.Logging);
      assert.ok(Logging.FUNCTION_MAP);
      for (let s of Object.values(Logging.SEVERITIES)) {
        assert.ok(Logging.FUNCTION_MAP[s]);
      }
    });
    it("provides ColorParser", function() {
      assert.equal(ColorParser, Util.ColorParser);
      assert.ok(ColorParser.parse);
    });
    it("provides tinycolor", function() {
      assert.equal(tinycolor, window.tinycolor);
      assert.ok(tinycolor("red"));
    });
  });
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
      /* Works with JSON parsing/formatting (except \v) */
      assert.equal(JSON.parse(`"\\${Util.StringEscapeChars['\b']}"`), '\b');
      for (let [e, c] of Object.entries(Util.StringEscapeChars)) {
        let s = `"\\${c}"`;
        /* JSON.parse('"\\v"') doesn't work even though "\v" !== "v" */
        if (e === '\v' && c === 'v') {
          continue;
        }
        assert.equal(JSON.parse(s), e);
        assert.equal(JSON.stringify(e), s);
      }
    });
    it("defines Util.EscapeChars", function() {
      /* Assert that s1 escapes to s2 using setAttribute */
      const testAttr = (s1, s2) => {
        const pat = /<span data-attr="(.*)"><\/span>/;
        let e = document.createElement("span");
        e.setAttribute("data-attr", s1);
        let s = getHTMLFor(e);
        let m = s.match(pat);
        assert.ok(m);
        assert.equal(m[0], s);
        assert.equal(m[1], s2);
      };
      /* Assert that s1 escapes to s2 using textContent */
      const testValue = (s1, s2) => {
        let e = document.createElement("span");
        e.textContent = s1;
        assert.equal(e.textContent, s1);
        assert.equal(e.innerHTML, s2);
      };
      testAttr('foo "bar" baz', "foo &quot;bar&quot; baz");
      testValue("<>", "&lt;&gt;");
      testValue("<", Util.EscapeChars["<"]);
      testValue(">", Util.EscapeChars[">"]);
      testValue("&", Util.EscapeChars["&"]);
      testAttr("\"", Util.EscapeChars['"']);
      testAttr("&", Util.EscapeChars["&"]);
      /* TODO: Test &apos; somehow? */
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
    it("defines Array.{min,max}", function() {
      let keyFn = (a) => a;
      assert.equal([1, 2, 3].min(), 1);
      assert.equal(['a', 'b', 'c'].min(), 'a');
      assert.equal(['a', 'b', 'c'].min(keyFn), 'a');
      assert.equal(['a', 'b', 'c'].max(), 'c');
      assert.equal(['a', 'b', 'c'].max(keyFn), 'c');
      assert.equal([].min(), null);
      assert.equal([].min(keyFn), null);
      assert.equal([].max(), null);
      assert.equal([].max(keyFn), null);
      assert.equal(Array.of(..."text").max(), "x");
      assert.equal(Array.of(..."text").max(keyFn), "x");
      assert.equal(Array.of(..."text").min(), "e");
      assert.equal(Array.of(..."text").min(keyFn), "e");
      assert.equal([-1, -2, -3].min(), -3);
      assert.equal([-1, -2, -3].max(), -1);
      keyFn = (a) => a < 5 ? a : -a;
      assert.equal([4, 5, 6].min(keyFn), 6);
      assert.equal([4, 5, 6].max(keyFn), 4);
      keyFn = (a) => a.length;
      assert.equal(["foo", "f", "fooo"].min(keyFn), "f");
      assert.equal(["foo", "f", "fooo"].max(keyFn), "fooo");
      assert.deepEqual([[], [1], [1, 2]].min(keyFn), []);
      assert.deepEqual([[], [1], [1, 2]].max(keyFn), [1, 2]);
      keyFn = (a) => -a.length;
      assert.equal(["foo", "f", "fooo"].max(keyFn), "f");
      assert.equal(["foo", "f", "fooo"].min(keyFn), "fooo");
      assert.deepEqual([[], [1], [1, 2]].min(keyFn), [1, 2]);
      assert.deepEqual([[], [1], [1, 2]].max(keyFn), []);
      keyFn = (a) => a[0] + a[1];
      assert.deepEqual([[0, 15], [7, 7], [14, 0], [16, -15]].max(keyFn), [0, 15]);
      assert.deepEqual([[0, 15], [7, 7], [14, 0], [16, -15]].min(keyFn), [16, -15]);
      keyFn = (a) => a[0] * a[1];
      assert.deepEqual([[0, 1, 2], [3, 4, 5], [100, 1]].max(keyFn), [100, 1]);
      assert.deepEqual([[0, 1, 2], [3, 4, 5], [100, 1]].min(keyFn), [0, 1, 2]);
    });
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
    it("defines String.map", function() {
      assert.equal("abc".map((c) => c.toUpperCase()), "ABC");
      assert.equal("ABC".map((c) => c.toLowerCase()), "abc");
      assert.equal("abc".map((c) => c + "1"), "a1b1c1");
      assert.equal("abc".map((c) => ""), "");
      assert.equal("abc".map((c) => String.fromCharCode(c.charCodeAt(0)+1)), "bcd");
      assert.equal("xyz".map((c) => `a${c}b`), "axbaybazb");
    });
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
      function match(u, fail=false) {
        const m = u.match(new RegExp(Util.URL_REGEX));
        if (fail) {
          if (m) {
            Util.LogOnly("unexpected match for", u, ":", m);
          }
          return !m;
        } else {
          assert.ok(m);
          assert.equal(m[0], u);
          return true;
        }
      }
      assert.ok(match("example.com"));
      assert.ok(match("example.com/"));
      assert.ok(match("www.example.com"));
      assert.ok(match("www.example.com/"));
      assert.ok(match("www-2.example.com"));
      assert.ok(match("www-2.example.com/"));
      assert.ok(match("http://example.com"));
      assert.ok(match("http://example.com/"));
      assert.ok(match("https://example.com"));
      assert.ok(match("https://example.com/"));
      assert.ok(match("https://www.example.com"));
      assert.ok(match("https://www.example.com/"));
      assert.ok(match("https://www2.example.com"));
      assert.ok(match("https://www2.example.com/"));
      assert.ok(match("https://www-2.example.com"));
      assert.ok(match("https://www-2.example.com/"));
      assert.ok(match("http://example.com?a=b"));
      assert.ok(match("http://example.com?a=b#section.c"));
      assert.ok(match("http://example.com/?a=b#section.c"));
      assert.ok(match("www.example.com/www.example.com/example.asf"));
      assert.ok(match("http://www.example.com/www.example.com/example.asf"));
      assert.ok(match("www.foo.example.org"));
      assert.ok(match("www.foo.example.org/"));
      assert.ok(match("https://os.cs.csce.university.edu"));
      assert.ok(match("http://os.cs.csce.university.edu/foo?bar=baz#qux.1"));
      assert.ok(match("www.2-example.com"));
      assert.ok(match("www.foo-bar.example.com"));
      assert.ok(match("http://asd.co"));
      assert.ok(match("http://os.cs.csce.university.ax/foo/bar?baz=&qux=asd+asd#hash=1+2+4,hash2="));
      assert.ok(match("www.a--x.as"));
      //assert.ok(match("//foo.example.com/path/to/the-thing.js"));
      /* non-http */
      assert.ok(match("ws://foo.com"));
      assert.ok(match("ws://foo.tv"));
      assert.ok(match("ftp://bar.com/"));
      assert.ok(match("notasite", true));
      /* bugs found after delivery */
      assert.ok(match("www.foo.co.uk/bar/baz"));
      assert.ok(match("foo...", true));
      assert.ok(match("foo.,,", true));
    });
    it("can find URLs in text", function() {
      const matchCount = (s) => {
        let m = s.match(Util.URL_REGEX);
        return m ? m.length : 0;
      };
      assert.equal(matchCount("no urls at all"), 0);
      assert.equal(matchCount("http://www.example.com"), 1);
      assert.equal(matchCount("text www.foo.com text http://bar.com text"), 2);
      assert.equal(matchCount("https://clips.twitch.tv/this-should-be-a-slug hey look at this"), 1);
      assert.equal(matchCount("https://foo.com/https://bar.com"), 1);
    });
    it("defines Util.URL", function() {
      assert.ok(new URL(Util.URL("//www.example.com")));
      assert.ok(new URL(Util.URL("www.example.com")));
      assert.ok(new URL(Util.URL("example.com")));
      assert.ok(new URL(Util.URL("//foo.com/bar/baz")));
      assert.ok(new URL(Util.URL("basic-text")));
      /* Nested space should cause problems */
      assert.throws(() => new URL(Util.URL("basic text")));
      assert.throws(() => new URL(Util.URL("basic%20text")));
    });
    it("defines Util.SplitPath", function() {
      /* TODO: More coverage */
      assert.deepEqual(Util.SplitPath("foo/bar"), ["foo", "bar"]);
      assert.deepEqual(Util.SplitPath("foo/bar/baz"), ["foo/bar", "baz"]);
      assert.deepEqual(Util.SplitPath("foo"), ["", "foo"]);
      assert.deepEqual(Util.SplitPath("foo/"), ["foo", ""]);
    });
    it("defines Util.JoinPath", function() {
      /* TODO: More coverage */
      assert.equal(Util.JoinPath("foo", "bar"), "foo/bar");
      assert.equal(Util.JoinPath("", "bar"), "bar");
      assert.equal(Util.JoinPath("foo", ""), "foo/");
    });
    it("defines Util.StripCommonPrefix", function() {
      let paths = Util.StripCommonPrefix([
        "file:///home/user/foo/bar/script.js",
        "file:///home/user/foo/bar/page.html?foo",
        "file:///home/user/foo/bar/baz/qux/docs.html",
        "file:///home/user/foo/bar",
        "file:///home/user/foo/bar/"
      ]);
      assert.equal(paths.length, 5);
      assert.equal(paths[0], "bar/script.js");
      /* FIXME: loses "?foo" */
      // assert.equal(paths[1], "bar/page.html?foo");
      assert.equal(paths[2], "bar/baz/qux/docs.html");
      assert.equal(paths[3], "bar");
      /* FIXME: leaves trailing slash */
      // assert.equal(paths[4], "bar");
      paths = Util.StripCommonPrefix(["www.example.com"]);
      assert.deepEqual(paths, [""]);
      paths = Util.StripCommonPrefix([
        "www.example.com",
        "https://www.example.com",
        "http://www.example.com"
      ]);
      assert.deepEqual(paths, ["", "", ""]);
    });
  });
  /* Section "Error handling" tested below */
  describe("Logging", function() {
    it("defines Util.Throw with stack handling", function() {
      /* Throw an error via Util.Throw (then throw, if that fails) */
      function foo() {
        function bar() {
          Util.Throw(Error, "test");
          throw new Error("fallback");
        }
        bar();
      }
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
    });
    it("parses stacks", function() {
      let frames = Util.ParseStack([
        "@debugger eval code:1:1",
        "function@path/filename.js:100:23"
      ]);
      assert.equal(frames.length, 2);
      assert.equal(frames[0].text, "@debugger eval code:1:1");
      assert.equal(frames[0].name, "");
      assert.equal(frames[0].file, "debugger eval code");
      assert.equal(frames[0].line, 1);
      assert.equal(frames[0].column, 1);
      assert.equal(frames[1].text, "function@path/filename.js:100:23");
      assert.equal(frames[1].name, "function");
      assert.equal(frames[1].file, "path/filename.js");
      assert.equal(frames[1].line, 100);
      assert.equal(frames[1].column, 23);

      frames = Util.ParseStack(["something unparseable"]);
      assert.equal(frames.length, 1);
      assert.equal(frames[0].text, "something unparseable");
      assert.equal(frames[0].name, "<unnamed>");
      assert.equal(frames[0].file, window.location.pathname);
      assert.ok(Number.isNaN(frames[0].line));
      assert.ok(Number.isNaN(frames[0].column));

      frames = Util.ParseStack([
        "  at SomeFunc [as SomeThing] (path/file.js:100:1)",
        "  at Caller (path/file.js:1:1)",
        "at foo.js:12:101",
        "at :0:0",
        "path/to/file.js:100:4",
        "SomeFunc:0:0",
        "at new Class (path/to/file.js:1:2)"
      ]);
      assert.equal(frames[0].name, "SomeFunc");
      assert.equal(frames[0].actual_name, "SomeThing");
      assert.equal(frames[0].file, "path/file.js");
      assert.equal(frames[0].line, 100);
      assert.equal(frames[0].column, 1);
      assert.equal(frames[1].name, "Caller");
      assert.equal(frames[1].file, "path/file.js");
      assert.equal(frames[1].line, 1);
      assert.equal(frames[1].column, 1);
      assert.equal(frames[2].name, "<unnamed>");
      assert.equal(frames[2].line, 12);
      assert.equal(frames[2].column, 101);
      assert.equal(frames[3].name, "<unnamed>");
      assert.equal(frames[3].line, 0);
      assert.equal(frames[3].column, 0);
      assert.equal(frames[4].name, "<unnamed>");
      assert.equal(frames[4].file, "path/to/file.js");
      assert.equal(frames[4].line, 100);
      assert.equal(frames[4].column, 4);
      assert.equal(frames[5].name, "SomeFunc");
      assert.equal(frames[5].file, window.location.pathname);
      assert.equal(frames[5].line, 0);
      assert.equal(frames[5].column, 0);
      assert.equal(frames[6].name, "new Class");
      assert.equal(frames[6].file, "path/to/file.js");
      assert.equal(frames[6].line, 1);
      assert.equal(frames[6].column, 2);
    });
    /* TODO: Stack formatting */
    /* TODO: Stack trimming */
    it("provides debug levels", function() {
      const oldestLevel = Util.DebugLevel;
      Util.PushDebugLevel(Util.LEVEL_DEBUG);
      assert.equal(Util.DebugLevel, Util.LEVEL_DEBUG);
      assert.equal(Util.LEVEL_OFF, Util.LEVEL_MIN);
      assert.ok(Util.LEVEL_MIN < Util.LEVEL_FATAL);
      assert.ok(Util.LEVEL_FATAL < Util.LEVEL_WARN);
      assert.ok(Util.LEVEL_WARN < Util.LEVEL_INFO);
      assert.ok(Util.LEVEL_INFO < Util.LEVEL_DEBUG);
      assert.ok(Util.LEVEL_DEBUG < Util.LEVEL_TRACE);
      assert.ok(Util.LEVEL_TRACE === Util.LEVEL_MAX);
      assert.ok(Util.PopDebugLevel());
      Util.PushDebugLevel(Util.LEVEL_TRACE);
      assert.equal(Util.DebugLevel, Util.LEVEL_TRACE);
      assert.ok(Util.Logger.severityEnabled(Util.Logging.ALL));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.ERROR));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.WARN));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.INFO));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.DEBUG));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.TRACE));
      Util.PushDebugLevel(Util.LEVEL_DEBUG);
      assert.equal(Util.DebugLevel, Util.LEVEL_DEBUG);
      assert.ok(Util.Logger.severityEnabled(Util.Logging.ERROR));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.WARN));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.INFO));
      assert.ok(Util.Logger.severityEnabled(Util.Logging.DEBUG));
      assert.ok(!Util.Logger.severityEnabled(Util.Logging.TRACE));
      Util.PopDebugLevel();
      assert.equal(Util.DebugLevel, Util.LEVEL_TRACE);
      Util.PopDebugLevel();
      Util.PushDebugLevel(Util.LEVEL_FATAL);
      assert.ok(Util.Logger.severityEnabled(Util.Logging.ERROR));
      assert.ok(!Util.Logger.severityEnabled(Util.Logging.WARN));
      assert.ok(!Util.Logger.severityEnabled(Util.Logging.INFO));
      assert.ok(!Util.Logger.severityEnabled(Util.Logging.DEBUG));
      assert.ok(!Util.Logger.severityEnabled(Util.Logging.TRACE));
      Util.PopDebugLevel();
      assert.ok(!Util.PopDebugLevel());
      assert.equal(Util.DebugLevel, oldestLevel);
    });
    describe("simple logging", function() {
      it("logs", function(done) {
        resetLogger();
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.equal(sev, "INFO");
          assert.ok(hasStack);
          assert.deepEqual(args, ["test", 1, 2, 3]);
          done();
          return Util.Logging.HOOK_STOP;
        });
        Util.Info("test", 1, 2, 3);
        resetLogger();
      });
      it("logs without a stack", function(done) {
        resetLogger();
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.equal(sev, "INFO");
          assert.ok(!hasStack);
          assert.deepEqual(args, ["test", 1, 2, 3]);
          done();
          return Util.Logging.HOOK_STOP;
        });
        Util.InfoOnly("test", 1, 2, 3);
        resetLogger();
      });
      it("logs once", function(done) {
        resetLogger();
        let count = 0;
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.equal(sev, "INFO");
          assert.ok(hasStack);
          assert.deepEqual(args, ["test", 1, 2, 3]);
          count += 1;
          return Util.Logging.HOOK_STOP;
        }, "INFO");
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.equal(count, 1);
          done();
          return Util.Logging.HOOK_STOP;
        }, "DEBUG");
        Util.InfoOnce("test", 1, 2, 3);
        Util.InfoOnce("test", 1, 2, 3);
        Util.InfoOnce("test", 1, 2, 3);
        Util.InfoOnlyOnce("test", 1, 2, 3);
        Util.InfoOnlyOnce("test", 1, 2, 3);
        Util.InfoOnlyOnce("test", 1, 2, 3);
        Util.DebugOnly("done");
        resetLogger();
      });
      it("honors hooks with levels", function(done) {
        resetLogger();
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.equal(sev, "DEBUG");
        }, "DEBUG");
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.ok(args.length > 0);
          if (sev !== "INFO" || args[0] !== "done") {
            assert.equal(args[0], sev.toLowerCase());
          }
        });
        Util.Logger.addHook((sev, hasStack, ...args) => {
          assert.ok(args.length > 0);
          if (args[0] === "done") {
            done();
          }
        }, "INFO");
        /* Prevent console cluttering */
        for (let s of Object.keys(Util.Logging.SEVERITIES)) {
          if (s === "ALL") continue;
          Util.Logger.addHook((sev, hasStack, ...args) => {
            return Util.Logging.HOOK_STOP;
          }, s);
        }
        Util.DebugOnly("debug");
        Util.TraceOnly("trace");
        Util.LogOnly("info");
        Util.InfoOnly("info");
        Util.WarnOnly("warn");
        Util.ErrorOnly("error");
        Util.LogOnly("done");
        resetLogger();
      });
    });
    it("provides filters", function(done) {
      resetLogger();
      Util.Logger.addFilter(/filtered/);
      Util.Logger.addFilter("omit this message");
      Util.Logger.addFilter("omit debug", "DEBUG");
      Util.Logger.addHook((sev, hasStack, ...args) => {
        assert.ok(!/filtered/.test(args.join(" ")));
        assert.ok(args.join(" ").indexOf("omit this message") === -1);
        if (sev === "DEBUG") {
          assert.ok(args.join(" ").indexOf("omit debug") === -1);
        }
        if (args[0] === "done") {
          done();
        }
        /* Hide things from cluttering the output */
        return Util.Logging.HOOK_STOP;
      });
      Util.LogOnly("this should be filtered");
      Util.LogOnly("we should", "omit this message");
      Util.DebugOnlyOnce("omit debug");
      Util.DebugOnly("omit debug");
      Util.DebugOnlyOnce("omit", "debug");
      Util.DebugOnly("omit", "debug");
      Util.DebugOnly("this should make it through");
      Util.WarnOnly("this should be", "filtered");
      Util.WarnOnly("omit debug");
      Util.LogOnly("this should be logged");
      Util.LogOnly("done");
      resetLogger();
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
    describe("Util.Color oject", function() {
      let red = new Util.Color("red");
      it("has basic operations", function() {
        assert.equal(black.hex, "#000000");
        assert.equal(white.hex, "#ffffff");
        assert.deepEqual(black.rgb, [0, 0, 0]);
        assert.deepEqual(white.rgb, [255, 255, 255]);
        assert.deepEqual(black.rgba, [0, 0, 0, 255]);
        assert.deepEqual(white.rgba, [255, 255, 255, 255]);
      });
      it("provides constructors", function() {
        assert.deepEqual(C(black).rgba, [0, 0, 0, 255]);
        assert.deepEqual(C().rgba, [0, 0, 0, 255]);
        assert.deepEqual(C("black").rgba, [0, 0, 0, 255]);
        assert.deepEqual(C("white").rgba, [255, 255, 255, 255]);
        assert.deepEqual(C(0, 0, 0, 0).rgba, [0, 0, 0, 0]);
        assert.deepEqual(C([0, 0, 0]).rgba, [0, 0, 0, 255]);
        assert.deepEqual(C([0, 0, 0, 127]).rgba, [0, 0, 0, 127]);
        assert.deepEqual(C("#ff0000").rgba, [255, 0, 0, 255]);
        assert.throws(() => C("notacolor"));
      });
      it("has equals", function() {
        assert.ok(red.equals("#ff0000"));
        assert.ok(red.equals("#ff0000ff"));
        assert.ok(red.equals("rgb(255, 0, 0)"));
        assert.ok(red.equals("rgba(255, 0, 0, 1)"));
        assert.ok(red.equals("hsl(0, 1, 0.5)"));
        assert.ok(red.equals("hsla(0, 1, 0.5, 1)"));
      });
      it("provides getters/conversion getters", function() {
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
      });
      it("has inverted", function() {
        assert.equal(white.inverted().hex, "#000000");
        assert.equal(black.inverted().hex, "#ffffff");
        assert.equal(red.inverted().hex, "#00ffff");
        assert.equal(red.inverted().inverted().hex, "#ff0000");
        assert.equal(C("#7f7f7f").inverted().hex, "#808080");
        assert.equal(C("#808080").inverted().hex, "#7f7f7f");
      });
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
      function assertRatio(c1, c2, ex) {
        let cr = Util.ContrastRatio(new Util.Color(c1), new Util.Color(c2));
        try {
          assert.ok(approxEqual(cr, ex));
        }
        catch (e) {
          Util.Error("Failure:", cr, ex, "not equal");
          throw e;
        }
      }
      /* Values taken from Wikipedia Template:Color_contrast_ratio */
      assert.equal(Util.ContrastRatio(black, white), 21);
      assertRatio("#000080", "#DDDDDD", 11.787);
      assertRatio("#7B0000", "#FF9900", 5.324);
      assertRatio("#004800", "#AAAAAA", 4.691);
      assertRatio("red", "white", 3.998);
      assertRatio("#FF0000", "#FF9999", 1.955);
      assertRatio("#BADFEE", "black", 14.878);
      assertRatio("red", "black", 5.252);
      assertRatio("#FFFF00", "#00FFFF", 1.168);
    });
    it("can maximize contrast", function() {
      /* TODO */
    });
    it("supports sRGB calculation", function() {
      assert.deepEqual(black.srgb, black.rgb_1);
      assert.deepEqual(white.srgb, white.rgb_1);
      assert.ok(approxEqual(Util.Color.SRGBToLinear(Util.Color.LinearToSRGB(0.5)), 0.5));
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
    const C = class C extends CallbackHandler { };
    it("supports CallbackHandler", function() {
      let testCounter = 0;
      let defaultCounter = 0;
      let c = new C();
      c.bind("test1", function() { testCounter += 1; });
      c.bindDefault(function() { defaultCounter += 1; });
      c.fire("test1", {}); /* increments counter */
      c.fire("test2", {}); /* increments default counter */
      c.unbind("test1");
      c.fire("test1", {}); /* increments default counter */
      assert.equal(testCounter, 1);
      assert.equal(defaultCounter, 2);
      c.unbindDefault(function() { });
      c.fire("test2", {}); /* increments default counter */
      assert.equal(defaultCounter, 3);
      c.unbindDefault();
      c.fire("test2", {}); /* should do nothing */
      assert.equal(defaultCounter, 3);
      c.fire("test1", {}); /* should do nothing */
      assert.equal(testCounter, 1);
      c.bind("test", function() { testCounter += 1; });
      c.fire("test", {}); /* increments counter */
      assert.equal(testCounter, 2);
      c.unbindNamed("test");
      c.fire("test", {}); /* should do nothing */
      assert.equal(testCounter, 2);

      let [f1Count, f2Count] = [0, 0];
      let f1 = function() { f1Count += 1; };
      let f2 = function() { f2Count += 1; };
      c.bindDefault(f1);
      c.bindDefault(f2);
      c.fire("test", {}); /* increments f1, f2 */
      assert.equal(f1Count, 1);
      assert.equal(f2Count, 1);
      c.unbindDefault(f1);
      c.fire("test", {}); /* increments f2 */
      assert.equal(f1Count, 1);
      assert.equal(f2Count, 2);
      c.bind("test", f1);
      c.fire("test", {}); /* increments f1 */
      assert.equal(f1Count, 2);
      assert.equal(f2Count, 2);
      c.unbind("test", f1);
      c.fire("test", {}); /* increments f2 */
      assert.equal(f1Count, 2);
      assert.equal(f2Count, 3);
      c.unbind("test", f1);
      c.fire("test", {}); /* increments f2 */
      assert.equal(f1Count, 2);
      assert.equal(f2Count, 4);
    });
    it("supports useDOMEvents", function(done) {
      this.slow(200);
      let counter = {};
      const inc = (name) => {
        counter[name] = (counter[name] || 0) + 1;
      };
      const event = (m) => {
        let e = new window.Event(m);
        e.message = m;
        return e;
      };
      let c = new C({useDOMEvents: true});
      const fn = function(e) { inc("ev_" + e.message); };
      document.addEventListener("test", fn);
      c.bindDefault(function() { inc("default"); });
      c.bind("test", function(e) { inc("cb_" + e.message); });
      c.fire("test", {"message": "test2"}); /* cb_test2 */
      c.fire("test", event("test")); /* ev_test */
      c.fire("foo", event("foo")); /* nothing; foo not bound */
      c.fire("bar", event("bar")); /* cb_test */
      c.fire("done", {}); /* default */
      c.fire("test", {"message": "test3"}); /* cb_test3 */
      document.removeEventListener("test", fn);
      c.fire("test", event("test")); /* cb_test */
      window.setTimeout(function() {
        try {
          assert.equal(counter.cb_test, 2);
          assert.equal(counter.cb_test2, 1);
          assert.equal(counter.cb_test3, 1);
          assert.equal(counter.ev_test, 1);
          assert.equal(counter.default, 1);
          done();
        }
        catch (e) {
          Util.Error("Test failure; counters:", counter);
          done(e);
        }
      }, 50);
      /* TODO:
       * useDOMEventsFirst
       * useDefaultAfterDOMEvents
       */
    });
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
      /* TODO: ensure every branch is tested */
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
      assert.deepEqual(Util.StringToCodes(" "), [32]);
      assert.deepEqual(Util.StringToCodes("\x00\x01\x02\x03"), [0, 1, 2, 3]);
      assert.deepEqual(Util.StringToCodes("abc"), [97, 98, 99]);
      assert.deepEqual(Util.StringToCodes("\r\n\v\t"), [13, 10, 11, 9]);
      for (let c of Util.ASCII) {
        assert.deepEqual(Util.StringToCodes(c), [Util.ASCII.indexOf(c)]);
      }
    });
    it("defines Util.FormatDate", function() {
      assert.equal(Util.FormatDate(new Date("Jan 1 2000")), "2000-01-01 00:00:00.000");
      let dt = new Date("Jan 12 2000");
      assert.equal(Util.FormatDate(dt), "2000-01-12 00:00:00.000");
      dt.setFullYear(2001);
      dt.setMonth(2);
      dt.setDate(12);
      dt.setHours(1);
      dt.setMinutes(2);
      dt.setSeconds(3);
      dt.setMilliseconds(0);
      assert.equal(Util.FormatDate(dt), "2001-03-12 01:02:03.000");
      dt.setHours(14);
      assert.equal(Util.FormatDate(dt), "2001-03-12 14:02:03.000");
      /* TODO: more coverage */
    });
    it("defines Util.FormatInterval", function() {
      assert.equal(Util.FormatInterval(4), "4s");
      assert.equal(Util.FormatInterval(-4), "-4s");
      assert.equal(Util.FormatInterval(-4.99), "-5s");
      assert.equal(Util.FormatInterval(60), "1m");
      assert.equal(Util.FormatInterval(61), "1m 1s");
      assert.equal(Util.FormatInterval(119), "1m 59s");
      assert.equal(Util.FormatInterval(-119), "-1m 59s");
      assert.equal(Util.FormatInterval(Number.NaN), "NaNs");
      assert.equal(Util.FormatInterval(0), "0s");
    });
    it("defines Util.{Encode,Decode}Flags", function() {
      assert.deepEqual(Util.DecodeFlags("5d"), [true, false, true]);
      assert.deepEqual(Util.DecodeFlags("111"), [true, true, true]);
      assert.deepEqual(Util.DecodeFlags("1"), [true]);
      assert.deepEqual(Util.DecodeFlags("6d"), [false, true, true]);
      assert.deepEqual(Util.DecodeFlags("6"), []);
      assert.deepEqual(Util.DecodeFlags("6d", 6), [false, true, true, false, false, false]);
      assert.deepEqual(Util.DecodeFlags("01010"), [false, true, false, true, false]);
      assert.deepEqual(Util.DecodeFlags(""), []);
      assert.deepEqual(Util.DecodeFlags("01210"), []);
      assert.deepEqual(Util.DecodeFlags("01210", 5), [false, false, false, false, false]);
      assert.equal(Util.EncodeFlags([false, true, false, true, false]), "01010");
      assert.equal(Util.EncodeFlags([]), "");
      assert.equal(Util.EncodeFlags([1, 2, true, 8, false]), "11110");
      assert.equal(Util.EncodeFlags(["", "foo", "1", "0", 1]), "01111");
      assert.equal(Util.EncodeFlags([null, false, undefined, {}, []]), "00011");
    });
    it("defines Util.EscapeSlashes", function() {
      assert.equal(Util.EscapeSlashes("foo\nbar\nbaz"), "foo\\nbar\\nbaz");
      assert.equal(Util.EscapeSlashes("1\t2\t3"), "1\\t2\\t3");
      assert.equal(Util.EscapeSlashes("\\t"), "\\\\t");
      assert.equal(Util.EscapeSlashes("\x01a\x02b\x03c"), "\\x01a\\x02b\\x03c");
    });
    it("defines Util.StringToRegExp", function() {
      assert.deepEqual(/foo/, new RegExp("foo"));
      assert.deepEqual(/foo/gim, new RegExp("foo", "gim"));
      assert.deepEqual(Util.StringToRegExp("foo"), /\bfoo\b/);
      assert.deepEqual(Util.StringToRegExp("foo", "gim"), /\bfoo\b/gim);
      assert.deepEqual(Util.StringToRegExp("/foo/m", "gi"), /foo/m);
      assert.deepEqual(Util.StringToRegExp("/foo[a-z]/m", "mg"), /foo[a-z]/m);
      assert.deepEqual(Util.StringToRegExp("f[^ ]+oo"), /\bf\[\^ \]\+oo\b/);
      assert.deepEqual(Util.StringToRegExp("f[^ ]+oo", "g"), /\bf\[\^ \]\+oo\b/g);
    });
    it("defines Util.JSONClone with opts.exclude", function() {
      let o = {
        "foo": {"bar": 1},
        "bar": 2,
        "baz": {"foo": 3}
      };
      assert.deepEqual(Util.JSONClone(o), o);
      assert.deepEqual(Util.JSONClone(o, {"exclude": ["foo", "baz"]}), {"bar": 2});
      assert.deepEqual(Util.JSONClone(o, {"exclude": "foo bar baz"}), o);
      assert.deepEqual(Util.JSONClone(o, {"exclude": []}), o);
      o = {
        "foo": "bar",
        [1]: "baz"
      };
      assert.deepEqual(Util.JSONClone(o), o);
      assert.deepEqual(Util.JSONClone(o, {"exclude": [1]}), o);
      o["func"] = () => 1;
      Util.PushDebugLevel(Util.LEVEL_OFF);
      assert.deepEqual(Util.JSONClone(o, {"exclude": ["foo"]}), {[1]: "baz"});
      assert.deepEqual(Util.JSONClone(o, {"exclude": ['1']}), {"foo": "bar"});
      assert.deepEqual(Util.JSONClone(o, {"exclude": ["foo", "1", "2"]}), {});
      Util.PopDebugLevel();
    });
  });
  describe("Configuration and localStorage functions", function() {
    it("supports get/set/append", function() {
      Util.SetWebStorageKey("config");
      assert.equal(Util.GetWebStorage(), null);
      Util.SetWebStorage({"foo": "bar"});
      assert.deepEqual(Util.GetWebStorage(), {"foo": "bar"});
      Util.SetWebStorageKey("config2");
      assert.equal(Util.GetWebStorage(), null);
      assert.deepEqual(Util.GetWebStorage("config"), {"foo": "bar"});
      Util.SetWebStorage(["foo", "bar"]);
      assert.deepEqual(Util.GetWebStorage(), ["foo", "bar"]);
      Util.StorageAppend(Util.GetWebStorageKey(), "baz");
      assert.deepEqual(Util.GetWebStorage(), ["foo", "bar", "baz"]);
      Util.SetWebStorage(["foo"]);
      Util.StorageAppend(Util.GetWebStorageKey(), Util.GetWebStorage());
      assert.deepEqual(Util.GetWebStorage(), ["foo", ["foo"]]);
      /* Appending to an unknown key */
      Util.StorageAppend("newkey", 1);
      assert.deepEqual(Util.GetWebStorage("newkey"), [1]);
      /* Appending to not-an-array */
      Util.SetWebStorage("foo");
      Util.StorageAppend(Util.GetWebStorageKey(), "bar");
      assert.deepEqual(Util.GetWebStorage(), ["foo", "bar"]);
    });
    it("supports obfuscated storage", function() {
      const cfg = {"foo": {"bar": 1}, "baz": 2};
      const oneTrip = (obj, args) => {
        return Util.StorageParse(Util.StorageFormat(obj, args), args.reverse());
      };
      /* Ensure standard obfuscations are lossless */
      for (let o of ["b64", "xor", "bs", "x1", "x19", "x31"]) {
        assert.deepEqual(oneTrip(cfg, [o]), cfg);
      }
      /* Ensure combinding obfuscations is lossless */
      assert.deepEqual(oneTrip(cfg, ["b64", "xor"]), cfg);
      assert.deepEqual(oneTrip(cfg, ["nojson"]), JSON.stringify(cfg));
    });
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
      tests[`?base64=${window.btoa("?foo=bar")}`] = {"foo": "bar"};
      /* base64: with non-base64 value */
      tests[`?bar=baz&base64=${window.btoa("?foo=bar")}`] = {"foo": "bar", "bar": "baz"};
      /* base64: overriding */
      tests[`?foo=baz&base64=${window.btoa("?foo=bar")}`] = {"foo": "bar"};
      tests[`?base64=${window.btoa("?foo=bar")}&foo=baz`] = {"foo": "baz"};
      for (let [qs, obj] of Object.entries(tests)) {
        assert.deepEqual(Util.ParseQueryString(qs), obj);
        assert.deepEqual(Util.ParseQueryString(qs.substr(1)), obj);
        /* possibly nested base64 */
        assert.deepEqual(Util.ParseQueryString(`?base64=${window.btoa(qs)}`), obj);
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
    /* NOTE: PointIsOn may not be testable via nodejs */
  });
  describe("DOM functions", function() {
    it("has a working DOM", function() {
      assert.ok(document.getElementById("id1"));
      assert.ok(document.querySelector("span.span1"));
      assert.ok(document.querySelector("span#id1"));
      assert.ok(document.querySelector(".span1"));
    });
    it("defines CreateNode", function() {
      let n1 = Util.CreateNode("foo");
      let n2 = Util.CreateNode(1);
      let n3 = Util.CreateNode(true);
      let n4 = Util.CreateNode(new URL("https://example.com"));
      let n5 = Util.CreateNode(n4);
      assert.equal(n1.nodeType, window.document.TEXT_NODE);
      assert.equal(n1.nodeName, "#text");
      /* FIXME: fails */
      // assert.equal(n1.nodeValue, "foo");
      assert.equal(n2.nodeType, n1.nodeType);
      assert.equal(n2.nodeName, n1.nodeName);
      /* FIXME: fails */
      // assert.equal(n2.nodeValue, "1");
      assert.equal(n3.nodeType, n1.nodeType);
      assert.equal(n3.nodeName, n1.nodeName);
      /* FIXME: fails */
      // assert.equal(n3.nodeValue, "true");
      assert.equal(n4.nodeType, window.document.ELEMENT_NODE);
      assert.equal(n4.nodeName, "A");
      assert.equal(n4.getAttribute("href"), "https://example.com/");
      assert.equal(n4.getAttribute("target"), "_blank");
      assert.equal(n4.textContent, n4.getAttribute("href"));
      assert.equal(n4.innerHTML, n4.textContent);
      assert.deepEqual(n5, n4);
    });
    it("defines ClampToScreen", function() {
      /* Window size is 1024x768 */
      const [W, H] = [1024, 768];
      const clamp = (x, y, w, h) => Util.ClampToScreen({
        top: y, left: x, width: w, height: h
      });
      const offset = (x, y) => ({top: y, left: x});
      assert.equal(window.innerWidth, W);
      assert.equal(window.innerHeight, H);
      assert.deepEqual(clamp(0, 0, 0, 0), offset(0, 0));
      assert.deepEqual(clamp(-1, 0, 0, 0), offset(0, 0));
      assert.deepEqual(clamp(1, 0, 0, 0), offset(1, 0));
      assert.deepEqual(clamp(10000, 0, 0, 0), offset(W, 0));
      assert.deepEqual(clamp(0, -1, 0, 0), offset(0, 0));
      assert.deepEqual(clamp(0, 1, 0, 0), offset(0, 1));
      assert.deepEqual(clamp(0, 10000, 0, 0), offset(0, H));
      assert.deepEqual(clamp(0, 0, 10, 10), offset(0, 0));
      assert.deepEqual(clamp(-100, 0, 10, 10), offset(0, 0));
      assert.deepEqual(clamp(100, 0, 10, 10), offset(100, 0));
      assert.deepEqual(clamp(0, -100, 10, 10), offset(0, 0));
      assert.deepEqual(clamp(0, 100, 10, 10), offset(0, 100));
      assert.deepEqual(clamp(-100, -100, 10, 10), offset(0, 0));
      assert.deepEqual(clamp(10000, 10000, 0, 0), offset(W, H));
      assert.deepEqual(clamp(W, H, 1, 1), offset(W-1, H-1));
      assert.deepEqual(clamp(W*2, H/2, 0, 0), offset(W, H/2));
    });
    /* TODO: PromiseElement, PromiseImage? */
    /* TODO: SplitGIF? */
    /* TODO: ImageFromPNGData? */
  });
  describe("CSS functions", function() {
    /* After "DOM functions" due to dependencies */
    /* TODO: Util.CSS.GetSheet; <link> tags don't seem to work? */
    it("supports reading CSS", function() {
      let root = Util.CSS.GetRule(document.styleSheets[0], ":root");
      assert.ok(root);
      let props = Util.CSS.GetPropertyNames(root);
      assert.ok(props);
      assert.ok(props.length > 0);
      assert.ok(props.indexOf("--var") > -1);
      assert.ok(props.indexOf("--value") > -1);
      assert.ok(props.indexOf("--value-default") > -1);
      let span1 = document.querySelector(".span1");
      assert.ok(span1);
      let span1style = window.getComputedStyle(span1);
      assert.ok(span1style);
      assert.equal(Util.CSS.GetProperty(span1, "color"), "red");
      let id1 = document.querySelector("#id1");
      assert.ok(id1);
      let id1style = window.getComputedStyle(id1);
      assert.ok(id1style);
      assert.equal(Util.CSS.GetProperty(id1, "background-color"), "white");
    });
    it("supports writing CSS", function() {
      let span1 = document.querySelector(".span1");
      assert.ok(span1);
      Util.CSS.SetProperty(span1, "color", "green");
      assert.equal(Util.CSS.GetProperty(span1, "color"), "green");
      let id1 = document.querySelector("#id1");
      assert.ok(id1);
      Util.CSS.SetProperty(id1, "color", "blue");
      Util.CSS.SetProperty(id1, "background-color", "cyan");
      assert.equal(Util.CSS.GetProperty(id1, "color"), "blue");
      assert.equal(Util.CSS.GetProperty(id1, "background-color"), "cyan");
    });
  });
  describe("Miscellaneous functions", function() {
    /* Can't test Util.Open via nodejs; ignore */
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
  describe("Final tests", function() {
    it("supports disabling localStorage", function() {
      /* TODO */
    });
  });
});

/* vim-fold directives for fold.vim plugin:
 * "vim-fold-set: <pattern>: <comment>"
 * "vim-fold-opts-set: <option>: <comment>" */

/* vim-fold-set: ^[ ]\+const makeTest =: */
/* vim-fold-set: ^[ ]\+makeTest(: */
/* vim-fold-set: ^[ ]\+it(": */
/* vim-fold-set: ^      describe(": */
/* vim-fold-set: ^    describe(": */
/* vim-fold-set: ^  describe(": */
/* vim-fold-set: ^[^ ].*{$: */ /* add text after { to inhibit */
/* vim-fold-opt-set: stop: */ /* inhibit FoldJS() */

/* globals describe it Util CallbackHandler Logging ColorParser tinycolor */
/* globals assert */
