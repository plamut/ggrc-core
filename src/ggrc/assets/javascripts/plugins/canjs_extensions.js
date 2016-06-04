/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/
(function ($, can) {
  // a few core CanJS extensions below.
  // Core validation for fields not being "blank", i.e.
  // having no content when outside spaces are trimmed away.
  can.Model.validationMessages.non_blank =
    can.Map.validationMessages.non_blank = 'cannot be blank';

  can.Model.validateNonBlank =
    can.Map.validateNonBlank = function (attrNames, options) {
      this.validate(attrNames, options, function (value) {
        if (_.isUndefined(value) ||
            _.isNull(value) ||
            _.isFunction(value.trim) && value.trim() === '') {
          return this.constructor.validationMessages.non_blank;
        }
      });
    };
  can.Model.validateContact =
    can.Map.validateContact = function (attrNames, options) {
      this.validate(attrNames, options, function (newVal, prop) {
        var reifiedContact = this.contact ? this.contact.reify() : false;
        var hasEmail = reifiedContact ? reifiedContact.email : false;

        // This check will not work until the bug introduced with commit 8a5f600c65b7b45fd34bf8a7631961a6d5a19638
        // is resolved.
        if (!hasEmail) {
          return 'No valid contact selected for assignee';
        }
      });
    };

  // Adding reduce, a generally useful array comprehension.
  //  Bitovi decided against including it in core CanJS, but
  //  adding it here for easy universal use across can.List
  //  as well as arrays.
  if (!can.reduce) {
    can.reduce = function (a, f, i) {
      if (_.isNull(a)) {
        return null;
      }
      return [].reduce.apply(a, arguments.length < 3 ? [f] : [f, i]);
    };
  }

  // Turn camelSpace strings into Camel Space strings
  can.spaceCamelCase = function (string) {
    return can.underscore(string)
      .split('_')
      .map(can.capitalize)
      .join(' ');
  };
  can.camelCaseToUnderscore = function (string) {
    return string.replace(/([A-Z])/g, '_$1').toLowerCase();
  };
  can.dashCaseToCamelCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  };
})(jQuery, can);
