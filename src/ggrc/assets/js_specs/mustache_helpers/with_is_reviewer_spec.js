/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: jure@reciprocitylabs.com
  Maintained By: jure@reciprocitylabs.com
*/

describe("can.mustache.helper.with_is_reviewer", function () {
  var fakeOptions,
      helper;

  beforeAll(function () {
    fakeOptions = {
      fn: jasmine.createSpy(),
      contexts: {
        add: jasmine.createSpy(),
      }
    };

    helper = can.Mustache._helpers["with_is_reviewer"].fn;
  });

  describe("calls options.contexts.add with specified value", function() {

    it("is {is_reviewer: false} when review_task is not set",
      function () {
        helper(false, fakeOptions);
        expect(fakeOptions.contexts.add).toHaveBeenCalledWith({is_reviewer: false})
      }
    );

    it("is {is_reviewer: true} when user is Admin",
      function () {
        spyOn(Permission, "is_allowed").and.returnValue(true);
        helper({contact: {id: 12345}}, fakeOptions);
        expect(fakeOptions.contexts.add).toHaveBeenCalledWith({is_reviewer: true})
      }
    );

    it("is {is_reviewer: false} when contact does not match current user",
      function () {
        spyOn(Permission, "is_allowed").and.returnValue(false);
        helper({contact: {id: 12345}}, fakeOptions);
        expect(fakeOptions.contexts.add).toHaveBeenCalledWith({is_reviewer: false})
      }
    );

    it("is {is_reviewer: true} when contact matches current user",
      function () {
        spyOn(Permission, "is_allowed").and.returnValue(false);
        // GGRC.current_user.id is 1 in testing environment
        helper({contact: {id: 1}}, fakeOptions);
        expect(fakeOptions.contexts.add).toHaveBeenCalledWith({is_reviewer: true})
      }
    );

  })

});
