
"use strict";

var assert = require("assert");

var {Util} = require("../utility.js");
Util.DebugLevel = Util.LEVEL_DEBUG;

/* Must be stored in global for client.js */
global.Util = Util;

var {
  Twitch,
  TwitchEvent,
  TwitchChatEvent,
  TwitchSubEvent,
  TwitchClient} = require("../client.js");

const ClientID = "1e47abl0sg42inth50wjerbzxh9mbs";
const NewClient = (opts) => {
  let o = opts ? Util.JSONClone(opts) : {};
  o.ClientID = ClientID;
  return new TwitchClient(o);
};

/* Test client.js */
describe("Client", function() {
  describe("Events", function() {
    it("implements TwitchEvent", function() {
    });
    it("implements TwitchChatEvent", function() {
    });
    it("implements TwitchSubEvent", function() {
    });
  });
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
  it("defines specific static attributes", function() {
    assert.ok(TwitchClient.CAPABILITIES.length > 0);
    assert.ok(TwitchClient.CHANNEL_ROOMS);
    assert.ok(TwitchClient.DEFAULT_EMOTE_SIZE);
    assert.ok(TwitchClient.DEFAULT_HISTORY_SIZE > 0);
    assert.ok(TwitchClient.DEFAULT_MAX_MESSAGES > 0);
    assert.equal(TwitchClient.ESET_GLOBAL, 0);
    assert.ok(TwitchClient.ESET_TURBO_1);
    assert.ok(TwitchClient.ESET_TURBO_2);
    assert.ok(TwitchClient.ESET_TURBO_3);
    assert.ok(TwitchClient.ESET_TURBO_4);
    assert.ok(TwitchClient.ESET_PRIME);
    assert.equal(new TwitchClient({}).toString(), "[object TwitchClient]");
  });
  describe("Simple connection", function() {
    it("should connect just fine", function(done) {
      let c = NewClient();
      c.bind("twitch-ack", function(e) {
        c.close();
        c.unbind("twitch-ack");
        c.unbind("twitch-error");
        done();
      });
      c.bind("twitch-error", function(e) {
        c.close();
        done(e);
      });
      c.Connect();
    });
    it("should report status", function(done) {
      let c = NewClient();
      c.bind("twitch-ack", function(e) {
        assert.equal(c.connecting, false);
        assert.equal(c.status.connected, true);
        assert.equal(c.status.authed, false);
        c.close();
        c.unbind("twitch-ack");
        c.unbind("twitch-error");
        done();
      });
      c.Connect();
    });
  });
});

/* globals describe it */
