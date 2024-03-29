"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 * Emotes like ":-D" show more than one emote (turbo 1, turbo 2, global)
 */

/* TODO/FIXME:
 * Change APIs from Kraken to Helix
 *  Twitch.URL.Stream(channelId)
 *    `${Twitch.Helix}/streams?user_id=${channelId}`
 *  Twitch.URL.GlobalCheers()
 *  Twitch.URL.Cheers(channelId)
 *  Twitch.URL.EmoteSet(emoteset)
 */

/* TODO (IMPROVEMENT): Rewrite GetEmote API
 *  Abbreviations:
 *    e_url :== string, emote URL
 *    e_name :== string, emote's name
 *    e_id :== number, emote's numeric id
 *    eset :== number, emote set ID
 *  GetEmote(e_id or e_name, size=default)
 *    e_url
 *  GetGlobalEmote(e_id or e_name, size=default)
 *    e_url
 *  GetChannelEmote(channel, e_id or e_name, size=default)
 *    e_url
 *  GetGlobalEmotes(size=default)
 *    {e_name: e_url}
 *  GetChannelEmotes(channel, size=default)
 *    {e_name: e_url}
 *  GetAllChannelEmotes(size=default)
 *    {channel: {e_name: e_url}}
 *  GetEmoteSets(size=default)
 *    {eset: {e_name: e_url}}
 *  GetEmoteSet(eset, size=default)
 *    {e_name: e_url}
 *  GetEmoteInfo(e_id or e_name)
 *    {e_name: {id: e_id, pattern: emote_pattern, ...}}
 */

/* Change this to the local badge provider service host */
const LOCAL_BADGE_URI = "http://localhost:8081";

/* Container for Twitch utilities */
let Twitch = {};

/* Blacklisted emoteset IDs (loading these give HTTP 503) */
Twitch.BAD_EMOTESET_IDS = ['1825876091', '1590490520', '798691873', '1285844906'];

/* Event classes {{{0 */

/* Base Event object for Twitch events */
class TwitchEvent {
  constructor(type, raw, parsed) {
    this._cmd = type;
    this._raw = raw || "";
    if (!parsed) {
      /* Construct from essentially nothing */
      this._parsed = {};
    } else if (parsed instanceof window.Event) {
      /* Construct from an event */
      this._parsed = {
        event: parsed,
        name: Object.getPrototypeOf(parsed).constructor.name
      };
    } else {
      /* Construct from an object */
      this._parsed = parsed;
    }
    if (TwitchEvent.COMMAND_LIST.indexOf(this._cmd) === -1) {
      Util.Error(`Command "${this._cmd}" not enumerated in this.COMMANDS`);
    }
    /* Ensure certain flags have expected types */
    if (!this._parsed.message) {
      this._parsed.message = "";
    }
    if (!this._parsed.user) {
      this._parsed.user = null;
    }
    if (!this._parsed.flags) {
      this._parsed.flags = {};
    }
    if (!this._parsed.channel) {
      this._parsed.channel = {channel: "GLOBAL"};
    }
  }

  /* All "twitch-<cmd>" commands; (s) = synthetic */
  static get COMMAND_LIST() {
    return [
      "CHAT", /* (s) Received a message from another user */
      "PING", /* Twitch is checking to see if we're still here */
      "ACK", /* Twitch acknowledged our capability request */
      "TOPIC", /* (s) Received a TOPIC message from Twitch */
      "NAMES", /* Received a list of connected users */
      "JOIN", /* User joined a channel */
      "PART", /* User left a channel */
      "JOINED", /* (s) Client joined a channel */
      "PARTED", /* (s) Client left a channel */
      "RECONNECT", /* Twitch requested a reconnect */
      "MODE", /* Twitch set the mode for a user */
      "PRIVMSG", /* Received a message */
      "WHISPER", /* Received a private message */
      "USERSTATE", /* Received user information */
      "ROOMSTATE", /* Received room information */
      "STREAMINFO", /* (s) Received stream information */
      "ASSETLOADED", /* (s) An asset API request resolved */
      "USERNOTICE", /* Received user-centric notice */
      "GLOBALUSERSTATE", /* Received global client user information */
      "CLEARCHAT", /* Moderator cleared the chat */
      "HOSTTARGET", /* Streamer is hosting another streamer */
      "NOTICE", /* Received a notice (error, warning, etc) from Twitch */
      "SUB", /* (s) Someone subscribed */
      "RESUB", /* (s) Someone resubscribed */
      "GIFTSUB", /* (s) Someone gifted a subscription */
      "ANONGIFTSUB", /* (s) Someone gifted a subscription anonymously */
      "NEWUSER", /* (s) A brand new user just said hi */
      "REWARDGIFT", /* (s) Gift rewards have been shared in chat */
      "MYSTERYGIFT", /* (s) Random gift rewards have been shared in chat */
      "GIFTUPGRADE", /* (s) Upgraded a giftsub to a real subscription */
      "PRIMEUPGRADE", /* (s) Upgraded a prime sub to a tiered subscription */
      "ANONGIFTUPGRADE", /* (s) Upgraded an anonymous giftsub */
      "OTHERUSERNOTICE", /* (s) Received an unknown USERNOTICE */
      "RAID", /* (s) Streamer is raiding or was raided by another streamer */
      "OPEN", /* (s) WebSocket opened */
      "CLOSE", /* (s) WebSocket closed */
      "MESSAGE", /* (s) WebSocket received a message */
      "ERROR", /* (s) WebSocket received an error */
      "OTHER" /* Received some unknown event */
    ];
  }

  /* Object for the commands above */
  static get COMMANDS() {
    let result = {};
    for (let cmd of TwitchEvent.COMMAND_LIST) {
      result[cmd] = cmd;
    }
    return result;
  }

  get type() { return "twitch-" + this._cmd.toLowerCase(); }
  get command() { return this._cmd; }
  get raw() { return this._raw; }
  get values() { return this._parsed; }

  get userValue() { return this.values.user; }
  get nameValue() { return this.flags["display-name"]; }
  get channel() { return this.values.channel; }
  get channelString() { return Twitch.FormatChannel(this.channel); }
  get message() { return this.values.message; }
  get flags() { return this.values.flags; }

  /* Prefer username over display name */
  get user() { return this.userValue || this.nameValue; }

  /* Prefer display name over username */
  get name() { return this.nameValue || this.userValue; }

  /* Obtain the named flag */
  flag(flag) {
    if (this.values.flags) {
      return this.values.flags[flag];
    }
    return null;
  }

  /* Obtain a "msg-param-" value */
  param(name) { return this.flag("msg-param-" + name); }

  /* Obtain the first non-false-y value of the listed flags */
  firstFlag(...flags) {
    for (let flag of flags) {
      if (this.flags[flag]) {
        return this.flags[flag];
      }
    }
    return null;
  }

  /* Return the msg-id, if one is present */
  get noticeMsgId() {
    if (this._cmd === "NOTICE" && this.flags) {
      if (typeof(this.flags["msg-id"]) === "string") {
        return this.flags["msg-id"];
      }
    }
    return null;
  }

  /* Return the class of the msg-id, if one is present */
  get noticeClass() {
    let msgid = this.noticeMsgId;
    if (typeof(msgid) === "string") {
      return msgid.split("_")[0];
    }
    return null;
  }

  /* Object.prototype.toSource convenience function (for debugging) */
  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let args = [this._cmd, this._raw, this._parsed];
    return `new ${cls}(${JSON.stringify(args)})`;
  }

  get [Symbol.toStringTag]() {
    return `TwitchEvent<${this._cmd}>`;
  }
}

/* Event object for chat events */
class TwitchChatEvent extends TwitchEvent {
  constructor(raw_line, parsed) {
    super("CHAT", raw_line, parsed);
    this._id = parsed.flags.id;
  }
  get id() { return this._id; }
  get iscaster() { return this.hasBadge("broadcaster"); }
  get ismod() { return this.hasBadge("moderator") || this.flags.mod || this.iscaster; }
  get issub() { return this.hasBadge("subscriber") || this.flags.subscriber; }
  get isstaff() { return this.hasBadge("staff") || this.flags.staff; }
  get isvip() { return this.hasBadge("vip"); }
  get badges() { return this.flags.badges || []; }
  hasBadge(badge, rev=null) {
    for (let [badge_name, badge_rev] of this.badges) {
      if (badge_name === badge) {
        /* null rev matches all badges with this name */
        return rev === badge_rev || rev === null;
      }
    }
    return false;
  }
  get subMonths() {
    if (this.flags["badge-info"]) {
      for (let [bname, brev] of this.flags["badge-info"]) {
        if (bname === "subscriber") {
          return brev;
        }
      }
    }
    return 0;
  }
  get bits() {
    return typeof(this.flags.bits) === "number" ? this.flags.bits : 0;
  }
  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let raw = JSON.stringify(this._raw);
    let parsed = JSON.stringify(this._parsed);
    return `new ${cls}(${raw},${parsed})`;
  }
}

/* Event object for subscription events */
class TwitchSubEvent extends TwitchEvent {
  constructor(sub_kind, raw_line, parsed) {
    super(sub_kind, raw_line, parsed);
    this._sub_kind = sub_kind;
    if (TwitchSubEvent.KINDS.indexOf(sub_kind) === -1) {
      Util.Error(`Invalid sub kind ${sub_kind}; defaulting to "SUB"`);
      this._sub_kind = TwitchSubEvent.KIND_SUB;
    }
  }

  /* Known kinds of subscriptions */
  static get KINDS() { return ["SUB", "RESUB", "GIFTSUB", "ANONGIFTSUB"]; }
  static get KIND_SUB() { return "SUB"; }
  static get KIND_RESUB() { return "RESUB"; }
  static get KIND_GIFTSUB() { return "GIFTSUB"; }
  static get KIND_ANONGIFTSUB() { return "ANONGIFTSUB"; }
  static IsKind(k) { return TwitchSubEvent.KINDS.indexOf(k) > -1; }

  /* Known subscription tiers */
  static get PLANS() { return ["Prime", "1000", "2000", "3000"]; }
  static get PLAN_PRIME() { return "Prime"; }
  static get PLAN_TIER1() { return "1000"; }
  static get PLAN_TIER2() { return "2000"; }
  static get PLAN_TIER3() { return "3000"; }
  static IsPlan(p) { return TwitchSubEvent.PLANS.indexOf(p) > -1; }

