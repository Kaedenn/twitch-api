
"use strict";

/*loadHarness("client");*/

/* TODO:
 * Twitch API:
 *  Twitch.FLAG_ESCAPE_RULES
 *  Twitch.ParseUser, Twitch.FormatUser
 *  Twitch.ParseChannel, Twitch.FormatChannel
 *  Twitch.IsRoom
 *  Twitch.FormatRoom
 *  Twitch.EncodeFlag, Twitch.DecodeFlag
 *  Twitch.ParseFlag, Twitch.ParseFlags
 *  Twitch.ParseEmote
 *  Twitch.FormatEmoteFlag
 *  Twitch.EmoteToRegex
 *  Twitch.CheerToRegex
 *  Twitch.ScanEmotes
 */

/* Test client.js Twitch object */
describe("Twitch Utility API", function() {
  describe("Twitch Utility functions", function() {
    it("supports channel parsing, formatting", function() {
    });
    it("supports emotes", function() {
    });
    it("supports cheermotes", function() {
    });
    it("implements the StripCredentials function", function() {
      assert.equal(Twitch.StripCredentials("oauth:123456"), "oauth:<removed>");
      assert.equal(Twitch.StripCredentials("oauth:123123abcdefg"), "oauth:<removed>");
      assert.equal(Twitch.StripCredentials("OAuth 123123"), "OAuth <removed>");
      assert.equal(Twitch.StripCredentials("OAuth 123123abcdefg"), "OAuth <removed>");
    });
  });
  describe("IRC message parsing", function() {
    function assertParsed(message, cmd, attrs) {
      let r = Twitch.ParseIRCMessage(message);
      assert.ok(r);
      assert.equal(r.cmd, cmd);
      for (let [k, v] of Object.entries(attrs)) {
        assert.ok(r.hasOwnProperty(k));
        assert.deepEqual(r[k], v);
      }
    }
    it("parses simple messages", function() {
      assertParsed("PING :tmi.twitch.tv", "PING", {server: "tmi.twitch.tv"});
      assertParsed(":tmi.twitch.tv CAP * ACK :word1 word2 word3", "ACK", {
        operation: "CAP",
        server: "tmi.twitch.tv",
        flags: ["word1", "word2", "word3"]});
      assertParsed(":tmi.twitch.tv 375 username :message", "OTHER", {
        server: "tmi.twitch.tv", code: "375"});
      assertParsed(":tmi.twitch.tv 376 username :message", "OTHER", {
        server: "tmi.twitch.tv", code: "376"});
      assertParsed(":tmi.twitch.tv 366 username :message", "OTHER", {
        server: "tmi.twitch.tv", code: "366"});
      /* TODO: Other codes */
    });
    it("parses more elaborate messages", function() {
      /* TODO: Messages with flags */
    });
  });
});

/* globals describe it loadHarness assert */
/* globals TestTMIUser TestChannel TestClientID */

/* vim: set ts=2 sts=2 sw=2: */
/* vim-fold-set: ^[ ]\+it(": */
/* vim-fold-set: ^[ ]\+describe(": */
/* vim-fold-set: ^[^ ].*{$: */
/* vim-fold-opt-set: stop: */
