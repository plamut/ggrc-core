/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

describe('GGRC.Components.assessmentInfoPane', function () {
  'use strict';

  var vm;  // viewModel of the component under test

  beforeEach(function () {
    // inside beforeEach (as opposed to befreAll), because a new and clean
    // viewModel instance should be used for each test case
    vm = GGRC.Components.getViewModel('assessmentInfoPane');
  });

  describe('requestQuery() method', function () {
    var dfdBatchRequests;

    beforeEach(function () {
      dfdBatchRequests = new can.Deferred();
      spyOn(GGRC.Utils.QueryAPI, 'batchRequests')
          .and.returnValue(dfdBatchRequests.promise());
    });

    it('resolves given promise with a list of objects of the requested type',
      function (done) {
        var requestPromise;

        var query = {
          object_name: 'Document',
          fields: [],
          filters: {}
        };

        // NOTE: It is technically not 100% guaranteed that having selfLink as
        // the first key would reproduce the original issue, although in
        // practice major browsers do respect and preserve the object key
        // which is reflected in what Object.keys() method returns.
        // See https://stackoverflow.com/a/23202095/5040035 for more details.
        var serverResponse = {
          selfLink: null,  // must come frist!
          Document: {
            values: [{id: 5, title: 'Document 5'}],
            total: 1,
            count: 1
          }
        };

        requestPromise = vm.requestQuery(query, 'Document');
        requestPromise.then(function (result) {
          expect(result).toEqual([{id: 5, title: 'Document 5'}]);
          done();
        });
        dfdBatchRequests.resolve(serverResponse);
      }
    );
  });
});