  static KindFromMsgID(msgid) {
    if (msgid === "sub") return TwitchSubEvent.KIND_SUB;
    if (msgid === "resub") return TwitchSubEvent.KIND_RESUB;
    if (msgid === "subgift") return TwitchSubEvent.KIND_GIFTSUB;
    if (msgid === "anonsubgift") return TwitchSubEvent.KIND_ANONGIFTSUB;
    return null;
  }

  static PlanName(plan_id) {
    let plan = `${plan_id}`;
    if (plan === TwitchSubEvent.PLAN_PRIME) {
      return "Twitch Prime";
    } else if (plan === TwitchSubEvent.PLAN_TIER1) {
      return "Tier 1";
    } else if (plan === TwitchSubEvent.PLAN_TIER2) {
      return "Tier 2";
    } else if (plan === TwitchSubEvent.PLAN_TIER3) {
      return "Tier 3";
    } else {
      return `"${plan}"`;
    }
  }

  /* Methods below apply to all sub kinds */
  get kind() { return this._sub_kind; }
  get user() { return this.param("login") || this.name; }
  get plan() { return this.param("sub-plan-name"); }
  get plan_id() { return this.param("sub-plan"); }
  get months() { return this.param("months") || 0; }
  get total_months() { return this.param("cumulative-months") || 0; }
  get share_streak() { return this.param("should-share-streak"); }
  get streak_months() { return this.param("streak-months") || 0; }

  /* Methods below only apply only to gift subs */
  get anonymous() { return this.kind === TwitchSubEvent.KIND_ANONGIFTSUB; }
  get recipient() { return this.param("recipient-user-name"); }
  get recipient_id() { return this.param("recipient-id"); }
  get recipient_name() { return this.param("recipient-display-name"); }
}

/* End of event classes section 0}}} */

/* Twitch Client class definition */
class TwitchClient extends CallbackHandler {
  static get DEFAULT_HISTORY_SIZE() { return 300; }
  static get DEFAULT_MAX_MESSAGES() { return 100; }

  /* Emote set number for global emotes */
  static get ESET_GLOBAL() { return 0; }

  /* Emote set numbers for Turbo (sets 1, 2, 3, and 4) */
  static get ESET_TURBO_1() { return 33; }
  static get ESET_TURBO_2() { return 42; }
  static get ESET_TURBO_3() { return 457; }
  static get ESET_TURBO_4() { return 793; }

  /* Emote set number for Twitch Prime emotes */
  static get ESET_PRIME() { return 19194; }

  /* Default emote size; 1.0 is standard for chat messages */
  static get DEFAULT_EMOTE_SIZE() { return "1.0"; }

  /* Default emote light/dark mode; tfc prefers dark over light */
  static get DEFAULT_EMOTE_DARK() { return "dark"; }

  /* Requested capabilities */
  static get CAPABILITIES() {
    return ["twitch.tv/tags", "twitch.tv/commands", "twitch.tv/membership"];
  }

  constructor(opts) {
    super({});
    let cfg_name = opts.Name;
    let cfg_clientid = opts.ClientID;
    let cfg_pass = opts.Pass;

    /* Core variables */
    this._ws = null;
    this._is_open = false;
    this._connected = false;
    this._username = null;
    this._connecting = false;

    /* WebSocket endpoint */
    this._endpoint = opts.WSURI || "wss://irc-ws.chat.twitch.tv";
    /* List of channels presently joined */
    this._channels = [];
    /* List of channels about to join once connected to Twitch */
    this._pending_channels = opts.Channels || [];
    /* Channel information */
    this._rooms = {};
    this._rooms_byid = {};
    /* History of sent chat messages (recent = first) */
    this._history = [];
    /* Maximum history size */
    this._hist_max = opts.HistorySize || TwitchClient.DEFAULT_HISTORY_SIZE;
    /* Granted capabilities */
    this._capabilities = [];
    /* TwitchClient's userstate information */
    this._self_userstate = {};
    /* TwitchClient's userid */
    this._self_userid = null;
    /* Emotes the TwitchClient is allowed to use */
    this._self_emotes = {}; /* {eid: ename} */
    /* Mapping of emote set to emotes */
    this._self_emote_sets = {}; /* {sid: [eid, eid, ...]} */

    this._use_local_badge_service = opts.LocalBadgeService;
    if (opts.LocalBadgeURI) {
      this._use_local_badge_service = true;
      this._local_badge_uri = opts.LocalBadgeURI;
    }
    Twitch.Local.URI = this._local_badge_uri;

    /* Extension support */
    this._enable_ffz = !opts.NoFFZ || opts.NoAssets;
    this._enable_bttv = !opts.NoBTTV || opts.NoAssets;

    /* Whether or not we were given a clientid */
    this._has_clientid = cfg_clientid && cfg_clientid.length > 0;

    /* Don't load assets (for small testing) */
    this._no_assets = Boolean(opts.NoAssets);

    /* Badge and cheer definitions */
    this._channel_badges = {};
    this._global_badges = {};
    this._channel_cheers = {};
    this._global_cheers = {};

    /* Extension emotes */
    this._ffz_channel_emotes = {};
    this._ffz_badges = {};
    this._ffz_badge_users = {};
    this._bttv_badges = {}; /* If BTTV adds badges */
    this._bttv_global_emotes = {};
    this._bttv_channel_emotes = {};

    /* Let the client be used as an arbitrary key-value store */
    this._kv = {};
    this.get = function _Client_get(k) { return this._kv[k]; };
    this.set = function _Client_set(k, v) { this._kv[k] = v; };
    this.has = function _Client_has(k) { return this._kv.hasOwnProperty(k); };

    /* Handle authentication and password management */
    this._authed = cfg_pass ? true : false;
    let oauth, oauth_header;
    if (this._authed) {
      if (cfg_pass.indexOf("oauth:") !== 0) {
        oauth = `oauth:${cfg_pass}`;
        oauth_header = `OAuth ${cfg_pass}`;
      } else {
        oauth = cfg_pass;
        oauth_header = cfg_pass.replace(/^oauth:/, "OAuth ");
      }
    }

    /* Construct the Twitch API object */
    let pub_headers = {};
    let priv_headers = {};
    if (this._has_clientid) {
      pub_headers["Client-Id"] = cfg_clientid;
    }
    if (this._authed) {
      priv_headers["Authorization"] = oauth_header;
      priv_headers["OAuth"] = oauth_header;
    }
    this._api = new Twitch.API(pub_headers, priv_headers);

    /* TwitchClient.Connect(): Returns a Promise  */
    this.Connect = (function _TwitchClient_Connect() {
      return new Promise((resolve, reject) => {
        /* Prevent recursion */
        if (this._connecting) {
          Util.Error("Client is already attempting to connect");
          reject(new Error("Client is already attempting to connect"));
        }
        this._connecting = true;

        /* Ensure the socket is indeed closed */
        this.close();

        /* Store the presently-connected channels as pending */
        for (let c of this._channels) {
          if (this._pending_channels.indexOf(c) === -1) {
            this._pending_channels.push(c);
          }
        }
        this._channels = [];
        this._rooms = {};
        this._capabilities = [];
        this._username = null;
        this._is_open = false;
        this._connected = false;

        /* Construct the websocket and bind to its events */
        this._ws = new WebSocket(this._endpoint);
        this._ws.client = this;
        this._ws.onopen = (event) => {
          try {
            Util.LogOnly("ws open>", this._ws.url);
            this._connecting = false;
            this._connected = false;
            this._is_open = true;
            this._onWebsocketOpen(cfg_name, oauth);
            resolve(this);
          } catch (e) {
            Util.Alert("ws.onopen error: " + e.toString());
            reject(e);
          }
        };
        this._ws.onmessage = this._ws_onmessage.bind(this);
        this._ws.onerror = this._ws_onerror.bind(this);
        this._ws.onclose = this._ws_onclose.bind(this);
        this.send = (function _TwitchClient_send(m) {
          try {
            this._ws.send(m);
            Util.DebugOnly("ws send>", Twitch.StripCredentials(JSON.stringify(m)));
          } catch (e) {
            Util.Alert("this.send error: " + e.toString());
            throw e;
          }
        }).bind(this);

        Util.LogOnly("Connecting to Twitch...");
      });
    }).bind(this);

    Util.LogOnly("Client constructed and ready for action");
  }

  /* Private: Event handlers and event handling {{{0 */

  /* ws.onopen bound above due to OAuth usage */

  /* ws.onmessage = _ws_onmessage.bind(this) */
  _ws_onmessage(event) {
    try {
      let data = Twitch.StripCredentials(JSON.stringify(event.data));
      Util.TraceOnly("ws recv>", data);
      this._onWebsocketMessage(event);
    } catch (e) {
      Util.Alert("ws.onmessage error: " + e.toString() + "\n" + e.stack);
      throw e;
    }
  }

  /* ws.onerror = _ws_onerror.bind(this) */
  _ws_onerror(event) {
    try {
      Util.LogOnly("ws error>", event);
      this._connected = false;
      this._onWebsocketError(event);
    } catch (e) {
      Util.Alert("ws.onerror error: " + e.toString());
      throw e;
    }
  }

  /* ws.onclose = _ws_onclose.bind(this) */
  _ws_onclose(event) {
    try {
      Util.TraceOnly("ws close: ", event);
      Util.LogOnly("ws close>");
      this._connected = false;
      this._is_open = false;
      this._onWebsocketClose(event);
    } catch (e) {
      Util.Alert("ws.onclose error: " + e.toString());
      throw e;
    }
  }

  /* Private: fire a TwitchEvent instance */
  _fire(event) {
    this.fire(event.type, event);
  }

  /* End event handlers and event handling 0}}} */

  /* Private functions section {{{0 */

  /* Private: Return the channel's userstate value for the given key */
  _selfUserState(channel, value) {
    let ch = Twitch.FormatChannel(channel);
    if (this._self_userstate) {
      if (this._self_userstate[ch]) {
        return this._self_userstate[ch][value];
      }
    }
    return null;
  }

