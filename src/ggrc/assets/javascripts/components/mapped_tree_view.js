/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function (can, $) {
  can.Component.extend({
    tag: 'mapping-tree-view',
    template: can.view(GGRC.mustache_path +
      '/base_templates/mapping_tree_view.mustache'),
    scope: {
      reusable: '@',
      reuseMethod: '@',
      treeViewClass: '@',
      expandable: '@',
      isExpandable: function () {
        var expandable = this.attr('expandable');
        if (expandable === null || expandable === undefined) {
          return true;
        } else if (typeof expandable === 'string') {
          return expandable === 'true';
        }
        return expandable;
      }
    },
    init: function (element) {
      var el = $(element);

      _.each(['mapping', 'itemTemplate'], function (prop) {
        if (!this.scope.attr(prop)) {
          this.scope.attr(prop,
            el.attr(can.dashCaseToCamelCase(prop)));
        }
      }, this);
    },
    events: {
      '[data-toggle=unmap] click': function (el, ev) {
        var instance = el.find('.result').data('result');
        var mappings = this.scope.parentInstance.get_mapping(
          this.scope.mapping);
        var binding;

        ev.stopPropagation();

        binding = _.find(mappings, function (mapping) {
          return mapping.instance.id === instance.id &&
                 mapping.instance.type === instance.type;
        });
        _.each(binding.get_mappings(), function (mapping) {
          mapping.refresh()
            .then(function () {
              return mapping.destroy();
            })
            .then(function () {
              return mapping.documentable.reify();
            });
        });
      }
    }
  });
})(window.can, window.can.$);
