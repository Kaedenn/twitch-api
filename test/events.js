
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

/* Test client.js TwitchEvent events */
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

      r = `:${TestTMIUser} JOIN #kaedenn_`;
      e = BuildEvent("JOIN", r);
      assert.equal(e.type, "twitch-join");
      assert.equal(e.command, "JOIN");
      assert.equal(e.raw, r);
      assert.equal(e.channel.channel, "#kaedenn_");
      assert.equal(e.user, "kaedenn_");

      /* TODO:
       *  userValue, nameValue
       *  user, name
       *  message
       *  flags, flag()
       *  param()
       *  firstFlag()
       *  noticeMsgId, noticeClass
       *  repr()
       */
    });
  });
  describe("TwitchChatEvent", function() {
    it("implements basic API", function() {
      let r = `@flag=value;flag2=w1\\sw2 :${TestTMIUser} PRIVMSG #kaedenn_ :This is a message`;
      let e = BuildEvent(TwitchChatEvent, "PRIVMSG", r);
      assert.equal(e.channel.channel, "#kaedenn_");
      assert.deepEqual(e.channel, Twitch.ParseChannel("#kaedenn_"));
      assert.equal(e.message, "This is a message");
      assert.equal(e.flags.flag, "value");
      assert.equal(e.flags.flag2, "w1 w2");
      assert.equal(e.user, "kaedenn_");
      assert.equal(e.name, "kaedenn_");

      r = BuildMessage({
        flags: {
          "badges": "staff/1",
          "staff": "1",
          "moderator": null,
          "subscriber": null,
          "user-type": ""
        },
        kaedenn: true
      });
      e = BuildEvent(TwitchChatEvent, "PRIVMSG", r);
      assert.equal(e.channel.channel, TestChannel);

      /* TODO:
       *  id
       *  iscaster, ismod, issub, isstaff, isvip
       *  badges, hasBadge()
       *  subMonths
       *  bits
       *  repr()
       */
    });
  });
  describe("TwitchSubEvent", function() {
    it("implements basic API", function() {
      /* TODO:
       *  SUB, RESUB, GIFTSUB, ANONGIFTSUB
       *  Prime, 1000, 2000, 3000
       *  kind
       *  user
       *  plan, plan_id
       *  months, total_months, share_streak, streak_months
       *  anonymous, recipient, recipient_id, recipient_name
       */
    });
  });
});

/* globals describe it loadHarness assert */
/* globals TestTMIUser TestChannel TestClientID BuildMessage BuildEvent */

/* vim: set ts=2 sts=2 sw=2: */
/* vim-fold-set: ^[ ]\+it(": */
/* vim-fold-set: ^[ ]\+describe(": */
/* vim-fold-set: ^[^ ].*{$: */
/* vim-fold-opt-set: stop: */
