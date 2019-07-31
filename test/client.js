
"use strict";

loadHarness("client");

/* TODO:
 * Twitch Client:
 *  HasCapability
 *  IsUIDSelf
 *  IsSub, IsVIP, IsMod, IsCaster
 *  Timeout, UnTimeout, Ban, UnBan (verify all fail)
 *  ParseChannel
 *  JoinChannel, LeaveChannel, IsInChannel
 *  GetJoinedChannels
 *  GetChannelInfo, GetChannelById
 *  IsCheer, FindCheers, AreCheersLoaded
 *  GetCheer, GetGlobalCheer, GetCheers
 *  GetEmotes, GetGlobalEmotes
 *  AddEmoteSet (prime or turbo, likely)
 *  GetEmoteSets, GetEmoteSetEmotes
 *  PromiseEmote
 *  GetEmoteName, GetEmote
 *  GetFFZEmotes, GetGlobalBTTVEmotes, GetBTTVEmotes
 *  SendMessage (with and without faux)
 *  SendMessageToAll (with and without faux)
 *  SendRaw (maybe?)
 *  AddHistory
 *  GetHistoryItem, GetHistoryMax, GetHistoryLength
 *  GetClip
 *  GetGame
 *  IsGlobalBadge, GetGlobalBadge, GetGlobalBadges
 *  IsChannelBadge, GetChannelBadge, GetChannelBadges
 *  simulate websocket error
 *  simulate twitch error
 *  simulate twitch notice
 */

var assert = require("assert");

const NewClient = (opts) => {
  let o = opts ? Util.JSONClone(opts) : {};
  o.ClientID = TestClientID;
  return new TwitchClient(o);
};

const FailTimeout = (c, done) => {
  /* Ensure the test completes in a reasonable amount of time */
  window.setTimeout(() => {
    if (c.status.open) {
      c.close();
      done(new Error("test failed: timeout"));
      /* Ensure twitch-error/twitch-close done() doesn't get called */
    }
  }, 1950);
};

/* Test client.js TwitchClient object */
describe("Client", function() {
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
    this.slow(5000);
    it("should connect just fine", function(done) {
      let c = NewClient();
      FailTimeout(c, done);
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
  });
});

/* globals describe it loadHarness */
/* globals TestTMIUser TestChannel TestClientID BuildMessage BuildEvent */

/* vim: set ts=2 sts=2 sw=2: */
/* vim-fold-set: ^[ ]\+it(": */
/* vim-fold-set: ^[ ]\+describe(": */
/* vim-fold-set: ^[^ ].*{$: */
/* vim-fold-opt-set: stop: */