  /* Private: Return whether or not the client has the specified badge */
  _hasBadge(channel, badge_name) {
    let badges = this._selfUserState(channel, "badges");
    if (badges) {
      for (let badge_def of badges) {
        if (badge_def[0] === badge_name) {
          return true;
        }
      }
    }
    return false;
  }

  /* Private: Ensure the user specified is in reduced form */
  _ensureUser(user) {
    if (user.indexOf("!") > -1) {
      return Twitch.ParseUser(user);
    } else {
      return user;
    }
  }

  /* Private: Ensure the given channel is defined in this._rooms */
  _ensureRoom(channel) {
    let cobj = Twitch.ParseChannel(channel);
    let cname = cobj.channel;
    if (!(cname in this._rooms)) {
      this._rooms[cname] = {
        users: [],     /* Joined users */
        userInfo: {},  /* Joined users' info */
        operators: [], /* Operators */
        channel: cobj, /* Channel object */
        cname: cname,  /* Channel name */
        id: null,      /* Channel ID */
        online: false, /* Currently streaming */
        stream: {},    /* Stream status */
        streams: []    /* Stream statuses */
      };
    }
  }

  /* Private: Called when a user joins a channel */
  _onJoin(channel, userName) {
    let cobj = Twitch.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(channel);
    if (!this._rooms[cobj.channel].users.includes(user)) {
      this._rooms[cobj.channel].users.push(user);
    }
    if (!this._rooms[cobj.channel].userInfo.hasOwnProperty(user)) {
      this._rooms[cobj.channel].userInfo[user] = {};
    }
  }

  /* Private: Called when a user parts a channel */
  _onPart(channel, userName) {
    let cobj = Twitch.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(channel);
    let cname = cobj.channel;
    if (this._rooms[cname].users.includes(user)) {
      let idx = this._rooms[cname].users.indexOf(user);
      this._rooms[cname].users.splice(idx, 1);
    }
  }

  /* Private: Called when the client receives a MODE +o event */
  _onOp(channel, userName) {
    let cobj = Twitch.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(channel);
    let cname = cobj.channel;
    if (!this._rooms[cname].operators.includes(user)) {
      this._rooms[cname].operators.push(user);
    }
  }

  /* Private: Called when the client receives a MODE -o event */
  _onDeOp(channel, userName) {
    let cobj = Twitch.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(channel);
    let cname = cobj.channel;
    let idx = this._rooms[cname].operators.indexOf(user);
    if (idx > -1) {
      this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
    }
  }

  /* Private: Load in the channel badges for a given channel name and ID */
  _getChannelBadges(cname, cid) {
    let channel = Twitch.ParseChannel(cname);
    let c = channel.channel; /* To sanitize channel */
    this._channel_badges[c] = {};
    let endpoint = Twitch.URL.ChannelBadges(cid);
    if (this._use_local_badge_service) {
      endpoint = Twitch.Local.UserBadges(c.replace(/^#/, ''));
    }
    this._api.Get(endpoint, (json) => {
      /* data[]
       *  set_id = subscriber
       *   versions[]
       *    id = <number of months>
       *     image_url_1x: url
       *     image_url_2x: url
       *     image_url_4x: url
       */
      for (let json_badge of json.data) {
        let badge = {};
        for (let version of json_badge.versions) {
          badge[version.id] = version; // Has a redundant id in there, but makes it easier.
        }
        this._channel_badges[c][json_badge.set_id] = badge;
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "channel_badges"
      }));
    }, null, true);
  }

  /* Private: Load in the channel cheermotes for a given channel name and ID */
  _getChannelCheers(cname, cid) {
    this._channel_cheers[cname] = {};
    /* TODO: This API no longer exists. Use an API equivalent if available */
    /*
    this._api.Get(Twitch.URL.Cheers(cid), (json) => {
      for (let cdef of json.actions) {
        cdef.pattern = Twitch.CheerToRegex(cdef.prefix);
        this._channel_cheers[cname][cdef.prefix] = cdef;
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "channel_cheers",
        channel: Twitch.ParseChannel(cname),
        channelId: cid
      }));
    }, {}, false);
    */
  }

