/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

can.Model('GGRC.Models.Search', {
  findOne: 'GET /search',
  search: function (str, params) {
    return this.findOne($.extend({q: str}, params));
  },
  search_for_types: function (str, types, params) {
    if ((!str || str.trim().length === 0) && (!params || params.length === 0)) {
      // Empty search, so actually hit normal endpoints instead of search
      // This returns a search instance which will search across all given types.
      return this.load_via_model_endpoints(types);
    }
    // This returns a Search instance, NOT a model instance.
    return this.findOne($.extend({q: str, types: types.join(',')}, params));
  },
  counts: function (str, params) {
    return this.findOne($.extend({q: str, counts_only: true}, params));
  },
  counts_for_types: function (str, types, params, extra_columns) {
    return this.findOne($.extend({
      q: str,
      types: types.join(','),
      counts_only: true,
      extra_columns: extra_columns && extra_columns.join(',')
    }, params));
  },
  load_via_model_endpoints: function (types) {
    var dfds;
    dfds = can.map(types, function (model_name) {
      // FIXME: This should use __stubs_only=true when paging is used
      return CMS.Models[model_name].findAll({
        __stubs_only: true,
        __sort: 'title,email'
      });
    });
    return $.when.apply($, dfds).then(function () {
      var model_results = can.makeArray(arguments);
      var search_response = {entries: {}, selfLink: 'Fake'};

      // Mock the search resource format
      can.each(types, function (model_name, index) {
        search_response.entries[model_name] = model_results[index];
      });

      return new GGRC.Models.Search(search_response);
    });
  },
  init: function () {
    var _findOne = this.findOne;
    if (this._super) {
      this._super.apply(this, arguments);
    }
    this.findOne = function () {
      return _findOne.apply(this, arguments).then(function (data) {
        if (data.results.entries) {
          data.attr('entries', data.results.entries);
        }
        if (data.results.counts) {
          data.attr('counts', data.results.counts);
        }
        data.removeAttr('results');
        return data;
      });
    };
  }
}, {
  getResultsFor: function (type) {
    var _class = type.shortName ? type :
      (can.getObject('CMS.Models.' + type) ||
      can.getObject('GGRC.Models.' + type));

    type = _class.shortName;
    return can.map(
      this.entries, function (v) {
        var inst;
        if (v.type === type) {
          inst = new _class({id: v.id});
          return inst;
        }
      });
  },
  getResultsForType: function (model_name) {
    var model = CMS.Models[model_name];
    var entries;

    if (!(this.entries instanceof Array ||
      this.entries instanceof can.Observe.List)) {
      entries = this.entries[model_name] || [];
    } else {
      entries = can.map(this.entries, function (v) {
        if (v.type === model_name) {
          return v;
        }
      });
    }
    return can.map(entries, function (stub) {
      return CMS.Models.get_instance(model.shortName, stub.id);
    });
  },
  getCountFor: function (type) {
    if (type && type.shortName) {
      type = type.shortName;
    }

    if (!this.counts[type]) {
      return 0;
    }
    return this.counts[type];
  }
});
