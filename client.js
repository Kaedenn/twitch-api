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

  this._internal_hooks = {
    'WSMESSAGE': 1,
    'WSMESSAGELINE': 1
  }

  this._dispatch = function(hook, args) {
    if (this._hooks[hook] && this._hooks[hook].length > 0) {
      for (var func in this._hooks[hook]) {
        func.apply(this, args);
      }
    } else if (this._hooks[hook] && !(hook in this._internal_hooks)) {
      Util.Warn(`Unhandled event ${hook}:`, args);
    }
  }

  this.Connect = function() {
    if (this._ws !== null) {
      this._ws.close();
    }

    for (var c of this._channels) {
      this._pending_channels.push(c);
    }
    this._channels = [];
    this._rooms = {};

    var client = this;
    this._ws = new WebSocket('wss://irc-ws.chat.twitch.tv');
    this._ws.client = this;
    this._ws.onopen = function() { client.OnWebsocketOpen(opts.Name, opts.Pass); };
    this._ws.onmessage = function(m) { client.OnWebsocketMessage(m); };
    this._ws.onerror = function(e) { client.OnWebsocketError(e); };
    this._ws.onclose = function(e) { client.OnWebsocketClise(e); };
  }
}

TwitchClient.prototype._getRooms = function(channel) {
  console.log("_getRooms", channel);
  var client = this;
  function onGetRooms(json) {
    for (var room_def of json["rooms"]) {
      client._rooms[channel].rooms[room_def["name"]] = room_def;
    }
  }
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    console.log(this.readyState,  this.status);
    if (this.readyState == 4 && this.status == 200) {
      var json = JSON.parse(this.responseText);
      onGetRooms(json);
    }
  }
  req.open('GET', Twitch.URL.GetRooms(channel));
  req.setRequestHeader('Client-ID', this._client_id);
  req.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
  req.send();
  console.log(req);
}

TwitchClient.prototype.debug = function() {
  if (!this._debug) { return; }
  var save_stacktrim = [Util.StackTrim, Util.StackTrimEnd];
  Util.StackTrim = 1;
  Util.StackTrimEnd = 1;
  Util.Log.apply(Util.Log, arguments);
  Util.StackTrim = save_stacktrim[0];
  Util.StackTrim = save_stacktrim[1];
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
        Util.Warn(`JoinChannel: Already in ${ch}`);
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
      Util.Warn(`LeaveChannel: Not in channel ${ch}`);
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
  this._ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
  this.SetName(name, pass);
  var chlist = this._pending_channels;
  this._pending_channels = [];
  for (var i of chlist) {
    this.JoinChannel(i);
  }
}

TwitchClient.prototype.OnWebsocketMessage = function(msg) {
  this._dispatch('WSMESSAGE', msg);
  var data = msg.data.split('\r\n');
  for (var line of data) {
    if (line.trim() == '') {
      continue;
    }
    this._dispatch('WSMESSAGELINE', line);
    var result = this.ParseWSMessage(line);
    switch (result.cmd) {
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
        this._rooms[result.channel.channel] = {
          id: result.flags['room-id'],
          channel: result.channel
        };
        this._getRooms(result.flags['room-id']);
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
  Util.Error(error);
}

TwitchClient.prototype.OnWebsocketClose = function(e) {
  this.debug('OnWebsocketClose', arguments);
  this._pending_channels = this._channels;
  this._channels = [];
}

TwitchClient.prototype.ParseWSMessage = function(line) {
  this.debug(line);
  var result = { cmd: null };
  var parts = line.split(" ");
  var data = {};
  if (parts[0].startsWith('@')) {
    data = Twitch.ParseData(parts[0]);
    parts.shift();
  }
  if (parts[0] == "PING") {
    /* "PING <server>" */
    result.cmd = "PING";
    result.arg = parts[1];
  } else if (line.indexOf('CAP * ACK') > -1) {
    /* :<server> CAP * ACK <flags...> */
    result.cmd = 'ACK';
    result.operation = 'CAP';
    result.server = parts[0].replace(/^:/, "");
    result.flags = line.substr(line.indexOf(':', 1)+1).split();
  } else if (parts[1] == "375" || parts[1] == "376") {
    /* 375: Start TOPIC listing
     * 376: End TOPIC listing */
    /* :<server> <code> <username> :<message> */
    result.cmd = "OTHER";
    result.code = parts[1];
  } else if (parts[1].match(/00[1-9]/) || parts[1] == "372") {
    /* :<server> 00[1-4] <username> :<message> */
    result.cmd = "TOPIC";
    result.code = parts[1];
    result.server = parts[0].replace(/^:/, "");
  } else if (parts[1] == "353") {
    /* NAMES listing entry */
    /* :<user> 353 <mode> <channel> :<username> */
    result.cmd = "NAMES";
    result.user = parts[0].replace(/^:/, "");
    result.mode = parts[2];
    result.channel = Twitch.ParseChannel(parts[3]);
    result.username = Twitch.ParseUser(parts[4]);
  } else if (parts[1] == "366") {
    /* End of NAMES listing */
    result.cmd = "OTHER";
  } else if (parts[1] == "JOIN" || parts[1] == "PART") {
    /* ":<user> JOIN <channel> */
    /* ":<user> PART <channel> */
    result.cmd = parts[1];
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == "MODE") {
    /* ":<user> MODE <channel> <modset> " */
    result.cmd = "MODE";
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.modeset = parts.splice(2);
  } else if (parts[1] == "PRIVMSG") {
    /* [@<flags>] :<user> PRIVMSG <channel> :<msg> */
    result.cmd = "PRIVMSG";
    result.flags = data;
    result.user = Twitch.ParseUser(parts[0]);
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
  } else if (parts[1] == 'ROOMSTATE') {
    /* [@<flags>] :<server> ROOMSTATE <channel> */
    result.cmd = "ROOMSTATE";
    result.flags = data;
    result.channel = Twitch.ParseChannel(parts[2]);
  } else if (parts[1] == 'USERNOTICE') {
    result.cmd = "USERNOTICE";
    /* [@<flags>] :<server> USERNOTICE <channel> */
    /* [@<flags>] :<server> USERNOTICE <channel> :<message> */
    result.flags = data;
    result.channel = Twitch.ParseChannel(parts[2]);
    result.message = line.substr(line.indexOf(':', line.indexOf(parts[2])) + 1);
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
    this.debug("Parsed", result);
  } else {
    this.debug('OnWebsocketMessage: unknown message:', parts);
  }
  return result;
}