  /* Private: Load the global cheermotes */
  _getGlobalCheers() {
    this._api.Get(Twitch.URL.GlobalCheers(), (json) => {
      for (let cdef of json.data) {
        /* Simplify things later by adding the regex here */
        cdef.pattern = Twitch.CheerToRegex(cdef.prefix);
        this._global_cheers[cdef.prefix] = cdef;
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "global_cheers"
      }));
    }, null, true);
  }

  /* Private: Load in the global and per-channel FFZ emotes */
  _getFFZEmotes(cname, cid) {
    this._ffz_channel_emotes[cname] = {};
    this._api.GetSimple(Twitch.URL.FFZEmotes(cid), (json) => {
      let ffz = this._ffz_channel_emotes[cname];
      ffz.id = json.room.uid;
      ffz.set_id = json.room.set;
      ffz.css = json.room.css;
      ffz.display_name = json.room.display_name;
      ffz.user_name = json.room.id;
      ffz.is_group = json.room.is_group;
      ffz.mod_urls = {};
      if (json.room.mod_urls) {
        for (let [k, v] of Object.entries(json.room.mod_urls)) {
          if (v) {
            ffz.mod_urls[k] = Util.URL(v);
          }
        }
      }
      if (json.room.moderator_badge) {
        ffz.mod_badge = Util.URL(json.room.moderator_badge);
      } else {
        ffz.mod_badge = null;
      }
      ffz.sets_raw = json.sets;
      if (json.sets[ffz.set_id]) {
        let set_def = json.sets[ffz.set_id];
        ffz.emotes_name = set_def.title;
        ffz.emotes_desc = set_def.description || "";
        ffz.emotes = {};
        for (let v of Object.values(set_def.emoticons)) {
          if (v.hidden) continue;
          ffz.emotes[v.name] = v;
          for (let [size, url] of Object.entries(v.urls)) {
            ffz.emotes[v.name].urls[size] = Util.URL(url);
          }
        }
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "ffz_emotes"
      }));
    }, (resp) => {
      if (resp.status === 404) {
        Util.LogOnly(`Channel ${cname}:${cid} has no FFZ emotes`);
      }
    });
  }

  /* Private: Load in the per-channel BTTV emotes */
  _getBTTVEmotes(cname, cid) {
    let url = Twitch.URL.BTTVEmotes(cid);
    this._bttv_channel_emotes[cname] = {};
    this._api.GetSimple(url, (json) => {
      let bttv = this._bttv_channel_emotes[cname];
      for (let emote of json.sharedEmotes) {
        /* code, id, imageType, user */
        bttv[emote.code] = {
          "id": emote.id,
          "code": emote.code,
          "channel": emote.channel,
          "image-type": emote.imageType,
          "url": Twitch.URL.BTTVEmote(emote.id)
        };
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "bttv_channel_emotes"
      }));
    }, (resp) => {
      /* Received an error */
      if (resp.status === 404) {
        Util.LogOnly(`Channel ${cname}:${cid} has no BTTV emotes`);
      } else {
        let rtext = "response: (null)";
        if (resp.response !== null && `${resp.response}` !== "") {
          rtext = resp.response;
        }
        Util.WarnOnly(`Failed to get BTTV emotes for channel ${cname}:${cid}: ${rtext}`);
      }
    });
  }

  /* Private: Load in the global BTTV emotes */
  _getGlobalBTTVEmotes() {
    this._bttv_global_emotes = {};
    this._api.GetSimple(Twitch.URL.BTTVAllEmotes(), (json) => {
      for (let emote of json) {
        this._bttv_global_emotes[emote.code] = {
          "id": emote.id,
          "code": emote.code,
          "channel": emote.channel,
          "image-type": emote.imageType,
          "url": Twitch.URL.BTTVEmote(emote.id)
        };
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "bttv_emotes"
      }));
    }, (resp) => {
      /* Received an error */
      if (resp.response !== null && `${resp.response}` !== "") {
        Util.WarnOnly(`Failed to get global BTTV emotes: ${resp.response}`);
      } else {
        Util.WarnOnly(`Failed to get global BTTV emotes: null response (see console)`);
      }
    });
  }

  /* Private: Load in the global badges  */
  _getGlobalBadges() {
    this._global_badges = {};
    if (this._no_assets) return;
    let endpoint = Twitch.URL.AllBadges();
    if (this._use_local_badge_service) {
      endpoint = Twitch.Local.GlobalBadges();
    }
    this._api.Get(endpoint, (json) => {
      for (let badge of json.data) {
        this._global_badges[badge.set_id] = badge;
      }
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "global_badges"
      }));
    }, {}, false);
    if (this._enable_ffz) {
      this._api.GetSimple(Twitch.URL.FFZBadgeUsers(), (resp) => {
        for (let badge of Object.values(resp.badges)) {
          this._ffz_badges[badge.id] = badge;
        }
        for (let [badge_nr, users] of Object.entries(resp.users)) {
          this._ffz_badge_users[badge_nr] = users;
        }
        this._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "ffz_badges"
        }));
      });
    }
  }

  /* Private: Build a faux PRIVMSG event from the chat message given */
  _buildChatEvent(chobj, message) {
    let flags = {};
    let emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
    let chstr = Twitch.FormatChannel(chobj);
    let userstate = this._self_userstate[chstr] || {};
    let msg = message;

    /* Construct the parsed flags object */
    flags["badge-info"] = userstate["badge-info"];
    flags["badges"] = userstate["badges"] || [];
    flags["color"] = userstate["color"];
    flags["subscriber"] = userstate["subscriber"];
    flags["mod"] = userstate["mod"];
    flags["vip"] = userstate["vip"] || null;
    flags["broadcaster"] = userstate["broadcaster"] || null;
    flags["display-name"] = userstate["display-name"];
    flags["emotes"] = emote_obj;
    flags["id"] = Util.Random.uuid();
    flags["user-id"] = this._self_userid;
    flags["room-id"] = this._rooms[chobj.channel].id;
    flags["tmi-sent-ts"] = (new Date()).getTime();
    flags["turbo"] = 0;
    flags["user-type"] = "";
    flags["__synthetic"] = 1;

    /* Construct the formatted flags string */
    let flag_arr = [];
    let addFlag = (n, v) => {
      let val = `${v}`;
      if (typeof(v) === "undefined" || v === null) {
        val = "";
      }
      flag_arr.push(`${n}=${val}`);
    };

    /* Build and add the rest of the flags */
    addFlag("badges", flags["badges"].map((b, r) => `${b}/${r}`).join(","));
    addFlag("color", flags["color"]);
    addFlag("display-name", flags["display-name"]);
    addFlag("subscriber", flags["subscriber"]);
    addFlag("mod", flags["mod"]);
    if (flags["vip"]) {
      addFlag("vip", flags["vip"]);
    }
    if (flags["broadcaster"]) {
      addFlag("broadcaster", flags["broadcaster"]);
    }
    addFlag("emotes", Twitch.FormatEmoteFlag(flags["emotes"]));
    addFlag("id", flags["id"]);
    addFlag("user-id", flags["user-id"]);
    addFlag("room-id", flags["room-id"]);
    addFlag("tmi-sent-ts", flags["tmi-sent-ts"]);
    addFlag("turbo", flags["turbo"]);
    addFlag("user-type", flags["user-type"]);
    addFlag("__synthetic", flags["__synthetic"]);
    addFlag("__synthetic", "1");
    let flag_str = flag_arr.join(";");

    /* Build the raw and parsed objects */
    let user = userstate["display-name"].toLowerCase();
    let useruri = `:${user}!${user}@${user}.tmi.twitch.tv`;
    let channel = Twitch.FormatChannel(chobj);
    /* @<flags> <useruri> PRIVMSG <channel> :<message> */
    let raw_line = `@${flag_str} ${useruri} PRIVMSG ${channel} :`;

    /* Handle /me */
    if (msg.startsWith("/me ")) {
      msg = msg.substr("/me ".length);
      raw_line += "\x01ACTION " + msg + "\x01";
      flags.action = true;
    } else {
      raw_line += msg;
    }

    /* Construct and return the event */
    let event = new TwitchChatEvent(raw_line, ({
      cmd: "PRIVMSG",
      flags: flags,
      user: Twitch.ParseUser(useruri),
      channel: chobj,
      message: msg,
      synthetic: true /* mark the event as synthetic */
    }));

    /* TFC-Specific logic: handle mod antics
     * This logic only applies when the client is running inside the Twitch
     * Filtered Chat. Yes, this violates encapsulation in multiple ways. The
     * intent here is to set event.flags.bits if mod antics are enabled and
     * the message contains cheer antics. This enables fanfare effects on
     * messages containing antics */
    if (this.get("HTMLGen")) {
      let H = this.get("HTMLGen");
      if (typeof(H.hasAntics) === "function") {
        if (H.hasAntics(event)) {
          /* genMsgInfo modifies the event in-place */
          H._genMsgInfo(event);
        }
      }
    }
    return event;
  }

  /* End private functions section 0}}} */

  /* General status functions {{{0 */

  /* Forcibly close the socket */
  close() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }

  /* Return whether or not the client has a websocket */
  get hasSocket() { return this._ws !== null; }

  /* Get the client's current username */
  GetName() { return this._username; }
  get name() { return this.GetName(); }

  /* Obtain connection status information */
  ConnectionStatus() {
    return {
      endpoint: this._endpoint,
      capabilities: Util.JSONClone(this._capabilities),
      open: this._is_open,
      connected: this.Connected(),
      identified: this._has_clientid,
      authed: this.IsAuthed()
    };
  }
  get status() { return this.ConnectionStatus(); }

  /* Return whether or not the client is currently trying to connect */
  IsConnecting() { return this._connecting; }
  get connecting() { return this.IsConnecting(); }

  /* Return whether or not we're connected to Twitch */
  Connected() { return this._connected; }
  get connected() { return this.Connected(); }

  /* Return whether or not the client is authenticated with an AuthID */
  IsAuthed() { return this._authed; }
  get authed() { return this._authed; }

  /* Return whether or not FFZ support is enabled */
  FFZEnabled() { return this._enable_ffz; }
  get ffzEnabled() { return this.FFZEnabled(); }

  /* Provide API to disable FFZ support entirely */
  disableFFZ() { this._enable_ffz = false; }

  /* Return whether or not BTTV support is enabled */
  BTTVEnabled() { return this._enable_bttv; }
  get bttvEnabled() { return this.BTTVEnabled; }

  /* Provide API to disable BTTV support entirely */
  disableBTTV() { this._enable_bttv = false; }

  /* Return a copy of the client's userstate */
  SelfUserState() {
    let obj = Util.JSONClone(this._self_userstate);
    obj.userid = this._self_userid;
    return obj;
  }
  get userState() { return this.SelfUserState(); }

  /* Return true if the client has been granted the capability specified. Values
   * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
   * following: twitch.tv/tags twitch.tv/commands twitch.tv/membership */
  HasCapability(test_cap) {
    for (let cap of this._capabilities) {
      if (test_cap === cap || cap.endsWith("/" + test_cap.replace(/^\//, ""))) {
        return true;
      }
    }
    return false;
  }

  /* Return whether or not the numeric user ID refers to the client itself */
  IsUIDSelf(userid) { return userid === this._self_userid; }

  /* End of general status functions 0}}} */

  /* Role and moderation functions {{{0 */

  /* Return true if the client is a subscriber in the channel given */
  IsSub(channel) {
    if (this._selfUserState(channel, "sub")) return true;
    if (this._hasBadge(channel, "subscriber")) return true;
    return false;
  }

  /* Return true if the client is a VIP in the channel given */
  IsVIP(channel) {
    if (this._selfUserState(channel, "vip")) return true;
    if (this._hasBadge(channel, "vip")) return true;
    return false;
  }

  /* Return true if the client is a moderator in the channel given */
  IsMod(channel) {
    if (this._selfUserState(channel, "mod")) return true;
    if (this._hasBadge(channel, "moderator")) return true;
    return false;
  }

  /* Return true if the client is the broadcaster for the channel given */
  IsCaster(channel) {
    if (this._selfUserState(channel, "broadcaster")) return true;
    if (this._hasBadge(channel, "broadcaster")) return true;
    return false;
  }

  /* Timeout the specific user in the specified channel */
  Timeout(channel, user, duration="600s", reason=null) {
    let msg = reason;
    if (!reason) {
      /* Sanitizes channel */
      let cname = Twitch.FormatChannel(Twitch.ParseChannel(channel));
      msg = `Timed out by ${this._username} from ${cname} for ${duration}`;
    }
    this.SendMessage(channel, `/timeout ${user} ${duration} "${msg}"`);
  }

  /* Un-timeout the specific user in the specified channel */
  UnTimeout(channel, user) {
    this.SendMessage(channel, `/untimeout ${user}`);
  }

  /* Ban the specific user from the specified channel */
  Ban(channel, user, reason=null) {
    let msg = reason;
    if (!reason) {
      /* Sanitizes channel */
      let cname = Twitch.FormatChannel(Twitch.ParseChannel(channel));
      msg = `Banned from ${cname} by ${this._username}`;
    }
    this.SendMessage(channel, `/ban ${user} ${msg}`);
  }

  /* Unban the specific user from the specified channel */
  UnBan(channel, user) {
    this.SendMessage(channel, `/unban ${user}`);
  }

  /* End of role and moderation functions 0}}} */

  /* Channel functions {{{0 */

  /* Backwards compatibility */
  ParseChannel(channel) { return Twitch.ParseChannel(channel); }

  /* Request the client to join the channel specified */
  JoinChannel(channel) {
    let chobj = Twitch.ParseChannel(channel);
    let cname = Twitch.FormatChannel(chobj); /* Sanitizes channel */
    let user = chobj.channel.replace(/^#/, "");
    if (this._is_open) {
      if (this._channels.indexOf(cname) === -1) {
        this.send(`JOIN ${cname}`);
        this._channels.push(cname);
        /* Determine if the channel to join is a real channel */
        this._api.Get(Twitch.URL.User(user), (response) => {
          let r = response.data; /* v5 Migration compatibility */
          if (!r || r.length === 0 || r[0].login !== user) {
            Util.Warn(`${cname} doesn't seem to be a real channel; leaving`);
            this.LeaveChannel(channel);
          }
        }, /*headers*/null, /*add_private*/true);
      } else {
        Util.Warn(`JoinChannel: Already in ${cname}`);
      }
    } else if (this._pending_channels.indexOf(cname) === -1) {
      this._pending_channels.push(cname);
    }
  }

  /* Request the client to leave the channel specified */
  LeaveChannel(channel) {
    /* Sanitizes channel */
    let cname = Twitch.FormatChannel(Twitch.ParseChannel(channel));
    if (this._is_open) {
      let idx = this._channels.indexOf(cname);
      if (idx > -1) {
        this.send(`PART ${cname}`);
        this._channels.splice(idx, 1);
        delete this._rooms[cname]; /* harmless if fails */
      } else {
        Util.Warn(`LeaveChannel: Not in channel ${cname}`);
      }
    }
  }

  /* Return whether or not the client is in the channel specified */
  IsInChannel(channel) {
    /* Sanitizes channel */
    let cname = Twitch.FormatChannel(Twitch.ParseChannel(channel));
    return this._is_open && this._channels.indexOf(cname) > -1;
  }

  /* Get the list of currently-joined channels */
  GetJoinedChannels() {
    return this._channels;
  }
  get channels() { return this.GetJoinedChannels(); }

  /* Get information regarding the channel specified */
  GetChannelInfo(channel) {
    /* Sanitizes channel */
    let cname = Twitch.FormatChannel(Twitch.ParseChannel(channel));
    return this._rooms[cname] || {};
  }

  /* Get a channel information by streamer ID */
  GetChannelById(cid) {
    for (let cinfo of Object.values(this._rooms)) {
      if (cinfo.id === cid) {
        return cinfo;
      }
    }
    return null;
  }

  /* End channel functions 0}}} */

  /* Functions related to cheers and emotes {{{0 */

  /* Return whether or not the given word is a cheer for the given channel */
  IsCheer(channel, word) {
    /* Sanitizes channel */
    let cname = Twitch.ParseChannel(channel).channel;
    if (this._channel_cheers.hasOwnProperty(cname)) {
      for (let name of Object.keys(this._channel_cheers[cname])) {
        if (word.match(this._channel_cheers[cname][name].pattern)) {
          return true;
        }
      }
    }
    return false;
  }

  /* Return all of the cheers found in the message */
  FindCheers(channel, message) {
    let matches = [];
    let parts = message.split(" ");
    let offset = 0;
    /* Sanitizes channel */
    let cname = Twitch.ParseChannel(channel).channel;
    if (this._channel_cheers.hasOwnProperty(cname)) {
      for (let [name, cheer] of Object.entries(this._channel_cheers[cname])) {
        if (message.search(cheer.pattern) > -1) {
          /* Remove the "g" flag */
          let wpat = new RegExp(cheer.pattern, "i");
          for (let token of parts) {
            let m = token.match(wpat);
            if (m) {
              let num_bits = Number.parseInt(m[2]);
              matches.push({
                cheer: cheer,
                name: m[1],
                cheername: name,
                bits: num_bits,
                start: offset,
                end: offset + token.length,
                groups: m
              });
            }
            offset += token.length + 1;
          }
        }
      }
    }
    return matches;
  }

  /* Return whether or not global cheers have been loaded */
  AreCheersLoaded() {
    if (this._global_cheers["Cheer"]) {
      return true;
    } else {
      return false;
    }
  }
  get cheersLoaded() { return this.AreCheersLoaded(); }

  /* Obtain information about a given cheermote. Overloads:
   * GetCheer(channel, cheername)
   * GetCheer(cheername) -> GetCheer("GLOBAL", cheername) */
  GetCheer(...args) {
    let [cname, name] = ["GLOBAL", null];
    if (args.length === 1) {
      [cname, name] = ["GLOBAL", args[0]];
    } else if (args.length === 2) {
      [cname, name] = args;
    } else {
      Util.Error("Invalid call to GetCheer([ch], cheer)", args);
      return null;
    }
    let cheer = null;
    if (cname === "GLOBAL") {
      if (this._global_cheers.hasOwnProperty(name)) {
        cheer = this._global_cheers[name];
      }
    } else if (this._channel_cheers.hasOwnProperty(cname)) {
      if (this._channel_cheers[cname].hasOwnProperty(name)) {
        cheer = this._channel_cheers[cname][name];
      }
    }
    return cheer;
  }

  /* Obtain information about a given global cheermote. This is identical to
   * client.GetCheer("GLOBAL", cheerName) */
  GetGlobalCheer(name) {
    return this.GetCheer("GLOBAL", name);
  }

  /* Obtain all cheermotes */
  GetCheers() {
    let cheers = {"GLOBAL": this._global_cheers};
    for (let [cname, ccheers] of Object.entries(this._channel_cheers)) {
      cheers[cname] = ccheers;
    }
    return cheers;
  }

  /* Return the emotes the client is allowed to use */
  GetEmotes(size=TwitchClient.DEFAULT_EMOTE_SIZE) {
    let emotes = {};
    for (let [k, v] of Object.entries(this._self_emotes)) {
      emotes[v] = this.GetEmote(k, size);
    }
    return emotes;
  }

  /* Return the URLs to all of the global emotes */
  GetGlobalEmotes(size=TwitchClient.DEFAULT_EMOTE_SIZE) {
    let emotes = {};
    if (this._self_emote_sets[TwitchClient.ESET_GLOBAL]) {
      for (let eid of this._self_emote_sets[TwitchClient.ESET_GLOBAL]) {
        let ename = this._self_emotes[eid] || `${eid}`;
        emotes[ename] = this.GetEmote(eid, size);
      }
    } else {
      Util.Warn("Unable to get global emotes; are emotes loaded?");
    }
    return emotes;
  }

  /* Return true if the given emote set has emotes loaded */
  isEmoteSetLoaded(eset) {
    if (Object.keys(this._self_emote_sets).includes(eset)) {
      if (this._self_emote_sets[eset].length > 0) {
        return true;
      }
    }
    return false;
  }

  /* Load the specified emote set(s); eset can be either a number or a
   * comma-separated sequence of numbers.
   */
  AddEmoteSet(eset) {
    /* Don't Get() if all emote set IDs are already loaded */
    let load = false;
    for (let i of `${eset}`.split(",")) {
      if (!this.isEmoteSetLoaded(i)) {
        load = true;
        break;
      }
    }
    /* Don't load blacklisted emotesets (which give 503s) */
    if (Twitch.BAD_EMOTESET_IDS.includes(`${eset}`)) {
      Util.DebugOnly(`Not loading eset ${eset}; set is blacklisted`);
      return;
    }
    if (load) {
      let eset_url = Twitch.URL.EmoteSet(eset);
      if (!this._self_emote_sets[eset]) {
        this._self_emote_sets[eset] = [];
      }
      this._api.Get(eset_url, (json) => {
        for (let emote of json.data) {
            if (!this._self_emote_sets[eset].includes(emote.id)) {
              this._self_emote_sets[eset].push(emote.id);
              this._self_emotes[emote.id] = emote.name;
            }
        }
        this._fire(new TwitchEvent("ASSETLOADED", "", {
          kind: "emote_set",
          eset: eset
        }));
      }, null, true);
    } else {
      Util.DebugOnly("Not loading emote sets " + eset + "; already loaded");
    }
  }

  /* Return the loaded emote sets */
  GetEmoteSets() {
    return Util.JSONClone(this._self_emote_sets);
  }

  /* Return the emotes in the given emote set */
  GetEmoteSetEmotes(eset) {
    let emotes = {};
    if (this._self_emote_sets[eset]) {
      emotes = Util.JSONClone(this._self_emote_sets[eset]);
    } else {
      Util.Warn(`No such emote set ${eset}`);
    }
    return emotes;
  }

  /* Return a promise for the given Twitch emote as an <img> element */
  PromiseEmote(ename, size=TwitchClient.DEFAULT_EMOTE_SIZE) {
    return Util.PromiseImage(this.GetEmote(ename, size));
  }

  /* Return the name of the given emote ID */
  GetEmoteName(emote_id) {
    if (this._self_emotes[emote_id]) {
      return this._self_emotes[emote_id];
    } else {
      return null;
    }
  }

  /* Return the ID of the given emote by name */
  GetEmoteID(emote_name) {
    for (let [k, v] of Object.entries(this._self_emotes)) {
      if (k === emote_name) {
        return v;
      }
    }
    return null;
  }

  /* Return the URL to the image for the emote and size specified (id or name) */
  GetEmote(emote_id, size=TwitchClient.DEFAULT_EMOTE_SIZE, dark=TwitchClient.DEFAULT_EMOTE_DARK) {
    if (typeof(emote_id) === "number" || emote_id > 0) {
      return Twitch.URL.EmoteV1(emote_id, size);
    } else if (`${emote_id}`.startsWith("emotesv2_")) {
      return Twitch.URL.EmoteV2(emote_id, size, "dark");
    } else {
      for (let [k, v] of Object.entries(this._self_emotes)) {
        if (v === emote_id) {
          return Twitch.URL.Emote(k, size);
        }
      }
    }
    return null;
  }

  /* Obtain the FFZ emotes for a channel */
  GetFFZEmotes(channel) {
    return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
  }

  /* Obtain global BTTV emotes */
  GetGlobalBTTVEmotes() {
    return this._bttv_global_emotes;
  }

  /* Obtain the BTTV emotes for the channel specified */
  GetBTTVEmotes(channel) {
    let ch = Twitch.FormatChannel(channel);
    if (this._bttv_channel_emotes[ch]) {
      return this._bttv_channel_emotes[ch];
    } else {
      Util.Log("Channel", channel, "has no BTTV emotes stored");
      return {};
    }
  }

  /* End of functions related to cheers and emotes 0}}} */

  /* Functions for sending messages {{{0 */

  /* Send a message to the channel specified */
  SendMessage(channel, message, bypassFaux=false) {
    let cobj = Twitch.ParseChannel(channel);
    let cname = Twitch.FormatChannel(cobj); /* Sanitizes channel */
    let msg = message.trim();
    if (this._connected && this._authed) {
      this.send(`PRIVMSG ${cobj.channel} :${msg}`);
      /* Dispatch a faux "Message Received" event */
      if (!bypassFaux) {
        if (this._self_userstate[Twitch.FormatChannel(cobj)]) {
          this._fire(this._buildChatEvent(cobj, msg));
        } else {
          Util.Error(`No USERSTATE given for channel ${cname}`);
        }
      }
    } else {
      Util.Warn(`Unable to send "${msg}" to ${cname}: not connected or authed`);
    }
  }

  /* Alias for client.SendMessage */
  Send(channel, message, bypassFaux=false) {
    this.SendMessage(channel, message, bypassFaux);
  }

  /* Send a message to every connected channel */
  SendMessageToAll(message, bypassFaux=false) {
    if (this._connected) {
      for (let ch of this._channels) {
        this.SendMessage(ch, message, bypassFaux);
      }
    } else {
      Util.Warn(`Unable to send "${message}" to all channels: not connected`);
    }
  }

  /* Alias for client.SendMessageToAll */
  SendToAll(message, bypassFaux=false) {
    this.SendMessageToAll(message, bypassFaux);
  }

  /* Send text to the Twitch servers, bypassing any special logic */
  SendRaw(raw_msg) {
    this.send(raw_msg.trimEnd() + "\r\n");
  }

  /* End of functions for sending messages 0}}} */

  /* History functions {{{0 */

  /* Add a message to the history of sent messages */
  AddHistory(message) {
    /* Prevent sequential duplicates */
    if (this._history.length === 0 || message !== this._history[0]) {
      this._history.unshift(message);
      while (this.GetHistoryLength() > this.GetHistoryMax()) {
        this._history.pop();
      }
    }
  }

  /* Obtain the history of sent messages */
  GetHistory() {
    return Util.JSONClone(this._history);
  }
  get history() { return this.GetHistory(); }

  /* Obtain the nth most recently sent message */
  GetHistoryItem(n) {
    if (n >= 0 && n < this._history.length) {
      return this._history[n];
    }
    return null;
  }

  /* Obtain the maximum number of history items */
  GetHistoryMax() {
    return this._hist_max;
  }
  get historyMaxSize() { return this.GetHistoryMax(); }

  /* Obtain the current number of history items */
  GetHistoryLength() {
    return this._history.length;
  }
  get historyLength() { return this.GetHistoryLength(); }

  /* End of history functions 0}}} */

  /* Asset and API functions {{{0 */

  /* Return the data for the given clip slug */
  GetClip(slug) {
    return new Promise((function _getclip_promise(resolve, reject) {
      this._api.Get(Twitch.URL.Clip(slug), function _getclip_resp(resp) {
        resolve(resp["data"][0]);
      }, reject);
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "clip",
        slug: slug
      }));
    }).bind(this));
  }

  /* Return information on the given game ID */
  GetGame(game_id) {
    return new Promise((function _getgame_promise(resolve, reject) {
      this._api.Get(Twitch.URL.Game(game_id), function _getgame_clip(resp) {
        resolve(resp["data"][0]);
      }, reject);
      this._fire(new TwitchEvent("ASSETLOADED", "", {
        kind: "game_info",
        game_id: game_id
      }));
    }).bind(this));
  }

  /* Return true if the badge specified is a global badge */
  IsGlobalBadge(badge_name, badge_version=null) {
    if (badge_name in this._global_badges) {
      if (badge_version === null) {
        return this._global_badges[badge_name].versions.length > 0;
      } else {
        for (let version of this._global_badges[badge_name].versions) {
          if (badge_version.toString() === version.id.toString()) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /* Return true if the badge specified exists as a channel badge */
  IsChannelBadge(channel, badge_name, badge_num=null) {
    /* Sanitizes channel */
    let c = Twitch.ParseChannel(channel).channel;
    if (c in this._channel_badges) {
      if (badge_name in this._channel_badges[c]) {
        let badge = this._channel_badges[c][badge_name];
        if (badge && (badge_num === null || badge[badge_num])) {
          return true;
        }
      }
    }
    return false;
  }

  /* Get a global badge by name and number; returns the first badge if
   * badge_num is null */
  GetGlobalBadge(badge_name, badge_version=null) {
    if (this._global_badges.hasOwnProperty(badge_name)) {
      let bver = badge_version;
      if (badge_version === null) {
        bver = this._global_badges[badge_name].versions[0].id;
      }
      for (let version of this._global_badges[badge_name].versions) {
        if (bver.toString() === version.id.toString()) { // ids / versions are always a string, but may represent a number.
          return version;
        }
      }
    }
    return {};
  }

  /* Get a channel badge by name and number; returns the first badge if
   * badge_num is null */
  GetChannelBadge(channel, badge_name, badge_num=null) {
    let cobj = Twitch.ParseChannel(channel);
    if (this.IsChannelBadge(cobj, badge_name, badge_num)) {
      let b = this._channel_badges[cobj.channel][badge_name];
      let idxs = Object.keys(b).sort();
      if (badge_num !== null) {
        return b[badge_num];
      } else if (idxs.length > 0) {
        return b[idxs[0]];
      }
    }
    return null;
  }

  /* Obtain all of the global badges */
  GetGlobalBadges() {
    return Util.JSONClone(this._global_badges);
  }

  /* Obtain all of the channel badges for the specified channel */
  GetChannelBadges(channel) {
    let cobj = Twitch.ParseChannel(channel);
    if (this._channel_badges.hasOwnProperty(cobj.channel)) {
      return Util.JSONClone(this._channel_badges[cobj.channel]);
    }
    return {};
  }

  /* End of asset handling functions 0}}} */

  /* Websocket callbacks {{{0 */

  /* Called on each (non-empty) line received through the websocket */
  _onWebsocketLine(line) {
    let result = Twitch.ParseIRCMessage(line);

    /* Fire twitch-message for every line received */
    this._fire(new TwitchEvent("MESSAGE", line, result));

    /* Don't handle messages with NULL commands */
    if (!result.cmd) {
      Util.Error("Parser failure: result.cmd is NULL for", result, line);
      return;
    }

    /* Parse and handle result.channel to simplify code below */
    let cname = null;
    let cstr = null;
    let room = null;
    let roomid = null;
    if (result.channel) {
      this._ensureRoom(result.channel);
      cname = result.channel.channel;
      cstr = Twitch.FormatChannel(result.channel);
      room = this._rooms[cname];
      if (result.flags && result.flags["room-id"]) {
        roomid = result.flags["room-id"];
        this._rooms_byid[roomid] = room;
      }
    }

    /* Handle each command that could be returned */
    switch (result.cmd) {
      case "PING":
        this.send(`PONG :${result.server}`);
        break;
      case "ACK":
        this._connected = true;
        this._capabilities = result.flags;
        /* Load global emotes */
        this.AddEmoteSet(TwitchClient.ESET_GLOBAL);
        /* Obtain global cheermotes */
        this._getGlobalCheers();
        /* Obtain global BTTV emotes */
        if (this._enable_bttv) {
          this._getGlobalBTTVEmotes();
        }
        break;
      case "TOPIC":
        /* No special processing needed */
        break;
      case "NAMES":
        for (let user of result.usernames) {
          this._onJoin(result.channel, user);
        }
        break;
      case "JOIN":
        if (result.user.equalsLowerCase(this._username)) {
          this._fire(new TwitchEvent("JOINED", line, result));
        }
        this._onJoin(result.channel, result.user);
        break;
      case "PART":
        if (result.user.equalsLowerCase(this._username)) {
          this._fire(new TwitchEvent("PARTED", line, result));
        }
        this._onPart(result.channel, result.user);
        break;
      case "RECONNECT":
        this.Connect();
        break;
      case "MODE":
        if (result.modeflag === "+o") {
          this._onOp(result.channel, result.user);
        } else if (result.modeflag === "-o") {
          this._onDeOp(result.channel, result.user);
        }
        break;
      case "PRIVMSG": {
        let event = new TwitchChatEvent(line, result);
        if (!room.userInfo.hasOwnProperty(result.user)) {
          room.userInfo[result.user] = {};
        }
        if (!room.users.includes(result.user)) {
          room.users.push(result.user);
        }
        if (!event.flags.badges) event.flags.badges = [];
        if (this._enable_ffz) {
          for (let [badge_nr, users] of Object.entries(this._ffz_badge_users)) {
            if (users.indexOf(result.user) > -1) {
              let ffz_badges = event.flags["ffz-badges"];
              if (!ffz_badges) ffz_badges = [];
              ffz_badges.push(this._ffz_badges[badge_nr]);
              event.flags["ffz-badges"] = ffz_badges;
            }
          }
        }
        let ui = room.userInfo[result.user];
        ui.ismod = event.ismod;
        ui.issub = event.issub;
        ui.isvip = event.isvip;
        ui.userid = event.flags["user-id"];
        ui.uuid = event.flags["id"];
        ui.badges = event.flags["badges"];
        this._fire(event);
      } break;
      case "WHISPER":
        /* No special processing needed */
        break;
      case "USERSTATE":
        if (!this._self_userstate.hasOwnProperty(cstr)) {
          this._self_userstate[cstr] = {};
        }
        for (let [key, val] of Object.entries(result.flags)) {
          this._self_userstate[cstr][key] = val;
        }
        break;
      case "ROOMSTATE":
        room.id = roomid;
        room.channel = result.channel;
        if (!this._no_assets) {
          this._getChannelBadges(cname, roomid);
          this._getChannelCheers(cname, roomid);
          if (this._enable_ffz) {
            this._getFFZEmotes(cname, roomid);
          }
          if (this._enable_bttv) {
            this._getBTTVEmotes(cname, roomid);
          }
        }
        this._api.Get(Twitch.URL.Stream(roomid), (resp) => {
          if (resp.data && resp.data.length > 0) {
            room.stream = resp.data[0];
            room.streams = resp.data;
            room.online = true;
          } else {
            room.stream = {};
            room.streams = [];
            room.online = false;
          }
          this._fire(new TwitchEvent("STREAMINFO", line, result));
        }, null, true);
        break;
      case "USERNOTICE":
        if (TwitchSubEvent.IsKind(result.sub_kind)) {
          this._fire(new TwitchSubEvent(result.sub_kind, line, result));
        } else if (result.israid) {
          this._fire(new TwitchEvent("RAID", line, result));
        } else if (result.isritual && result.ritual_kind === "new_chatter") {
          this._fire(new TwitchEvent("NEWUSER", line, result));
        } else if (result.ismysterygift) {
          this._fire(new TwitchEvent("MYSTERYGIFT", line, result));
        } else if (result.isrewardgift) {
          this._fire(new TwitchEvent("REWARDGIFT", line, result));
        } else if (result.isupgrade) {
          let command = "OTHERUSERNOTICE";
          if (result.isgiftupgrade) {
            command = "GIFTUPGRADE";
          } else if (result.isprimeupgrade) {
            command = "PRIMEUPGRADE";
          } else if (result.isanongiftupgrade) {
            command = "ANONGIFTUPGRADE";
          }
          this._fire(new TwitchEvent(command, line, result));
        } else {
          this._fire(new TwitchEvent("OTHERUSERNOTICE", line, result));
        }
        break;
      case "GLOBALUSERSTATE":
        this._self_userid = result.flags["user-id"];
        break;
      case "CLEARCHAT":
        /* No special processing needed */
        break;
      case "CLEARMSG":
        /* No special processing needed */
        break;
      case "HOSTTARGET":
        /* No special processing needed */
        break;
      case "NOTICE":
        /* No special processing needed */
        break;
      case "ERROR":
        /* No special processing needed */
        break;
      case "OTHER":
        /* No special processing needed */
        break;
      default:
        Util.Error("Unhandled event:", result, line);
        break;
    }

    /* Obtain emotes the client is able to use */
    if (result.cmd === "GLOBALUSERSTATE") {
      if (result.flags && result.flags["emote-sets"]) {
        /* Add the sets one at a time in case a set gives an error */
        for (let eset of result.flags["emote-sets"].map((e) => `${e}`)) {
          this.AddEmoteSet(eset);
        }
      }
    }

    /* Fire top-level event after event was handled */
    this._fire(new TwitchEvent(result.cmd, line, result));
  }

  /* Callback: called when the websocket opens */
  _onWebsocketOpen(name, pass) {
    this.send(`CAP REQ :${TwitchClient.CAPABILITIES.join(" ")}`);
    if (name && pass) {
      this._username = name;
    } else {
      this._username = `justinfan${Math.floor(Math.random() * 999999)}`;
    }
    if (pass) {
      this.send(`PASS ${pass.indexOf("oauth:") === 0 ? "" : "oauth:"}${pass}`);
      this.send(`NICK ${name}`);
    } else {
      this.send(`NICK ${this._username}`);
    }
    for (let i of this._pending_channels) {
      this.JoinChannel(i);
    }
    this._pending_channels = [];
    this._getGlobalBadges();
    this._fire(new TwitchEvent("OPEN", "", {"has-clientid": this._has_clientid}));
  }

  /* Callback: called when the websocket receives a message */
  _onWebsocketMessage(event) {
    /* Strip and split the message into lines, discarding empty lines */
    let lines = event.data.trim().split("\r\n").filter((l) => l.length > 0);
    /* Log the lines to the debug console */
    if (lines.length === 1) {
      Util.DebugOnly(`ws recv> "${lines[0]}"`);
    } else {
      for (let [i, l] of Object.entries(lines)) {
        let n = Number.parseInt(i) + 1;
        if (l.trim().length > 0) Util.DebugOnly(`ws recv/${n}> "${l}"`);
      }
    }
    /* Process each line */
    for (let line of lines) {
      this._onWebsocketLine(line);
    }
  }

  /* Callback: called when the websocket receives an error */
  _onWebsocketError(event) {
    Util.Error(event);
    this._fire(new TwitchEvent("ERROR", "", event));
  }

  /* Callback: called when the websocket is closed */
  _onWebsocketClose(event) {
    for (let chobj of this._channels) {
      if (this._pending_channels.indexOf(chobj) === -1) {
        this._pending_channels.push(chobj);
      }
    }
    this._channels = [];
    Util.LogOnly("WebSocket Closed", event);
    this._fire(new TwitchEvent("CLOSE", "", event));
  }

  /* End websocket callbacks 0}}} */

  get [Symbol.toStringTag]() { return "TwitchClient"; }
}

/* Twitch message escape sequences */
Twitch.FLAG_ESCAPE_RULES = [
  /* escaped character, escaped regex, raw character, raw regex */
  ["\\s", /\\s/g, " ", / /g],
  ["\\:", /\\:/g, ";", /;/g],
  ["\\r", /\\r/g, "\r", /\r/g],
  ["\\n", /\\n/g, "\n", /\n/g],
  ["\\\\", /\\\\/g, "\\", /\\/g]
];

/* API URL definitions {{{0 */

Twitch.Local = {}; /* non-Twitch endpoints */
Twitch.Local.URI = `${LOCAL_BADGE_URI}`;
Twitch.Local.UserBadges = (user) => `${Twitch.Local.URI}/user/badge/${encodeURIComponent(user)}`;
Twitch.Local.GlobalBadges = () => `${Twitch.Local.URI}/badges`;

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
Twitch.V5 = "https://api.twitch.tv/v5";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/3";
Twitch.BTTVCDN = "https://cdn.betterttv.net/";
Twitch.Badges = "https://badges.twitch.tv/v1/badges"; // Undocumented Endpoint, should not be used as a replacement exists in Helix.

/* Store URLs to specific asset APIs */
Twitch.URL = {
  User: (uname) => `${Twitch.Helix}/users?login=${uname}`,
  Stream: (cid) => `${Twitch.Helix}/streams?user_id=${cid}`,
  Clip: (slug) => `${Twitch.Helix}/clips?id=${slug}`,
  Game: (id) => `${Twitch.Helix}/games?id=${id}`,

  ChannelBadges: (cid) => `${Twitch.Helix}/chat/badges?broadcaster_id=${cid}`,
  AllBadges: () => `${Twitch.Helix}/chat/badges/global`,
  GlobalCheers: () => `${Twitch.Helix}/bits/cheermotes`,
  Cheers: (cid) => `${Twitch.Helix}/bits/cheermotes?broadcaster_id=${cid}`,
  EmoteV1: (eid, size="1.0") => `${Twitch.JTVNW}/emoticons/v1/${eid}/${size}`,
  EmoteV2: (eid, size="1.0", dark="dark") => `${Twitch.JTVNW}/emoticons/v2/${eid}/default/${dark}/${size}`,
  Emote: function _Twitch_URL_Emote(eid, size="1.0", dark="dark") {
    if (eid.startsWith("emotesv2_")) {
      return Twitch.URL.EmoteV2(eid, size, dark);
    } else {
      return Twitch.URL.EmoteV1(eid, size);
    }
  },
  EmoteSet: (eset) => `${Twitch.Helix}/chat/emotes/set?emote_set_id=${eset}`,

  FFZAllEmotes: () => `${Twitch.FFZ}/emoticons`,
  FFZEmotes: (cid) => `${Twitch.FFZ}/room/id/${cid}`,
  FFZEmote: (eid) => `${Twitch.FFZ}/emote/${eid}`,
  FFZBadges: () => `${Twitch.FFZ}/_badges`,
  FFZBadgeUsers: () => `${Twitch.FFZ}/badges`,

  BTTVAllEmotes: () => `${Twitch.BTTV}/cached/emotes/global`,
  BTTVBadges: () => `${Twitch.BTTV}/cached/badges`,
  BTTVEmotes: (cid) => `${Twitch.BTTV}/cached/users/twitch/${cid}`,
  BTTVEmote: (eid, size="1x") => `${Twitch.BTTVCDN}/emote/${eid}/${size}`
};

/* End API URL definitions 0}}} */

/* Abstract XMLHttpRequest */
Twitch.API = function _Twitch_API(global_headers, private_headers, onerror=null) {
  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  function doGetSimpleCB(url, callback, errorcb=null) {
    let req = new window.XMLHttpRequest();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          if (this.response !== null && `${this.response}` !== "") {
            Util.WarnOnly(`Failed to get "${url}"; response="${this.response}"`);
          } else {
            Util.WarnOnly(`Failed to get "${url}"; response=(null)`);
          }
          Util.WarnOnly(this);
        }
      }
    };
    req.open("GET", url);
    req.send();
  }
  this.GetSimple = doGetSimpleCB.bind(this);

  /* GET url, optionally adding private headers, using callbacks */
  function doGetCB(url, callback, headers=null, add_private=false, errorcb=null) {
    let req = new window.XMLHttpRequest();
    let callerStack = Util.GetStack();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          if (this.response !== null && `${this.response}` !== "") {
            Util.WarnOnly(`Failed to get "${url}"; response="${this.response}"; stack=`, callerStack);
          } else {
            Util.WarnOnly(`Failed to get "${url}"; response=(null); stack=`, callerStack);
          }
          Util.WarnOnly(url, this);
        }
      }
    };
    req.open("GET", url);
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    for (let key of Object.keys(global_headers || {})) {
      req.setRequestHeader(key, global_headers[key]);
    }
    for (let key of Object.keys(headers || {})) {
      req.setRequestHeader(key, headers[key]);
    }
    if (add_private) {
      for (let key of Object.keys(private_headers || {})) {
        req.setRequestHeader(key, private_headers[key]);
      }
    }
    req.send();
  }
  this.Get = doGetCB.bind(this);

  /* Get url, without headers, returning a promise */
  function doFetchSimple(url) {
    return new Promise((resolve, reject) => {
      this.GetSimple(url, resolve, reject);
    });
  }
  this.FetchSimple = doFetchSimple.bind(this);

  /* GET url, optionally adding private headers, returning a promise */
  function doFetch(url, headers=null, add_private=false) {
    return new Promise((resolve, reject) => {
      this.Get(url, resolve, headers, add_private, reject);
    });
  }
  this.Fetch = doFetch.bind(this);
};

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  return user.replace(/^:/, "").split("!")[0];
};

