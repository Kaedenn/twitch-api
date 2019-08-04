
"use strict";

/* Generic test harness for all tests; specific harnesses for individual tests
 * can be found in the test/harness/ directory */

/* TODO/FIXME:
 * CSS: JSDOM doesn't support stylesheets. Migrate to using puppeteer?
 */

function _init(export_func) {
  const {JSDOM} = require("jsdom");
  const fs = require("fs");
  const path = require("path");

  /* Define document HTML */
  const dom = new JSDOM(`
<!DOCTYPE html>
<head>
<title>TWAPI Tests</title>
<style type="text/css">
:root {
  --var: 1;
  --value: var(--var);
  --value-default: var(--var-bad, 2);
}
.span1 { color: red; }
#id1 { background-color: white; }
</style>
</head>
<body>
  <span class="span1" id="id1">text</span>
</body>
</html>`);

  /* Define localStorage */
  const Storage = require("jsdom/lib/jsdom/living/generated/Storage.js");
  delete dom.window.localStorage;
  dom.window.localStorage = Storage.create([], {
    associatedWindow: dom.window,
    storageArea: new Map(),
    type: "localStorage",
    url: dom.window.document.documentURI,
    storageQuota: 1000000
  });

  /* Load specific harness from the test/harness directory */
  function loadHarness(name) {
    const hpath = path.join("test/harness", name + ".js");
    return new Promise((resolve, reject) => {
      fs.readFile(hpath, "ASCII", (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(eval(data));
        }
      });
    });
  }

  export_func("assert", require("assert"));
  export_func("crypto", require("crypto"));
  export_func("window", dom.window);
  export_func("document", dom.window.document);
  export_func("WebSocket", dom.window.WebSocket);
  export_func("loadHarness", loadHarness);
}

_init(function(label, value) {
  global[label] = value;
});

