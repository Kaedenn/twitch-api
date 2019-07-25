
global.crypto = require("crypto");
const {JSDOM} = require("jsdom");

const dom = new JSDOM(`<!DOCTYPE html><head><title>twapi tests</title></head><body></body></html>`);
global.window = dom.window;

/* Persist window.* into global.* */
for (let key of Reflect.ownKeys(dom.window)) {
  if (!global.hasOwnProperty(key)) {
    /* These raise SecurityError */
    if (key === "localStorage") continue;
    if (key === "sessionStorage") continue;
    global[key] = dom.window[key];
  }
}

/* Define localStorage */
const Storage = require("jsdom/lib/jsdom/living/generated/Storage.js");
delete window.localStorage;
window.localStorage = Storage.create([], {
  associatedWindow: dom.window,
  storageArea: new Map(),
  type: "localStorage",
  url: dom.window.document.documentURI,
  storageQuota: 1000000
});

function getOwnKeysOf(obj) {
  return Reflect.ownKeys(global.window).map((k) => JSON.stringify(k)).sort();
}

