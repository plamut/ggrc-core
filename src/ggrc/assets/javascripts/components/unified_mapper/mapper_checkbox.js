/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  'use strict';

  GGRC.Components('mapperCheckbox', {
    tag: 'mapper-checkbox',
    template: '<content />',
    scope: {
      instance: null,
      checkbox: function (status) {
        if (this.attr('mapper.getList') && !this.attr('appended')) {
          return false;
        }
        return (
          this.attr('isMapped') ||
          this.attr('select_state') ||
          this.attr('appended')
        );
      },
      define: {
        isMapped: {
          type: 'boolean',
          'default': false
        },
        allowedToMap: {
          type: 'boolean',
          'default': false
        }
      }
    },
    init: function () {
      var scope = this.scope;
      var parentInstance = scope.attr('mapper.parentInstance');
      var instance = scope.attr('instance');
      var isMapped = GGRC.Utils.is_mapped(parentInstance, instance);
      var hasPending = GGRC.Utils.hasPending(parentInstance, instance, 'add');

      if (isMapped || hasPending) {
        scope.attr('isMapped', true);
        scope.attr('checkbox', true);
      }
    },
    events: {
      '{scope} selected': function () {
        var checked = _.findWhere(this.scope.attr('selected'), {
          id: Number(this.scope.attr('instance').id)
        });
        // Avoid null and undefined
        if (!checked) {
          checked = false;
        }
        this.element
          .find('.object-check-single')
          .prop('checked', checked);
      },
      '.object-check-single change': function (el, ev) {
        var scope = this.scope;
        var instance = scope.attr('instance');
        var item = _.find(scope.attr('options'), function (option) {
          return option.instance.id === instance.id &&
                 option.instance.type === instance.type;
        });
        var status = el.prop('checked');
        var selected = this.scope.attr('selected');
        var needle = {id: item.instance.id, type: item.instance.type};
        var index;

        if (el.prop('disabled') || el.hasClass('disabled')) {
          return false;
        }

        if (!status) {
          index = _.findIndex(selected, needle);
          selected.splice(index, 1);
        } else if (!_.findWhere(selected, needle)) {
          selected.push({
            id: item.instance.id,
            type: item.instance.type,
            href: item.instance.href
          });
        }
      }
    },
    helpers: {
      not_allowed_to_map: function (options) {
        if (this.attr('mapper.getList')) {
          return options.inverse();
        }
        if (!this.attr('allowedToMap')) {
          return options.fn();
        }
        return options.inverse();
      },
      is_disabled: function (options) {
        if (this.attr('is_saving') ||
            this.attr('is_loading')) {
          return options.fn();
        }
        if (this.attr('mapper.getList')) {
          return options.inverse();
        }
        if (this.attr('isMapped') ||
            !this.attr('allowedToMap')) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });
})(window.can, window.can.$);
