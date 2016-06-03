/*!
    Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  'use strict';

  GGRC.Components('inlineEdit', {
    tag: 'inline-edit',
    template: can.view(
      GGRC.mustache_path +
      '/components/inline_edit/inline.mustache'
    ),
    scope: {
      instance: null,
      type: '@',
      caId: null,
      property: '@',
      value: null,
      values: null,
      readonly: false,  // whether or not the value can be edited
      isSaving: false,
      context: {
        isEdit: false,
        value: null,
        values: null
      },

      emptyText: '@',

      $rootEl: null,

      _EV_INSTANCE_SAVE: 'on-save',

      /**
       * Enter the edit mode if editing is allowed (i.e. the readonly option is
       * not set). If the readonly option is enabled, do not do anything.
       *
       * @param {can.Map} scope - the scope object itself (this)
       * @param {jQuery.Element} $el - the DOM element that triggered the event
       * @param {jQuery.Event} ev - the event object
       */
      enableEdit: function (scope, $el, ev) {
        ev.preventDefault();

        if (!this.attr('readonly')) {
          this.attr('context.isEdit', true);
        }
      },

      onCancel: function (ctx, el, ev) {
        ev.preventDefault();
        this.attr('context.isEdit', false);
        this.attr('context.value', this.attr('value'));
      },
      onSave: function (ctx, el, ev) {
        var caid = this.attr('caId');
        var property = this.attr('property');
        var instance = this.attr('instance');
        var oldValue = this.attr('value');
        var onSaveHandler = this.$rootEl.attr('can-' + this._EV_INSTANCE_SAVE);
        var value = this.attr('context.value');
        var type = this.attr('type');

        ev.preventDefault();

        // If a custom onSave handler is provided, trigger it, otherwise use
        // the component's onSave logic (deprecated, should be moved out of the
        // component as it is not the latter's resposnisiblity).
        if (onSaveHandler) {
          // CAUTION: triggering the event must come before changing any of the
          // scope attributes, otherwise the event gets lost for some reason
          this.$rootEl.triggerHandler({
            type: this._EV_INSTANCE_SAVE,
            oldVal: oldValue,
            newVal: value
          });

          this.attr('context.isEdit', false);
          return;
        }

        this.attr('context.isEdit', false);
        if (oldValue === value) {
          return;
        }

        this.attr('isSaving', true);
        instance.refresh().then(function () {
          if (this.attr('caId')) {
            if (type === 'checkbox') {
              value = value ? 1 : 0;
            }
            if (type === 'person') {
              value = value ? ('Person:' + value.id) : value;
            }
            instance.attr('custom_attributes.' + caid, value);
          } else {
            instance.attr(property, value);
          }

          instance.save()
            .done(function () {
              $(document.body).trigger('ajax:flash', {
                success: 'Saved'
              });
            })
            .fail(function () {
              $(document.body).trigger('ajax:flash', {
                error: 'There was a problem saving'
              });
            })
            .always(function () {
              this.attr('isSaving', false);
            }.bind(this));
        }.bind(this));
      }
    },
    init: function (element, options) {
      var scope = this.scope;
      var value = scope.attr('value');
      var values = scope.attr('values');
      var property = scope.attr('property');
      var instance = scope.attr('instance');
      var type = scope.attr('type');

      scope.attr('$rootEl', $(element));

      if (scope.attr('caId')) {
        if (type === 'checkbox') {
          value = value === '1';
        } else if (type === 'person') {
          if (value && value instanceof can.Map) {
            value = value.serialize();
          }
          value = _.isEmpty(value) ? undefined : value;
        }

        if (!scope.attr('emptyText')) {
          scope.attr('emptyText', 'None');  // default for custom attributes
        }
      }

      if (property) {
        value = instance.attr(property);
      }
      scope.attr('context.value', value);

      if (values && _.isString(values)) {
        values = values.split(',');
      }
      scope.attr('context.values', values);
    },
    events: {
      click: function () {
        this.scope.attr('isInside', true);
      },
      '{window} click': function (el, ev) {
        if (this.scope.attr('context.isEdit') &&
            !this.scope.attr('isInside')) {
          this.scope.onSave(this.scope, el, ev);
        }
        this.scope.attr('isInside', false);
      }
    }
  });
})(window.can, window.can.$);
