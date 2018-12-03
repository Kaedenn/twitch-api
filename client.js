"use strict";
/* Collapse all:
 * %g/\<class\|function\>[^{]\+{$/norm $zf%
 */

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 */

/* TODO:
 *  Document the following events:
 *    twitch-error
 *    twitch-open
 *    twitch-message (fired on each parsed line)
 *    twitch-close
 *  Implement the following features:
 *    Tracking operators (MODE #dwangoac +o dwangoac) (broken)
 *    Joining specific rooms (JoinChannel only looks at channel.channel, etc)
 *  Implement the following commands:
 *    HOSTTARGET
 *    RECONNECT
 */

/* TwitchEvent: Primary Event object for TwitchClient events
 * Constructor:
 * + TwitchEvent(event-type, raw-line, parsed-line)
 *     event-type: the specific Twitch action that triggered this event
 *     raw-line: the raw, un-parsed line that generated this event
 *     parsed-line: the content of the line, parsed into an object
 * Methods:
 * + get command
 *     returns "event-type"
 * + get raw_line
 *     returns "raw-line"
 * + get values
 *     returns "parsed-line"
 * + value(key)
 *     alias to `values()[key]`
 * Static methods:
 * + get COMMANDS
 *     Returns an object of "event-type": "event-name" enumerating the possible
 *     values for "event-type".
 * Command-specific methods:
 *   These methods only make sense for certain commands but are presented here
 *   for convenience. Be aware that calling these methods for commands that
 *   don't implement the requisite API may raise an exception.
 * + get channel
 *     Returns `values()["channel"]`
 * + get message
 *     Returns `values()["message"]`
 * + get user
 *     Returns `values()["user"]`
 * + get flags
 *     Returns `values()["flags"]`
 * + flag(key)
 *     Returns `flags()[key]`
 * + repr
 *     Returns a string that can be eval()ed to get an exact copy of the event
 */
class TwitchEvent extends Event {
  constructor(type, raw_line, parsed) {
    super("twitch-" + type.toLowerCase());
    this._cmd = type;
    this._raw = raw_line;
    this._parsed = parsed;
  }
  static get COMMANDS() {
    return {
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
      ANONGIFTSUB: "ANONGIFTSUB"
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
  flag(flag) { return this._parsed.flags[flag]; }

  /* Extra attributes */
  repr() {
    /* Return a value similar to Object.toSource() */
    var cls = Object.getPrototypeOf(this).constructor.name;
    var args = [
      this._cmd.repr(),
      this._raw.repr(),
      this._parsed.toSource()
    ].join(",");
    return `new ${cls}(${args})`;
  }
}

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
          if (badge_rev == rev) {
            return true;
          }
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
    var cls = Object.getPrototypeOf(this).constructor.name;
    var args = [
      this._raw.repr(),
      this._parsed.toSource()
    ].join(",");
    return `new ${cls}(${args})`;
  }
}

/* TODO: Change to a real class definition */
function TwitchClient(opts) {
  /* Supported configuration opts:
   *  ClientID
   *  Name
   *  Pass
   *  Channels
   *  Debug
   */
  this._debug = opts.Debug || 0;
  this._channels = [];
  this._pending_channels = opts.Channels || [];
  this._rooms = {};
  this._ws = null;
  this._username = null;
  this._is_open = false;
  this._connected = false;
  this._capabilities = [];
  this._self_userstate = {};

  this._hooks = {};

  this._channel_badges = {};
  this._global_badges = {};
  this._cheer_emotes = {};
  this._emotes = {};
  this._cheers = {};

  /* Handle authentication and password management */
  this._authed = !!opts.Pass;
  var oauth, oauth_header;
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
  var pub_headers = {"Client-ID": opts.ClientID};
  var priv_headers = {}
  if (this._authed)
    priv_headers["Authorization"] = oauth_header;
  this._api = new Twitch.API(pub_headers, priv_headers);

  Util.Debug("Configured with", Twitch.StripCredentials(opts.toSource()));

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

    this._ws = new WebSocket("wss://irc-ws.chat.twitch.tv");
    this._ws.client = this;
    this._ws._send = this._ws.send;
    this._ws.send = function(m) {
      Util.Debug('ws send>', Twitch.StripCredentials(m).repr());
      this._send(m);
    };
    this._ws.onopen = function(e) {
      Util.Debug('ws open>', e);
      this.client._connected = false;
      this.client._is_open = true;
      this.client.OnWebsocketOpen(opts.Name, oauth);
    };
    this._ws.onmessage = function(e) {
      Util.Debug('ws recv>', Twitch.StripCredentials(e.data.repr()));
      this.client.OnWebsocketMessage(e);
    };
    this._ws.onerror = function(e) {
      Util.Debug('ws error>', e);
      this.client._connected = false;
      this.client.OnWebsocketError(e);
    };
    this._ws.onclose = function(e) {
      Util.Debug('ws close>', e);
      this.client._connected = false;
      this.client._is_open = false;
      this.client.OnWebsocketClose(e);
    };
  }
}

