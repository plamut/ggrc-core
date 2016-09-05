/*!
  Copyright (C) 2016 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('CMS.Models.CustomAttributeDefinition', function () {
  'use strict';

  var Model;

  beforeAll(function () {
    Model = CMS.Models.CustomAttributeDefinition;
  });

  describe('multiChoiceOptions custom validator', function () {
    var validator;
    var instance;

    beforeEach(function () {
      instance = new can.Map({
        attribute_type: 'Dropdown'
      });
      validator = Model._customValidators.multiChoiceOptions.bind(instance);
    });

    it('returns an empty message for properties other ' +
      'than multi_choice_options',
      function () {
        ['foo', 'bar', 'baz'].forEach(function (propName) {
          var msg = validator(',,,', propName);
          expect(msg).toEqual('');
        });
      }
    );

    it('returns an empty message for non-dropdown types', function () {
      Model.attributeTypes.forEach(function (attrType) {
        var msg;

        if (attrType === 'Dropdown') {
          return;
        }

        instance.attr('attribute_type', attrType);

        msg = validator(',,,', 'multi_choice_options');
        expect(msg).toEqual('');
      });
    });

    it('returns an error when no values defined', function () {
      var msg = validator('', 'multi_choice_options');
      expect(msg).toEqual('At least one possible value required.');
    });

    it('returns an error when blank values defined', function () {
      // NOTE: the empty value is the one after the last comma
      var msg = validator('foo  ,  bar ,', 'multi_choice_options');
      expect(msg).toEqual('Blank values not allowed.');
    });

    it('returns an error when duplicate values values defined', function () {
      var msg = validator('foo, bar, baz, foo  , gox', 'multi_choice_options');
      expect(msg).toEqual('Duplicate values found.');
    });

    it('returns an empty message if validation succeeds', function () {
      var msg = validator('  one  two, three,four   ', 'multi_choice_options');
      expect(msg).toEqual('');
    });
  });
});
