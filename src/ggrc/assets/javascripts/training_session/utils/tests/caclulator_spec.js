/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.utils.Calculator', function () {
  'use strict';

  var LOG_CALLS = false;  // whther or not to log before*/after*() calls

  var calc;

  beforeAll(function () {
    if (LOG_CALLS) {
      console.log('beforeAll(): TOP level');
    }
  });

  afterAll(function () {
    if (LOG_CALLS) {
      console.log('afterAll(): TOP level');
    }
  });

  beforeEach(function () {
    if (LOG_CALLS) {
      console.log('        beforeEach(): TOP level');
    }
    calc = new GGRC.utils.Calculator();  // <--- moved out of every test case
  });

  afterEach(function () {
    if (LOG_CALLS) {
      console.log('        afterEach(): TOP level');
    }
  });

  describe('sign() method', function () {
    beforeAll(function () {
      if (LOG_CALLS) {
        console.log('    beforeAll(): sign() method level');
      }
    });

    afterAll(function () {
      if (LOG_CALLS) {
        console.log('    afterAll(): sign() method level');
      }
    });

    beforeEach(function () {
      if (LOG_CALLS) {
        console.log('            beforeEach(): sign() method level');
      }
    });

    afterEach(function () {
      if (LOG_CALLS) {
        console.log('            afterEach(): sign() method level');
      }
    });

    it('returns 1 for positive numbers', function () {
      // calc = new GGRC.utils.Calculator();
      var result = calc.sign(6);
      expect(result).toEqual(1);
    });

    it('returns -1 for negative numbers', function () {
      // calc = new GGRC.utils.Calculator();
      var result = calc.sign(-7);
      expect(result).toEqual(-1);
    });

    it('returns 0 for zero', function () {
      // calc = new GGRC.utils.Calculator();
      var result = calc.sign(0.0);
      expect(result).toEqual(0);
    });
  });

  describe('greaterThanSecret() method', function () {
    beforeEach(function () {
      if (LOG_CALLS) {
        console.log(
          '            beforeEach(): greaterThanSecret() method level');
      }
      calc._SECRET = 7;
    });

    afterEach(function () {
      if (LOG_CALLS) {
        console.log(
          '            afterEach(): greaterThanSecret() method level');
      }
    });

    it('returns true for a number greater than the secret', function () {
      // calc = new GGRC.utils.Calculator(7);
      var result = calc.greaterThanSecret(7.0001);
      expect(result).toBe(true);
    });

    it('returns false for a number less than the secret', function () {
      // calc = new GGRC.utils.Calculator(7);
      var result = calc.greaterThanSecret(6.999);
      expect(result).toBe(false);
    });

    it('returns false for the number equal to the secret', function () {
      // calc = new GGRC.utils.Calculator(7);
      var result = calc.greaterThanSecret(7);
      expect(result).toBe(false);
    });
  });
});
