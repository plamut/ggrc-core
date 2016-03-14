/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.objectHistory revisions_diff helper', function () {
  'use strict';

  var fakeOptions;  // fake mustache options object passed to the helper
  var fakeRevHistory;
  var helper;
  var instance;  // an object the helper retrieves an attribute value from
  var origModelAttrDefs;  // original user-friendly attribute name definitions

  beforeAll(function () {
    var Component = GGRC.Components.get('objectHistory');

    helper = Component.prototype.helpers.revisions_diff;
  });

  beforeEach(function () {
    // fake options used as an argument to the helper
    fakeOptions = {
      fn: jasmine.createSpy(),
      contexts: {
        add: jasmine.createSpy().and.callFake(function (newContext) {
          return newContext;
        })
      }
    };

    // create a fake object instance used as an argument to the helper
    fakeRevHistory = [];

    instance = new can.Map({});

    instance.get_mapping = jasmine.createSpy().and.callFake(
      function (mappingName) {
        if (mappingName !== 'revision_history') {
          throw new Error('Unknown mapping ' + mappingName);
        }
        return fakeRevHistory;
      }
    );

    // mock global model attribute definitions
    origModelAttrDefs = GGRC.model_attr_defs;
    GGRC.model_attr_defs = {};
  });

  afterEach(function () {
    GGRC.model_attr_defs = origModelAttrDefs;
  });

  it('computes an empty list on empty Revision history', function () {
    var callArgs;
    var diffList;

    fakeRevHistory = [];
    helper(instance, fakeOptions);

    expect(fakeOptions.fn.calls.count()).toEqual(1);
    callArgs = fakeOptions.fn.calls.mostRecent().args;

    expect(callArgs.length).toEqual(1);
    diffList = callArgs[0].objectChanges;
    expect(diffList).toEqual([]);
  });

  it('computes an empty list on missing Revision content data', function () {
    var callArgs;
    var diffList;

    fakeRevHistory = [
      {
        instance: {content: undefined}
      },
      {
        instance: {content: undefined}
      }
    ];

    helper(instance, fakeOptions);

    expect(fakeOptions.fn.calls.count()).toEqual(1);
    callArgs = fakeOptions.fn.calls.mostRecent().args;

    expect(callArgs.length).toEqual(1);
    diffList = callArgs[0].objectChanges;
    expect(diffList).toEqual([]);
  });

  it('includes the modification time in the diff object', function () {
    var callArgs;
    var diffList;

    fakeRevHistory = [
      {
        instance: {
          updated_at: '2016-01-24T10:05:42',
          modified_by: {id: 1},
          content: {}
        }
      },
      {
        instance: {
          updated_at: '2016-01-30T08:15:11',
          modified_by: {id: 1},
          content: {}
        }
      }
    ];

    helper(instance, fakeOptions);

    expect(fakeOptions.fn.calls.count()).toEqual(1);
    callArgs = fakeOptions.fn.calls.mostRecent().args;
    expect(callArgs.length).toEqual(1);

    diffList = callArgs[0].objectChanges;
    expect(diffList.length).toEqual(1);
    expect(diffList[0].updatedAt).toEqual('2016-01-30T08:15:11');
  });

  it('includes the author of the change(s) in the diff object', function () {
    var callArgs;
    var diffList;

    fakeRevHistory = [
      {
        instance: {
          updated_at: '2016-01-24T10:05:42',
          modified_by: {id: 1},
          content: {}
        }
      },
      {
        instance: {
          updated_at: '2016-01-30T08:15:11',
          modified_by: {id: 7},
          content: {}
        }
      }
    ];

    helper(instance, fakeOptions);

    expect(fakeOptions.fn.calls.count()).toEqual(1);
    callArgs = fakeOptions.fn.calls.mostRecent().args;
    expect(callArgs.length).toEqual(1);

    diffList = callArgs[0].objectChanges;
    expect(diffList.length).toEqual(1);
    expect(diffList[0].madeBy).toEqual('User 7');
  });

  it('computes diff objects for all successive Revision pairs', function () {
    var actual;
    var expected;
    var callArgs;
    var diffList;

    fakeRevHistory = [
      {
        instance: {
          updated_at: '2016-01-24T10:05:42',
          modified_by: {id: 1},
          content: {
            title: 'Audit 1',
            description: 'first Audit',
            status: 'New'
          }
        }
      },
      {
        instance: {
          updated_at: '2016-01-25T16:36:29',
          modified_by: {id: 5},
          content: {
            title: 'Audit 1.0',
            description: 'This is first audit',
            status: 'New'
          }
        }
      },
      {
        instance: {
          updated_at: '2016-01-30T13:22:59',
          modified_by: {id: 5},
          content: {
            title: 'Audit 1.0',
            description: 'This is first audit',
            status: 'In Progress'
          }
        }
      }
    ];

    helper(instance, fakeOptions);

    expect(fakeOptions.fn.calls.count()).toEqual(1);
    callArgs = fakeOptions.fn.calls.mostRecent().args;
    expect(callArgs.length).toEqual(1);

    diffList = callArgs[0].objectChanges;
    expect(diffList.length).toEqual(2);

    // NOTE: the actual order of the changed fields does not matter,
    // thus the sorting of the list before the assertion
    actual = _.sortBy(diffList[0].changes, 'fieldName');
    expected = [
      {
        fieldName: 'description',
        origVal: 'first Audit',
        newVal: 'This is first audit'
      },
      {
        fieldName: 'title',
        origVal: 'Audit 1',
        newVal: 'Audit 1.0'
      }
    ];
    expect(actual).toEqual(expected);

    // check the 2nd diff object, too
    actual = _.sortBy(diffList[1].changes, 'fieldName');
    expected = [
      {
        fieldName: 'status',
        origVal: 'New',
        newVal: 'In Progress'
      }
    ];
    expect(expected).toEqual(expected);
  });

  describe('with model attributes definitions defined', function () {
    beforeEach(function () {
      GGRC.model_attr_defs = {
        Audit: [
          {
            attr_name: 'title',
            display_name: 'Object Name'
          }
        ]
      };
    });

    it('uses the fields\' display names in the diff objects', function () {
      var actual;
      var expected;
      var callArgs;
      var diffList;

      fakeRevHistory = [
        {
          instance: {
            updated_at: '2016-01-25T16:36:29',
            modified_by: {id: 5},
            resource_type: 'Audit',
            content: {
              title: 'Audit 1.0'
            }
          }
        },
        {
          instance: {
            updated_at: '2016-01-30T13:22:59',
            modified_by: {id: 5},
            resource_type: 'Audit',
            content: {
              title: 'My Audit 1.0'
            }
          }
        }
      ];

      helper(instance, fakeOptions);

      expect(fakeOptions.fn.calls.count()).toEqual(1);
      callArgs = fakeOptions.fn.calls.mostRecent().args;
      expect(callArgs.length).toEqual(1);

      diffList = callArgs[0].objectChanges;
      expect(diffList.length).toEqual(1);

      actual = diffList[0].changes;
      expected = [
        {
          fieldName: 'Object Name',
          origVal: 'Audit 1.0',
          newVal: 'My Audit 1.0'
        }
      ];
      expect(actual).toEqual(expected);
    });

    it('omits object fields that are considered internal', function () {
      var match;
      var callArgs;
      var diffList;

      fakeRevHistory = [
        {
          instance: {
            updated_at: '2016-01-25T16:36:29',
            modified_by: {id: 5},
            resource_type: 'Audit',
            content: {
              title: 'Audit 1.0',
              internalField: 'AUDIT-e34a'
            }
          }
        },
        {
          instance: {
            updated_at: '2016-01-30T13:22:59',
            modified_by: {id: 5},
            resource_type: 'Audit',
            content: {
              title: 'Audit 1.0',
              internalField: 'AUDIT-e34a-v2'
            }
          }
        }
      ];

      helper(instance, fakeOptions);

      expect(fakeOptions.fn.calls.count()).toEqual(1);
      callArgs = fakeOptions.fn.calls.mostRecent().args;
      expect(callArgs.length).toEqual(1);

      diffList = callArgs[0].objectChanges;
      expect(diffList.length).toEqual(1);

      // the Audit's internalField does not have a display name defined in
      // GGRC.model_attr_defs, and is thus considered internal, meaning that it
      // should be omitted from the resulting diff object
      match = _.find(diffList[0].changes, {fieldName: 'internalField'});
      expect(match).toBeUndefined();
    });
  });
});
