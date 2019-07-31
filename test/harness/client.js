
"use strict";

/* Specific harness for tests using the TwitchClient */

var TWUtil = require("../utility.js");
for (let [k, v] of Object.entries(TWUtil)) {
  global[k] = v;
}

var TWClient = require("../client.js");
for (let [k, v] of Object.entries(TWClient)) {
  global[k] = v;
}

const TestTMIUser = `kaedenn_!kaedenn_@kaedenn_.tmi.twitch.tv`;
const TestChannel = "#dwangoac";
const TestClientID = "1e47abl0sg42inth50wjerbzxh9mbs";

/* BuldMessage: rules:
 *  user: string: "user!user@user.tmi.twitch.tv"
 *  channel: string: "#channel"
 *  kaedenn: boolean; true to add predefined flags
 *  flags: object: {key: val, ...}
 * if a flag's val is null, then the flag is removed
 */
const BuildMessage = (rules) => {
  let result = "";
  const cmd = rules.command || "PRIVMSG";
  const user = rules.user || TestTMIUser;
  const ch = rules.channel || TestChannel;
  const message = rules.message || `Test message: ${JSON.stringify(rules)}`;
  let flagObj = {};

  /* rules.kaedenn: add my flags */
  if (rules.kaedenn) {
    flagObj["badge-info"] = "subscriber/12";
    flagObj["badges"] = "moderator/1,subscriber/12,bits/1000";
    flagObj["color"] = "#0262C1";
    flagObj["display-name"] = "Kaedenn";
    flagObj["flags"] = "";
    flagObj["id"] = "6ba8dc82-000f-4da6-9131-d69233b14e41";
    flagObj["mod"] = 1;
    flagObj["subscriber"] = 1;
    flagObj["turbo"] = 0;
    flagObj["emotes"] = "";
    flagObj["user-type"] = "mod";
    flagObj["user-id"] = "175437030";
    flagObj["room-id"] = "70067886";
    flagObj["tmi-sent-ts"] = Number(new Date());
  }

  /* rules.flags: {flag: value, ...} */
  for (let [flag, value] of Object.entries(rules.flags || {})) {
    if (value === null) {
      delete flagObj[flag];
    } else {
      flagObj[flag] = value;
    }
  }

  /* Append flags to the result */
  let flags = [];
  for (let [k, v] of Object.entries(flagObj)) {
    flags.push(`${k}=${Twitch.EncodeFlag(`${v}`)}`);
  }
  if (flags.length > 0) {
    result = `@${flags.join(";")} `;
  }

  result += `:${user} ${cmd} ${ch} :${message}`;
  return result;
};

const BuildEvent = (...args) => {
  if (args.length < 2 || args.length > 3) {
    throw new Error("Expected (cmd, msg) or (event, cmd, msg)");
  }
  let obj = TwitchEvent;
  if (args.length === 3) {
    obj = args.shift();
  }
  let [cmd, raw] = args;
  let parsed = Twitch.ParseIRCMessage(raw);
  if (obj === TwitchEvent) {
    return new (obj)(cmd, raw, parsed);
  } else if (obj === TwitchChatEvent) {
    return new (obj)(raw, parsed);
  } else if (obj === TwitchSubEvent) {
    return new (obj)(cmd, raw, parsed);
  } else {
    throw new Error("Not sure what to do with obj", obj);
  }
};

global.TestTMIUser = TestTMIUser;
global.TestChannel = TestChannel;
global.TestClientID = TestClientID;
global.BuildMessage = BuildMessage;
global.BuildEvent = BuildEvent;
