/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/


(function(can, $) {
  can.Component.extend({
    tag: "mapping-tree-view",
    template: can.view(GGRC.mustache_path + "/base_templates/mapping_tree_view.mustache"),
    scope: {
    },
    events: {
      "[data-toggle=unmap] click": function (el, ev) {
        ev.stopPropagation();
        var instance = el.find(".result").data("result"),
            mappings = this.scope.parentInstance.get_mapping(this.scope.mapping),
            binding;

        binding = _.find(mappings, function (mapping) {
          return mapping.instance.id === instance.id &&
                 mapping.instance.type === instance.type;
        });
        _.each(binding.get_mappings(), function (mapping) {
          mapping.refresh().then(function () {
            mapping.destroy();
          });
        });
      }
    }
  });
})(window.can, window.can.$);
