/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/
(function(_) {
  _.mixin({
    exists: function (obj, key) {
      if (!key) {
        return obj;
      }
      var keys = arguments.length > 2 ? Array.prototype.slice.call(arguments).slice(1) : key.split(".");
      return keys.reduce(function (base, memo) {
        return (_.isUndefined(base) || _.isNull(base)) ? base : base[memo];
      }, obj);
    }
  });
})(_);
