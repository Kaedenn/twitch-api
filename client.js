"use strict";

/* Collapse all:
 * %g/^\([^ ][^(]*\)\?\(\<Twitch\|class\|function\|let\|let\>\)[^{]\+{$/norm $zf%
 */

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 *  https://www.frankerfacez.com/developers
 */

/* FIXME:
 *  OnWebsocketError:
 *    error seems to be lost somewhere
 */

/* TODO:
 *  Fix the following:
 *    Generate a UUID for the faux PRIVMSG
 *    Join specific room (JoinChannel only looks at channel.channel)
 *  Implement the following features:
 *    Cheermote support (see https://dev.twitch.tv/docs/irc/tags/#privmsg-twitch-tags)
 *      API to format message with emotes (splitting?)
 *    Emote support (see https://dev.twitch.tv/docs/irc/tags/#privmsg-twitch-tags)
 *      API to format message with emotes (splitting?)
 *    Raid messages
 *      msg-param-viewerCount (raid size)
 *      msg-param-displayName (raider's name)
 *      msg-param-login (raider's login)
 *    FFZ & BTTV Support
 *      API to add emotes
 *  Implement the following commands:
 *    HOSTTARGET
 *    RECONNECT
 */

/* Base Event object for Twitch events */
class TwitchEvent extends Event {
  constructor(type, raw_line, parsed) {
    super("twitch-" + type.toLowerCase());
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
      USERSTATE: "USERSTATE",
      ROOMSTATE: "ROOMSTATE",
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
    let args = [
      this._cmd.repr(),
      this._raw.toSource(),
      this._parsed.toSource()
    ].join(",");
    return `new ${cls}(${args})`;
  }
}

/* Event object for chat events */
class TwitchChatEvent extends TwitchEvent {
  constructor(raw_line, parsed) {
    super("CHAT", raw_line, parsed);
    this._id = parsed.flags.id;
  }
  get id() { return this._id; }
  get ismod() { return this._parsed.flags.mod; }
  get issub() { return this._parsed.flags.subscriber; }
  get isvip() { return this.has_badge("vip"); }
  has_badge(badge, rev=undefined) {
    if (!this.flag("badges"))
      return false;
    for (let [badge_name, badge_rev] of this.flag("badges")) {
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
      this._parsed.toSource()
    ].join(",");
    return `new ${cls}(${args})`;
  }
}

/* TwitchClient constructor definition */
function TwitchClient(opts) {
  let cfg_name = opts.Name;
  let cfg_clientid = opts.ClientID;
  let cfg_pass = opts.Pass;

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
  this._ffz_emotes = {};
  this._ffz_channel_emotes = {};
  this._ffz_badges = {};
  this._ffz_badge_users = {};
  this._bttv_emotes = {};
  this._bttv_channel_emotes = {};

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
  this.Connect = function _TwitchClient_Connect() {
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

    /* TRIGGER: To trigger an error, add .bad to the URI */
    this._ws = new WebSocket("wss://irc-ws.chat.twitch.tv");
    this._ws.client = this;
    this._ws._send = this._ws.send;
    this._ws.send = function(m) {
      Util.DebugOnly('ws send>', Twitch.StripCredentials(m).repr());
      this._send(m);
    };
    this._ws.onopen = function(e) {
      Util.DebugOnly('ws open>', e);
      this.client._connected = false;
      this.client._is_open = true;
      this.client.OnWebsocketOpen(cfg_name, oauth);
    };
    this._ws.onmessage = function(e) {
      Util.DebugOnly('ws recv>', Twitch.StripCredentials(e.data.repr()));
      this.client.OnWebsocketMessage(e);
    };
    this._ws.onerror = function(e) {
      Util.DebugOnly('ws error>', e);
      this.client._connected = false;
      this.client.OnWebsocketError(e);
    };
    this._ws.onclose = function(e) {
      Util.DebugOnly('ws close>', e);
      this.client._connected = false;
      this.client._is_open = false;
      this.client.OnWebsocketClose(e);
    };
  }
}

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

/* Bind a function to the TwitchChat event specified */
TwitchClient.prototype.bind =
function _TwitchClient_bind(event, callback) {
  document.addEventListener(event, callback);
}

