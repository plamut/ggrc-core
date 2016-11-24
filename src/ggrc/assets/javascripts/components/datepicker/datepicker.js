/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, GGRC, moment) {
  'use strict';

  GGRC.Components('datepicker', {
    tag: 'datepicker',
    template: can.view(
      GGRC.mustache_path +
      '/components/datepicker/datepicker.mustache'
    ),
    scope: {
      date: null,
      format: '@',
      helptext: '@',
      isShown: false,
      pattern: 'MM/DD/YYYY',
      setMinDate: null,
      setMaxDate: null,
      _date: null,
      required: '@',
      define: {
        label: {
          type: 'string'
        },
        persistent: {
          type: 'boolean',
          'default': false
        }
      },
      onSelect: function (val, ev) {
        this.attr('_date', val);
        this.attr('isShown', false);
      },
      onFocus: function (el, ev) {
        this.attr('showTop', false);
        this.attr('isShown', true);

        if (!GGRC.Utils.inViewport(this.picker)) {
          this.attr('showTop', true);
        }
      }
    },
    events: {
      inserted: function () {
        var element = this.element.find('.datepicker__calendar');
        var date = this.getDate(this.scope.date);

        element.datepicker({
          altField: this.element.find('.datepicker__input'),
          onSelect: this.scope.onSelect.bind(this.scope)
        });

        this.scope.attr('picker', element);

        this.scope.picker.datepicker('setDate', date);
        if (this.scope.setMinDate) {
          this.updateDate('minDate', this.scope.setMinDate);
        }
        if (this.scope.setMaxDate) {
          this.updateDate('maxDate', this.scope.setMaxDate);
        }
        this.scope._date = date;
      },
      getDate: function (date) {
        if (date instanceof Date) {
          return moment(date).format(this.scope.pattern);
        }
        if (moment(date, 'YYYY-MM-DD').isValid()) {
          return moment(date).format(this.scope.pattern);
        }
        if (this.isValidDate(date)) {
          return date;
        }
        return null;
      },
      isValidDate: function (date) {
        return moment(date, this.scope.pattern, true).isValid();
      },
      updateDate: function (type, date) {
        var types = {
          minDate: function () {
            date.add(1, 'day');
          },
          maxDate: function () {
            date.subtract(1, 'day');
          }
        };
        if (!date) {
          this.scope.picker.datepicker('option', type, null);
          return;
        }
        date = moment(date, "MM/DD/YYYY");

        if (types[type]) {
          types[type]();
        }
        date = date.toDate();
        this.scope.picker.datepicker('option', type, date);
        return date;
      },
      '{scope} setMinDate': function (scope, ev, date) {
        var updated = this.updateDate('minDate', date);
        if (this.scope.attr('date') < updated) {
          this.scope.attr('_date', moment(updated).format(this.scope.pattern));
        }
      },
      '{scope} setMaxDate': function (scope, ev, date) {
        this.updateDate('maxDate', date);
      },
      '{scope} _date': function (scope, ev, val) {
        scope.attr('date', val);
        scope.picker.datepicker('setDate', val);
      },
      '{window} mousedown': function (el, ev) {
        var isInside;

        if (this.scope.attr('persistent')) {
          return;
        }
        isInside = GGRC.Utils.events.isInnerClick(this.element, ev.target);

        if (this.scope.isShown && !isInside) {
          this.scope.attr('isShown', false);
        }
      }
    },
    helpers: {
      isHidden: function (opts) {
        if (this.attr('isShown') || this.attr('persistent')) {
          return opts.inverse();
        }
        return opts.fn();
      }
    }
  });
})(window.can, window.GGRC, window.moment);
