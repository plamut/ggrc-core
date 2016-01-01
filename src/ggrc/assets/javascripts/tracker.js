/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: dan@reciprocitylabs.com
    Maintained By: dan@reciprocitylabs.com
*/

GGRC = window.GGRC || {};

GGRC.Tracker = GGRC.Tracker || {};

if (typeof st === 'number') {
  GGRC.Tracker.timing('dashboard', 'load_scripts', Date.now() - st, 'dashboard.js script tag to exec start');
}
window.st = Date.now();

GGRC.Tracker.init = function () {
  var i;
  GGRC.Tracker.ga = this._ga;

  //  Emit any events already recorded
  for (i = 0; i < this._pending_emit; i++) {
    this.emit(this._pending_emit[i]);
  }
  delete this._pending_emit;

  this.setup_jQuery();
};

GGRC.Tracker._ga = function (func, data) {
  if (window.GoogleAnalyticsObject) {
    window[window.GoogleAnalyticsObject](func, data);
  }
};

GGRC.Tracker.setup_jQuery = function () {
  //  Setup jQuery AJAX tracking once jQuery is available
  var that = this;
  if (this._setup_jQuery_done) {
    return;
  }
  if (!window.jQuery) {
    setTimeout(function () {
      that.setup_jQuery();
    }, 20);
  } else {
    $.ajaxTransport('json', this.api_timing_transport);
  }
};

GGRC.Tracker.emit = function (data) {
  if (this.ga) {
    this._events = this._events || [];
    this._events.push(data);
    this.ga('send', data);
  } else {
    this._pending_emit = this._pending_emit || [];
    this._pending_emit.push(data);
  }
};

GGRC.Tracker.event = function (category, action, label, value) {
  var data = {
    hitType: 'event',
    eventCategory: category,
    eventAction: action
  };
  if (label) {
    data.eventLabel = label;
  }
  if (value) {
    data.eventValue = Number(value);
  }
  this.emit(data);
};

GGRC.Tracker.timing = function (category, variable, value, label) {
  var data = {
    hitType: 'timing'
  };
  data.timingCategory = category;
  data.timingVar = variable;
  data.timingValue = Number(value);
  if (label) {
    data.timingLabel = label;
  }
  this.emit(data);
};

GGRC.Tracker.exception = function (description, fatal) {
  var data = {
    hitType: 'exception'
  };
  data.exDescription = description;
  if (arguments.length > 1) {
    data.exFatal = !!fatal;
  }
  this.emit(data);
};

GGRC.Tracker.start = function (category, action, label) {
  var data;
  if (!this._pending_timings) {
    this._pending_timings = {};
  }
  if (!this._pending_timings[category]) {
    this._pending_timings[category] = {};
  }
  if (!this._pending_timings[category][action]) {
    data = {
      start: Date.now()
    };
    if (label) {
      data.label = label;
    }
    this._pending_timings[category][action] = data;
    return function () {
      GGRC.Tracker.stop(category, action);
    };
  } else {
    //  Ignore re-entrant events for now by returning no-op function
    return function () {};
  }
};

GGRC.Tracker.stop = function (category, action, label) {
  var data;
  if (this._pending_timings[category]) {
    if (this._pending_timings[category][action]) {
      data = this._pending_timings[category][action];
      this.timing(
        category, action, Date.now() - data.start, data.label || label);
      delete this._pending_timings[category][action];
    }
    if (Object.keys(this._pending_timings[category]).length === 0) {
      delete this._pending_timings[category];
    }
    if (Object.keys(this._pending_timings).length === 0) {
      delete this._pending_timings;
    }
  }
};

GGRC.Tracker.api_timing_transport = function (options, _originalOptions, _jqXHR) {
  var url;
  var match;
  var tracker_stop;
  if (_originalOptions._canonical_url) {
    // console.debug("Found re-entrant request: " + _originalOptions._canonical_url);
    return;
  }

  url = options.url;
  match = url.match(/^(.*)([?&])_=\d+(?:([?&])(.*))?$/);

  if (match) {
    if (match[4]) {
      url = match[1] + match[2] + match[4];
    } else {
      url = match[1];
    }
  }

  _originalOptions._canonical_url = url;

  tracker_stop = null;

  return {
    send: function (headers, completeCallback) {
      tracker_stop = GGRC.Tracker.start('AJAX:' + options.type, url);

      jQuery.ajax(_originalOptions).done(function (data, statusText, jqXHR) {
        tracker_stop();
        completeCallback(
          jqXHR.status,
          statusText,
          {json: data},
          jqXHR.getAllResponseHeaders());
      }).fail(function (jqXHR, message, statusText) {
        GGRC.Tracker.exception(
          ['AJAX request failed', statusText, options.type, url].join(': '));
        completeCallback(
          jqXHR.status,
          statusText,
          {text: jqXHR.responseText},
          jqXHR.getAllResponseHeaders());
      });
    },
    abort: function () {
      console.debug('Aborted ajax');
    }
  };
};

GGRC.Tracker.setup_jQuery();
