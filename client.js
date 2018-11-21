"use strict";

/* Reference materials:
 *  https://dev.twitch.tv/docs/irc/msg-id/
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
  this._client_id = opts.ClientId;
  this._ws = null;

  this._hooks = {
    'PING': [],
    'JOIN': [],
    'PART': [],
    'MODE': [],
    'WSMESSAGE': [],
    'WSMESSAGELINE': [],
    'PRIVMSG': [],
    'ROOMSTATE': [],
    'USERNOTICE': [],
    'SUB': [],
    'RESUB': [],
    'GIFTSUB': []
  };

  this._dispatch = function(hook, args) {
    for (var func in this._hooks[hook]) {
      func.apply(this, args);
    }
  }

  this.Connect = function() {
    if (this._ws !== null) {
      this._ws.close();
    }

    for (var c of client._channels) {
      this._pending_channels.push(c);
    }
    this.channels = [];

    var client = this;
    this._ws = new WebSocket('wss://irc-ws.chat.twitch.tv');
    this._ws.onopen = function() { client.OnWebsocketOpen(opts.Name, opts.Pass); };
    this._ws.onmessage = function(m) { client.OnWebsocketMessage(m); };
    this._ws.onerror = function(e) { client.OnWebsocketError(e); };
    this._ws.onclose = function(e) { client.OnWebsocketClise(e); };
  }
}

TwitchClient.prototype.debug = function() {
  if (this._debug) {
    console.log('TwitchClient>', arguments);
  }
}

TwitchClient.prototype.on = function(action, callback) {
  this._hooks[action].push(callback);
}

TwitchClient.prototype.JoinChannel = function(channel) {
  this.debug('JoinChannel', channel);
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
        console.log(`JoinChannel: Already in ${ch}`);
      }
    }
  } else if (this._pending_channels.indexOf(ch) == -1) {
    this._pending_channels.push(ch);
  }
}

TwitchClient.prototype.LeaveChannel = function(channel) {
  this.debug('LeaveChannel', channel);
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
      console.log(`LeaveChannel: Not in channel ${ch}`);
    }
  }
}

TwitchClient.prototype.SetName = function(name, pass) {
  if (name && pass) {
    this._username = name;
    this._ws.send(`PASS ${pass.indexOf('oauth:') == 0 ? '' : 'oauth:'} ${pass}`);
    this._ws.send(`NICK ${name}`);
  } else {
    this._username = `justinfan${Math.floor(Math.random() * 999999)}`;
    this._ws.send(`NICK ${this._username}`);
  }
  this.debug('SetName', this._username);
}

TwitchClient.prototype.SendMessage = function(channel, message) {
  if (channel.indexOf('#') != 0) {
    channel = "#" + channel;
  }
  this._ws.send(`PRIVMSG ${channel} :${message}`);
}

TwitchClient.prototype.OnWebsocketOpen = function(name, pass) {
  this.debug('OnWebsocketOpen', arguments);
  this.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
  this.SetName(name, pass);
  for (var i of self._pending_channels) {
    this.JoinChannel(i);
  }
}

TwitchClient.prototype.OnWebsocketMessage = function(msg) {
  this.debug('OnWebsocketMessage', arguments);
  this._dispatch('WSMESSAGE', msg);
  var data = msg.data.split('\r\n');
  for (var line of data) {
    if (line.trim() == '') {
      continue;
    }
    this._dispatch('WSMESSAGELINE', line);
    var parsed = this.ParseWSMessage(line);
    switch (parsed.cmd) {
      case "PING":
        this._ws.send(`PONG ${result.arg}`);
        this._dispatch("PING", result.arg);
        break;
      case "JOIN":
        this._dispatch("JOIN", result.user, result.channel);
        break;
      case "PART":
        this._dispatch("PART", result.user, result.channel);
        break;
      case "MODE":
        this._dispatch("MODE", result.user, result.channel, result.modset);
        break;
      case "PRIVMSG":
        this._dispatch("PRIVMSG", result.user, result.channel, result.flags, result.message);
        break;
      case "ROOMSTATE":
        this._dispatch("ROOMSTATE", result.channel, result.flags);
        break;
      case "USERNOTICE":
        this._dispatch("USERNOTICE", result.channel, result.flags, result.message);
        if (result.sub_kind == 'SUB') {
          this._dispatch('SUB', result.sub_user, result.channel, result.sub_tier);
        } else if (result.sub_kind == 'RESUB') {
          this._dispatch('RESUB', result.sub_user, result.channel, result.sub_tier, result.sub_months);
        } else if (result.sub_kind == 'GIFTSUB') {
          this._dispatch('GIFTSUB', result.sub_user, result.channel, result.sub_tier, result.sub_gifting_user, result.sub_months);
        }
        break;
    }
  }
}

TwitchClient.prototype.OnWebsocketError = function(error) {
  this.debug('OnWebsocketError', arguments);
}

TwitchClient.prototype.OnWebsocketClose = function(e) {
  this.debug('OnWebsocketClose', arguments);
  this._pending_channels = this._channels;
  this._channels = [];
}

TwitchClient.prototype.ParseUser = function(uspec) {
  /* :<name>!<username>@<username>.tmi.twitch.tv*/
  if (uspec.indexOf(':') == 0) {
    uspec = uspec.substr(1);
  }
  return uspec.split('!')[0];
}

