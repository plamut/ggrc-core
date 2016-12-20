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
      setMinDate: null,
      setMaxDate: null,
      _date: null,  // the internal value of the text input field
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
      // this is when date is changed through the datepicker
      // TOOD: docstring... when date is pickeed, it is already in ISO format,
      // because datepicker has been configured this way
      onSelect: function (val, ev) {
        this.attr('date', val);
        this.attr('isShown', false);
      },
      onFocus: function (el, ev) {
        this.attr('showTop', false);
        this.attr('isShown', true);

        if (!GGRC.Utils.inViewport(this.picker)) {
          this.attr('showTop', true);
        }
      },

      // Date formats for the actual selected value, and for the date as
      // displayed to the user. The Moment.js library and the jQuery datepicker
      // use different format notation, thus separate settings for each.
      // IMPORTANT: The pair of settings for each "type" of value (i.e. actual
      // value / display value) must be consistent across both libraries!
      MOMENT_ISO_DATE: 'YYYY-MM-DD',
      MOMENT_DISPLAY_FMT: 'MM/DD/YYYY',
      PICKER_ISO_DATE: 'yy-mm-dd',
      PICKER_DISPLAY_FMT: 'mm/dd/yy'
    },
    events: {
      inserted: function () {
        var scope = this.scope;
        var element = this.element.find('.datepicker__calendar');
        /////////////////
        //var displayFormat = this.scope.displayFormat || 'mm/dd/yy';
        scope.attr('displayFormat', scope.PICKER_DISPLAY_FMT);
        console.log('display format', scope.displayFormat);
        // TODO: should be moved one level up (to inline-edit component)
        /////////////

        var dateObj;
        var date = this.getDate(this.scope.date);

        console.log('after getDate()', date);

        element.datepicker({
          dateFormat: scope.PICKER_ISO_DATE,
          altField: this.element.find('.datepicker__input'),
          altFormat: scope.PICKER_DISPLAY_FMT,
          onSelect: this.scope.onSelect.bind(this.scope)
        });

        this.scope.attr('picker', element);

        if (date) {
          dateObj = moment.utc(date).toDate();
        } else {
          dateObj = null;
        }
        this.scope.picker.datepicker('setDate', dateObj);

        //////////
        // debugger;
        var minDate = this.getDate(this.scope.setMinDate);
        var maxDate = this.getDate(this.scope.setMaxDate);
        this.scope.attr('setMinDate', minDate);
        this.scope.attr('setMaxDate', maxDate);
        //////////////

        // TODO: this is still to be adjusted...
        if (this.scope.setMinDate) {
          this.updateDate('minDate', this.scope.setMinDate);
        }
        if (this.scope.setMaxDate) {
          this.updateDate('maxDate', this.scope.setMaxDate);
        }
      },
      // TODO: docstring!
      getDate: function (date) {
        var scope = this.scope;

        if (date instanceof Date) {
          // TODO: explain why not UTC!
          return moment(date).format(scope.MOMENT_ISO_DATE);
        }
        if (moment(date, scope.MOMENT_ISO_DATE).isValid()) {
          return moment.utc(date).format(scope.MOMENT_ISO_DATE);
        }
        if (this.isValidDate(date)) {
          return date;
        }
        return null;
      },
      isValidDate: function (date) {
        var scope = this.scope;
        return moment(date, scope.MOMENT_ISO_DATE, true).isValid();
      },

      // TODO: docstring, tests
      updateDate: function (type, date) {
        var scope = this.scope;

        var types = {
          minDate: function () {
            date.add(1, 'day');
          },
          maxDate: function () {
            date.subtract(1, 'day');
          }
        };
        // debugger;  // TODO: another format?
        if (!date) {
          this.scope.picker.datepicker('option', type, null);
          return;
        }

        if (date instanceof Date) {
          // TODO: explain why not UTC! to get rid of timezone
          date = moment(date).format(scope.MOMENT_ISO_DATE);
        }
        date = moment.utc(date);

        if (types[type]) {
          types[type]();
        }
        date = date.toDate();
        this.scope.picker.datepicker('option', type, date);
        return date;
      },
      '{scope} setMinDate': function (scope, ev, date) {
        // debugger;
        var currentDateObj = null;
        var updated = this.updateDate('minDate', date);

        if (scope.date) {
          currentDateObj = moment.utc(scope.date).toDate();
          if (currentDateObj < updated) {
            // TODO: extract hardcoded siplay format to variable!
            this.scope.attr(
              '_date',
              moment.utc(updated).format(scope.MOMENT_DISPLAY_FMT));
          }
        }
      },
      '{scope} setMaxDate': function (scope, ev, date) {
        // TODO: different! because date set!
        // debugger;
        this.updateDate('maxDate', date);
      },
      // this is when text input directly changes
      '{scope} _date': function (scope, ev, val) {
        var valISO = null;
        // TODO: check forvalidity?
        if (val) {
          valISO = moment.utc(val, scope.MOMENT_DISPLAY_FMT)
                         .format(scope.MOMENT_ISO_DATE);
        }
        scope.attr('date', valISO);
        scope.picker.datepicker('setDate', valISO);
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
