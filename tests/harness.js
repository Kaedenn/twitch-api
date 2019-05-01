/* Twitch Chat API Test Harness */

class Tests {
  constructor() {
    this._e = $(document.createElement('div'));
    this._e.attr("id", "output");
    this._e.addClass("output");
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

  out(val) {
    let e = $(`<span class="data"></span>`);
    if (typeof(val) === "string") {
      e.html(val);
    } else {
      e.append(val);
    }
    let $l = $(`<div class="line"></div>`);
    $l.append($(`<span class="ts">${Number(new Date())}&nbsp;</span>`));
    $l.append(e);
    this._e.append($l);
    if ($l.get() && $l.get()[0].scrollIntoView) {
      $l.get()[0].scrollIntoView();
    }
  }

  add(name, func) {
    this._tests.push([name, func]);
  }

  run() {
    for (let t of this._tests) {
      let obj = {};
      obj.name = t[0];
      obj.func = t[1];
      obj.out = this.out.bind(this);
      obj.escape = this.escape.bind(this);
      obj.host = this;
      (obj.func.bind(obj))();
    }
  }
}