/* Unbind a function from the TwitchChat event specified */
TwitchClient.prototype.unbind =
function _TwitchClient_unbind(event, callback) {
  document.removeEventListener(event, callback);
}

/* Return whether or not the client is authenticated with an AuthID */
TwitchClient.prototype.IsAuthed =
function _TwitchClient_IsAuthed() {
  return this._authed;
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
      users: [],
      userInfo: {},
      operators: [],
      channel: channel,
      rooms: {},
      id: null
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
  this._api.Get(Twitch.URL.Rooms(cid), (function(json) {
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
  if (this._no_assets) return;
  if (!this._has_clientid) {
    Util.Warn("Unable to get badges; no clientid");
    return;
  }
  this._api.Get(Twitch.URL.Badges(cid), (function(json) {
    for (let badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
}

/* Private: Load in the channel cheermotes for a given channel name and ID */
TwitchClient.prototype._getChannelCheers =
function _TwitchClient__getChannelCheers(cname, cid) {
  this._channel_cheers[cname] = {};
  if (this._no_assets) return;
  if (!this._has_clientid) {
    Util.Warn("Unable to get channel cheers; no clientid");
    return;
  }
  this._api.Get(Twitch.URL.Cheers(cid), (function(json) {
    for (let badge_def of json.actions) {
      /* Simplify things later by adding the regexp here */
      badge_def.word_pattern = new RegExp('^(' + RegExp.escape(badge_def.prefix) + ')([1-9][0-9]*)$', 'i');
      badge_def.line_pattern = new RegExp('(?:\\b[\\s]|^)(' + RegExp.escape(badge_def.prefix) + ')([1-9][0-9]*)(?:\\b|[\\s]|$)')
      this._channel_cheers[cname][badge_def.prefix] = badge_def;
    }
  }).bind(this), {}, false);
}

/* Private: Load in the global and per-channel FFZ emotes */
TwitchClient.prototype._getFFZEmotes =
function _TwitchClient__getFFZEmotes(cname, cid) {
  this._ffz_channel_emotes[cname] = {};
  if (this._no_assets) return;
  this._api.GetSimple(Twitch.URL.FFZEmotes(cid), (function(json) {
    /* TODO: store */
    /* NOTE: gives 404 when channel has no emotes */
    //console.log(`Received FFZ emotes for ${cname}:${cid}:`, json);
  }).bind(this), (function _ffze_onerror(resp) {
    if (resp.status == 404) {
      Util.Log(`Channel ${cname}:${cid} has no FFZ emotes`);
    }
  }));
  this._api.GetSimple(Twitch.URL.FFZAllEmotes(), (function(json) {
    /* TODO: store */
    //console.log("Received global FFZ emotes:", json);
  }).bind(this), (function _ffzae_onerror(resp) {
    
  }));
}

/* Private: Load in the global and per-channel BTTV emotes */
TwitchClient.prototype._getBTTVEmotes =
function _TwitchClient__getBTTVEmotes(cname, cid) {
  this._bttv_channel_emotes[cname] = {};
  if (this._no_assets) return;
  this._api.GetSimple(Twitch.URL.BTTVEmotes(cname.lstrip('#')), (function(json) {
    /* TODO: store */
    /* NOTE: gives 404 when channel has no emotes */
    //console.log("Received BTTV emotes for", cname, json);
  }).bind(this), (function _bttve_onerror(resp) {
    if (resp.status == 404) {
      Util.Log(`Channel ${cname}:${cid} has no BTTV emotes`);
    }
  }));
  this._api.GetSimple(Twitch.URL.BTTVAllEmotes(), (function(json) {
    /* TODO: store */
    //console.log("Received global BTTV emotes", json);
  }).bind(this), (function _bttvae_onerror(resp) {
    
  }));
}

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges =
function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  if (this._no_assets) return;
  this._api.Get(Twitch.URL.AllBadges(), (function(json) {
    for (let badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
  if (this._enable_ffz) {
    this._api.GetSimple(Twitch.URL.FFZBadgeUsers(), (function(resp) {
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
  flag_obj["badges"] = this._self_userstate["badges"];
  if (!flag_obj["badges"]) {
    flag_obj["badges"] = [];
  }
  flag_obj["color"] = this._self_userstate["color"];
  flag_obj["subscriber"] = this._self_userstate["subscriber"];
  flag_obj["mod"] = this._self_userstate["mod"];
  flag_obj["display-name"] = this._self_userstate["display-name"];
  flag_obj["emotes"] = emote_obj;
  /* TODO: generate unique ID */
  flag_obj["id"] = "00000000-0000-0000-0000-000000000000";
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
  flag_str += `;emotes=${Twitch.FormatEmoteFlag(flag_obj["emotes"])}`;
  flag_str += `;id=${flag_obj["id"]}`;
  flag_str += `;user-id=${flag_obj["user-id"]}`;
  flag_str += `;room-id=${flag_obj["room-id"]}`;
  flag_str += `;tmi-sent-ts=${flag_obj["tmi-sent-ts"]}`;
  flag_str += `;turbo=${flag_obj["turbo"]}`;
  flag_str += `;user-type=${flag_obj["user-type"]}`;

  /* Build the raw and parsed objects */
  let user = this._self_userstate["display-name"].toLowerCase();
  let useruri = `:${user}!${user}@${user}.tmi.twitch.tv`;
  let channel = Twitch.FormatChannel(chobj);
  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  let raw_line = `${flag_str} ${useruri} PRIVMSG ${channel} :${message}`;
  let parsed = {};
  parsed.cmd = "PRIVMSG";
  parsed.flags = flag_obj;
  parsed.user = Twitch.ParseUser(useruri);
  parsed.channel = chobj;
  parsed.message = message;

  /* Mark the object as synthesized */
  parsed.synthesized = true;

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, parsed);
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

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel =
function _TwitchClient_JoinChannel(channel) {
  channel = this._ensureChannel(channel);
  let ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) == -1) {
      this._ws.send(`JOIN ${ch}`);
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
      this._ws.send(`PART ${ch}`);
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

/* Get the client's current username */
TwitchClient.prototype.GetName =
function _TwitchClient_GetName() {
  return this._username;
}

/* Get an object containing all of the known badges */
TwitchClient.prototype.GetBadges =
function _TwitchClient_GetBadges() {
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
  if (this._channel_cheers.hasOwnProperty(cname)) {
    for (let name of Object.keys(this._channel_cheers[cname])) {
      let match = message.search(this._channel_cheers[cname][name].line_pattern);
      if (match !== null) {
        matches.push(match);
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

/* Get information regarding the channel specified */
TwitchClient.prototype.GetRoomInfo =
function _TwitchClient_GetRoomInfo(room) {
  return this._rooms[room];
}

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo =
function _TwitchClient_GetChannelInfo(channel) {
  return this._rooms[channel];
}

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels =
function _TwitchClient_GetJoinedChannels() {
  return this._channels;
}

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

/* Return whether or not the numeric ID refers to the client itself */
TwitchClient.prototype.IsSelf =
function _TwitchClient_IsSelf(userid) {
  return userid == this._self_userid;
}

/* Set the client's name to the value given, optionally including a password.
 * This is called automatically when the client connects; please specify the
 * desired username and password in the constructor's configuration argument
 */
TwitchClient.prototype.SetName =
function _TwitchClient_SetName(name, pass) {
  if (name && pass) {
    this._username = name;
  } else {
    this._username = `justinfan${Math.floor(Math.random() * 999999)}`;
  }
  if (!!pass) {
    this._ws.send(`PASS ${pass.indexOf("oauth:") == 0 ? "" : "oauth:"}${pass}`);
    this._ws.send(`NICK ${name}`);
  } else {
    this._ws.send(`NICK ${this._username}`);
  }
}

/* Send a message to the channel specified */
TwitchClient.prototype.SendMessage =
function _TwitchClient_SendMessage(channel, message, bypassFaux=false) {
  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected && this._authed) {
    this._ws.send(`PRIVMSG ${channel.channel} :${message}`);
    /* Dispatch a faux "Message Received" event */
    if (!bypassFaux) {
      Util.FireEvent(this._build_privmsg(channel, message));
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
  this._ws.send(raw_msg.trimEnd() + "\r\n");
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

/* Obtain all of the channel badges for the specified channel */
TwitchClient.prototype.GetChannelBadges =
function _TwitchClient_GetChannelBadges(channel) {
  channel = this._ensureChannel(channel);
  if (this._channel_badges.hasOwnProperty(channel.channel)) {
    return new Object(this._channel_badges[channel.channel]);
  }
  return {};
}

/* Obtain all of the global badges */
TwitchClient.prototype.GetGlobalBadges =
function _TwitchClient_GetGlobalBadges() {
  return new Object(this._global_badges);
}

/* Return the URL to the image for the emote specified */
TwitchClient.prototype.GetEmote =
function _TwitchClient_GetEmote(emote_id) {
  return Twitch.URL.Emote(emote_id, '1.0');
}

/* Return the URL to the image for the cheermote specified */
TwitchClient.prototype.GetCheer =
function _TwitchClient_GetCheer(prefix, tier, scheme="dark", size="1") {
  return Twitch.URL.Cheer(prefix, tier, scheme, size);
}

/* Callback: called when the websocket opens */
TwitchClient.prototype.OnWebsocketOpen =
function _TwitchClient_OnWebsocketOpen(name, pass) {
  this._ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  this.SetName(name, pass);
  let chlist = this._pending_channels;
  this._pending_channels = [];
  for (let i of chlist) {
    this.JoinChannel(i);
  }
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

    /* Make sure the room is tracked */
    if (result.channel && result.channel.channel) {
      this._ensureRoom(result.channel);
    }

    /* Don't handle messages with NULL commands */
    if (!result.cmd) {
      Util.Error('result.cmd is NULL for', result, line);
      continue;
    }

    /* Fire top-level events, dispatch top-level callbacks */
    Util.FireEvent(new TwitchEvent(result.cmd, line, result));
    Util.FireEvent(new TwitchEvent("MESSAGE", line, result));
    let cname = result.channel ? result.channel.channel : null;

    /* Handle each command that could be returned */
    switch (result.cmd) {
      case "PING":
        this._ws.send(`PONG :${result.server}`);
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
        if (!this._rooms[cname].userInfo.hasOwnProperty(result.user)) {
          this._rooms[cname].userInfo[result.user] = {};
        }
        if (!event.flag('badges')) event.flags.badges = [];
        if (this._enable_ffz) {
          for (let [badge_nr, users] of Object.entries(this._ffz_badge_users)) {
            if (users.indexOf(result.user) > -1 || result.user === "kaedenn_") {
              let ffz_badges = event.flag('ffz-badges');
              if (ffz_badges === undefined) ffz_badges = [];
              ffz_badges.push(this._ffz_badges[badge_nr]);
              event.flags['ffz-badges'] = ffz_badges;
            }
          }
        }
        /* TODO: add BTTV badges */
        let ui = this._rooms[cname].userInfo[result.user];
        ui.ismod = event.ismod;
        ui.issub = event.issub;
        ui.isvip = event.isvip;
        ui.userid = event.flag('user-id');
        ui.uuid = event.flag('id');
        ui.badges = event.flag('badges');
        Util.FireEvent(event);
        break;
      case "USERSTATE":
        for (let [key, val] of Object.entries(result.flags)) {
          this._self_userstate[key] = val;
        }
        break;
      case "ROOMSTATE":
        this._rooms[cname].id = result.flags["room-id"];
        this._rooms[cname].channel = result.channel;
        if (this._authed) {
          this._getRooms(cname, result.flags["room-id"]);
        }
        this._getChannelBadges(cname, result.flags["room-id"]);
        this._getChannelCheers(cname, result.flags["room-id"]);
        if (this._enable_ffz) {
          this._getFFZEmotes(cname, result.flags["room-id"]);
        }
        if (this._enable_bttv) {
          this._getBTTVEmotes(cname, result.flags["room-id"]);
        }
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
    if (result.cmd == "USERSTATE" || result.cmd == "GLOBALUSERSTATE") {
      if (result.flags && result.flags["emote-sets"]) {
        this._api.Get(
          Twitch.URL.EmoteSet(result.flags["emote-sets"].join(',')),
          (function(json) {
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
  this._pending_channels = this._channels;
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  Util.FireEvent(new TwitchEvent("CLOSE", event));
}

/* Mark the Twitch Client API as loaded */
TwitchClient.API_Loaded = true;

