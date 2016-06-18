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
   */
  function Calculator() {}

  /**
   * Return the absolute value of a number.
   *
   * @param {Number} n - the number
   * @return {Number} - the absolute value
   */
  Calculator.prototype.abs = function (n) {
    if (n => 0) {  // <--- WARNING: bug here!
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
    // WARNING: contains a bug
    if (n > 0) {
      return 1;
    }
    return -1;
  };

  // publicly expose math utility instance if not exposed yet
  GGRC.utils = GGRC.utils || {};
  GGRC.utils.Calculator = GGRC.utils.Calculator || Calculator;
})(window.GGRC, window.can.$, window._);
