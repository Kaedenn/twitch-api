/* Twitch Chat API Test Harness */

class Tests {
  constructor() {
    this._e = $(document.createElement('div'));
    this._e.attr("id", "output");
    this._e.addClass("output");
    this._e.css("font-family", "monospace");
    $("body").append(this._e);

    this._tests = [];
  }

  escape(s) {
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
  }

  out(val, esc=false) {
    let e = $(`<span class="data"></span>`);
    if (typeof(val) === "string") {
      if (esc) {
        e.text(val);
      } else {
        e.html(val);
      }
    } else {
      e.append(val);
    }
    let $l = $(`<div class="line"></div>`);
    $l.append($(`<span class="ts">${Number(new Date())}&nbsp;|&nbsp;</span>`));
    $l.append(e);
    this._e.append($l);
    if ($l.get() && $l.get()[0].scrollIntoView) {
      $l.get()[0].scrollIntoView();
    }
  }

  add(name, func) {
    this._tests.push([name, func]);
  }

  index(name, func=null) {
    for (let i = 0; i < this._tests.length; ++i) {
      let t = this._tests[i];
      if (t[0] == name && (t[1] == null || t[1] == func)) {
        return i;
      }
    }
    return -1;
  }

  run() {
    for (let t of this._tests) {
      let obj = {};
      obj.name = t[0];
      obj.func = t[1];
      obj.out = this.out.bind(this);
      obj.escape = this.escape.bind(this);
      obj.host = this;
      try {
        let result = (obj.func.bind(obj))();
        if (!result) {
          this.fail(obj, "false", result);
        }
      } catch (e) {
        this.fail(obj, "error", e);
      }
    }
  }

  pass(test) {
    var t = this._tests[this.index(test.name)];
    t.pass = true;
  }

  fail(test, reason, cause) {
    var t = this._tests[this.index(test.name)];
    var cause = cause ? cause.toString() : null;
    this.out(`${test.name} failed: ${reason}: ${cause}`);
  }
}
