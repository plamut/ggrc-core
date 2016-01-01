/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC utils allowed_to_map() method', function () {
  'use strict';

  var allowed_to_map;  // the method under test
  var fakeOptions;
  var fakeProgram;
  var fakeAudit;
  var fakeCA;
  var fakePersonCreator;

  beforeAll(function () {
    allowed_to_map = GGRC.Utils.allowed_to_map;
  });

  beforeEach(function () {
    fakeOptions = {};
  });

  describe('given an Audit and Program pair', function () {
    beforeEach(function () {
      fakeProgram = new CMS.Models.Program({type: 'Program'});
      fakeAudit = new CMS.Models.Audit({type: 'Audit'});

      spyOn(GGRC.Mappings, 'get_canonical_mapping_name')
        .and.returnValue('audits');

      spyOn(Permission, 'is_allowed_for').and.returnValue(true);
    });

    it('returns false for Audit as source and Program as target', function () {
      var result = allowed_to_map(fakeAudit, fakeProgram, fakeOptions);
      expect(result).toBe(false);
    });

    it('returns false for Program as source and Audit as target', function () {
      var result = allowed_to_map(fakeProgram, fakeAudit, fakeOptions);
      expect(result).toBe(false);
    });
  });

  describe('given an Person and Control Assessment pair', function () {
    beforeEach(function () {
      fakeCA = new CMS.Models.ControlAssessment({type: 'ControlAssessment'});
      fakePersonCreator = new CMS.Models.Person({type: 'Person'});

      spyOn(Permission, 'is_allowed_for').and.returnValue(true);
      spyOn(GGRC.Mappings, 'get_canonical_mapping_name');
    });

    it('returns true for Control Assessment as source and Person as target',
      function () {
        var result;
        GGRC.Mappings.get_canonical_mapping_name.and.returnValue('people');
        result = allowed_to_map(fakeCA, fakePersonCreator, fakeOptions);

        expect(result).toBe(true);
      });

    it('returns false for Person as source and as Control Assessment target',
      function () {
        var result;
        GGRC.Mappings.get_canonical_mapping_name.and.returnValue('related_objects');
        result = allowed_to_map(fakePersonCreator, fakeCA, fakeOptions);

        expect(result).toBe(false);
      });
  });
});
