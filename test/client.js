
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

const TMIUser = `kaedenn_!kaedenn_@kaedenn_.tmi.twitch.tv`;
const ClientID = "1e47abl0sg42inth50wjerbzxh9mbs";
const NewClient = (opts) => {
  let o = opts ? Util.JSONClone(opts) : {};
  o.ClientID = ClientID;
  return new TwitchClient(o);
};

const FailTimeout = (c, done) => {
  /* Ensure the test completes in a reasonable amount of time */
  window.setTimeout(() => {
    if (c.status.open) {
      c.close();
      done(new Error("test failed: timeout"));
      /* Ensure twitch-error/twitch-close done() doesn't get called */
      Util.Unbind("twitch-error");
      Util.Unbind("twitch-close");
    }
  }, 1950);
};

/* Test client.js */
describe("Client", function() {
  describe("TwitchEvent", function() {
    it("implements basic API", function() {
      let r = "raw line";
      let e = new TwitchEvent("OPEN", r, {
        channel: Twitch.ParseChannel("#kaedenn_")
      });
      assert.equal(e.type, "twitch-open");
      assert.equal(e.command, "OPEN");
      assert.equal(e.raw, "raw line");
      assert.equal(e.values.channel.channel, "#kaedenn_");
      assert.equal(e.channel.channel, "#kaedenn_");
      assert.equal(e.channelString, "#kaedenn_");
      assert.equal(e.toString(), "[object TwitchEvent<OPEN>]");

      r = `:${TMIUser} JOIN #kaedenn_`;
      e = new TwitchEvent("JOIN", r, Twitch.ParseIRCMessage(r));
      assert.equal(e.type, "twitch-join");
      assert.equal(e.command, "JOIN");
      assert.equal(e.raw, r);
      assert.equal(e.channel.channel, "#kaedenn_");
      assert.equal(e.user, "kaedenn_");

      /* TODO: far more */
    });
  });
  describe("TwitchChatEvent", function() {
    it("implements basic API", function() {
      let r = `@flag=value;flag2=w1\\sw2 :${TMIUser} PRIVMSG #kaedenn_ :This is a message`;
      let e = new TwitchChatEvent(r, Twitch.ParseIRCMessage(r));
      assert.equal(e.channel.channel, "#kaedenn_");
      assert.deepEqual(e.channel, Twitch.ParseChannel("#kaedenn_"));
      assert.equal(e.message, "This is a message");
      assert.equal(e.flags.flag, "value");
      assert.equal(e.flags.flag2, "w1 w2");
      assert.equal(e.user, "kaedenn_");
      assert.equal(e.name, "kaedenn_");

      /* TODO: badge info, badges, flags, and much more */
    });
  });
  describe("TwitchSubEvent", function() {
    it("implements basic API", function() {
      /* TODO: sub, resub, giftsub, anongiftsub, etc */
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
    /* Tests are disabled for now until the stale callback problem is fixed
    it("should connect just fine", function(done) {
      let c = NewClient();
      FailTimeout(c, done);
      Util.UnbindAll("twitch-");
      c.bind("twitch-ack", function(e) {
        assert.ok(c.name);
        assert.ok(c.connected);
        assert.ok(c.ffzEnabled);
        assert.ok(c.bttvEnabled);
        assert.ok(c.userState);
        c.close();
        done();
      });
      c.bind("twitch-error", function(e) {
        c.close();
        done(new Error(e));
      });
      c.Connect();
    });
    it("should report status", function(done) {
      let c = NewClient();
      FailTimeout(c, done);
      Util.UnbindAll("twitch-");
      c.bind("twitch-ack", function(e) {
        assert.ok(c.connected);
        assert.equal(c.connecting, false);
        assert.equal(c.status.authed, false);
        c.close();
        done();
      });
      c.bind("twitch-error", function(e) {
        c.close();
        done(new Error(e));
      });
      c.Connect();
    });
    it("should be able to parse simple channels", function(done) {
      let c = NewClient();
      FailTimeout(c, done);
      Util.UnbindAll("twitch-");
      c.bind("twitch-ack", function(e) {
        assert.ok(c.ParseChannel("#kaedenn_"));
        assert.ok(c.ParseChannel("#dwangoac"));
        assert.equal(c.ParseChannel("#kaedenn_").channel, "#kaedenn_");
        assert.ok(!c.IsInChannel("#kaedenn_"));
        c.close();
        done();
      });
      c.bind("twitch-error", function(e) {
        c.close();
        done(new Error(e));
      });
      c.Connect();
    });
    it("should support cheers", function(done) {
      let c = NewClient();
      FailTimeout(c, done);
      Util.UnbindAll("twitch-");
      c.bind("twitch-assetloaded", function(e) {
        if (e.values.kind === "global_cheers") {
          assert.ok(c._global_cheers);
          assert.ok(c.GetCheer("Cheer"));
          c.close();
          done();
        }
      });
      c.bind("twitch-error", function(e) {
        c.close();
        done(new Error(e));
      });
      c.Connect();
    });
    */
  });
});

/* globals describe it */
