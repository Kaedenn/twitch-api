
global.crypto = require("crypto");

function ensureGlobal(path, value) {
  let items = typeof(path) === "string" ? [path] : Array.of(...path);
  let cobj = global;
  while (items.length > 1) {
    if (cobj.hasOwnProperty(items[0])) {
      cobj = cobj[items.shift()];
    } else {
      throw new Error(`Object ${cobj} lacks property ${items[0]}`);
    }
  }
  cobj[items[0]] = value;
}

/*
console.log(Reflect.ownKeys(global).sort((a, b) => {
  let as = "";
  let bs = "";
  try { as = `${a}`; } catch (e) { as = JSON.stringify(a); }
  try { bs = `${b}`; } catch (e) { bs = JSON.stringify(b); }
  if (as < bs) return -1;
  if (as > bs) return 1;
  return 0;
}));
*/

ensureGlobal("window", global);
ensureGlobal("navigator", {});
ensureGlobal("localStorage", {});

ensureGlobal("location", {});
ensureGlobal(["location", "origin"], null);
ensureGlobal(["location", "protocol"], "file:");
ensureGlobal(["location", "host"], "localhost");
ensureGlobal(["location", "hostname"], "localhost");
ensureGlobal(["location", "port"], "");
ensureGlobal(["location", "pathname"], process.cwd() + "/test/harness.js");
ensureGlobal(["location", "search"], "");
ensureGlobal(["location", "hash"], "");
ensureGlobal(["location", "href"], location.protocol + "//" + location.pathname + location.search + location.hash);
