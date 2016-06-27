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

  describe('circleArea() method', function () {
    var dfdServerResponse;

    beforeEach(function () {
      dfdServerResponse = new can.Deferred();

      spyOn(can, 'ajax').and.returnValue(dfdServerResponse);

      // ...or call a fake function that can also contain extra logic:
      // spyOn(can, 'ajax').and.callFake(function () {
      //   return dfdServerResponse;
      // });

      // ...if we only want to spy on the calls, but otherwise not interfere:
      // spyOn(can, 'ajax').and.callThrough();

      // NOTE: for mocking network calls, there is also can.fixture():
      // https://canjs.com/docs/can.fixture.html
    });

    it('fetches the value of PI from a trustworthy location', function () {
      var callArgs;
      var trustedLocation = 'https://newton.ex.ac.uk/';

      calc.circleArea(2.0);

      // now inspect the mocked method's calls
      expect(can.ajax).toHaveBeenCalled();
      callArgs = can.ajax.calls.mostRecent().args;

      expect(callArgs.length).toBe(1);
      expect(callArgs[0].url).toContain(trustedLocation);
      // NOTE: should test for an equivalent of "toStartWith" in real code
    });

    it('correctly calculates an area of a circle', function (done) {
      var result = calc.circleArea(2.0);

      dfdServerResponse.resolve({
        status: 200,
        data: '3.1415926535'
      });

      result.then(function (computedArea) {
        var rounded = Number(computedArea.toFixed(2));
        expect(rounded).toEqual(12.57);
        done();  // tell Jasmine that an async test has done all the work
      });

      // NOTE: "done" is needed, otherwise a test would pass even if the
      // returned deferred object was not resolved!
    });
  });

  xdescribe('populateWithDelay() method', function () {
    // NOTE: incorrect implementation of the test!
    it('[BAD] populates given list with first N natural numbers', function () {
      var numbers = [17, -4, 99, 0];
      calc.populateWithDelay(numbers, 6);
      expect(numbers).toEqual([0, 1, 2, 3, 4, 5]);
    });

    xit('populates given with list with first N natural numbers',
      function (done) {
        var numbers = [17, -4, 99, 0];
        calc.populateWithDelay(numbers, 6);

        // NOTE: in practice, be careful with tests that rely on timing!
        setTimeout(function () {
          expect(numbers).toEqual([0, 1, 2, 3, 4, 5]);
          done();
        }, 2500);
      }
    );
  });
});
