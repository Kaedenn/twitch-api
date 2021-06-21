
"use strict";

/*loadHarness("client");

var TWUtil = require("../utility.js");
for (let name of Object.getOwnPropertyNames(TWUtil)) {
  global[name] = TWUtil[name];
}
var TWClient = require("../client.js");
for (let name of Object.getOwnPropertyNames(TWClient)) {
  global[name] = TWClient[name];
}*/

/* TODO 2021:
 * Animated emotes
 */

/* TODO:
 * x = done
 * ? = problem
 * Twitch Client:
 *  x HasCapability
 *  ? IsUIDSelf
 *  ? IsSub, IsVIP, IsMod, IsCaster
 *  ? Timeout, UnTimeout, Ban, UnBan (verify all fail)
 *  x ParseChannel (simple)
 *  ? JoinChannel, LeaveChannel, IsInChannel
 *  ? GetJoinedChannels
 *  ? GetChannelInfo, GetChannelById
 *  IsCheer, FindCheers
 *    add cheers for hard-coded channel name and id
 *  x AreCheersLoaded
 *  x GetCheer(cheername)
 *  GetCheer(channel, cheername)
 *    add cheers for hard-coded channel name and id
 *  x GetGlobalCheer, GetCheers
 *  GetEmotes, GetGlobalEmotes
 *  AddEmoteSet (prime or turbo, likely)
 *  GetEmoteSets, GetEmoteSetEmotes
 *  PromiseEmote
 *  x GetEmoteName, GetEmoteID, GetEmote
 *  GetFFZEmotes, GetGlobalBTTVEmotes, GetBTTVEmotes
 *  ? SendMessage (with and without faux)
 *  ? SendMessageToAll (with and without faux)
 *  ? SendRaw (maybe?)
 *  AddHistory
 *  GetHistoryItem, GetHistoryMax, GetHistoryLength
 *  GetClip
 *  GetGame
 *  IsGlobalBadge, GetGlobalBadge, GetGlobalBadges
 *  IsChannelBadge, GetChannelBadge, GetChannelBadges
 *    add badges for hard-coded channel name and id
 *  simulate websocket error
 *  simulate twitch error
 *  simulate twitch notice
 * XXX:
 *  IsUIDSelf
 *    No userstate/globaluserstate is given
 *  IsSub, IsVIP, IsMod, IsCaster
 *    No userstate/globaluserstate is given
 *  Timeout, UnTimeout, Ban, UnBan
 *    Twitch ignores messages from unauthed clients
 *  JoinChannel, LeaveChannel, GetJoinedChannels, GetChannelById
 *    Twitch ignores messages from unauthed clients
 *  SendMessage, SendMessageToAll, SendRaw
 *    Twitch ignores messages from unauthed clients
 */

/* Keep track of all known clients */
var allClients = [];

/* Allocate a new TwitchClient */
const NewClient = (opts=null) => {
  /* Filter out unwanted logger messages */
  /* TODO: Move these to a before-test hook? */
  Util.Logger.removeAllFilters();
  Util.Logger.addFilter("Client constructed and ready for action");
  Util.Logger.addFilter("Connecting to Twitch...");
  Util.Logger.addFilter("WebSocket Closed");
  Util.Logger.addFilter("ws close>");
  Util.Logger.addFilter("ws open>");
  Util.DebugLevel = Util.LEVEL_DEBUG;
  /* Determine options to pass to the constructor */
  let o = opts ? Util.JSONClone(opts) : {};
  o.ClientID = TestClientID;

  /* Construct, track, and return */
  let client = new TwitchClient(o);
  allClients.push(client);
  return client;
};

