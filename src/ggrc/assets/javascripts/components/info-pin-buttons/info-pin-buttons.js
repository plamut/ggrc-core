/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can) {
  'use strict';

  GGRC.Components('infoPinButtons', {
    tag: 'info-pin-buttons',
    template: can.view(
      GGRC.mustache_path +
      '/components/info-pin-buttons/info-pin-buttons.mustache'
    ),
    scope: {
      onChangeMaximizedState: null,
      onClose: null,
      define: {
        maximized: {
          type: 'boolean',
          'default': false
        }
      },
      toggleSize: function (scope, el, ev) {
        var maximized = !this.attr('maximized');
        var onChangeMaximizedState = Mustache.resolve(this.onChangeMaximizedState);
        ev.preventDefault();
        this.attr('maximized', maximized);
        onChangeMaximizedState(maximized);
      },
      close: function (scope, el, ev) {
        var onClose = Mustache.resolve(this.onClose);
        el.find('[rel=tooltip]').data('tooltip').hide();
        ev.preventDefault();
        onClose();
      }
    }
  });
})(window.can);