/* Parse channel to {channel}; overloads:
 *   Twitch.ParseChannel("#channel") (string)
 *   Twitch.ParseChannel({channel: "#channel"}) (object)
 */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  if (typeof(channel) === "string") {
    let chobj = {
      channel: ""
    };
    let parts = channel.split(":");
    if (parts.length === 1) {
      /* #channel */
      chobj.channel = parts[0];
    } else {
      Util.Warn(`ParseChannel: ${channel} not in expected format`);
      chobj.channel = parts[0];
    }
    if (chobj.channel.indexOf("#") !== 0 && chobj.channel !== "GLOBAL") {
      chobj.channel = "#" + chobj.channel;
    }
    return chobj;
  } else if (channel && channel.channel) {
    return Twitch.ParseChannel(channel.channel);
  } else {
    Util.Warn("ParseChannel: don't know how to parse", channel);
    return {channel: "GLOBAL"};
  }
};

/* Format a channel name or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel) {
  if (typeof(channel) === "string") {
    let cname = channel.toLowerCase();
    if (cname === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (cname.indexOf("#") !== 0) {
        cname = "#" + cname;
      }
      return cname;
    }
  } else if (channel && typeof(channel.channel) === "string") {
    return Twitch.FormatChannel(channel.channel);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel);
    return `${channel}`;
  }
};

/* Parse Twitch flag escape sequences */
Twitch.DecodeFlag = function _Twitch_DecodeFlag(value) {
  let result = value;
  for (let row of Twitch.FLAG_ESCAPE_RULES) {
    result = result.replace(row[1], row[2]);
  }
  return result;
};