/* Test client.js TwitchClient object */
describe("Client", function() { /* nofold */
  const makeTest = (desc, config) => {
    /* Generic function to handle client setup/teardown and errors */
    (config.only ? it.only : it)(desc, function(done) {
      const c = NewClient();
      /* Store the test description in the client for debugging */
      c.set("desc", desc);

      /* Set the debug level if desired */
      if (config.level) {
        if (Util[config.level]) {
          Util.PushDebugLevel(Util[config.level]);
        } else {
          Util.PushDebugLevel(config.level);
        }
      }

      /* Ensure client closes if we timeout */
      window.setTimeout(() => {
        if (c.status.open) {
          c.close();
          done(new Error(`Test failed: timeout after ${this.slow()-50}ms`));
        }
      }, this.slow() - 50);

      /* Close client when test calls done() */
      const doneFunc = (...args) => {
        if (config.level) Util.PopDebugLevel();
        c.close();
        done(...args);
      };

      /* Fail the test on any twitch error */
      c.bind("twitch-error", (e) => { doneFunc(new Error(e)); });

      /* Bind requested config, giving useful arguments */
      for (let [k, v] of Object.entries(config)) {
        /* callback(client, doneFunc, event) bound to test context */
        if (typeof(v) === "function") {
          c.bind(k, v.bind(this, c, doneFunc));
        }
      }

      /* Start the test */
      c.Connect();
    });
  };
  it("defines static attributes", function() {
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
    assert.equal(NewClient().toString(), "[object TwitchClient]");
  });
  describe("Connection", function() {
    this.slow(5000); /* All of these tests are slower than usual */
    makeTest("should connect just fine", {
      "twitch-ack": function(c, done, e) {
        assert.ok(c.name);
        assert.ok(c.name.match(/^justinfan[0-9]+$/));
        assert.ok(c.connected);
        assert.ok(c.ffzEnabled);
        assert.ok(c.bttvEnabled);
        assert.ok(c.userState);
        assert.equal(c.userState.userid, null);
        assert.ok(!c.connecting);
        assert.ok(c.HasCapability("twitch.tv/tags"));
        assert.ok(c.HasCapability("tags"));
        assert.ok(c.HasCapability("twitch.tv/commands"));
        assert.ok(c.HasCapability("commands"));
        assert.ok(c.HasCapability("twitch.tv/membership"));
        assert.ok(c.HasCapability("membership"));
        c.close();
        done();
      }
    });
    makeTest("should report status", {
      "twitch-ack": function(c, done, e) {
        assert.ok(c.status.open);
        assert.ok(c.status.connected);
        assert.ok(c.status.identified);
        assert.ok(!c.status.authed);
        assert.ok(!c.connecting);
        assert.ok(c.status.endpoint.match(/^wss:/), "using ssl");
        assert.ok(c.status.capabilities.length > 0);
        done();
      }
    });
    makeTest("should be able to parse simple channels", {
      "twitch-ack": function(c, done, e) {
        assert.ok(c.ParseChannel("#kaedenn_"));
        assert.ok(c.ParseChannel("#dwangoac"));
        assert.equal(c.ParseChannel("#kaedenn_").channel, "#kaedenn_");
        assert.ok(!c.IsInChannel("#kaedenn_"));
        done();
      }
    });
    makeTest("should support global cheers", {
      "twitch-assetloaded": function(c, done, e) {
        if (e.values.kind === "global_cheers") {
          assert.ok(c.AreCheersLoaded());
          assert.ok(c.cheersLoaded);
          for (let cname of ["Cheer", "PJSalt", "Kappa"]) {
            const cheer = c.GetCheer(cname);
            assert.deepEqual(c.GetGlobalCheer(cname), cheer);
            assert.ok(cheer);
            assert.ok(cheer.prefix);
            assert.ok(cheer.scales.length > 0);
            assert.ok(cheer.states.length > 0);
            assert.ok(cheer.tiers.length > 0);
          }
          assert.ok(c.GetCheers().GLOBAL.Kappa);
          done();
        }
      }
    });
    makeTest("should support global emotes", {
      "twitch-assetloaded": function(c, done, e) {
        /* TODO: GetFFZEmotes */
        if (e.values.kind === "emote_set"
            && e.values.eset === TwitchClient.ESET_GLOBAL) {
          assert.ok(c.GetEmotes());
          assert.ok(c.GetEmotes()["Kappa"]);
          assert.ok(c.GetEmoteSets()[TwitchClient.ESET_GLOBAL].length > 0);
          assert.ok(c.GetGlobalEmotes().Kappa);
          for (let ename of ["Kappa", "PJSalt", "DansGame"]) {
            assert.ok(Object.values(c._self_emotes).indexOf(ename) > -1);
          }
          done();
        }
      }
    });
    makeTest("should support global BTTV emotes", {
      level: "LEVEL_DEBUG",
      "twitch-assetloaded": function(c, done, e) {
        if (e.values.kind === "bttv_emotes") {
          assert.ok(c.GetGlobalBTTVEmotes());
          assert.ok(c.GetGlobalBTTVEmotes()["D:"]);
          assert.ok(c.GetGlobalBTTVEmotes()["D:"].id);
          assert.equal(c.GetGlobalBTTVEmotes()["D:"].code, "D:");
          assert.equal(c.GetGlobalBTTVEmotes()["D:"]["image-type"], "png");
          done();
        }
      }
    });
    makeTest("should be granted base capabilities", {
      "twitch-ack": function(c, done, e) {
        let caps = c.status.capabilities;
        /* Assert only requested capabilites were granted */
        for (let cap of caps) {
          assert.ok(TwitchClient.CAPABILITIES.indexOf(cap) > -1);
        }
        /* Assert all requested capabilities were granted */
        for (let cap of TwitchClient.CAPABILITIES) {
          assert.ok(caps.indexOf(cap) > -1);
        }
        done();
      }
    });
    makeTest("should have PromiseEmote", {
      "twitch-assetloaded": function(c, done, e) {
        this.slow(5000);
        if (e.values.kind === "emote_set"
            && e.values.eset === TwitchClient.ESET_GLOBAL) {
          /* TODO */
          done();
        }
      }
    });
    makeTest("should have history support", {
      "twitch-ack": function(c, done, e) {
        /* TODO */
        done();
      }
    });
    makeTest("should have clip support", {
      "twitch-ack": function(c, done, e) {
        /* TODO */
        done();
      }
    });
    makeTest("should have game support", {
      "twitch-ack": function(c, done, e) {
        /* TODO */
        done();
      }
    });
    makeTest("should have badge support", {
      "twitch-ack": function(c, done, e) {
        /* TODO */
        done();
      }
    });
    it("should handle websocket errors properly", function(done) {
      /* TODO */
      done();
    });
    it("should handle Twitch errors properly", function(done) {
      /* TODO */
      done();
    });
  });
  describe("cleanup", function() {
    it("closed all clients", function() {
      assert.ok(allClients.length > 0);
      for (let c of allClients) {
        try {
          assert.ok(!c.hasSocket);
        }
        catch (err) {
          Util.Error("Client still open:", c.get("desc"));
          throw err;
        }
      }
    });
  });
});

/* globals describe it loadHarness assert */
/* globals TestTMIUser TestChannel TestClientID BuildMessage BuildEvent */

/* vim: set ts=2 sts=2 sw=2: */
/* vim-fold-set: ^[ ]\+const makeTest =: */
/* vim-fold-set: ^[ ]\+makeTest(: */
/* vim-fold-set: ^[ ]\+it(": */
/* vim-fold-set: ^[ ]\+describe(": */
/* vim-fold-set: ^[^ ].*{$: */
/* vim-fold-opt-set: stop: */
