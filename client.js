"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 *  OnWebsocketMessage:
 *    Use Twitch.IRC.Parse over Twitch.ParseIRCMessage. Requires significant
 *    rewrite of OnWebsocketMessage and of bound event handlers in drivers.
 *  OnWebsocketError:
 *    error seems to be lost somewhere
 */

/* TODO:
 *  Fix the following:
 *    Join specific room (JoinChannel only looks at channel.channel)
 *  Implement the following features:
 *    Clip information
 *      https://api.twitch.tv/kraken/clips/<string>
 *    USERNOTICEs:
 *      submysterygift
 *      giftpaidupgrade
 *      rewardgift
 *      anongiftpaidupgrade
 *      raid
 *        msg-param-viewerCount (raid size)
 *        msg-param-displayName (raider's name)
 *        msg-param-login (raider's login)
 *      unraid
 *      ritual
 *      bitsbadgetier
 *  Implement the following commands:
 *    RECONNECT
 */

/* Event classes {{{0 */

/* Base Event object for Twitch events */
class TwitchEvent {
  constructor(type, raw_line, parsed) {
    this._cmd = type;
    this._raw = !!raw_line ? raw_line : "";
    this._parsed = !!parsed ? parsed : {};
    if (!TwitchEvent.COMMANDS.hasOwnProperty(this._cmd)) {
      Util.Error(`Command ${this._cmd} not enumerated in this.COMMANDS`);
    }
  }
  static get COMMANDS() {
    return {
      CHAT: "CHAT",
      PING: "PING",
      ACK: "ACK",
      TOPIC: "TOPIC",
      NAMES: "NAMES",
      JOIN: "JOIN",
      PART: "PART",
      MODE: "MODE",
      PRIVMSG: "PRIVMSG",
      WHISPER: "WHISPER",
      USERSTATE: "USERSTATE",
      ROOMSTATE: "ROOMSTATE",
      STREAMINFO: "STREAMINFO",
      USERNOTICE: "USERNOTICE",
      GLOBALUSERSTATE: "GLOBALUSERSTATE",
      CLEARCHAT: "CLEARCHAT",
      HOSTTARGET: "HOSTTARGET",
      NOTICE: "NOTICE",
      SUB: "SUB",
      RESUB: "RESUB",
      GIFTSUB: "GIFTSUB",
      ANONGIFTSUB: "ANONGIFTSUB",
      OPEN: "OPEN",
      CLOSE: "CLOSE",
      MESSAGE: "MESSAGE",
      ERROR: "ERROR",
      OTHER: "OTHER"
    };
  }
  get type() { return "twitch-" + this._cmd.toLowerCase(); }
  get command() { return this._cmd; }
  get raw_line() { return this._raw; }
  get values() { return this._parsed; }
  has_value(key) { return this._parsed.hasOwnProperty(key); }
  value(key) { return this._parsed[key]; }

  /* Event-specific methods */
  get channel() { return this._parsed.channel; }
  get message() { return this._parsed.message; }
  get user() { return this._parsed.user; }
  get name() { return this._parsed.flags["display-name"]; }
  get flags() { return this._parsed.flags; }
  flag(flag) {
    if (!!this._parsed.flags) {
      return this._parsed.flags[flag];
    }
    return undefined;
  }

  /* Extra attributes */
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
    return this.has_badge("broadcaster");
  }
  get ismod() {
    return this._parsed.flags.mod || this.has_badge("moderator") || this.iscaster;
  }
  get issub() {
    return this._parsed.flags.subscriber || this.has_badge("subscriber");
  }
  get isvip() {
    return this.has_badge("vip");
  }
  has_badge(badge, rev=undefined) {
    if (!this.flags.badges)
      return false;
    for (let [badge_name, badge_rev] of this.flags.badges) {
      if (badge_name == badge) {
        if (rev !== undefined) {
          return badge_rev == rev;
        } else {
          return true;
        }
      }
    }
    return false;
  }

  /* Extra attributes */
  repr() {
    /* Return a value similar to Object.toSource() */
    let cls = Object.getPrototypeOf(this).constructor.name;
    let args = [
      this._raw.repr(),
      JSON.stringify(this._parsed)
    ].join(",");
    return `new ${cls}(${args})`;
  }
}

/* End of event classes section 0}}} */