/* debug(args...): output everything given to the console as a debugging
 * message, if config.Debug was set to true */
TwitchClient.prototype.debug = function() {
  if (this._debug) {
    Util.LogOnly.apply(Util.LogOnly, arguments);
  }
}

/* Hook a callback function to a specific action */
TwitchClient.prototype.on = function(action, callback) {
  if (this._hooks[action] === undefined) {
    this._hooks[action] = [];
  }
  this._hooks[action].push(callback);
}

/* Get an array [[action, func]] of the currently-hooked callbacks */
TwitchClient.prototype.GetCallbacks = function() {
  return Object.entries(this._hooks);
}

/* Bind a function to the TwitchChat event specified */
TwitchClient.prototype.bind = function(event, callback) {
  document.addEventListener(event, callback);
}

/* Unbind a function from the TwitchChat event specified */
TwitchClient.prototype.unbind = function(event, callback) {
  document.removeEventListener(event, callback);
}

/* Private: Determine if the given hook has any bound functions */
TwitchClient.prototype._hooked = function(hook) {
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
TwitchClient.prototype._dispatch = function(hook, ...args) {
  if (this._hooked(hook)) {
    for (var func of this._hooks[hook]) {
      func.apply(this, args);
    }
  }
}

/* Private: Ensure the user specified is in reduced form */
TwitchClient.prototype._ensureUser = function(user) {
  if (user.indexOf('!') > -1) {
    return Twitch.ParseUser(user);
  } else {
    return user;
  }
}

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureChannel = function(channel) {
  if (typeof(channel) == "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
}

/* Private: Ensure the channel specified is a channel object */
TwitchClient.prototype._ensureRoom = function(channel) {
  channel = this._ensureChannel(channel);
  var cname = channel.channel;
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
TwitchClient.prototype._onJoin = function(channel, user) {
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
TwitchClient.prototype._onPart = function(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  if (this._rooms[cname].users.includes(user)) {
    var idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users = this._rooms[cname].users.splice(idx, 1);
  }
}

/* Private: Called when the client receives a MODE +o event */
TwitchClient.prototype._onOp = function(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  if (!this._rooms[cname].operators.includes(user)) {
    this._rooms[cname].operators.push(user);
  }
  Util.Log('_onOp', channel, user, this._rooms[cname].operators);
}

/* Private: Called when the client receives a MODE -o event */
TwitchClient.prototype._onDeOp = function(channel, user) {
  channel = this._ensureChannel(channel);
  user = this._ensureUser(user);
  this._ensureRoom(channel);
  var cname = channel.channel;
  var idx = this._rooms[cname].operators.indexOf(user);
  if (idx > -1) {
    this._rooms[cname].operators = this._rooms[cname].operators.splice(idx, 1);
  }
}

/* Private: Load in the extra chatrooms a streamer may or may not have */
TwitchClient.prototype._getRooms = function(cname, cid) {
  this._api.Get(Twitch.URL.GetRooms(cid), (function(json) {
    for (var room_def of json["rooms"]) {
      if (this._rooms[cname].rooms === undefined)
        this._rooms[cname].rooms = {};
      this._rooms[cname].rooms[room_def["name"]] = room_def;
    }
  }).bind(this), {}, true);
}

/* Private: Load in the channel badges for a given channel name and ID */
TwitchClient.prototype._getChannelBadges = function(cname, cid) {
  this._channel_badges[cname] = {};
  this._api.Get(Twitch.URL.GetChannelBadges(cid), (function(json) {
    for (var badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
}

/* Private: Load in the global badges  */
TwitchClient.prototype._getAllBadges = function() {
  this._global_badges = {};
  this._api.Get(Twitch.URL.GetAllBadges(), (function(json) {
    for (var badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
}

TwitchClient.prototype.GetBadges = function() {
  var result = {global: {}};
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

/* Private: Build a faux PRIVMSG event from the chat message given */
TwitchClient.prototype._build_privmsg = function(chobj, message) {
  /* Construct the parsed flags object */
  var flag_obj = {};
  flag_obj["badges"] = this._self_userstate["badges"];
  if (!flag_obj["badges"])
    flag_obj["badges"] = [];
  /* Add badges to denote the sender */
  flag_obj["badges"].unshift(["extension", 1]);
  flag_obj["badges"].unshift(["twitchbot", 1]);
  flag_obj["color"] = this._self_userstate["color"];
  flag_obj["subscriber"] = this._self_userstate["subscriber"];
  flag_obj["mod"] = this._self_userstate["mod"];
  flag_obj["display-name"] = this._self_userstate["display-name"];
  /* TODO: parse emotes */
  flag_obj["emotes"] = "";
  /* TODO: generate unique ID */
  flag_obj["id"] = "00000000-0000-0000-0000-000000000000";
  /* TODO: determine user ID */
  flag_obj["user-id"] = "999999999";
  flag_obj["room-id"] = this._rooms[chobj.channel].id;
  flag_obj["tmi-sent-ts"] = (new Date()).getTime();
  flag_obj["turbo"] = 0;
  flag_obj["user-type"] = "";

  /* Construct the formatted flags string */
  var flag_str = "@";
  flag_str += "badges=";
  if (flag_obj["badges"]) {
    var badges = []
    for (var [b, r] of flag_obj["badges"]) {
      badges.push(`${b}/${r}`);
    }
    flag_str += badges.join(",");
  }
  flag_str += `;color=${flag_obj["color"]}`;
  flag_str += `;display-name=${flag_obj["display-name"]}`;
  flag_str += `;subscriber=${flag_obj["subscriber"]}`;
  flag_str += `;mod=${flag_obj["mod"]}`;
  /* TODO: parse emotes */
  flag_str += `;emotes=${flag_obj["emotes"]}`;
  flag_str += `;id=${flag_obj["id"]}`;
  flag_str += `;user-id=${flag_obj["user-id"]}`;
  flag_str += `;room-id=${flag_obj["room-id"]}`;
  flag_str += `;tmi-sent-ts=${flag_obj["tmi-sent-ts"]}`;
  flag_str += `;turbo=${flag_obj["turbo"]}`;
  flag_str += `;user-type=${flag_obj["user-type"]}`;

  /* Build the raw and parsed objects */
  var user = this._self_userstate["display-name"].toLowerCase();
  var useruri = `:${user}!${user}@${user}.tmi.twitch.tv`;
  var channel = Twitch.FormatChannel(chobj);
  /* @<flags> <useruri> PRIVMSG <channel> :<message> */
  var raw_line = `${flag_str} ${useruri} PRIVMSG ${channel} :${message}`;
  var parsed = {};
  parsed.cmd = "PRIVMSG";
  parsed.flags = flag_obj;
  parsed.user = Twitch.ParseUser(useruri);
  parsed.channel = chobj;
  parsed.message = message;

  /* Construct and return the event */
  return new TwitchChatEvent(raw_line, parsed);
}

/* Request the client to join the channel specified */
TwitchClient.prototype.JoinChannel = function(channel) {
  channel = this._ensureChannel(channel);
  var ch = channel.channel;
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
TwitchClient.prototype.LeaveChannel = function(channel) {
  channel = this._ensureChannel(channel);
  var ch = channel.channel;
  if (this._is_open) {
    if (this._channels.indexOf(ch) > -1) {
      this._ws.send(`PART ${ch}`);
      var idx = this._channels.indexOf(ch);
      this._channels.splice(i, 1);
    } else {
      Util.Warn(`LeaveChannel: Not in channel ${ch}`);
    }
  }
}

/* Get the client's current username */
TwitchClient.prototype.GetName = function() {
  return this._username;
}

/* Get information regarding the channel specified */
TwitchClient.prototype.GetRoomInfo = function(room) {
  return this._rooms[room];
}

/* Get information regarding the channel specified */
TwitchClient.prototype.GetChannelInfo = function(channel) {
  return this._rooms[channel];
}

/* Get the list of currently-joined channels */
TwitchClient.prototype.GetJoinedChannels = function() {
  return this._channels;
}

/* Return true if the client has been granted the capability specified. Values
 * may omit the "twitch.tv/" scope if desired. Capabilities can be one of the
 * following:
 *  twitch.tv/tags
 *  twitch.tv/commands
 *  twitch.tv/membership
 */
TwitchClient.prototype.HasCapability = function(test_cap) {
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
TwitchClient.prototype.SetName = function(name, pass) {
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
TwitchClient.prototype.SendMessage = function(channel, message) {
  channel = this._ensureChannel(channel);
  message = Util.EscapeSlashes(message.trim());
  if (this._connected) {
    this._ws.send(`PRIVMSG ${channel.channel} :${message}`);
    /* Dispatch a faux "Message Received" event */
    Util.FireEvent(this._build_privmsg(channel, message));
  } else {
    var chname = Twitch.FormatChannel(channel);
    Util.Warn(`Unable to send "${message}" to ${chname}: not connected`);
  }
}

/* Send a message to every connected channel */
TwitchClient.prototype.SendMessageToAll = function(message) {
  if (this._connected) {
    for (var ch of this._channels) {
      this.SendMessage(ch, message);
    }
  } else {
    Util.Warn(`Unable to send "${message}" to all channels: not connected`);
  }
}

/* Send text to the Twitch servers, bypassing any special logic */
TwitchClient.prototype.SendRaw = function(raw_msg) {
  this._ws.send(raw_msg.trimEnd() + "\r\n");
}

/* Return true if the badge specified is a global badge */
TwitchClient.prototype.IsGlobalBadge = function(badge_name, badge_num) {
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
TwitchClient.prototype.IsChannelBadge = function(channel, badge_name) {
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
TwitchClient.prototype.GetGlobalBadge = function(badge_name, badge_num) {
  if (typeof(badge_num) == "string")
    badge_num = parseInt(badge_num);
  return this._global_badges[badge_name].versions[badge_num];
}

/* Returns Object {
 *   alpha: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   image: "https://static-cdn.jtvnw.net/chat-badges/<badge>.png",
 *   svg: "https://static-cdn.jtvnw.net/chat-badges/<badge>.svg"
 * } */
TwitchClient.prototype.GetChannelBadge = function(channel, badge_name) {
  channel = this._ensureChannel(channel);
  return this._channel_badges[channel.channel][badge_name];
}

/* TODO
 * Return the URL to the image for the emote specified */
TwitchClient.prototype.GetEmote = function(emote_id) {
  /* TODO */
}

/* TODO
 * Return the URL to the image for the cheermote specified */
TwitchClient.prototype.GetCheer = function(prefix, tier) {
  /* TODO */
}

/* Callback: called when the websocket opens */
TwitchClient.prototype.OnWebsocketOpen = function(name, pass) {
  this._ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  this.SetName(name, pass);
  var chlist = this._pending_channels;
  this._pending_channels = [];
  for (var i of chlist) {
    this.JoinChannel(i);
  }
  this._getAllBadges();
  Util.FireEvent(new TwitchEvent("OPEN"));
}

/* Callback: called when the websocket receives a message */
TwitchClient.prototype.OnWebsocketMessage = function(event) {
  this._dispatch("WSMESSAGE", event);
  var lines = event.data.split("\r\n");
  for (var line of lines) {
    /* Ignore empty lines */
    if (line.trim() == '')
      continue;
    /* Parse the message */
    var result = Twitch.ParseIRCMessage(line);
    /* Handle any common logic */
    if (result.channel && result.channel.channel) {
      this._ensureRoom(result.channel);
    }
    /* Fire top-level events, dispatch top-level callbacks */
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
        if (result.modeset == "+o") {
          this._onOp(result.channel, result.user);
        } else if (result.modeset == "-o") {
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
        var cname = result.channel.channel;
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
  }
}

/* Callback: called when the websocket receives an error */
TwitchClient.prototype.OnWebsocketError = function(event) {
  Util.Error(event);
  this._dispatch("ERROR", event);
  Util.FireEvent(new TwitchEvent("ERROR", event));
}

/* Callback: called when the websocket is closed */
TwitchClient.prototype.OnWebsocketClose = function(event) {
  this._pending_channels = this._channels;
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  this._dispatch('CLOSE');
  Util.FireEvent(new TwitchEvent("CLOSE", event));
}