/* Format Twitch flag escape sequences */
Twitch.EncodeFlag = function _Twitch_EncodeFlag(value) {
  let result = value;
  for (let row of Twitch.FLAG_ESCAPE_RULES.reverse()) {
    result = result.replace(row[3], row[0]);
  }
  return result;
};

/* Parse an individual @<flags...> key,value pair */
Twitch.ParseFlag = function _Twitch_ParseFlag(key, value) {
  let result = null;
  if (value.length === 0) {
    result = "";
  } else if (key === "badge-info" || key === "badges") {
    result = [];
    for (let badge of value.split(",")) {
      let [badge_name, badge_rev] = badge.split("/");
      result.push([badge_name, badge_rev]);
    }
  } else if (key === "emotes") {
    result = Twitch.ParseEmote(value);
  } else if (key === "emote-sets") {
    result = value.split(",").map(e => Util.ParseNumber(e));
  } else {
    result = Twitch.DecodeFlag(value);
  }
  if (typeof(result) === "string" && Util.IsNumber(result)) {
    result = Util.ParseNumber(result);
  }
  return result;
};

/* Parse @<flags...> key,value pairs */
Twitch.ParseFlags = function _Twitch_ParseFlags(dataString) {
  /* @key=value;key=value;... */
  let dataStr = dataString.replace(/^@/, "");
  let data = {};
  for (let item of dataStr.split(";")) {
    let key = item;
    let val = "";
    if (item.indexOf("=") !== -1) {
      [key, val] = item.split("=");
    }
    val = Twitch.ParseFlag(key, val);
    data[key] = val;
  }
  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  let result = [];
  for (let emote_def of value.split("/")) {
    let sep_pos = emote_def.indexOf(":");
    let emote_id = emote_def.substr(0, sep_pos);
    for (let range of emote_def.substr(sep_pos+1).split(",")) {
      let [start, end] = range.split("-");
      result.push({
        id: emote_id,
        name: null,
        start: Number.parseInt(start),
        end: Number.parseInt(end)
      });
    }
  }
  return result;
};

