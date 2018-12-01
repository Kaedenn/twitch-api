"use strict";
/* Collapse all:
 * %g/\<class\|function\>[^{]\+{$/norm $zf%
 */

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 *  https://dev.twitch.tv/docs/irc/commands/
 */

/* TODO:
 *  Implement the following features:
 *  Implement receiving the following commands:
 *    CLEARMSG
 *    CLEARCHAT (done)
 *    NOTICE (done)
 *  Implement sending the following commands:
 *    CLEARCHAT
 *    CLEARMSG
 *    HOSTTARGET
 *    NOTICE
 *    RECONNECT
 *    ROOMSTATE
 *    USERNOTICE
 *    USERSTATE
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
  this._debug = opts.Debug || false;
  this._channels = [];
  this._pending_channels = opts.Channels || [];
  this._rooms = {};
  this._ws = null;
  this._username = null;
  this._is_open = false;
  this._connected = false;
  this._capabilities = [];

  this._channel_badges = {};
  this._global_badges = {};
  this._cheer_emotes = {};
  this._emotes = {};
  this._cheers = {};

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

  this._api = new Twitch.API(
      /* Headers */
      {"Client-ID": opts.ClientID},
      /* Private Headers */
      {"Authorization": oauth_header});

  this._hooks = {};

  /* TwitchClient.dispatch(event, args...) */
  this._dispatch = function _TwitchClient__dispatch(hook, ...args) {
    if (this._hooks[hook] && this._hooks[hook].length > 0) {
      for (var func of this._hooks[hook]) {
        func.apply(this, args);
      }
    }
  }

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
    this._connected = false;

    this._ws = new WebSocket("wss://irc-ws.chat.twitch.tv");
    this._ws.client = this;
    this._ws._send = this._ws.send;
    this._ws.send = function(m) {
      console.log('ws send>', m);
      this._send(m);
    };
    this._ws.onopen = function(e) {
      console.log('ws open>', e);
      this.client._connected = false;
      this.client._is_open = true;
      this.client.OnWebsocketOpen(opts.Name, oauth);
    };
    this._ws.onmessage = function(m) {
      console.log('ws recv>', m);
      this.client.OnWebsocketMessage(m);
    };
    this._ws.onerror = function(e) {
      console.log('ws error>', e);
      this.client._connected = false;
      this.client.OnWebsocketError(e);
    };
    this._ws.onclose = function(e) {
      console.log('ws close>', e);
      this.client._connected = false;
      this.client._is_open = false;
      this.client.OnWebsocketClose(e);
    };
  }
}

TwitchClient.prototype.debug = function() {
  if (this._debug) {
    Util.LogOnly.apply(Util.LogOnly, arguments);
  }
}

TwitchClient.prototype.on = function(action, callback) {
  if (this._hooks[action] === undefined) {
    this._hooks[action] = [];
  }
  this._hooks[action].push(callback);
}

TwitchClient.prototype._ensureUser = function(user) {
  if (user.indexOf('!') > -1) {
    return Twitch.ParseUser(user);
  } else {
    return user;
  }
}

TwitchClient.prototype._ensureChannel = function(channel) {
  if (typeof(channel) == "string") {
    return Twitch.ParseChannel(channel);
  } else {
    return channel;
  }
}

