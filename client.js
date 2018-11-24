"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
 */

/* Features left to do:
 *  Implement sending the following commands:
 *    CLEARCHAT
 *    CLEARMSG
 *    HOSTTARGET
 *    NOTICE
 *    RECONNECT
 *    ROOMSTATE
 *    USERNOTICE
 *    USERSTATE
 *  https://dev.twitch.tv/docs/irc/commands/
 *
 */

/* Supported configuration opts:
 *  ClientID
 *  Name
 *  Pass
 *  Channels
 *  Debug
 */
function TwitchClient(opts) {
  this._debug = opts.Debug || false;
  this._channels = [];
  this._pending_channels = opts.Channels || [];
  this._rooms = {};
  this._client_id = opts.ClientID;
  this._ws = null;
  this._username = null;
  this._connected = false;

  /* TODO: remove all references to _client_id and opts.Pass */
  this._api = new Twitch.API({"Client-ID": opts.ClientID});

  opts.Name = opts.Pass = undefined;
  this._authed = !!opts.Path;

  if (this._authed) {
    if (opts.Pass.indexOf("oauth:") != 0) {
      opts.Pass = `oauth:${opts.Pass}`;
    }
  }

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
      this.client.OnWebsocketOpen(opts.Name, opts.Pass);
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
      this.client.OnWebsocketClose(e);
    };
  }

  /* TwitchClient._getRooms(channelName, channelId) */
  this._getRooms = function _TwitchClient__getRooms(name, channelid) {
    var client = this;
    function onGetRooms(json) {
      for (var room_def of json["rooms"]) {
        if (client._rooms[name].rooms === undefined)
          client._rooms[name].rooms = {};
        client._rooms[name].rooms[room_def["name"]] = room_def;
      }
    }
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var json = JSON.parse(this.responseText);
        onGetRooms(json);
      }
    }
    req.open("GET", Twitch.URL.GetRooms(channelid));
    req.setRequestHeader("Accept", "application/vnd.twitchtv.v5+json");
    req.setRequestHeader("Authorization", opts.Pass.replace("oauth:", "OAuth "));
    req.setRequestHeader("Client-ID", this._client_id);
    req.send();
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

TwitchClient.prototype.JoinChannel = function(channel) {
  var ch = channel.trim().toLowerCase();
  if (this._ws.readyState == 1) {
    if (ch.indexOf(':') == -1) {
      if (ch.indexOf('#') != 0) {
        ch = '#' + ch;
      }
      if (this._channels.indexOf(ch) == -1) {
        this._ws.send(`JOIN ${ch}`);
        this._channels.push(ch);
      } else {
        Util.Warn(`JoinChannel: Already in ${ch}`);
      }
    }
  } else if (this._pending_channels.indexOf(ch) == -1) {
    this._pending_channels.push(ch);
  }
}

TwitchClient.prototype.LeaveChannel = function(channel) {
  var ch = channel.trim();
  if (ch.indexOf(':') == -1) {
    if (ch.indexOf('#') != 0) {
      ch = '#' + ch;
    }
    if (this._channels.indexOf(ch) > -1) {
      if (this._ws.readyState == 1) {
        this._ws.send(`PART ${ch}`);
        var idx = this._channels.indexOf(ch);
        this._channels.splice(i, 1);
      }
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
  if (pass) {
    this._ws.send(`PASS ${pass.indexOf("oauth:") == 0 ? "" : "oauth:"} ${pass}`);
    this._ws.send(`NICK ${name}`);
  } else {
    this._ws.send(`NICK ${this._username}`);
  }
}

TwitchClient.prototype.SendMessage = function(channel, message) {
  if (channel.indexOf('#') != 0) {
    channel = '#' + channel;
  }
  this._ws.send(`PRIVMSG ${channel} :${message}`);
}

TwitchClient.prototype.OnWebsocketOpen = function(name, pass) {
  this._ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
  this.SetName(name, pass);
  var chlist = this._pending_channels;
  this._pending_channels = [];
  for (var i of chlist) {
    this.JoinChannel(i);
  }
}

TwitchClient.prototype.OnWebsocketMessage = function(msg) {
  this._dispatch("WSMESSAGE", msg);
  var lines = msg.data.split("\r\n");
  for (var line of lines) {
    if (line.trim() == '') { continue; }
    this._dispatch("WSMESSAGELINE", line);
    var result = Twitch.ParseIRCMessage(line);
    this._dispatch("MESSAGE", result);
    switch (result.cmd) {
      case "PING":
        this._ws.send(`PONG ${result.arg}`);
        this._dispatch("PING", result.arg);
        break;
      case "ACK":
        this._connected = true;
        this._dispatch('CONNECT', result.flags);
        break;
      case "TOPIC":
        this._dispatch('TOPIC', result.message);
        break;
      case "NAMES":
        this._dispatch('NAMES', result.usernames);
        break;
      case "JOIN":
        this._dispatch("JOIN", result.user, result.channel);
        break;
      case "PART":
        this._dispatch("PART", result.user, result.channel);
        break;
      case "MODE":
        this._dispatch("MODE", result.user, result.channel, result.modeset);
        break;
      case "PRIVMSG":
        this._dispatch("PRIVMSG", result.user, result.channel, result.flags, result.message);
        break;
      case "USERSTATE":
        this._dispatch("USERSTATE", result.username, result.channel, result.flags);
        break;
      case "ROOMSTATE":
        this._rooms[result.channel.channel] = {
          id: result.flags["room-id"],
          channel: result.channel
        };
        if (this._authed) {
          this._getRooms(result.channel.channel, result.flags["room-id"]);
        }
        this._dispatch("ROOMSTATE", result.channel, result.flags);
        break;
      case "USERNOTICE":
        this._dispatch("USERNOTICE", result.channel, result.flags, result.message);
        if (result.sub_kind == "SUB") {
          this._dispatch("SUB", result.sub_user, result.channel, result.sub_tier);
        } else if (result.sub_kind == "RESUB") {
          this._dispatch("RESUB", result.sub_user, result.channel, result.sub_tier, result.sub_months);
        } else if (result.sub_kind == "GIFTSUB") {
          this._dispatch("GIFTSUB", result.sub_user, result.channel, result.sub_tier, result.sub_gifting_user, result.sub_months);
        } else if (result.sub_kind == "ANONGIFTSUB") {
          this._dispatch("ANONGIFTSUB", result.sub_user, result.channel, result.sub_tier, result.sub_months);
        }
        break;
      case "GLOBALUSERSTATE":
        this._dispatch('GLOBALUSERSTATE', result.flags);
        break;
    }
  }
}

TwitchClient.prototype.OnWebsocketError = function(event) {
  Util.Error(event);
}

TwitchClient.prototype.OnWebsocketClose = function(event) {
  this._pending_channels = this._channels;
  this._channels = [];
}