/* Format an emote specification flag */
Twitch.FormatEmoteFlag = function _Twitch_FormatEmoteFlag(emotes) {
  let specs = [];
  for (let emote of emotes) {
    if (emote.id !== null) {
      specs.push(`${emote.id}:${emote.start}-${emote.end}`);
    }
  }
  return specs.join("/");
};

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; don't escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
};

/* Generate a regex from a cheer prefix */
Twitch.CheerToRegex = function _Twitch_CheerToRegex(prefix) {
  let p = RegExp.escape(prefix);
  return new RegExp(`(?:\\b[\\s]|^)(${p})([1-9][0-9]*)(?:\\b|[\\s]|$)`, "ig");
};

/* Generate emote specifications for the given emotes [eid, ename] */
Twitch.ScanEmotes = function _Twitch_ScanEmotes(msg, emotes, escape=false) {
  let results = [];
  for (let emote_def of emotes) {
    let [eid, emote] = emote_def;
    let pat = Twitch.EmoteToRegex(escape ? RegExp.escape(emote) : emote);
    let arr;
    while ((arr = pat.exec(msg)) !== null) {
      /* arr = [wholeMatch, matchPart] */
      let start = arr.index + arr[0].indexOf(arr[1]);
      /* -1 to keep consistent with Twitch's off-by-one */
      let end = start + arr[1].length - 1;
      results.push({id: eid, pat: pat, name: emote, start: start, end: end});
    }
  }
  return results;
};

