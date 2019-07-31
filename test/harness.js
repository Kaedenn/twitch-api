
"use strict";

/* Generic test harness for all tests; specific harnesses for individual tests
 * can be found in the test/harness/ directory */

global.crypto = require("crypto");
const {JSDOM} = require("jsdom");
const fs = require("fs");
const path = require("path");

const dom = new JSDOM(
  `<!DOCTYPE html><head><title>twapi tests</title></head><body></body></html>`);
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

function loadHarness(name) {
  const hpath = path.join("test/harness", name + ".js");
  return new Promise((resolve, reject) => {
    fs.readFile(hpath, "ASCII", (err, data) => {
      if (err) {
        reject(err);
      } else {
        const resp = eval(data);
        resolve(resp);
      }
    });
  });
}

global.loadHarness = loadHarness;