/* TwitchClient constructor definition */
function TwitchClient(opts) {
  let cfg_name = opts.Name;
  let cfg_clientid = opts.ClientID;
  let cfg_pass = opts.Pass;

  /* Core variables */
  this._ws = null;
  this._is_open = false;
  this._connected = false;
  this._username = null;
  this._debug = opts.Debug || 0;
  /* Channels/rooms presently connected to */
  this._channels = [];
  /* Channels/rooms about to be connected to */
  this._pending_channels = opts.Channels || [];
  /* Room information {"#ch": {...}} */
  this._rooms = {};
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
  this._enable_ffz = !opts.NoFFZ;
  this._enable_bttv = !opts.NoBTTV;

  /* Whether or not we were given a clientid */
  this._has_clientid = !!cfg_clientid && cfg_clientid.length > 0;

  /* Don't load assets (for small testing) */
  this._no_assets = !!opts.NoAssets;

  /* Badge, emote, cheermote definitions */
  this._channel_badges = {};
  this._global_badges = {};
  this._channel_cheers = {};

  /* Extension emotes */
  this._ffz_channel_emotes = {};
  this._ffz_badges = {};
  this._ffz_badge_users = {};
  this._bttv_badges = {}; /* If BTTV adds badges */
  this._bttv_channel_emotes = {};

  /* Let the client be used as an arbitrary key-value store */
  this._kv = {};
  this.get = function _Client_get(k) { return this._kv[k]; }
  this.set = function _Client_set(k, v) { this._kv[k] = v; }
  this.has = function _Client_has(k) { return this._kv.hasOwnProperty(k); }

  /* Handle authentication and password management */
  this._authed = !!cfg_pass;
  let oauth, oauth_header;
  if (this._authed) {
    if (cfg_pass.indexOf("oauth:") != 0) {
      oauth = `oauth:${cfg_pass}`;
      oauth_header = `OAuth ${cfg_pass}`;
    } else {
      oauth = cfg_pass;
      oauth_header = cfg_pass.replace(/^oauth:/, 'OAuth ');
    }
  }

  /* Construct the Twitch API object */
  let pub_headers = {};
  let priv_headers = {}
  if (this._has_clientid) { pub_headers["Client-Id"] = cfg_clientid; }
  if (this._authed) { priv_headers["Authorization"] = oauth_header; }
  this._api = new Twitch.API(pub_headers, priv_headers);

  /* TwitchClient.Connect() */
  this.Connect = (function _TwitchClient_Connect() {
    if (this._ws !== null) {
      this._ws.close();
    }

    for (let c of this._channels) {
      this._pending_channels.push(c);
    }
    this._channels = [];
    this._rooms = {};
    this._capabilities = [];
    this._username = null;
    this._is_open = false;
    this._connected = false;

    let self = this;

    this._ws = new WebSocket("wss://irc-ws.chat.twitch.tv");
    this._ws.client = this;
    this._ws.onopen = (function _ws_onopen(e) {
      try {
        Util.LogOnly("ws open>", this.url);
        self._connected = false;
        self._is_open = true;
        self.OnWebsocketOpen(cfg_name, oauth);
      } catch (e) {
        alert("ws._onopen error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this._ws.onmessage = (function _ws_onmessage(e) {
      try {
        Util.DebugOnly('ws recv>', Twitch.StripCredentials(e.data.repr()));
        self.OnWebsocketMessage(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString() + "\n" + e.stack);
        throw e;
      }
    }).bind(this._ws);
    this._ws.onerror = (function _ws_onerror(e) {
      try {
        Util.DebugOnly('ws error>', e);
        self._connected = false;
        self.OnWebsocketError(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this._ws.onclose = (function _ws_onclose(e) {
      try {
        Util.DebugOnly('ws close>', e);
        self._connected = false;
        self._is_open = false;
        self.OnWebsocketClose(e);
      } catch (e) {
        alert("ws._onmessage error: " + e.toString());
        throw e;
      }
    }).bind(this._ws);
    this.send = (function _TwitchClient_send(m) {
      try {
        this._ws.send(m);
        Util.DebugOnly('ws send>', Twitch.StripCredentials(m).repr());
      } catch (e) {
        alert("this.send error: " + e.toString());
        throw e;
      }
    }).bind(this);

    Util.LogOnly("Connecting to Twitch...");
  }).bind(this);

  Util.LogOnly("Client constructed and ready for action");
}

/* Statics */
TwitchClient.DEFAULT_HISTORY_SIZE = 300;
TwitchClient.DEFAULT_MAX_MESSAGES = 100;

/* Debugging section {{{0 */

/* debug(args...): output everything given to the console as a debugging
 * message, if config.Debug was set to true */
TwitchClient.prototype.debug =
function _TwitchClient_debug() {
  if (this._debug) {
    Util.LogOnly.apply(Util.LogOnly, arguments);
  }
}

/* Obtain the current client debug level (*not* logger debug level) */
TwitchClient.prototype.GetDebug =
function _TwitchClient_GetDebug() {
  return this._debug;
}

/* Update both client and logger debug level */
TwitchClient.prototype.SetDebug =
function _TwitchClient_SetDebug(val) {
  if (val === false || val === 0) this._debug = 0;
  else if (val === true || val === 1) this._debug = 1;
  else if (val === 2) this._debug = 2;
  else if (!!val) {
    this._debug = 1;
  } else {
    this._debug = 0;
  }
  Util.DebugLevel = this._debug;
}

/* End debugging section 0}}} */

/* Event handling {{{0 */

/* Bind a function to the event specified (wraps document.addEventListener) */
TwitchClient.prototype.bind =
function _TwitchClient_bind(event, callback) {
  Util.Bind(event, callback);
}

/* Unbind a function from the TwitchChat event specified */
TwitchClient.prototype.unbind =
function _TwitchClient_unbind(event, callback) {
  Util.Unbind(event, callback);
}

/* End event handling 0}}} */

/* Private functions section {{{0 */

/* Return the value of _self_userstate for the given channel and attribute */
TwitchClient.prototype._selfUserState =
function _TwitchClient__selfUserState(channel, value) {
  let ch = Twitch.FormatChannel(channel);
  if (this._self_userstate) {
    if (this._self_userstate[ch]) {
      return this._self_userstate[ch][value];
    }
  }
  return null;
}

/* Private: Ensure the user specified is in reduced form */
TwitchClient.prototype._ensureUser =
function _TwitchClient__ensureUser(user) {
  if (user.indexOf('!') > -1) {
    return Twitch.ParseUser(user);
  } else {
    return user;
  }
}

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureChannel =
function _TwitchClient__ensureChannel(channel) {
  if (typeof(channel) == "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
}

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureRoom =
function _TwitchClient__ensureRoom(channel) {
  channel = this._ensureChannel(channel);
  let cname = channel.channel;
  if (!(cname in this._rooms)) {
    this._rooms[cname] = {
      users: [],        /* Joined users */
      userInfo: {},     /* Joined users' info */
      operators: [],    /* Operators */
      channel: channel, /* Channel object */
      rooms: {},        /* Known rooms */
      id: null,         /* Channel ID */
      online: false,    /* Currently streaming */
      stream: {},       /* Stream status */
      streams: []       /* Stream statuses */
    }
  }
}

/* Private: Called when a user joins a channel */
TwitchClient.prototype._onJoin =
function _TwitchClient__onJoin(channel, user) {
  user = this._ensureUser(user);
  channel = this._ensureChannel(channel);
  this._ensureRoom(channel);
  if (!this._rooms[channel.channel].users.includes(user)) {
    if (channel.room && channel.roomuid) {
      /* User joined a channel room */
      this._rooms[channel.channel].users.push(user);
    } else {
      /* User joined a channel's main room */
      this._rooms[channel.channel].users.push(user);
    }
  }
  if (!this._rooms[channel.channel].userInfo.hasOwnProperty(user)) {
    this._rooms[channel.channel].userInfo[user] = {};
  }
}

/* Private: Called when a user parts a channel */
TwitchClient.prototype._onPart =
function _TwitchClient__onPart(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  if (this._rooms[cname].users.includes(user)) {
    let idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users.splice(idx, 1);
  }
}

/* Private: Called when the client receives a MODE +o event */
TwitchClient.prototype._onOp =
function _TwitchClient__onOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  if (!this._rooms[cname].operators.includes(user)) {
    this._rooms[cname].operators.push(user);
  }
}

/* Private: Called when the client receives a MODE -o event */
TwitchClient.prototype._onDeOp =
function _TwitchClient__onDeOp(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  let cname = channel.channel;
  let idx = this._rooms[cname].operators.indexOf(user);
  if (idx > -1) {
    this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
  }
}

/* Private: Load in the extra chatrooms a streamer may or may not have */
TwitchClient.prototype._getRooms =
function _TwitchClient__getRooms(cname, cid) {
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.Rooms(cid), (function _rooms_cb(json) {
    for (let room_def of json["rooms"]) {
      if (this._rooms[cname].rooms === undefined)
        this._rooms[cname].rooms = {};
      this._rooms[cname].rooms[room_def["name"]] = room_def;
    }
  }).bind(this), {}, true);
}

/* Private: Load in the channel badges for a given channel name and ID */
TwitchClient.prototype._getChannelBadges =
function _TwitchClient__getChannelBadges(cname, cid) {
  this._channel_badges[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get badges; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Badges(cid), (function _badges_cb(json) {
    for (let badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
}

/* Private: Load in the channel cheermotes for a given channel name and ID */
TwitchClient.prototype._getChannelCheers =
function _TwitchClient__getChannelCheers(cname, cid) {
  this._channel_cheers[cname] = {};
  if (!this._has_clientid) {
    Util.Warn("Unable to get channel cheers; no clientid");
    return;
  }
  this._api.GetCB(Twitch.URL.Cheers(cid), (function _cheers_cb(json) {
    for (let cdef of json.actions) {
      /* Simplify things later by adding the regexps here */
      cdef.word_pattern = new RegExp('^(' + RegExp.escape(cdef.prefix) + ')([1-9][0-9]*)$', 'i');
      cdef.line_pattern = new RegExp('(?:\\b[\\s]|^)(' + RegExp.escape(cdef.prefix) + ')([1-9][0-9]*)(?:\\b|[\\s]|$)', 'ig')
      cdef.split_pattern = new RegExp('(?:\\b[\\s]|^)(' + RegExp.escape(cdef.prefix) + '[1-9][0-9]*)(?:\\b|[\\s]|$)', 'ig')
      this._channel_cheers[cname][cdef.prefix] = cdef;
    }
  }).bind(this), {}, false);
}

/* Private: Load in the global and per-channel FFZ emotes */
TwitchClient.prototype._getFFZEmotes =
function _TwitchClient__getFFZEmotes(cname, cid) {
  this._ffz_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.FFZEmotes(cid), (function _ffz_emotes_cb(json) {
    let ffz = this._ffz_channel_emotes[cname];
    ffz.id = json.room._id;
    ffz.set_id = json.room.set;
    ffz.css = json.room.css;
    ffz.display_name = json.room.display_name;
    ffz.user_name = json.room.id;
    ffz.is_group = json.room.is_group;
    ffz.mod_urls = {};
    if (json.room.mod_urls) {
      for (let [k, v] of Object.entries(json.room.mod_urls)) {
        if (!!v) {
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
      for (let [k, v] of Object.entries(set_def.emoticons)) {
        if (v.hidden) continue;
        ffz.emotes[v.name] = v;
        for (let [size, url] of Object.entries(v.urls)) {
          ffz.emotes[v.name].urls[size] = Util.URL(url);
        }
      }
    }
  }).bind(this), (function _ffze_onerror(resp) {
    if (resp.status == 404) {
      Util.Log(`Channel ${cname}:${cid} has no FFZ emotes`);
    }
  }));
}

/* Private: Load in the global and per-channel BTTV emotes */
TwitchClient.prototype._getBTTVEmotes =
function _TwitchClient__getBTTVEmotes(cname, cid) {
  this._bttv_channel_emotes[cname] = {};
  this._api.GetSimpleCB(Twitch.URL.BTTVEmotes(cname.lstrip('#')),
                        (function _bttv_emotes_cb(json) {
    let bttv = this._bttv_channel_emotes[cname];
    bttv.emotes = {};
    for (let emote of json.emotes) {
      bttv.emotes[emote.code] = {
        'id': emote.id,
        'code': emote.code,
        'channel': emote.channel,
        'image-type': emote.imageType,
        'url': Util.URL(json.urlTemplate.replace('{{id}}', emote.id)
                                        .replace('{{image}}', '1x'))
      };
    }
  }).bind(this), (function _bttve_onerror(resp) {
    if (resp.status == 404) {
      Util.Log(`Channel ${cname}:${cid} has no BTTV emotes`);
    }
  }));
}

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges =
function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  if (this._no_assets) return;
  this._api.GetCB(Twitch.URL.AllBadges(), (function _badges_cb(json) {
    for (let badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
  if (this._enable_ffz) {
    this._api.GetSimpleCB(Twitch.URL.FFZBadgeUsers(), (function _ffz_bades_cb(resp) {
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
TwitchClient.prototype._build_privmsg =
function _TwitchClient__build_privmsg(chobj, message) {
  /* Construct the parsed flags object */
  let flag_obj = {};
  let emote_obj = Twitch.ScanEmotes(message, Object.entries(this._self_emotes));
  let chstr = Twitch.FormatChannel(chobj);
  flag_obj["badges"] = this._self_userstate[chstr]["badges"];
  if (!flag_obj["badges"]) {
    flag_obj["badges"] = [];
  }
  flag_obj["color"] = this._self_userstate[chstr]["color"];
  flag_obj["subscriber"] = this._self_userstate[chstr]["subscriber"];
  flag_obj["mod"] = this._self_userstate[chstr]["mod"];
  flag_obj["vip"] = this._self_userstate[chstr]["vip"] || null;
  flag_obj["broadcaster"] = this._self_userstate[chstr]["broadcaster"] || null;
  flag_obj["display-name"] = this._self_userstate[chstr]["display-name"];
  flag_obj["emotes"] = emote_obj;
  flag_obj["id"] = Util.Random.uuid();
  flag_obj["user-id"] = this._self_userid;
  flag_obj["room-id"] = this._rooms[chobj.channel].id;
  flag_obj["tmi-sent-ts"] = (new Date()).getTime();
  flag_obj["turbo"] = 0;
  flag_obj["user-type"] = "";

  /* Construct the formatted flags string */
  let flag_str = "@";
  flag_str += "badges=";
  if (flag_obj["badges"]) {
    let badges = []
    for (let [b, r] of flag_obj["badges"]) {
      badges.push(`${b}/${r}`);
    }
    flag_str += badges.join(",");
  }
  flag_str += `;color=${flag_obj["color"]}`;
  flag_str += `;display-name=${flag_obj["display-name"]}`;
  flag_str += `;subscriber=${flag_obj["subscriber"]}`;
  flag_str += `;mod=${flag_obj["mod"]}`;
  /* Only populate vip and broadcaster attributes if set */
  if (flag_obj["vip"]) {
    flag_str += `;vip=${flag_obj["vip"]}`;
  }
  if (flag_obj["broadcaster"]) {
    flag_str += `;broadcaster=${flag_obj["broadcaster"]}`;
  }
  flag_str += `;emotes=${Twitch.FormatEmoteFlag(flag_obj["emotes"])}`;
  flag_str += `;id=${flag_obj["id"]}`;
  flag_str += `;user-id=${flag_obj["user-id"]}`;
  flag_str += `;room-id=${flag_obj["room-id"]}`;
  flag_str += `;tmi-sent-ts=${flag_obj["tmi-sent-ts"]}`;
  flag_str += `;turbo=${flag_obj["turbo"]}`;
  flag_str += `;user-type=${flag_obj["user-type"]}`;

  /* Build the raw and parsed objects */
  let user = this._self_userstate[chstr]["display-name"].toLowerCase();
  let useruri = `:${user}!${user}@${user}.tmi.twitch.tv`;
  let channel = Twitch.FormatChannel(chobj);

  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  let raw_line = `${flag_str} ${useruri} PRIVMSG ${channel} :`;
  if (message.startsWith('/me ')) {
    raw_line += '\x01ACTION ' + message + '\x01';
    message = message.substr('/me '.length);
    flag_obj.action = true;
  } else {
    raw_line += message;
  }

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, ({
    cmd: "PRIVMSG",
    flags: flag_obj,
    user: Twitch.ParseUser(useruri),
    channel: chobj,
    message: message,
    synthesized: true /* mark the object as synthesized */
  }));
}

/* End private functions section 0}}} */

/* Role and moderation functions {{{0 */

/* Return whether or not the client is authenticated with an AuthID */
TwitchClient.prototype.IsAuthed =
function _TwitchClient_IsAuthed() {
  return this._authed;
}

/* Return true if the client is a subscriber in the channel given */
TwitchClient.prototype.IsSub =
function _TwitchClient_IsSub(channel) {
  return this._selfUserState(channel, "sub");
}

/* Return true if the client is a VIP in the channel given */
TwitchClient.prototype.IsVIP =
function _TwitchClient_IsVIP(channel) {
  return this._selfUserState(channel, "vip");
}

/* Return true if the client is a moderator in the channel given */
TwitchClient.prototype.IsMod =
function _TwitchClient_IsMod(channel) {
  return this._selfUserState(channel, "mod");
}

/* Return true if the client is the broadcaster for the channel given */
TwitchClient.prototype.IsCaster =
function _TwitchClient_IsCaster(channel) {
  return this._selfUserState(channel, "broadcaster");
}

/* Timeout the specific user in the specified channel */
TwitchClient.prototype.Timeout =
function _TwitchClient_Timeout(channel, user, duration="600s", reason=null) {
  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = `Timed out by ${this._username} from ${channel.channel} for ${duration}`;
  }
  this.SendMessage(channel, `/timeout ${user} ${duration} "${reason}"`);
}

/* Un-timeout the specific user in the specified channel */
TwitchClient.prototype.UnTimeout =
function _TwitchClient_UnTimeout(channel, user) {
  this.SendMessage(channel, `/untimeout ${user}`);
}

/* Ban the specific user from the specified channel */
TwitchClient.prototype.Ban =
function _TwitchClient_Ban(channel, user, reason=null) {
  channel = this._ensureChannel(channel);
  if (!reason) {
    reason = `Banned from ${channel.channel} by ${this._username}`;
  }
  this.SendMessage(channel, `/ban ${user} ${reason}`);
}

/* Unban the specific user from the specified channel */
TwitchClient.prototype.UnBan =
function _TwitchClient_UnBan(channel, user) {
  this.SendMessage(channel, `/unban ${user}`);
}

/* End of role and moderation functions 0}}} */

/* Channel functions {{{0 */

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel =
function _TwitchClient_JoinChannel(channel) {
  channel = this._ensureChannel(channel);
  let ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) == -1) {
      this.send(`JOIN ${ch}`);
      this._channels.push(ch);
    } else {
      Util.Warn(`JoinChannel: Already in ${ch}`);
    }
  } else if (this._pending_channels.indexOf(ch) == -1) {
    this._pending_channels.push(ch);
  }
}

/* Request the client to leave the channel specified */
TwitchClient.prototype.LeaveChannel =
function _TwitchClient_LeaveChannel(channel) {
  channel = this._ensureChannel(channel);
  let ch = channel.channel;
  if (this._is_open) {
    let idx = this._channels.indexOf(ch);
    if (idx > -1) {
      this.send(`PART ${ch}`);
      this._channels.splice(idx, 1);
      delete this._rooms[ch]; /* harmless if fails */
    } else {
      Util.Warn(`LeaveChannel: Not in channel ${ch}`);
    }
  }
}

/* Return whether or not the client is in the channel specified */
TwitchClient.prototype.IsInChannel =
function _TwitchClient_IsInChannel(channel) {
  channel = this._ensureChannel(channel);
  let ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) > -1) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels =
function _TwitchClient_GetJoinedChannels() {
  return this._channels;
}

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo =
function _TwitchClient_GetChannelInfo(channel) {
  return this._rooms[channel] || {};
}

/* End channel functions 0}}} */

/* Functions related to cheers and emotes {{{0 */

/* Return whether or not the given word is a cheer for the given channel */
TwitchClient.prototype.IsCheer =
function _TwitchClient_IsCheer(cname, word) {
  if (this._channel_cheers.hasOwnProperty(cname)) {
    for (let name of Object.keys(this._channel_cheers[cname])) {
      if (word.match(this._channel_cheers[cname][name].word_pattern)) {
        return true;
      }
    }
  }
  return false;
}

/* Return all of the cheers found in the message */
TwitchClient.prototype.FindCheers =
function _TwitchClient_FindCheers(cname, message) {
  let matches = [];
  let parts = message.split(" ");
  let offset = 0;
  if (this._channel_cheers.hasOwnProperty(cname)) {
    for (let [name, cheer] of Object.entries(this._channel_cheers[cname])) {
      if (message.search(cheer.line_pattern) > -1) {
        for (let token of parts) {
          let m = token.match(cheer.word_pattern);
          if (m) {
            let num_bits = Number.parseInt(m[2]);
            matches.push({
              cheer: cheer,
              name: m[1],
              bits: num_bits,
              start: offset,
              end: offset + token.length
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
TwitchClient.prototype.GetCheer =
function _TwitchClient_GetCheer(cname, name) {
  let cheer = null
  if (this._channel_cheers.hasOwnProperty(cname)) {
    if (this._channel_cheers[cname].hasOwnProperty(name)) {
      cheer = this._channel_cheers[cname][name];
    }
  }
  return cheer;
}

/* Return the URL to the image for the emote specified */
TwitchClient.prototype.GetEmote =
function _TwitchClient_GetEmote(emote_id) {
  return Twitch.URL.Emote(emote_id, '1.0');
}

/* Obtain the FFZ emotes for a channel */
TwitchClient.prototype.GetFFZEmotes =
function _TwitchClient_GetFFZEmotes(channel) {
  return this._ffz_channel_emotes[Twitch.FormatChannel(channel)];
}

/* Obtain the BTTV emotes for a channel */
TwitchClient.prototype.GetBTTVEmotes =
function _TwitchClient_GetBTTVEmotes(channel) {
  return this._bttv_channel_emotes[Twitch.FormatChannel(channel)];
}

/* End of functions related to cheers and emotes 0}}} */

/* Return true if the client has been granted the capability specified. Values
 * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
 * following: twitch.tv/tags twitch.tv/commands twitch.tv/membership
 */
TwitchClient.prototype.HasCapability =
function _TwitchClient_HasCapability(test_cap) {
  for (let cap of this._capabilities) {
    if (test_cap == cap || cap.endsWith('/' + test_cap.lstrip('/'))) {
      return true;
    }
  }
  return false;
}

/* Get the client's current username */
TwitchClient.prototype.GetName =
function _TwitchClient_GetName() {
  return this._username;
}

/* Return whether or not the numeric user ID refers to the client itself */
TwitchClient.prototype.IsUIDSelf =
function _TwitchClient_IsUIDSelf(userid) {
  return userid == this._self_userid;
}

/* Functions for sending messages {{{0 */

/* Send a message to the channel specified */
TwitchClient.prototype.SendMessage =
function _TwitchClient_SendMessage(channel, message, bypassFaux=false) {
  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected && this._authed) {
    this.send(`PRIVMSG ${channel.channel} :${message}`);
    /* Dispatch a faux "Message Received" event */
    if (!bypassFaux) {
      if (this._self_userstate[Twitch.FormatChannel(channel)]) {
        Util.FireEvent(this._build_privmsg(channel, message));
      } else {
        Util.Error(`No USERSTATE given for channel ${channel}`);
      }
    }
  } else {
    let chname = Twitch.FormatChannel(channel);
    Util.Warn(`Unable to send "${message}" to ${chname}: not connected or not authed`);
  }
}

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll =
function _TwitchClient_SendMessageToAll(message) {
  if (this._connected) {
    for (let ch of this._channels) {
      this.SendMessage(ch, message);
    }
  } else {
    Util.Warn(`Unable to send "${message}" to all channels: not connected`);
  }
}

/* Send text to the Twitch servers, bypassing any special logic */
TwitchClient.prototype.SendRaw =
function _TwitchClient_SendRaw(raw_msg) {
  this.send(raw_msg.trimEnd() + "\r\n");
}

/* End of functions for sending messages 0}}} */

/* History functions {{{0 */

/* Add a message to the history of sent messages */
TwitchClient.prototype.AddHistory =
function _TwitchClient_AddHistory(message) {
  this._history.unshift(message);
  if (this._history.length > this._hist_max) {
    this._history.pop();
  }
}

/* Obtain the history of sent messages */
TwitchClient.prototype.GetHistory =
function _TwitchClient_GetHistort() {
  /* Make a copy to prevent unexpected modification */
  return this._history.map((x) => x);
}

/* Obtain the nth most recently sent message */
TwitchClient.prototype.GetHistoryItem =
function _TwitchClient_GetHistoryItem(n) {
  if (n >= 0 && n < this._history.length) {
    return this._history[n];
  }
  return null;
}

/* Obtain the maximum number of history items */
TwitchClient.prototype.GetHistoryMax =
function _TwitchClient_GetHistoryMax() {
  return this._hist_max;
}

/* Obtain the current number of history items */
TwitchClient.prototype.GetHistoryLength =
function _TwitchClient_GetHistoryLength() {
  return this._history.length;
}

/* End of history functions 0}}} */

/* Badge handling functions {{{0 */

/* Get an object containing all of the known badges */
TwitchClient.prototype.GetAllBadges =
function _TwitchClient_GetAllBadges() {
  let result = {global: {}};
  for (let cname of Object.keys(this._channel_badges)) {
    result[cname] = {};
    for (let [name, val] of Object.entries(this._channel_badges[cname])) {
      result[cname][name] = val;
    }
  }
  for (let name of Object.keys(this._global_badges)) {
    result.global[name] = this._global_badges[name];
  }
  return result;
}

/* Return true if the badge specified is a global badge */
TwitchClient.prototype.IsGlobalBadge =
function _TwitchClient_IsGlobalBadge(badge_name, badge_version=null) {
  if (badge_name in this._global_badges) {
    if (badge_version === null) {
      return Object.keys(this._global_badges[badge_name].versions).length > 0;
    } else if (badge_version in this._global_badges[badge_name].versions) {
      if (!!this._global_badges[badge_name].versions[badge_version]) {
        return true;
      }
    }
  }
  return false;
}

/* Return true if the badge specified exists as a channel badge */
TwitchClient.prototype.IsChannelBadge =
function _TwitchClient_IsChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  if (channel.channel in this._channel_badges) {
    if (badge_name in this._channel_badges[channel.channel]) {
      if (!!this._channel_badges[channel.channel][badge_name]) {
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
TwitchClient.prototype.GetGlobalBadge =
function _TwitchClient_GetGlobalBadge(badge_name, badge_version=null) {
  if (this._global_badges.hasOwnProperty(badge_name)) {
    if (badge_version === null) {
      badge_version = Object.keys(this._global_badges[badge_name].versions).min();
    }
    if (this._global_badges[badge_name].versions.hasOwnProperty(badge_version)) {
      return this._global_badges[badge_name].versions[badge_version];
    }
  }
  return {};
}

/* Returns Object {
 *   alpha: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   image: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   svg: "https://static-cdn.jtvnw.net/chat-badges/<badge>.svg"
 * } */
TwitchClient.prototype.GetChannelBadge =
function _TwitchClient_GetChannelBadge(channel, badge_name) {
  channel = this._ensureChannel(channel);
  return this._channel_badges[channel.channel][badge_name];
}

/* Obtain all of the global badges */
TwitchClient.prototype.GetGlobalBadges =
function _TwitchClient_GetGlobalBadges() {
  return new Object(this._global_badges);
}

/* Obtain all of the channel badges for the specified channel */
TwitchClient.prototype.GetChannelBadges =
function _TwitchClient_GetChannelBadges(channel) {
  channel = this._ensureChannel(channel);
  if (this._channel_badges.hasOwnProperty(channel.channel)) {
    return new Object(this._channel_badges[channel.channel]);
  }
  return {};
}

/* End of badge handling functions 0}}} */

/* Websocket callbacks {{{0 */

/* Callback: called when the websocket opens */
TwitchClient.prototype.OnWebsocketOpen =
function _TwitchClient_OnWebsocketOpen(name, pass) {
  this.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  if (name && pass) {
    this._username = name;
  } else {
    this._username = `justinfan${Math.floor(Math.random() * 999999)}`;
  }
  if (!!pass) {
    this.send(`PASS ${pass.indexOf("oauth:") == 0 ? "" : "oauth:"}${pass}`);
    this.send(`NICK ${name}`);
  } else {
    this.send(`NICK ${this._username}`);
  }
  for (let i of this._pending_channels) {
    this.JoinChannel(i);
  }
  this._pending_channels = [];
  this._getGlobalBadges();
  Util.FireEvent(new TwitchEvent("OPEN", null, {"has-clientid": this._has_clientid}));
}

/* Callback: called when the websocket receives a message */
TwitchClient.prototype.OnWebsocketMessage =
function _TwitchClient_OnWebsocketMessage(ws_event) {
  let lines = ws_event.data.split("\r\n");
  for (let line of lines) {
    /* Ignore empty lines */
    if (line.trim() == '') {
      continue;
    }

    /* Parse the message (TODO: Use Twitch.IRC.Parse()) */
    let result = Twitch.ParseIRCMessage(line);
    Util.Trace('result1:', result);
    try {
      let result2 = Twitch.IRC.Parse(line);
      Util.Trace('result2:', result2);
    } catch (e) {
      Util.Error(e);
    }

    /* Fire twitch-message for every line received */
    Util.FireEvent(new TwitchEvent("MESSAGE", line, result));

    /* Make sure the room is tracked */
    if (result.channel && result.channel.channel) {
      this._ensureRoom(result.channel);
    }

    /* Don't handle messages with NULL commands */
    if (!result.cmd) {
      Util.Error('result.cmd is NULL for', result, line);
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
        this._onJoin(result.channel, result.user);
        break;
      case "PART":
        this._onPart(result.channel, result.user);
        break;
      case "MODE":
        if (result.modeflag == "+o") {
          this._onOp(result.channel, result.user);
        } else if (result.modeflag == "-o") {
          this._onDeOp(result.channel, result.user);
        }
        break;
      case "PRIVMSG":
        let event = new TwitchChatEvent(line, result);
        if (!room.userInfo.hasOwnProperty(result.user)) {
          room.userInfo[result.user] = {};
        }
        if (!event.flags.badges) event.flags.badges = [];
        if (this._enable_ffz) {
          for (let [badge_nr, users] of Object.entries(this._ffz_badge_users)) {
            if (users.indexOf(result.user) > -1) {
              let ffz_badges = event.flags['ffz-badges'];
              if (ffz_badges === undefined) ffz_badges = [];
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
        break;
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
        this._api.GetCB(Twitch.URL.Stream(result.flags['room-id']),
                        (function _stream_cb(resp) {
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
        }).bind(this));
        break;
      case "USERNOTICE":
        if (result.sub_kind == "SUB") {
          Util.FireEvent(new TwitchEvent("SUB", line, result));
        } else if (result.sub_kind == "RESUB") {
          Util.FireEvent(new TwitchEvent("RESUB", line, result));
        } else if (result.sub_kind == "GIFTSUB") {
          Util.FireEvent(new TwitchEvent("GIFTSUB", line, result));
        } else if (result.sub_kind == "ANONGIFTSUB") {
          Util.FireEvent(new TwitchEvent("ANONGIFTSUB", line, result));
        }
        break;
      case "GLOBALUSERSTATE":
        this._self_userid = result.flags['user-id'];
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
        Util.Warn("Unhandled event:", result);
        break;
    }

    /* Obtain emotes the client is able to use */
    if (result.cmd == "USERSTATE" || result.cmd == "GLOBALUSERSTATE") {
      if (result.flags && result.flags["emote-sets"]) {
        this._api.GetCB(
          Twitch.URL.EmoteSet(result.flags["emote-sets"].join(',')),
        (function _emoteset_cb(json) {
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
TwitchClient.prototype.OnWebsocketError =
function _TwitchClient_OnWebsocketError(event) {
  Util.Error(event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
}

/* Callback: called when the websocket is closed */
TwitchClient.prototype.OnWebsocketClose =
function _TwitchClient_OnWebsocketClose(event) {
  for (let chobj of this._channels) {
    if (this._pending_channels.indexOf(chobj) == -1) {
      this._pending_channels.push(chobj);
    }
  }
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  Util.FireEvent(new TwitchEvent("CLOSE", event));
}

/* End websocket callbacks 0}}} */

/* Mark the Twitch Client API as loaded */
TwitchClient.API_Loaded = true;
document.dispatchEvent(new Event("twapi-client-loaded"));