/* Parse a line received through the Twitch websocket */
Twitch.ParseIRCMessage = function _Twitch_ParseIRCMessage(line) {
  let result = { cmd: null };
  let parts = line.split(" ");
  let data = {};
  if (parts[0].startsWith("@")) {
    data = Twitch.ParseFlags(parts[0]);
    parts.shift();
  }
  /* line.substr(line.indexOf(..., line.indexOf(...)) + 1) */
  function argFrom(l, token, refpart) {
    return l.substr(l.indexOf(token, l.indexOf(refpart)) + 1);
  }
  if (parts[0] === "PING") {
    /* "PING :<server>" */
    result.cmd = "PING";
    result.server = parts[1].replace(/^:/, "");
  } else if (parts[1] === "CAP" && parts[2] === "*" && parts[3] === "ACK") {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = "ACK";
    result.operation = "CAP";
    result.server = parts[0].replace(/^:/, "");
    result.flags = line.substr(line.indexOf(":", 1)+1).split(" ");
  } else if (parts[1] === "375" || parts[1] === "376" || parts[1] === "366") {
    /* 375: Start TOPIC; 376: End TOPIC; 366: End NAMES */
    /* :<server> <code> <username> :<message> */
    result.cmd = "OTHER";
    result.server = parts[0].replace(/^:/, "");
    result.code = parts[1];
  } else if (parts[1].match(/00[1-9]/) || parts[1] === "372") {
    /* :<server> 00[1-4] <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
    result.server = parts[0].replace(/^:/, "");
    result.username = parts[2];
    result.message = parts.slice(3).join(" ").replace(/^:/, "");
  } else if (parts[1] === "353") {
    /* NAMES listing entry */
    /* :<user> 353 <username> <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = Twitch.ParseUser(parts[0].replace(/^:/, ""));
    result.mode = parts[3];
    result.channel = Twitch.ParseChannel(parts[4]);
    result.usernames = parts.slice(5).join(" ").replace(/^:/, "").split(" ");
  } else if (parts[1] === "JOIN" || parts[1] === "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "MODE") {
    /* :<sender> MODE <channel> <modeflag> <username> */
    result.cmd = "MODE";
    result.sender = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.modeflag = parts[3];
    result.user = parts[4];
  } else if (parts[1] === "PRIVMSG") {
    /* [@<flags>] :<user> PRIVMSG <channel> :<msg> */
    let msg = argFrom(line, ":", parts[2]);
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    if (msg.startsWith("\x01ACTION ")) {
      result.flags.action = true;
      result.message = msg.strip("\x01").substr("ACTION ".length);
    } else {
      result.flags.action = false;
      result.message = msg;
    }
  } else if (parts[1] === "WHISPER") {
    result.cmd = "WHISPER";
    result.flags = data;
    result.user = data["display-name"];
    result.sender = Twitch.ParseUser(parts[0]);
    result.recipient = Twitch.ParseUser(parts[2]);
    result.message = argFrom(line, ":", "WHISPER");
  } else if (parts[1] === "USERSTATE") {
    /* [@<flags>] :<server> USERSTATE <channel> */
    result.cmd = "USERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.username = data["display-name"];
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "ROOMSTATE") {
    /* [@<flags>] :<server> ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "USERNOTICE") {
    /* [@<flags>] :<server> USERNOTICE <channel> */
    /* [@<flags>] :<server> USERNOTICE <channel> :<message> */
    result.cmd = "USERNOTICE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    if (line.indexOf(":", line.indexOf(parts[2])) > -1) {
      result.message = argFrom(line, ":", parts[2]);
    }
    result.sub_kind = TwitchSubEvent.KindFromMsgID(result.flags["msg-id"]);
    result.issub = (result.sub_kind !== null);
    result.israid = (result.flags["msg-id"] === "raid");
    result.isritual = (result.flags["msg-id"] === "ritual");
    result.ismysterygift = (result.flags["msg-id"] === "submysterygift");
    result.isrewardgift = (result.flags["msg-id"] === "rewardgift");
    result.isgiftupgrade = (result.flags["msg-id"] === "giftpaidupgrade");
    result.isprimeupgrade = (result.flags["msg-id"] === "primepaidupgrade");
    result.isanongiftupgrade = (result.flags["msg-id"] === "anongiftpaidupgrade");
    result.isupgrade = result.flags["msg-id"].endsWith("paidupgrade");
    if (result.israid) {
      result.viewer_count = result.flags["msg-param-viewerCount"];
      result.raider = result.flags["msg-param-displayName"];
      result.raid_user = result.flags["msg-param-login"];
    }
    if (result.isritual) {
      result.ritual_kind = result.flags["msg-param-ritual-name"];
    }
  } else if (parts[1] === "GLOBALUSERSTATE") {
    /* [@<flags>] :server GLOBALUSERSTATE\r\n */
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
  } else if (parts[1] === "CLEARCHAT") {
    /* [@<flags>] :<server> CLEARCHAT <channel>[ :<user>]\r\n */
    result.cmd = "CLEARCHAT";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(":", line.indexOf(parts[2])) > -1) {
      result.user = argFrom(line, ":", parts[2]);
    }
  } else if (parts[1] === "CLEARMSG") {
    /* [@<flags>] :<server> CLEARMSG <channel> :<message>\r\n */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "HOSTTARGET") {
    /* :<server> HOSTTARGET <channel> :<user> -\r\n */
    result.cmd = "HOSTTARGET";
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = parts[3].replace(/^:/, "");
  } else if (parts[1] === "NOTICE") {
    /* [@<flags>] :<server> NOTICE <channel> :<message>\r\n */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "421") { /* Error */
    /* :<server> 421 <user> <command> :<message>\r\n */
    result.cmd = "ERROR";
    result.server = parts[0].replace(/^:/, "");
    result.user = Twitch.ParseUser(parts[2]);
    result.command = parts[3];
    result.message = argFrom(line, ":", parts[3]);
  } else {
    Util.Warn("OnWebsocketMessage: unknown message:", parts);
  }
  /* Ensure result.flags has values defined by badges */
  if (result.flags && result.flags.badges) {
    for (let badge_def of result.flags.badges) {
      let badge_name = badge_def[0];
      /* let badge_rev = badge_def[1]; */
      if (badge_name === "broadcaster") {
        result.flags.broadcaster = 1;
        result.flags.mod = 1;
      }
      if (badge_name === "subscriber") {
        result.flags.subscriber = 1;
      }
      if (badge_name === "moderator") {
        result.flags.mod = 1;
      }
    }
  }
  return result;
};

/* Strip private information from a string for logging */
Twitch.StripCredentials = function _Twitch_StripCredentials(msg) {
  let pats = [
    ["oauth:", /oauth:[\w]+/g],
    ["OAuth ", /OAuth [\w]+/g]
  ];
  let result = msg;
  for (let [name, pat] of pats) {
    if (result.match(pat)) {
      result = result.replace(pat, `${name}<removed>`);
    }
  }
  return result;
};

/* Construct the module */
try {
  /* globals module */
  module.exports.TwitchEvent = TwitchEvent;
  module.exports.TwitchChatEvent = TwitchChatEvent;
  module.exports.TwitchSubEvent = TwitchSubEvent;
  module.exports.TwitchClient = TwitchClient;
  module.exports.Twitch = Twitch;
}
catch (e) { /* not running in node; ignore */ }

/* exported TwitchEvent TwitchChatEvent TwitchSubEvent TwitchClient Twitch */
/* globals CallbackHandler */
