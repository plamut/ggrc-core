/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.utils.Calculator', function () {
  'use strict';

  it('is globally available', function () {
    expect(GGRC.utils.Calculator).toBeDefined();
  });

  describe('abs() method', function () {
    it('returns the number itself for non-negative numbers', function () {
      var calc = new GGRC.utils.Calculator();
      var result = calc.abs(8);
      expect(result).toEqual(8);
    });

    it('returns a negated number for negative numbers', function () {
      var calc = new GGRC.utils.Calculator();
      var result = calc.abs(-5);
      expect(result).toEqual(5);
    });
  });

  xdescribe('sign() method', function () {
    it('returns 1 for positive numbers', function () {
      var calc = new GGRC.utils.Calculator();
      var result = calc.sign(6);
      expect(result).toEqual(1);
    });

    it('returns -1 for negative numbers', function () {
      var calc = new GGRC.utils.Calculator();
      var result = calc.sign(-7);
      expect(result).toEqual(-1);
    });

    it('returns 0 for zero', function () {
      var calc = new GGRC.utils.Calculator();
      var result = calc.sign(0.0);
      expect(result).toEqual(0);
    });
  });
});