TwitchClient.prototype.ParseMessageData = function(dataString) {
  /* @key=value;key=value;... */
  if (dataString.indexOf('@') == 0) {
    dataString = dataString.substr(1);
  }
  var parts = dataString.split(';');
  var data = {};
  for (var item of dataString.split(';')) {
    var [key, val] = item.split('=');
    val = val.replace('\\\\s', ' ');
    data[key] = val;
  }
  return data;
}

TwitchClient.prototype.ParseWSMessage = function(line) {
  var result = { cmd: null };
  var parts = line.split(" ");
  if (parts[0] == "PING") {
    /* "PING <server>" */
    result.cmd = "PING";
    result.arg = parts[1];
  } else if (parts[1] == "JOIN" || parts[1] == "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = this.ParseUser(parts[0]);
    result.channel = parts[2];
  } else if (parts[1] == "MODE") {
    /* ":<user> MODE <channel> <modset> " */
    result.cmd = "MODE";
    result.user = this.ParseUser(parts[0]);
    result.channel = parts[2];
    result.modeset = parts.splice(2);
  } else if (parts[2] == "PRIVMSG") {
    /* @<flags> :<user> PRIVMSG <channel> :<msg> */
    result.cmd = "PRIVMSG";
    result.flags = this.ParseMessageData(parts[0]);
    result.user = this.ParseUser(parts[1]);
    result.channel = parts[3];
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[3])) + 1);
  } else if (parts[2] == 'ROOMSTATE') {
    /* @<flags> :server ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = this.ParseMessageData(parts[0]);
    result.channel = parts[3];
  } else if (parts[2] == 'USERNOTICE') {
    result.cmd = "USERNOTICE";
    /* @<flags> <server> USERNOTICE <channel> */
    /* @<flags> <server> USERNOTICE <channel> :<message> */
    result.flags = this.ParseMessageData(parts[0]);
    result.channel = parts[3];
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[3])) + 1);
    result.issub = false;
    result.sub_kind = null;
    result.sub_user = null;
    result.sub_gifting_user = null;
    result.sub_months = null;
    if (result.flags['msg-id']) {
      switch (result.flags['msg-id']) {
        case 'sub':
          result.issub = true;
          result.sub_kind = 'SUB';
          result.sub_user = result.flags['login'];
          result.sub_months = result.flags['msg-param-sub-months'];
          break;
        case 'resub':
          result.issub = true;
          result.sub_kind = 'RESUB';
          result.sub_user = result.flags['login'];
          result.sub_months = result.flags['msg-param-sub-months'];
          break;
        case 'subgift':
          result.issub = true;
          result.sub_kind = 'GIFTSUB';
          result.sub_gifting_user = result.flags['login'];
          result.sub_user = result.flags['msg-param-recipient-user-name'];
          result.sub_months = result.flags['msg-param-sub-months'];
          break;
      }
    }
  } else {
    this.debug('OnWebsocketMessage: unknown message:', parts);
  }
  return result;
}

