/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  'use strict';

  /**
   * A Control for dynamically injecting (and removing) spinners into the page.
   *
   * By design, only one spinner can be active at a time (per each Control
   * instance... although it is primarily meant to be used as a singleton).
   *
   * @class GGRC.Controllers.SpinnerInjector
   */
  var Ctrl = can.Control.extend('GGRC.Controllers.SpinnerInjector', {
    SPINNER_TEMPLATE: [
      '<spinner',
      '  size="{spinnerSize}"',
      '  extra-css-class="{extraCssClass}"',
      '  toggle="{visible}"',
      '  data-marker="SpinnerInjector"',
      '></spinner>'
    ].join('')
  }, {
    init: function ($el, options) {
      this.$spinner = null;
    },

    /**
     * Inject a spinner into the given container.
     *
     * If there exists another previously injected spinner, it is removed in
     * the process, even if located in a different container.
     *
     * @param {Object} $container - a jQuery-wrapped DOM element to inject the
     *   spinner into
     * @param {string} size - the size of the spinner as expected by the
     *  underlying spinner component
     * @param {string} extraCssClass - additional CSS class(es) to apply to the
     *   injected spinner as expected by the underlying spinner component
     */
    inject: function ($container, size, extraCssClass) {
      var renderer = can.stache(this.constructor.SPINNER_TEMPLATE);
      var fragment = renderer({
        spinnerSize: size,
        extraCssClass: extraCssClass,
        visible: true
      });

      this.remove();
      $container.append(fragment);

      this.$spinner = $container.find('[data-marker="SpinnerInjector"]');
    },

    /**
     * Remove the previously injected spinner from the DOM, if it exists.
     */
    remove: function () {
      if (this.$spinner) {
        this.$spinner.remove();
        this.$spinner = null;
      }
    }
  });

  GGRC.spinnerInjector = new Ctrl('body');
})(window.can, window.$);
