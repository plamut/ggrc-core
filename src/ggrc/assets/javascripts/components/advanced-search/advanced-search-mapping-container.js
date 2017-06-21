/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, GGRC) {
  'use strict';

  var template = can.view(GGRC.mustache_path +
    '/components/advanced-search/advanced-search-mapping-container.mustache');

  var viewModel = can.Map.extend({
    items: can.List(),
    modelName: null,
    availableAttributes: can.List(),
    addMappingCriteria: function () {
      var items = this.attr('items');
      if (items.length) {
        items.push(GGRC.Utils.AdvancedSearch.create.operator('AND'));
      }
      items.push(GGRC.Utils.AdvancedSearch.create.mappingCriteria());
    },
    removeMappingCriteria: function (item) {
      var items = this.attr('items');
      var index = items.indexOf(item);
      // we have to remove operator in front of each item except the first
      if (index > 0) {
        index--;
      }
      items.splice(index, 2);
    },
    createGroup: function (criteria) {
      var items = this.attr('items');
      var index = items.indexOf(criteria);
      items.attr(index, GGRC.Utils.AdvancedSearch.create.group([
        criteria,
        GGRC.Utils.AdvancedSearch.create.operator('AND'),
        GGRC.Utils.AdvancedSearch.create.mappingCriteria()
      ]));
    }
  });

  GGRC.Components('advancedSearchMappingContainer', {
    tag: 'advanced-search-mapping-container',
    template: template,
    viewModel: viewModel
  });
})(window.can, window.GGRC);
