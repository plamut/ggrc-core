/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can) {
  'use strict';

  GGRC.Components('clickCounterWrapper', {
    tag: 'click-counter-wrapper',
    template: '<content></content>',
    viewModel: {
      initialClickCount: 5
    }
  });

  GGRC.Components('clickCounter', {
    tag: 'click-counter',
    template: can.view(
      GGRC.mustache_path +
      '/components/click_counter/click_counter.mustache'
    ),
    viewModel: {
      count: null,

      // fake the stats to show double the amount of actual clicks
      inflatedStats: function () {
        return this.attr('count') * 2;
      },

      _updateCount: function () {
        this.attr('count', this.count + 1);
      }
    },

    events: {
      '.clickable click': function ($el, ev) {
        this.viewModel._updateCount();
      }
    }
  });
})(window.can);
