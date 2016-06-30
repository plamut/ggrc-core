/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

/**
 * A component that creates a simple calculator widget.
 */
(function (GGRC, can) {
  'use strict';

  // the component's configuration object (i.e. its constructor's prototype)
  var component = {
    tag: 'calculator',

    template: can.view(
      GGRC.mustache_path +
      '/components/calculator/calculator.mustache'
    ),

    scope: {
      OPERATIONS: Object.freeze({
        '+': function (a, b) {
          return a + b;
        },
        '-': function (a, b) {
          return a - b;
        },
        '*': function (a, b) {
          return a * b;
        },
        '/': function (a, b) {
          return a / b;
        }
      }),

      operator: '+',
      operand: 0.0,
      operand2: 0.0,
      result: undefined,

      resultsHistory: [],
      displayHint: false,
      errUnknownOperator: false,

      /**
       * Apply a function to operands and return the result.
       *
       * @param {Function} op - the operation to apply
       * @param {Number} a - the first operand
       * @param {Number} b - the second operand
       *
       * @return {*} - Whatever the `op` returns.
       */
      _compute: function (op, a, b) {
        return op(a, b);
      },

      /**
       * Prepend the computation history log with a new record.
       *
       * @param {String} op - the operator used in the computation
       * @param {Number} a - the first operand of the operation
       * @param {Number} b - the second operand of the operation
       * @param {Number} result - the result of the computation
       */
      _addHistoryItem: function (op, a, b, result) {
        var record = [a, op, b, '=', result].join(' ');
        this.resultsHistory.unshift(record);
      },

      /**
       * Caclulate the result using the current operation and operands.
       *
       * On success, the computation information is added to the beginning of
       * the list, but in case of an unknown operator, an error flag is set
       * instead;
       *
       * @param {can.Map} scope - the scope object itself (this)
       * @param {jQuery.Element} $el - the element that invoked the handler
       * @param {jQuery.Event} ev - the event object
       */
      getResult: function (scope, $el, ev) {
        var newResult;
        var operand = Number(this.operand);
        var operand2 = Number(this.operand2);
        var opFunc = this.OPERATIONS[this.operator];

        if (!opFunc) {
          this.attr('errUnknownOperator', true);
          return;
        }
        this.attr('errUnknownOperator', false);

        newResult = this._compute(opFunc, operand, operand2);
        this.attr('result', newResult);

        this._addHistoryItem(this.operator, operand, operand2, newResult);
      }
    },

    events: {
      /**
       * Event handler when the component is inserted into DOM
       *
       * @param {jQuery.Element} $el - component's root DOM node
       * @param {jQuery.Event} ev - the event object
       */
      inserted: function ($el, ev) {
        var scope = this.scope;
        if (!scope.OPERATIONS[scope.operator]) {
          scope.attr('errUnknownOperator', true);
        }
      },

      /**
       * Event handler for hovering over the calculate link.
       *
       * @param {jQuery.Element} $el - the link button itself
       * @param {jQuery.Event} ev - the event object
       */
      'a[name="btnResult"] mouseover': function ($el, ev) {
        this.scope.attr('displayHint', true);
      },

      /**
       * Event handler for hovering out of the calculate link.
       *
       * @param {jQuery.Element} $el - the link button itself
       * @param {jQuery.Event} ev - the event object
       */
      'a[name="btnResult"] mouseout': function ($el) {
        this.scope.attr('displayHint', false);
      }
    }
  };

  GGRC.Components('calculator', component);
})(window.GGRC, window.can);
