/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: peter@reciprocitylabs.com
    Maintained By: peter@reciprocitylabs.com
*/

/**
 * A caclulator utility implementing various useful mathematical functions.
 */
(function (GGRC, $, _) {
  'use strict';

  /**
   * The Calculator constructor function. Should be invoked with "new".
   *
   * @param {Number} [secretVal=42] - the value to store as a "secret" value
   */
  function Calculator(secretVal) {
    this._SECRET = _.isUndefined(secretVal) ? 42 : Number(secretVal);
  }

  /**
   * Return the absolute value of a number.
   *
   * @param {Number} n - the number
   * @return {Number} - the absolute value
   */
  Calculator.prototype.abs = function (n) {
    if (n >= 0) {
      return n;
    }
    return -n;
  };

  /**
   * Determine the sign of a number
   *
   * @param {Number} n - the number
   * @return {Number} - +1 if the number is positive, -1 if it is negative, and
   *   0 for the number zero itself.
   */
  Calculator.prototype.sign = function (n) {
    if (n > 0) {
      return 1;
    } else if (n < 0) {
      return -1;
    }
    return 0;
  };

  /**
   * Determine whether the given number is strictly greater than the magic
   * secret value.
   *
   * @param {Number} n - the number
   * @return {Boolean} - true if the number is strictly greater than the
   *   secret, false otherwise
   */
  Calculator.prototype.greaterThanSecret = function (n) {
    return (n > this._SECRET);
  };

  /**
   * Caclulate the area of a circle with the given radius.
   *
   * @param {Number} radius - the circle radius
   * @return {can.Defferred} - a deferred object resolved with the circle area
   *   on success, and rejected with a server error message if fetching  the
   *   value of the PI constant fails.
   */
  Calculator.prototype.circleArea = function (radius) {
    var URL = 'https://newton.ex.ac.uk/research/qsystems/collabs/pi/pi6.txt';

    var pi;  // let's just pretend the value of this constant is unknown
    var dfd = new can.Deferred();

    can.ajax({
      url: URL
    })
    .done(function (response) {
      pi = Number(response.data.substring(0, 8));
      dfd.resolve(pi * radius * radius);
    })
    .fail(function (error) {
      var msg = 'Could not fetch the value of PI: ' + error;
      dfd.reject(msg);
    });

    return dfd;
  };

   /**
    * Populate the given list in-place with the first N natural numbers
    * starting with zero.
    *
    * The existing list items are discarded in the process.
    * The list is populated asynchronously after some modest delay.
    *
    * @param {Array} list - the list to populate
    * @param {Number} n - the number of items to put in the list
    */
  Calculator.prototype.populateWithDelay = function (list, n) {
    var DELAY = 2000;

    list.length = 0;

    setTimeout(function () {
      var i;
      for (i = 0; i < n; i++) {
        list.push(i);
      }
    }, DELAY);
  };

  // publicly expose math utility instance if not exposed yet
  GGRC.utils = GGRC.utils || {};
  GGRC.utils.Calculator = GGRC.utils.Calculator || Calculator;
})(window.GGRC, window.can.$, window._);
