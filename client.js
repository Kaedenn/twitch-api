"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* Container for Twitch utilities */
let Twitch = {};

/* Event classes {{{0 */

/* Base Event object for Twitch events */
class TwitchEvent {
  constructor(type, raw, parsed) {
    this._cmd = type;
    this._raw = raw || "";
    if (!parsed) {
      this._parsed = {};
    } else if (parsed instanceof Event) {
      this._parsed = {
        event: parsed,
        name: Object.getPrototypeOf(parsed).constructor.name
      };
    } else {
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
      this._parsed.channel = {channel: "GLOBAL", room: null, roomuid: null};
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
  get object() { return this._parsed; }
  get values() { return this.object; }

  get channel() { return this.values.channel; }
  get channelString() { return Twitch.FormatChannel(this.channel); }
  get message() { return this.values.message; }
  get user() { return this.values.user || this.flags["display-name"]; }
  get name() { return this.flags["display-name"] || this.values.user; }
  get flags() { return this.values.flags; }
  flag(flag) { return this.flags ? this.flags[flag] : null; }

  /* Obtain the first non-falsy value of the listed flags */
  firstFlag(...flags) {
    for (let flag of flags) {
      if (this.flags[flag]) {
        return this.flags[flag];
      }
    }
    return null;
  }

  get noticeMsgId() {
    if (this._cmd === "NOTICE" && this.flags) {
      if (typeof(this.flags["msg-id"]) === "string") {
        return this.flags["msg-id"];
      }
    }
    return null;
  }

  get noticeClass() {
    let msgid = this.noticeMsgId;
    if (typeof(msgid) === "string") {
      return msgid.split('_')[0];
    }
    return null;
  }

  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let args = [this._cmd, this._raw, this._parsed];
    return `new ${cls}(${JSON.stringify(args)})`;
  }
}

/* Event object for chat events */
class TwitchChatEvent extends TwitchEvent {
  constructor(raw_line, parsed) {
    super("CHAT", raw_line, parsed);
    this._id = parsed.flags.id;
  }
  get id() {
    return this._id;
  }
  get iscaster() {
    return this.hasBadge("broadcaster");
  }
  get ismod() {
    return this.flags.mod || this.hasBadge("moderator") || this.iscaster;
  }
  get issub() {
    return this.flags.subscriber || this.hasBadge("subscriber");
  }
  get isvip() {
    return this.hasBadge("vip");
  }
  hasBadge(badge, rev=null) {
    if (!this.flags.badges)
      return false;
    for (let [badge_name, badge_rev] of this.flags.badges) {
      if (badge_name === badge) {
        if (rev !== null) {
          return badge_rev === rev;
        } else {
          return true;
        }
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
      this._sub_kind = TwitchSubEvent.SUB;
    }
  }

  get kind() { return this._sub_kind; }
  static get KINDS() { return ["SUB", "RESUB", "GIFTSUB", "ANONGIFTSUB"]; }
  static get SUB() { return "SUB"; }
  static get RESUB() { return "RESUB"; }
  static get GIFTSUB() { return "GIFTSUB"; }
  static get ANONGIFTSUB() { return "ANONGIFTSUB"; }

  static get PLANS() { return ["Prime", "1000", "2000", "3000"]; }
  static get PLAN_PRIME() { return "Prime"; }
  static get PLAN_TIER1() { return "1000"; }
  static get PLAN_TIER2() { return "2000"; }
  static get PLAN_TIER3() { return "3000"; }

  static FromMsgID(msgid) {
    if (msgid === "sub") return TwitchSubEvent.SUB;
    if (msgid === "resub") return TwitchSubEvent.RESUB;
    if (msgid === "subgift") return TwitchSubEvent.GIFTSUB;
    if (msgid === "anonsubgift") return TwitchSubEvent.ANONSUBGIFT;
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
  get user() {
    let name = this.firstFlag('msg-param-login', 'display-name');
    return name || this._parsed.user;
  }

  get plan() { return this.flags['msg-param-sub-plan-name']; }
  get plan_id() { return this.flags['msg-param-sub-plan']; }
  get months() { return this.flags['msg-param-months'] || 0; }
  get total_months() { return this.flags['msg-param-cumulative-months'] || 0; }
  get share_streak() { return this.flags['msg-param-should-share-streak']; }
  get streak_months() { return this.flags['msg-param-streak-months'] || 0; }

  /* Methods below only apply only to gift subs */
  get anonymous() { return this.kind === TwitchSubEvent.ANONGIFTSUB; }
  get recipient() { return this.flags['msg-param-recipient-user-name']; }
  get recipient_id() { return this.flags['msg-param-recipient-id']; }
  get recipient_name() { return this.flags['msg-param-recipient-display-name']; }
}

/* End of event classes section 0}}} */

/* Twitch Client class definition */
class TwitchClient { /* exported TwitchClient */
  static get DEFAULT_HISTORY_SIZE() { return 300; }
  static get DEFAULT_MAX_MESSAGES() { return 100; }

  constructor(opts) {
    let cfg_name = opts.Name;
    let cfg_clientid = opts.ClientID;
    let cfg_pass = opts.Pass;

    /* Core variables */
    this._ws = null;
    this._is_open = false;
    this._connected = false;
    this._username = null;
    this._connecting = false;

    /* List of channels/rooms presently joined */
    this._channels = [];
    /* List of channels/rooms about to join once connected to Twitch */
    this._pending_channels = opts.Channels || [];
    /* Channel and room information */
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
        oauth_header = cfg_pass.replace(/^oauth:/, 'OAuth ');
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
    }
    this._api = new Twitch.API(pub_headers, priv_headers);

    /* TwitchClient.Connect() */
    this.Connect = (function _TwitchClient_Connect() {
      /* Prevent recursion */
      if (this._connecting) {
        Util.Error("Client is already attempting to connect");
        return;
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
      this._endpoint = "wss://irc-ws.chat.twitch.tv";
      this._ws = new WebSocket(this._endpoint);
      this._ws.client = this;
      this._ws.onopen = (function _ws_onopen(event) {
        try {
          Util.LogOnly("ws open>", this.url, event);
          this._connecting = false;
          this._connected = false;
          this._is_open = true;
          this._onWebsocketOpen(cfg_name, oauth);
        } catch (e) {
          alert("ws.onopen error: " + e.toString());
          throw e;
        }
      }).bind(this);
      this._ws.onmessage = (function _ws_onmessage(event) {
        try {
          let data = Twitch.StripCredentials(JSON.stringify(event.data));
          Util.TraceOnly('ws recv>', data);
          this._onWebsocketMessage(event);
        } catch (e) {
          alert("ws.onmessage error: " + e.toString() + "\n" + e.stack);
          throw e;
        }
      }).bind(this);
      this._ws.onerror = (function _ws_onerror(event) {
        try {
          Util.LogOnly('ws error>', event);
          this._connected = false;
          this._onWebsocketError(event);
        } catch (e) {
          alert("ws.onerror error: " + e.toString());
          throw e;
        }
      }).bind(this);
      this._ws.onclose = (function _ws_onclose(event) {
        try {
          Util.LogOnly('ws close>', event);
          this._connected = false;
          this._is_open = false;
          this._onWebsocketClose(event);
        } catch (e) {
          alert("ws.onclose error: " + e.toString());
          throw e;
        }
      }).bind(this);
      this.send = (function _TwitchClient_send(m) {
        try {
          this._ws.send(m);
          Util.DebugOnly('ws send>', Twitch.StripCredentials(JSON.stringify(m)));
        } catch (e) {
          alert("this.send error: " + e.toString());
          throw e;
        }
      }).bind(this);

      Util.LogOnly("Connecting to Twitch...");
    }).bind(this);

    Util.LogOnly("Client constructed and ready for action");
  }

  /* Event handling {{{0 */

  /* Bind a function to the event specified */
  bind(event, callback) {
    Util.Bind(event, callback);
  }

  /* Bind a function to catch events not bound */
  bindDefault(callback) {
    Util.BindDefault(callback);
  }

  /* Unbind a function from the TwitchChat event specified */
  unbind(event, callback) {
    Util.Unbind(event, callback);
  }

  /* End event handling 0}}} */

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
    if (user.indexOf('!') > -1) {
      return Twitch.ParseUser(user);
    } else {
      return user;
    }
  }

  /* Private: Ensure the given channel is defined in this._rooms */
  _ensureRoom(channel) {
    let cobj = this.ParseChannel(channel);
    let cname = cobj.channel;
    if (!(cname in this._rooms)) {
      this._rooms[cname] = {
        users: [],     /* Joined users */
        userInfo: {},  /* Joined users' info */
        operators: [], /* Operators */
        channel: cobj, /* Channel object */
        cname: cname,  /* Channel name */
        rooms: {},     /* Known rooms */
        id: null,      /* Channel ID */
        online: false, /* Currently streaming */
        stream: {},    /* Stream status */
        streams: []    /* Stream statuses */
      };
    }
  }

  /* Private: Called when a user joins a channel */
  _onJoin(channel, userName) {
    let user = this._ensureUser(userName);
    let cobj = this.ParseChannel(channel);
    this._ensureRoom(channel);
    if (!this._rooms[cobj.channel].users.includes(user)) {
      if (cobj.room && cobj.roomuid) {
        /* User joined a channel room */
        this._rooms[cobj.channel].users.push(user);
      } else {
        /* User joined a channel's main room */
        this._rooms[cobj.channel].users.push(user);
      }
    }
    if (!this._rooms[cobj.channel].userInfo.hasOwnProperty(user)) {
      this._rooms[cobj.channel].userInfo[user] = {};
    }
  }

  /* Private: Called when a user parts a channel */
  _onPart(channel, userName) {
    let cobj = this.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(cobj);
    let cname = cobj.channel;
    if (this._rooms[cname].users.includes(user)) {
      let idx = this._rooms[cname].users.indexOf(user);
      this._rooms[cname].users.splice(idx, 1);
    }
  }

  /* Private: Called when the client receives a MODE +o event */
  _onOp(channel, userName) {
    let cobj = this.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(cobj);
    let cname = cobj.channel;
    if (!this._rooms[cname].operators.includes(user)) {
      this._rooms[cname].operators.push(user);
    }
  }

  /* Private: Called when the client receives a MODE -o event */
  _onDeOp(channel, userName) {
    let cobj = this.ParseChannel(channel);
    let user = this._ensureUser(userName);
    this._ensureRoom(cobj);
    let cname = cobj.channel;
    let idx = this._rooms[cname].operators.indexOf(user);
    if (idx > -1) {
      this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
    }
  }

  /* Private: Load in the extra chatrooms a streamer may or may not have */
  _getRooms(cname, cid) {
    if (this._no_assets) return;
    this._api.Get(Twitch.URL.Rooms(cid), (function _rooms_cb(json) {
      for (let room_def of json["rooms"]) {
        let room_name = room_def["name"];
        if (!this._rooms[cname].rooms) {
          this._rooms[cname].rooms = {};
        }
        this._rooms[cname].rooms[room_name] = room_def;
        this._rooms[cname].rooms[room_name].uid = room_def._id;
      }
    }).bind(this), {}, true);
  }

  /* Private: Load in the channel badges for a given channel name and ID */
  _getChannelBadges(cname, cid) {
    let channel = this.ParseChannel(cname);
    let c = channel.channel;
    this._channel_badges[c] = {};
    this._api.Get(Twitch.URL.ChannelBadges(cid), (function _badges_cb(json) {
      /* badge_sets
       *  subscriber
       *   versions
       *    <number of months>
       *     image_url_1x: url
       *     image_url_2x: url
       *     image_url_4x: url
       *     description: string
       *     title: string
       */
      for (let [badge_name, bdef] of Object.entries(json.badge_sets)) {
        let badge = {};
        for (let [months, urls] of Object.entries(bdef.versions)) {
          badge[months] = urls;
        }
        this._channel_badges[c][badge_name] = badge;
      }
    }).bind(this), {}, false);
  }

  /* Private: Load in the channel cheermotes for a given channel name and ID */
  _getChannelCheers(cname, cid) {
    this._channel_cheers[cname] = {};
    if (!this._has_clientid) {
      Util.Warn("Unable to get channel cheers; no clientid");
      return;
    }
    this._api.Get(Twitch.URL.Cheers(cid), (function _cheers_cb(json) {
      for (let cdef of json.actions) {
        /* Simplify things later by adding the regexps here */
        cdef.pattern = Twitch.CheerToRegex(cdef.prefix);
        this._channel_cheers[cname][cdef.prefix] = cdef;
      }
    }).bind(this), {}, false);
  }

  /* Private: Load the global cheermotes */
  _getGlobalCheermotes() {
    if (!this._has_clientid) {
      Util.Warn("Unable to get channel cheers; no clientid");
      return;
    }
    this._api.Get(Twitch.URL.GlobalCheers(), (function _cheers_cb(json) {
      for (let cdef of json.actions) {
        this._global_cheers[cdef.prefix] = cdef;
      }
    }).bind(this), {}, false);
  }

  /* Private: Load in the global and per-channel FFZ emotes */
  _getFFZEmotes(cname, cid) {
    this._ffz_channel_emotes[cname] = {};
    this._api.GetSimple(Twitch.URL.FFZEmotes(cid), (function _ffz_emotes_cb(json) {
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
    }).bind(this), (function _ffze_onerror(resp) {
      if (resp.status === 404) {
        Util.LogOnly(`Channel ${cname}:${cid} has no FFZ emotes`);
      }
    }));
  }

  /* Private: Load in the global and per-channel BTTV emotes */
  _getBTTVEmotes(cname, cid) {
    this._bttv_channel_emotes[cname] = {};
    this._api.GetSimple(Twitch.URL.BTTVEmotes(cname.replace(/^#/, "")),
                        (function _bttv_global_emotes_cb(json) {
      let url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
      let bttv = this._bttv_channel_emotes[cname];
      for (let emote of json.emotes) {
        bttv[emote.code] = {
          'id': emote.id,
          'code': emote.code,
          'channel': emote.channel,
          'image-type': emote.imageType,
          'url': Util.URL(url_base.replace(/\{\{id\}\}/g, emote.id))
        };
      }
    }).bind(this), (function _bttve_onerror(resp) {
      if (resp.status === 404) {
        Util.LogOnly(`Channel ${cname}:${cid} has no BTTV emotes`);
      }
    }));

    this._bttv_global_emotes = {};
    this._api.GetSimple(Twitch.URL.BTTVAllEmotes(),
                        (function _bttv_all_emotes_cb(json) {
      let url_base = json.urlTemplate.replace(/\{\{image\}\}/g, "1x");
      for (let emote of json.emotes) {
        this._bttv_global_emotes[emote.code] = {
          'id': emote.id,
          'code': emote.code,
          'channel': emote.channel,
          'image-type': emote.imageType,
          'url': Util.URL(url_base.replace('{{id}}', emote.id))
        };
      }
    }).bind(this), (function _bttve_onerror(resp) {
      if (resp.status === 404) {
        Util.LogOnly(`Channel ${cname}:${cid} has no BTTV emotes`);
      }
    }));
  }

  /* Private: Load in the global badges  */
  _getGlobalBadges() {
    this._global_badges = {};
    if (this._no_assets) return;
    this._api.Get(Twitch.URL.AllBadges(), (function _badges_cb(json) {
      for (let badge_name of Object.keys(json["badge_sets"])) {
        this._global_badges[badge_name] = json["badge_sets"][badge_name];
      }
    }).bind(this), {}, false);
    if (this._enable_ffz) {
      this._api.GetSimple(Twitch.URL.FFZBadgeUsers(), (function _ffz_bades_cb(resp) {
        for (let badge of Object.values(resp.badges)) {
          this._ffz_badges[badge.id] = badge;
        }
        for (let [badge_nr, users] of Object.entries(resp.users)) {
          this._ffz_badge_users[badge_nr] = users;
        }
      }).bind(this));
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
    if (msg.startsWith('/me ')) {
      msg = msg.substr('/me '.length);
      raw_line += '\x01ACTION ' + msg + '\x01';
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
  IsConnecting() {
    return this._connecting;
  }
  get connecting() { return this.IsConnecting(); }

  /* Return whether or not we're connected to Twitch */
  Connected() {
    return this._connected;
  }
  get connected() { return this.Connected(); }

  /* Return whether or not FFZ support is enabled */
  FFZEnabled() {
    return this._enable_ffz;
  }
  get ffzEnabled() { return this.FFZEnabled(); }

  /* Return whether or not BTTV support is enabled */
  BTTVEnabled() {
    return this._enable_bttv;
  }
  get bttvEnabled() { return this.BTTVEnabled; }

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
      if (test_cap === cap || cap.endsWith('/' + test_cap.replace(/^\//, ""))) {
        return true;
      }
    }
    return false;
  }

  /* Get the client's current username */
  GetName() {
    return this._username;
  }
  get name() { return this.GetName(); }

  /* Return whether or not the numeric user ID refers to the client itself */
  IsUIDSelf(userid) {
    return userid === this._self_userid;
  }

  /* End of general status functions 0}}} */

  /* Role and moderation functions {{{0 */

  /* Return whether or not the client is authenticated with an AuthID */
  IsAuthed() {
    return this._authed;
  }
  get authed() { return this._authed; }

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
      let cname = Twitch.FormatChannel(this.ParseChannel(channel));
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
      let cname = Twitch.FormatChannel(this.ParseChannel(channel));
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

  /* Parse a channel into a channel object */
  ParseChannel(channel) {
    let chobj = Twitch.ParseChannel(channel);
    if (chobj.room && chobj.channel !== "#chatrooms") {
      /* Parse #streamer:roomname strings */
      let [cname, rname] = [chobj.channel, chobj.room];
      let roomdef = this._rooms[cname];
      if (roomdef && roomdef.rooms && roomdef.rooms[rname]) {
        chobj.channel = "#chatrooms";
        chobj.room = roomdef.id;
        chobj.roomuid = roomdef.rooms[rname].uid;
      } else {
        Util.Warn(`Unable to parse room for ${JSON.stringify(channel)}`);
      }
    }
    return chobj;
  }

  /* Request the client to join the channel specified */
  JoinChannel(channel) {
    let chobj = this.ParseChannel(channel);
    let cname = Twitch.FormatChannel(chobj);
    let user = chobj.channel.replace(/^#/, "");
    if (this._is_open) {
      if (this._channels.indexOf(cname) === -1) {
        this.send(`JOIN ${cname}`);
        this._channels.push(cname);
        /* Determine if the channel to join is a real channel */
        this._api.Get(Twitch.URL.User(user), (resp) => {
          if (!resp || resp._total === 0) {
            Util.Warn(`${cname} doesn't seem to be a real channel; leaving`);
            this.LeaveChannel(channel);
          }
        });
      } else {
        Util.Warn(`JoinChannel: Already in ${cname}`);
      }
    } else if (this._pending_channels.indexOf(cname) === -1) {
      this._pending_channels.push(cname);
    }
  }

  /* Request the client to leave the channel specified */
  LeaveChannel(channel) {
    let cname = Twitch.FormatChannel(this.ParseChannel(channel));
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
    let cname = Twitch.FormatChannel(this.ParseChannel(channel));
    return this._is_open && this._channels.indexOf(cname) > -1;
  }

  /* Get the list of currently-joined channels */
  GetJoinedChannels() {
    return this._channels;
  }

  /* Get information regarding the channel specified */
  GetChannelInfo(channel) {
    let cname = Twitch.FormatChannel(this.ParseChannel(channel));
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
    let cname = this.ParseChannel(channel).channel;
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
    let cname = this.ParseChannel(channel).channel;
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

  /* Obtain information about a given cheermote */
  GetCheer(cname, name) {
    let cheer = null;
    if (this._channel_cheers.hasOwnProperty(cname)) {
      if (this._channel_cheers[cname].hasOwnProperty(name)) {
        cheer = this._channel_cheers[cname][name];
      }
    }
    return cheer;
  }

  /* Obtain information about a given global cheermote */
  GetGlobalCheer(name) {
    return Util.JSONClone(this._global_cheers[name]);
  }

  /* Obtain all cheermotes */
  GetCheers() {
    let cheers = {
      "GLOBAL": Util.JSONClone(this._global_cheers)
    };
    for (let [cname, chcheers] of Object.entries(this._channel_cheers)) {
      cheers[cname] = Util.JSONClone(chcheers);
    }
    return cheers;
  }

  /* Return the emotes the client is allowed to use */
  GetEmotes() {
    let emotes = {};
    for (let [k, v] of Object.entries(this._self_emotes)) {
      emotes[v] = this.GetEmote(k);
    }
    return emotes;
  }

  /* Return a promise for the given Twitch emote as an <img> element */
  PromiseEmote(ename) {
    return Util.PromiseImage(this.GetEmote(ename));
  }

  /* Return the URL to the image for the emote and size specified (id or name) */
  GetEmote(emote_id, size="1.0") {
    if (typeof(emote_id) === "number" || `${emote_id}`.match(/^[0-9]+$/)) {
      return Twitch.URL.Emote(emote_id, size);
    } else {
      for (let [k, v] of Object.entries(this._self_emotes)) {
        if (v === emote_id) {
          return Twitch.URL.Emote(k, size);
        }
      }
    }
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
    let cobj = this.ParseChannel(channel);
    let cname = Twitch.FormatChannel(cobj);
    let msg = message.trim();
    if (this._connected && this._authed) {
      this.send(`PRIVMSG ${cobj.channel} :${msg}`);
      /* Dispatch a faux "Message Received" event */
      if (!bypassFaux) {
        if (this._self_userstate[Twitch.FormatChannel(cobj)]) {
          Util.FireEvent(this._buildChatEvent(cobj, msg));
        } else {
          Util.Error(`No USERSTATE given for channel ${cname}`);
        }
      }
    } else {
      Util.Warn(`Unable to send "${msg}" to ${cname}: not connected or not authed`);
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
    }).bind(this));
  }

  /* Return information on the given game ID */
  GetGame(game_id) {
    return new Promise((function _getgame_promise(resolve, reject) {
      this._api.Get(Twitch.URL.Game(game_id), function _getgame_clip(resp) {
        resolve(resp["data"][0]);
      }, reject);
    }).bind(this));
  }

  /* Return true if the badge specified is a global badge */
  IsGlobalBadge(badge_name, badge_version=null) {
    if (badge_name in this._global_badges) {
      if (badge_version === null) {
        return Object.keys(this._global_badges[badge_name].versions).length > 0;
      } else if (badge_version in this._global_badges[badge_name].versions) {
        if (this._global_badges[badge_name].versions[badge_version]) {
          return true;
        }
      }
    }
    return false;
  }

  /* Return true if the badge specified exists as a channel badge */
  IsChannelBadge(channel, badge_name, badge_num=null) {
    let c = this.ParseChannel(channel).channel;
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

  /* Returns Object {
   *   image_url_1x: "https://static-cdn.jtvnw.net/badges/...",
   *   image_url_2x: "https://static-cdn.jtvnw.net/badges/...",
   *   image_url_4x: "https://static-cdn.jtvnw.net/badges/...",
   *   description: "Badge Description",
   *   title: "Badge Name",
   *   click_action: "badge_action",
   *   click_url: ""
   * } */
  GetGlobalBadge(badge_name, badge_version=null) {
    if (this._global_badges.hasOwnProperty(badge_name)) {
      let bver = badge_version;
      if (badge_version === null) {
        bver = Object.keys(this._global_badges[badge_name].versions).min();
      }
      if (this._global_badges[badge_name].versions.hasOwnProperty(bver)) {
        return this._global_badges[badge_name].versions[bver];
      }
    }
    return {};
  }

  /* Get a channel badge by name and number; returns the first badge if
   * badge_num is null */
  GetChannelBadge(channel, badge_name, badge_num=null) {
    let cobj = this.ParseChannel(channel);
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
    let cobj = this.ParseChannel(channel);
    if (this._channel_badges.hasOwnProperty(cobj.channel)) {
      return Util.JSONClone(this._channel_badges[cobj.channel]);
    }
    return {};
  }

  /* End of asset handling functions 0}}} */

  /* Websocket callbacks {{{0 */

  /* Callback: called when the websocket opens */
  _onWebsocketOpen(name, pass) {
    this.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
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
    Util.FireEvent(new TwitchEvent("OPEN", "", {"has-clientid": this._has_clientid}));
  }

  /* Callback: called when the websocket receives a message */
  _onWebsocketMessage(ws_event) {
    let lines = ws_event.data.trim().split("\r\n");
    /* Log the lines to the debug console */
    if (lines.length === 1) {
      Util.DebugOnly(`ws recv> "${lines[0]}"`);
    } else {
      for (let [i, l] of Object.entries(lines)) {
        let n = Number.parseInt(i) + 1;
        if (l.trim().length > 0) Util.DebugOnly(`ws recv/${n}> "${l}"`);
      }
    }
    for (let line of lines) {
      /* Ignore empty lines */
      if (line.trim().length === 0) {
        continue;
      }

      let result = Twitch.ParseIRCMessage(line);

      /* Fire twitch-message for every line received */
      Util.FireEvent(new TwitchEvent("MESSAGE", line, result));

      /* Don't handle messages with NULL commands */
      if (!result.cmd) {
        Util.Error("Parser failure: result.cmd is NULL for", result, line);
        continue;
      }

      /* Fire top-level event */
      Util.FireEvent(new TwitchEvent(result.cmd, line, result));

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
          break;
        case "TOPIC":
          break;
        case "NAMES":
          for (let user of result.usernames) {
            this._onJoin(result.channel, user);
          }
          break;
        case "JOIN":
          if (result.user.equalsLowerCase(this._username)) {
            Util.FireEvent(new TwitchEvent("JOINED", line, result));
          }
          this._onJoin(result.channel, result.user);
          break;
        case "PART":
          if (result.user.equalsLowerCase(this._username)) {
            Util.FireEvent(new TwitchEvent("PARTED", line, result));
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
                let ffz_badges = event.flags['ffz-badges'];
                if (!ffz_badges) ffz_badges = [];
                ffz_badges.push(this._ffz_badges[badge_nr]);
                event.flags['ffz-badges'] = ffz_badges;
              }
            }
          }
          let ui = room.userInfo[result.user];
          ui.ismod = event.ismod;
          ui.issub = event.issub;
          ui.isvip = event.isvip;
          ui.userid = event.flags['user-id'];
          ui.uuid = event.flags['id'];
          ui.badges = event.flags['badges'];
          Util.FireEvent(event);
        } break;
        case "WHISPER":
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
          if (this._authed) {
            this._getRooms(cname, roomid);
          }
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
          if (!Twitch.IsRoom(result.channel)) {
            this._api.Get(Twitch.URL.Stream(roomid), function _stream_cb(resp) {
              if (resp.streams && resp.streams.length > 0) {
                room.stream = resp.streams[0];
                room.streams = resp.streams;
                room.online = true;
              } else {
                room.stream = {};
                room.streams = [];
                room.online = false;
              }
              Util.FireEvent(new TwitchEvent("STREAMINFO", line, result));
            });
          }
          break;
        case "USERNOTICE":
          if (result.sub_kind === "SUB") {
            Util.FireEvent(new TwitchSubEvent("SUB", line, result));
          } else if (result.sub_kind === "RESUB") {
            Util.FireEvent(new TwitchSubEvent("RESUB", line, result));
          } else if (result.sub_kind === "GIFTSUB") {
            Util.FireEvent(new TwitchSubEvent("GIFTSUB", line, result));
          } else if (result.sub_kind === "ANONGIFTSUB") {
            Util.FireEvent(new TwitchSubEvent("ANONGIFTSUB", line, result));
          } else if (result.israid) {
            Util.FireEvent(new TwitchEvent("RAID", line, result));
          } else if (result.isritual && result.ritual_kind === "new_chatter") {
            Util.FireEvent(new TwitchEvent("NEWUSER", line, result));
          } else if (result.ismysterygift) {
            Util.FireEvent(new TwitchSubEvent("MYSTERYGIFT", line, result));
          } else if (result.isrewardgift) {
            Util.FireEvent(new TwitchSubEvent("REWARDGIFT", line, result));
          } else if (result.isupgrade) {
            let command = "OTHERUSERNOTICE";
            if (result.isgiftupgrade) {
              command = "GIFTUPGRADE";
            } else if (result.isprimeupgrade) {
              command = "PRIMEUPGRADE";
            } else if (result.isanongiftupgrade) {
              command = "ANONGIFTUPGRADE";
            }
            Util.FireEvent(new TwitchEvent(command, line, result));
          } else {
            Util.FireEvent(new TwitchEvent("OTHERUSERNOTICE", line, result));
          }
          break;
        case "GLOBALUSERSTATE":
          this._self_userid = result.flags['user-id'];
          this._getGlobalCheermotes();
          break;
        case "CLEARCHAT":
          break;
        case "CLEARMSG":
          break;
        case "HOSTTARGET":
          break;
        case "NOTICE":
          break;
        case "ERROR":
          break;
        case "OTHER":
          break;
        default:
          Util.Error("Unhandled event:", result, line);
          break;
      }

      /* Obtain emotes the client is able to use */
      if (result.cmd === "USERSTATE" || result.cmd === "GLOBALUSERSTATE") {
        if (result.flags && result.flags["emote-sets"]) {
          let eset_url = Twitch.URL.EmoteSet(result.flags["emote-sets"].join(','));
          this._api.Get(eset_url, (function _emoteset_cb(json) {
            for (let eset of Object.keys(json["emoticon_sets"])) {
              for (let edef of json["emoticon_sets"][eset]) {
                this._self_emotes[edef.id] = edef.code;
              }
            }
          }).bind(this));
        }
      }
    }
  }

  /* Callback: called when the websocket receives an error */
  _onWebsocketError(event) {
    Util.Error(event);
    Util.FireEvent(new TwitchEvent("ERROR", "", event));
  }

  /* Callback: called when the websocket is closed */
  _onWebsocketClose(event) {
    for (let chobj of this._channels) {
      if (this._pending_channels.indexOf(chobj) === -1) {
        this._pending_channels.push(chobj);
      }
    }
    this._channels = [];
    Util.Log("WebSocket Closed", event);
    Util.FireEvent(new TwitchEvent("CLOSE", "", event));
  }

  /* End websocket callbacks 0}}} */
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

Twitch.JTVNW = "https://static-cdn.jtvnw.net";
Twitch.Kraken = "https://api.twitch.tv/kraken";
Twitch.Helix = "https://api.twitch.tv/helix";
Twitch.V5 = "https://api.twitch.tv/v5";
Twitch.FFZ = "https://api.frankerfacez.com/v1";
Twitch.BTTV = "https://api.betterttv.net/2";
Twitch.Badges = "https://badges.twitch.tv/v1/badges";

/* Store URLs to specific asset APIs */
Twitch.URL = {
  User: (uname) => `${Twitch.Kraken}/users?login=${uname}`,
  Rooms: (cid) => `${Twitch.Kraken}/chat/${cid}/rooms`,
  Stream: (cid) => `${Twitch.Kraken}/streams?channel=${cid}`,
  Clip: (slug) => `${Twitch.Helix}/clips?id=${slug}`,
  Game: (id) => `${Twitch.Helix}/games?id=${id}`,

  ChannelBadges: (cid) => `${Twitch.Badges}/channels/${cid}/display?language=en`,
  AllBadges: () => `https://badges.twitch.tv/v1/badges/global/display`,
  GlobalCheers: () => `${Twitch.V5}/bits/actions`,
  Cheers: (cid) => `${Twitch.Kraken}/bits/actions?channel_id=${cid}`,
  Emote: (eid, size='1.0') => `${Twitch.JTVNW}/emoticons/v1/${eid}/${size}`,
  EmoteSet: (eset) => `${Twitch.Kraken}/chat/emoticon_images?emotesets=${eset}`,

  FFZAllEmotes: () => `${Twitch.FFZ}/emoticons`,
  FFZEmotes: (cid) => `${Twitch.FFZ}/room/id/${cid}`,
  FFZEmote: (eid) => `${Twitch.FFZ}/emote/${eid}`,
  FFZBadges: () => `${Twitch.FFZ}/_badges`,
  FFZBadgeUsers: () => `${Twitch.FFZ}/badges`,

  BTTVAllEmotes: () => `${Twitch.BTTV}/emotes`,
  BTTVEmotes: (cname) => `${Twitch.BTTV}/channels/${cname}`,
  BTTVEmote: (eid) => `${Twitch.BTTV}/emote/${eid}/1x`
};

/* End API URL definitions 0}}} */

/* Abstract XMLHttpRequest */
Twitch.API = function _Twitch_API(global_headers, private_headers, onerror=null) {
  this._onerror = onerror;

  /* GET url, without headers, using callbacks */
  function getSimpleCB(url, callback, errorcb=null) {
    let req = new XMLHttpRequest();
    req.onreadystatechange = function _XHR_onreadystatechange() {
      if (this.readyState === 4) {
        if (this.status === 200) {
          callback(JSON.parse(this.responseText));
        } else if (errorcb !== null) {
          errorcb(this);
        } else if (this._onerror) {
          this._onerror(this);
        } else {
          Util.Warn(this);
        }
      }
    };
    req.open("GET", url);
    req.send();
  }
  this.GetSimple = getSimpleCB.bind(this);

  /* GET url, optionally adding private headers, using callbacks */
  function getCB(url, callback, headers=null, add_private=false, errorcb=null) {
    let req = new XMLHttpRequest();
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
          Util.WarnOnly(`Failed to get "${url}" stack=`, callerStack);
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
  this.Get = getCB.bind(this);
};

/* Extract username from user specification */
Twitch.ParseUser = function _Twitch_ParseUser(user) {
  return user.replace(/^:/, "").split('!')[0];
};

/* Parse channel to {channel, room, roomuid} */
Twitch.ParseChannel = function _Twitch_ParseChannel(channel) {
  if (typeof(channel) === "string") {
    let chobj = {
      channel: "",
      room: null,
      roomuid: null
    };
    let parts = channel.split(':');
    if (parts.length === 1) {
      /* #channel */
      chobj.channel = parts[0];
    } else if (parts.length === 2) {
      /* #channel:room-name */
      chobj.channel = parts[0];
      chobj.room = parts[1];
    } else if (parts.length === 3) {
      /* #chatrooms:channel-id:room-uuid */
      chobj.channel = parts[0];
      chobj.room = parts[1];
      chobj.roomuid = parts[2];
    } else {
      Util.Warn(`ParseChannel: ${channel} not in expected format`);
      chobj.channel = parts[0];
    }
    if (chobj.channel !== "GLOBAL") {
      if (chobj.channel.indexOf('#') !== 0) {
        chobj.channel = '#' + chobj.channel;
      }
    }
    return chobj;
  } else if (channel && channel.channel) {
    return Twitch.ParseChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("ParseChannel: don't know how to parse", channel);
    return {channel: "GLOBAL", room: null, roomuid: null};
  }
};

/* Format a channel name, room name, or channel object */
Twitch.FormatChannel = function _Twitch_FormatChannel(channel, room, roomuid) {
  if (typeof(channel) === "string") {
    let cname = channel.toLowerCase();
    if (cname === "*") {
      /* Sent from GLOBAL */
      return "GLOBAL";
    } else {
      if (room) {
        cname += ':' + room;
      }
      if (roomuid) {
        cname += ':' + roomuid;
      }
      if (cname.indexOf('#') !== 0) {
        cname = '#' + cname;
      }
      return cname;
    }
  } else if (channel && typeof(channel.channel) === "string") {
    return Twitch.FormatChannel(channel.channel, channel.room, channel.roomuid);
  } else {
    Util.Warn("FormatChannel: don't know how to format", channel, room, roomuid);
    return `${channel}`;
  }
};

/* Return whether or not the channel object given is a #chatrooms room */
Twitch.IsRoom = function _Twitch_IsRoom(cobj) {
  return cobj.channel === "#chatrooms" && cobj.room && cobj.roomuid;
};

/* Format a room with the channel and room IDs given */
Twitch.FormatRoom = function _Twitch_FormatRoom(cid, rid) {
  return `#chatrooms:${cid}:${rid}`;
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
    for (let badge of value.split(',')) {
      let [badge_name, badge_rev] = badge.split('/');
      result.push([badge_name, badge_rev]);
    }
  } else if (key === "emotes") {
    result = Twitch.ParseEmote(value);
  } else if (key === "emote-sets") {
    result = value.split(',').map(e => Number.parse(e));
  } else {
    result = Twitch.DecodeFlag(value);
  }
  if (typeof(result) === "string") {
    let temp = Number.parse(result);
    if (!Number.isNaN(temp)) {
      result = temp;
    }
  }
  return result;
};

/* Parse @<flags...> key,value pairs */
Twitch.ParseFlags = function _Twitch_ParseFlags(dataString) {
  /* @key=value;key=value;... */
  let dataStr = dataString.replace(/^@/, "");
  let data = {};
  for (let item of dataStr.split(';')) {
    let key = item;
    let val = "";
    if (item.indexOf('=') !== -1) {
      [key, val] = item.split('=');
    }
    val = Twitch.ParseFlag(key, val);
    data[key] = val;
  }
  return data;
};

/* Parse an emote specification flag */
Twitch.ParseEmote = function _Twitch_ParseEmote(value) {
  let result = [];
  for (let emote_def of value.split('/')) {
    let sep_pos = emote_def.indexOf(':');
    let emote_id = Number.parseInt(emote_def.substr(0, sep_pos));
    for (let range of emote_def.substr(sep_pos+1).split(',')) {
      let [start, end] = range.split('-');
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
  return specs.join('/');
};

/* Convert an emote name to a regex */
Twitch.EmoteToRegex = function _Twitch_EmoteToRegex(emote) {
  /* NOTE: Emotes from Twitch are already regexes; dont escape them */
  return new RegExp("(?:\\b|[\\s]|^)(" + emote + ")(?:\\b|[\\s]|$)", "g");
};

/* Generate a regex from a cheer prefix */
Twitch.CheerToRegex = function _Twitch_CheerToRegex(prefix) {
  let p = RegExp.escape(prefix);
  return new RegExp(`(?:\\b[\\s]|^)(${p})([1-9][0-9]*)(?:\\b|[\\s]|$)`, 'ig');
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
  let parts = line.split(' ');
  let data = {};
  if (parts[0].startsWith('@')) {
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
    result.flags = line.substr(line.indexOf(':', 1)+1).split(" ");
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
    result.message = parts.slice(3).join(' ').replace(/^:/, "");
  } else if (parts[1] === "353") {
    /* NAMES listing entry */
    /* :<user> 353 <username> <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = Twitch.ParseUser(parts[0].replace(/^:/, ""));
    result.mode = parts[3];
    result.channel = Twitch.ParseChannel(parts[4]);
    result.usernames = parts.slice(5).join(' ').replace(/^:/, "").split(' ');
  } else if (parts[1] === "JOIN" || parts[1] === "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] === "MODE") {
    /* ":<sender> MODE <channel> <modeflag> <username>" */
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
    if (msg.startsWith('\x01ACTION ')) {
      result.flags.action = true;
      result.message = msg.strip('\x01').substr('ACTION '.length);
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
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.message = argFrom(line, ":", parts[2]);
    }
    result.sub_kind = TwitchSubEvent.FromMsgID(result.flags["msg-id"]);
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
    /* "[@<flags>] :server GLOBALUSERSTATE\r\n" */
    result.cmd = "GLOBALUSERSTATE";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
  } else if (parts[1] === "CLEARCHAT") {
    /* "[@<flags>] :<server> CLEARCHAT <channel>[ :<user>]\r\n" */
    result.cmd = "CLEARCHAT";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = null;
    if (line.indexOf(':', line.indexOf(parts[2])) > -1) {
      result.user = argFrom(line, ":", parts[2]);
    }
  } else if (parts[1] === "CLEARMSG") {
    /* "[@<flags>] :<server> CLEARMSG <channel> :<message>\r\n" */
    result.cmd = "CLEARMSG";
    result.flags = data;
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "HOSTTARGET") {
    /* ":<server> HOSTTARGET <channel> :<user> -\r\n" */
    result.cmd = "HOSTTARGET";
    result.server = parts[0];
    result.channel = Twitch.ParseChannel(parts[2]);
    result.user = parts[3].replace(/^:/, "");
  } else if (parts[1] === "NOTICE") {
    /* "[@<flags>] :<server> NOTICE <channel> :<message>\r\n" */
    result.cmd = "NOTICE";
    result.flags = data; /* not always present */
    result.server = parts[0].replace(/^:/, "");
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = argFrom(line, ":", parts[2]);
  } else if (parts[1] === "421") { /* Error */
    /* ":<server> 421 <user> <command> :<message>\r\n" */
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
    ['oauth:', /oauth:[\w]+/g],
    ['OAuth ', /OAuth [\w]+/g]
  ];
  let result = msg;
  for (let [name, pat] of pats) {
    if (result.search(pat)) {
      result = result.replace(pat, `${name}<removed>`);
    }
  }
  return result;
};

