
"use strict";

var mocha = require("mocha");
var assert = require("assert");

var {Util} = require("../utility.js");

/* Must be stored in global for client.js */
global.Util = Util;

var {
  Twitch,
  TwitchEvent,
  TwitchChatEvent,
  TwitchSubEvent,
  TwitchClient} = require("../client.js");

/* Test client.js */
describe("Client", function() {
  describe("Events", function() {
    /* TODO */
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
    it("implements the ParseIRCMessage function", function() {
    });
    it("implements the StripCredentials function", function() {
      assert.equal(Twitch.StripCredentials("oauth:123456"), "oauth:<removed>");
      assert.equal(Twitch.StripCredentials("oauth:123123abcdefg"), "oauth:<removed>");
      assert.equal(Twitch.StripCredentials("OAuth 123123"), "OAuth <removed>");
      assert.equal(Twitch.StripCredentials("OAuth 123123abcdefg"), "OAuth <removed>");
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
    Util.DebugLevel = Util.LEVEL_OFF;
    assert.equal(new TwitchClient({}).toString(), "[object TwitchClient]");
  });
  describe("Simple connection", function() {
  });
});

/* globals describe it */