TwitchClient.prototype._onJoin = function(channel, user) {
  user = this._ensureUser(user);
  channel = this._ensureChannel(channel);
  if (!(channel.channel in this._rooms)) {
    this._rooms[channel.channel] = {};
  }
  if (!this._rooms[channel.channel].users) {
    this._rooms[channel.channel].users = [];
  }
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

TwitchClient.prototype._onPart = function(channel, user) {
  // Allow overloading with parsed and unparsed user
  user = this._ensureUser(user);
  channel = this._ensureChannel(channel);
  var cname = channel.channel;
  if (!(cname in this._rooms)) {
    this._rooms[cname] = {};
  }
  if (!this._rooms[cname].users) {
    this._rooms[cname].users = [];
  }
  if (this._rooms[cname].users.includes(user)) {
    var idx = this._rooms[cname].users.indexOf(user);
    this._rooms[cname].users = this._rooms[cname].users.splice(idx, 1);
  } else {
    Util.Warn(`onPart: user ${user} not in userlist for ${channel.channel}`);
  }
}

TwitchClient.prototype._getRooms = function(cname, cid) {
  this._api.Get(Twitch.URL.GetRooms(cid), (function(json) {
    for (var room_def of json["rooms"]) {
      if (this._rooms[cname].rooms === undefined)
        this._rooms[cname].rooms = {};
      this._rooms[cname].rooms[room_def["name"]] = room_def;
    }
  }).bind(this), {}, true);
}

TwitchClient.prototype._getChannelBadges = function(cname, cid) {
  this._channel_badges[cname] = {};
  this._api.Get(Twitch.URL.GetChannelBadges(cid), (function(json) {
    for (var badge_name of Object.keys(json)) {
      this._channel_badges[cname][badge_name] = json[badge_name];
    }
  }).bind(this), {}, false);
}

TwitchClient.prototype._getAllBadges = function() {
  this._global_badges = {};
  this._api.Get(Twitch.URL.GetAllBadges(), (function(json) {
    for (var badge_name of Object.keys(json["badge_sets"])) {
      this._global_badges[badge_name] = json["badge_sets"][badge_name];
    }
  }).bind(this), {}, false);
}

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

TwitchClient.prototype.GetName = function() {
  return this._username;
}

TwitchClient.prototype.GetRoomInfo = function(room) {
  return this._rooms[room];
}

TwitchClient.prototype.GetJoinedChannels = function() {
  return this._channels;
}

TwitchClient.prototype.SetName = function(name, pass) {
  if (name) {
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

TwitchClient.prototype.SendMessage = function(channel, message) {
  channel = this._ensureChannel(channel);
  if (this._connected) {
    this._ws.send(`PRIVMSG ${channel.channel} :${message}`);
  }
}

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

/* Returns Object { image_url_1x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1", image_url_2x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/2", image_url_4x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3", description: "Subscriber", title: "Subscriber", click_action: "subscribe_to_channel", click_url: "" } */
TwitchClient.prototype.GetGlobalBadge = function(badge_name, badge_num) {
  if (typeof(badge_num) == "string")
    badge_num = parseInt(badge_num);
  return this._global_badges[badge_name].versions[badge_num];
}

/* Returns Object { alpha: "https://static-cdn.jtvnw.net/chat-badges/globalmod-alpha.png", image: "https://static-cdn.jtvnw.net/chat-badges/globalmod.png", svg: "https://static-cdn.jtvnw.net/chat-badges/globalmod.svg" } */
TwitchClient.prototype.GetChannelBadge = function(channel, badge_name) {
  channel = this._ensureChannel(channel);
  return this._channel_badges[channel.channel][badge_name];
}

TwitchClient.prototype.GetEmote = function(emote_id) {
  /* TODO */
}

TwitchClient.prototype.GetCheer = function(prefix, tier) {
  /* TODO */
}

TwitchClient.prototype.OnWebsocketOpen = function(name, pass) {
  this._ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  this.SetName(name, pass);
  var chlist = this._pending_channels;
  this._pending_channels = [];
  for (var i of chlist) {
    this.JoinChannel(i);
  }
  this._getAllBadges();
}

TwitchClient.prototype.OnWebsocketMessage = function(msg) {
  this._dispatch("WSMESSAGE", msg);
  var lines = msg.data.split("\r\n");
  for (var line of lines) {
    /* Ignore empty lines */
    if (line.trim() == '')
      continue;
    /* Parse the message */
    var result = Twitch.ParseIRCMessage(line);
    /* Fire top-level events, dispatch top-level callbacks */
    Util.FireEvent(new TwitchEvent(result.cmd, line, result));
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
        this._dispatch("MODE", result.user, result.channel, result.modeset);
        break;
      case "PRIVMSG":
        this._dispatch("PRIVMSG", result.user, result.channel, result.flags, result.message);
        Util.FireEvent(new TwitchChatEvent(line, result));
        break;
      case "USERSTATE":
        this._dispatch("USERSTATE", result.username, result.channel, result.flags);
        break;
      case "ROOMSTATE":
        var cname = result.channel.channel;
        if (!(cname in this._rooms)) {
          this._rooms[cname] = {};
        }
        this._rooms[cname].id = result.flags["room-id"];
        this._rooms[cname].channel = result.channel;
        if (this._authed) {
          this._getRooms(cname, result.flags["room-id"]);
        }
        this._getChannelBadges(cname, result.flags["room-id"]);
        this._dispatch("ROOMSTATE", result.channel, result.flags);
        break;
      case "USERNOTICE":
        this._dispatch("USERNOTICE", result.channel, result.flags, result.message);
        if (result.sub_kind == "SUB") {
          this._dispatch("SUB", result.sub_user, result.channel, result.sub_tier);
          Util.FireEvent(new TwitchEvent("SUB", line, result));
        } else if (result.sub_kind == "RESUB") {
          this._dispatch("RESUB", result.sub_user, result.channel, result.sub_tier, result.sub_months);
          Util.FireEvent(new TwitchEvent("RESUB", line, result));
        } else if (result.sub_kind == "GIFTSUB") {
          this._dispatch("GIFTSUB", result.sub_user, result.channel, result.sub_tier, result.sub_gifting_user, result.sub_months);
          Util.FireEvent(new TwitchEvent("GIFTSUB", line, result));
        } else if (result.sub_kind == "ANONGIFTSUB") {
          this._dispatch("ANONGIFTSUB", result.sub_user, result.channel, result.sub_tier, result.sub_months);
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
      case "OTHER":
        break;
      default:
        Util.Warn("Unhandled event:", result);
        break;
    }
  }
}

TwitchClient.prototype.OnWebsocketError = function(event) {
  Util.Error(event);
  this._dispatch("ERROR", event);
}

TwitchClient.prototype.OnWebsocketClose = function(event) {
  this._pending_channels = this._channels;
  this._channels = [];
  Util.Log("WebSocket Closed", event);
  this._dispatch('CLOSE');
}

