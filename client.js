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
    if (TwitchEvent.COMMANDS[this._cmd] === undefined) {
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
  value(key) { return this._parsed[key]; }

  /* Event-specific methods */
  get channel() { return this._parsed.channel; }
  get message() { return this._parsed.message; }
  get user() { return this._parsed.user; }
  get name() { return this._parsed.flags["display-name"]; }
  get flags() { return this._parsed.flags; }
  flag(flag) { return !!this._parsed.flags ? this._parsed.flags[flag] : undefined; }

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
    for (var [badge_name, badge_rev] of this.flag("badges")) {
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

/* TwitchEmote class for abstracting the various kinds of emotes */
class TwitchEmote {
  constructor(emote, url, style=null, sizes=null, ...attrs) {
    this._emote = emote;
    this._url = url;
    this._css = style;
    this._sizes = sizes;
    this._attrs = attrs;
  }
  get emote() { return this._emote; }
  get url() { return this._url; }
  get pattern() { return Twitch.EmoteToRegex(this._emote); }
  get re() { return this.pattern; }
  get css() { return this._css; }
  get sizes() { return this._sizes; }
  get extra_attrs() { return this._attrs; }

  /* TODO: functions for testing whether a string contains this emote */
}

/* TwitchClient constructor definition */
function TwitchClient(opts) {
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

  /* (OBSOLETE) Hooked callbacks */
  this._hooks = {};

  /* Badge, emote, cheermote definitions */
  this._channel_badges = {};
  this._global_badges = {};
  this._cheer_emotes = {};
  this._emotes = {};
  this._cheers = {};

  /* Handle authentication and password management */
  this._authed = !!opts.Pass;
  let oauth, oauth_header;
  if (this._authed) {
    if (opts.Pass.indexOf("oauth:") != 0) {
      oauth = `oauth:${opts.Pass}`;
      oauth_header = `OAuth ${opts.Pass}`;
    } else {
      oauth = opts.Pass;
      oauth_header = opts.Pass.replace(/^oauth:/, 'OAuth ');
    }
  }

  /* Construct the Twitch API object */
  let pub_headers = {"Client-Id": opts.ClientID};
  let priv_headers = {}
  if (this._authed)
    priv_headers["Authorization"] = oauth_header;
  this._api = new Twitch.API(pub_headers, priv_headers);

  Util.DebugOnly("Configured with", Twitch.StripCredentials(opts.toSource()));

  /* TwitchClient.Connect() */
  this.Connect = function _TwitchClient_Connect() {
    if (this._ws !== null) {
      this._ws.close();
    }

    for (var c of this._channels) {
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
      this.client.OnWebsocketOpen(opts.Name, oauth);
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

/* Hook a callback function to a specific action */
TwitchClient.prototype.on =
function _TwitchClient_on(action, callback) {
  if (this._hooks[action] === undefined) {
    this._hooks[action] = [];
  }
  this._hooks[action].push(callback);
}

/* Get an array [[action, func]] of the currently-hooked callbacks */
TwitchClient.prototype.GetCallbacks =
function _TwitchClient_GetCallbacks() {
  return Object.entries(this._hooks);
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

/* Private: Determine if the given hook has any bound functions */
TwitchClient.prototype._hooked =
function _TwitchClient__hooked(hook) {
  if (hook in this._hooks) {
    if (this._hooks[hook]) {
      if (this._hooks[hook].length > 0) {
        return true;
      }
    }
  }
  return false;
}

/* Private: Dispatch the given hook with the arguments specified */
TwitchClient.prototype._dispatch =
function _TwitchClient__dispatch(hook, ...args) {
  if (this._hooked(hook)) {
    for (var func of this._hooks[hook]) {
      func.apply(this, args);
    }
  }
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
    this._rooms[cname].users = this._rooms[cname].users.splice(idx, 1);
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
  this._api.Get(Twitch.URL.Rooms(cid), (function(json) {
    for (var room_def of json["rooms"]) {
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
  this._api.Get(Twitch.URL.Badges(cid), (function(json) {
    for (var badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
}

/* Private: Load in the global badges  */
TwitchClient.prototype._getGlobalBadges =
function _TwitchClient__getGlobalBadges() {
  this._global_badges = {};
  this._api.Get(Twitch.URL.AllBadges(), (function(json) {
    for (var badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
}

/* Private: Build a faux PRIVMSG event from the chat message given */
TwitchClient.prototype._build_privmsg =
function _TwitchClient__build_privmsg(chobj, message) {
  /* Construct the parsed flags object */
  let flag_obj = {};
  flag_obj["badges"] = this._self_userstate["badges"];
  if (!flag_obj["badges"])
    flag_obj["badges"] = [];
  /* Add badges to denote the sender */
  flag_obj["badges"].unshift(["twitchbot", 1]);
  flag_obj["color"] = this._self_userstate["color"];
  flag_obj["subscriber"] = this._self_userstate["subscriber"];
  flag_obj["mod"] = this._self_userstate["mod"];
  flag_obj["display-name"] = this._self_userstate["display-name"];
  flag_obj["emotes"] = Twitch.FormatEmoteFlag(Twitch.ScanEmotes(message, Object.entries(this._self_emotes)));
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
    for (var [b, r] of flag_obj["badges"]) {
      badges.push(`${b}/${r}`);
    }
    flag_str += badges.join(",");
  }
  flag_str += `;color=${flag_obj["color"]}`;
  flag_str += `;display-name=${flag_obj["display-name"]}`;
  flag_str += `;subscriber=${flag_obj["subscriber"]}`;
  flag_str += `;mod=${flag_obj["mod"]}`;
  flag_str += `;emotes=${flag_obj["emotes"]}`;
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

/* Add an emote to the internal list of known emotes */
TwitchClient.prototype.AddEmote =
function _TwitchClient_AddEmote(emote_string, emote_url, style=null, sizes=null) {
  this._emotes[emote_string] = new TwitchEmote(emote_string, emote_url, style, sizes);
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
    if (this._channels.indexOf(ch) > -1) {
      this._ws.send(`PART ${ch}`);
      let idx = this._channels.indexOf(ch);
      this._channels.splice(i, 1);
    } else {
      Util.Warn(`LeaveChannel: Not in channel ${ch}`);
    }
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
  for (var cname of Object.keys(this._channel_badges)) {
    result[cname] = {};
    for (var [name, val] of Object.entries(this._channel_badges[cname])) {
      result[cname][name] = val;
    }
  }
  for (var name of Object.keys(this._global_badges)) {
    result.global[name] = this._global_badges[name];
  }
  return result;
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
  for (var cap of this._capabilities) {
    if (test_cap == cap || cap.endsWith('/' + test_cap.lstrip('/'))) {
      return true;
    }
  }
  return false;
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
function _TwitchClient_SendMessage(channel, message) {
  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected) {
    this._ws.send(`PRIVMSG ${channel.channel} :${message}`);
    /* Dispatch a faux "Message Received" event */
    Util.FireEvent(this._build_privmsg(channel, message));
  } else {
    let chname = Twitch.FormatChannel(channel);
    Util.Warn(`Unable to send "${message}" to ${chname}: not connected`);
  }
}

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll =
function _TwitchClient_SendMessageToAll(message) {
  if (this._connected) {
    for (var ch of this._channels) {
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
function _TwitchClient_IsGlobalBadge(badge_name, badge_num) {
  if (typeof(badge_num) == "string")
    badge_num = parseInt(badge_num);
  if (badge_name in this._global_badges) {
    if (badge_num in this._global_badges[badge_name].versions) {
      if (!!this._global_badges[badge_name].versions[badge_num]) {
        return true;
      }
    }
  }
  return false;
}

/* Return true if the badge specified exists as a channel badge */
TwitchClient.prototype.IsChannelBadge =
function _TwitchClient_IsChannelBadge(channel, badge_name) {
  if (typeof(badge_num) == "string")
    badge_num = parseInt(badge_num);
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
function _TwitchClient_GetGlobalBadge(badge_name, badge_num) {
  if (typeof(badge_num) == "string")
    badge_num = parseInt(badge_num);
  return this._global_badges[badge_name].versions[badge_num];
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
  for (var i of chlist) {
    this.JoinChannel(i);
  }
  this._getGlobalBadges();
  Util.FireEvent(new TwitchEvent("OPEN"));
}

/* Callback: called when the websocket receives a message */
TwitchClient.prototype.OnWebsocketMessage =
function _TwitchClient_OnWebsocketMessage(event) {
  this._dispatch("WSMESSAGE", event);
  let lines = event.data.split("\r\n");
  for (var line of lines) {
    /* Ignore empty lines */
    if (line.trim() == '')
      continue;
    /* Parse the message */
    let result = Twitch.ParseIRCMessage(line);
    /* Handle any common logic */
    if (result.channel && result.channel.channel) {
      this._ensureRoom(result.channel);
    }
    /* Fire top-level events, dispatch top-level callbacks */
    if (!result.cmd) {
      Util.Error('result.cmd is NULL for', result, line);
      continue;
    }

    Util.FireEvent(new TwitchEvent(result.cmd, line, result));
    Util.FireEvent(new TwitchEvent("MESSAGE", line, result));
    this._dispatch("WSMESSAGELINE", line);
    this._dispatch("MESSAGE", result);
    /* Handle each command that could be returned */
    switch (result.cmd) {
      case "PING":
        this._ws.send(`PONG :${result.server}`);
        this._dispatch("PING", result.server);
        break;
      case "ACK":
        this._connected = true;
        this._capabilities = result.flags;
        this._dispatch('CONNECT', result.flags);
        break;
      case "TOPIC":
        this._dispatch('TOPIC', result.message);
        break;
      case "NAMES":
        for (var user of result.usernames) {
          this._onJoin(result.channel, user);
        }
        this._dispatch('NAMES', result.mode, result.channel, result.usernames);
        break;
      case "JOIN":
        this._onJoin(result.channel, result.user);
        this._dispatch("JOIN", result.user, result.channel);
        break;
      case "PART":
        this._onPart(result.channel, result.user);
        this._dispatch("PART", result.user, result.channel);
        break;
      case "MODE":
        if (result.modeflag == "+o") {
          this._onOp(result.channel, result.user);
        } else if (result.modeflag == "-o") {
          this._onDeOp(result.channel, result.user);
        }
        this._dispatch("MODE", result.user, result.channel, result.modeset);
        break;
      case "PRIVMSG":
        this._dispatch("PRIVMSG", result.user, result.channel, result.flags,
                       result.message);
        Util.FireEvent(new TwitchChatEvent(line, result));
        break;
      case "USERSTATE":
        for (var [key, val] of Object.entries(result.flags)) {
          this._self_userstate[key] = val;
        }
        this._dispatch("USERSTATE", result.username, result.channel,
                       result.flags);
        break;
      case "ROOMSTATE":
        let cname = result.channel.channel;
        this._rooms[cname].id = result.flags["room-id"];
        this._rooms[cname].channel = result.channel;
        if (this._authed) {
          this._getRooms(cname, result.flags["room-id"]);
        }
        this._getChannelBadges(cname, result.flags["room-id"]);
        this._dispatch("ROOMSTATE", result.channel, result.flags);
        break;
      case "USERNOTICE":
        this._dispatch("USERNOTICE", result.channel, result.flags,
                       result.message);
        if (result.sub_kind == "SUB") {
          this._dispatch("SUB", result.sub_user, result.channel,
                         result.sub_tier);
          Util.FireEvent(new TwitchEvent("SUB", line, result));
        } else if (result.sub_kind == "RESUB") {
          this._dispatch("RESUB", result.sub_user, result.channel,
                         result.sub_tier, result.sub_months);
          Util.FireEvent(new TwitchEvent("RESUB", line, result));
        } else if (result.sub_kind == "GIFTSUB") {
          this._dispatch("GIFTSUB", result.sub_user, result.channel,
                         result.sub_tier, result.sub_gifting_user,
                         result.sub_months);
          Util.FireEvent(new TwitchEvent("GIFTSUB", line, result));
        } else if (result.sub_kind == "ANONGIFTSUB") {
          this._dispatch("ANONGIFTSUB", result.sub_user, result.channel,
                         result.sub_tier, result.sub_months);
          Util.FireEvent(new TwitchEvent("ANONGIFTSUB", line, result));
        }
        break;
      case "GLOBALUSERSTATE":
        this._self_userid = result.flags['user-id'];
        this._dispatch('GLOBALUSERSTATE', result.flags);
        break;
      case "CLEARCHAT":
        this._dispatch("CLEARCHAT", result.user, result.channel, result.flags);
        break;
      case "NOTICE":
        this._dispatch("NOTICE", result.channel, result.message);
        break;
      case "ERROR":
        this._dispatch("ERROR", result.user, result.message);
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
            for (var eset of Object.keys(json["emoticon_sets"])) {
              for (var edef of json["emoticon_sets"][eset]) {
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
  this._dispatch("ERROR", event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
}

/* Callback: called when the websocket is closed */
TwitchClient.prototype.OnWebsocketClose =
function _TwitchClient_OnWebsocketClose(event) {
  this._pending_channels = this._channels;
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  this._dispatch('CLOSE');
  Util.FireEvent(new TwitchEvent("CLOSE", event));
}

