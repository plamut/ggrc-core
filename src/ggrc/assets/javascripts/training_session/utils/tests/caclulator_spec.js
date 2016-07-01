/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.utils.Calculator', function () {
  'use strict';

  var calc;

  beforeEach(function () {
    calc = new GGRC.utils.Calculator();
  });

  describe('a test that tries to test too many things', function () {
    // If the test fails, we only know that there is a bug, but it is not
    // entirely clear in what exact case does it occur, throwing away one
    // of the advatanges unit tests offer.
    it('sign() method returns a correct sign for a number', function () {
      var method = calc.sign;

      // test for positive numbers
      var result = method(7);
      expect(result).toEqual(1);

      // test for negative numbers
      result = method(-2);
      expect(result).toEqual(-1);

      // test edge case - zero
      result = method(0);
      expect(result).toEqual(0);
    });
  });

  describe('test a test that does not really test anything', function () {
    // After writing a test, MAKE SURE IT CAN ACTUALLY FAIL!
    // It's best to write the test even BEFORE implementing a method/bugfix
    // (the TDD approach), but if writing it afterwards, temporarily change the
    // code under test, to make sure that the test would indeed catch a bug.
    it('abs() method returns the number\'s absolute value', function () {
      var method = calc.abs;
      var theNumber = 4;
      var result = method(theNumber);
      expect(theNumber).toEqual(4);  // should instead check the result!
    });
  });

  describe('tests that are not independent from each other', function () {
    var method;

    beforeEach(function () {
      method = calc.greaterThanSecret;
    });

    it('relying on another method\'s correctness', function () {
      // If there is a bug in the setSecret() method, the test for the
      // greaterThanSecret() method would (incorrectly) fail, too, despite the
      // latter method being correct. This makes it more difficult to locate
      // the actual source of the bug.
      var result;
      calc.setSecret(8);  // <--- dependency
      result = method(8.0001);
      expect(result).toBe(true);
    });

    // NOTE: Even worse are the tests that rely on the state that the previous
    // tests set in an object/application. Unit tests should yield the same
    // outcome regardless of their execution order. ALWAYS make sure a test
    // starts in a desired state of the underlying unit under test (hint:
    // fixtures).
  });

  // MISC.:
  // If there is a code coverage report enabled, the primary goal is not to
  // have a 100% test coverage - one should focus on writing good tests instead
  // (and coverage will automatically follow).
  // Aiming just for the metric itself can lead to artificial tests that only
  // run every line of code, but do not really make proper assertions about it.
  //
  // Testing asynchronous code can be tricky. Avoid relying on timing, e.g.
  // waiting for exactly 168 miliseconds before making an assertion - such
  // tests tend to randomly produce false negatives, making them less useful
  // and trusted. Use proper async testing patterns, and e.g. libraries that
  // can freeze/manipulate time. ALso important when testing the code dealing
  // with the current date/time and being dependent on the machine's local
  // timezone settings.
});
