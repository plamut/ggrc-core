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
      },

      // TODO: ali se to avtomatično osveži v templateu?

      // TODO: tests, docstrings,

      // instance either a Request or an Assessment... the underlying object
      // We need to check whether the current user is allowed to edit a
      // particular comment or not
      commentReadonly: function () {
        // the instance the comment is posted on
        var instance = this.parentInstance;


        // TODO: check baseInstance
        //debugger; // TODO: check for base instance

        var END_STATES = Object.freeze({
          'Verified': true,
          'Completed': true
        });

        var user = GGRC.current_user;

        // administrators can always edit comments
        if (user.system_wide_role === 'Superuser') {
          return false;
        }

        // non-administrators cannot edit comments if the underlying object is
        // in final or verfiied state
        if (instance.status in END_STATES) {
          return true;
        }

        // TODO:
        // how to get the actual comment object in order to find its creator?


        // a non-administrator can only edit a comment on a "non-finished"
        // object if he/she created the comment in the first place
        // TODO
        // else {

        //    var isOwner = false; // TODO: how to determine?

        //   var instance = this.options.instance;
        //   if (instance.type !== "Comment") {
        //     return;  // nothing to do, irrelevant for a non-comment
        //   }

        //   // now we have a comment, get the underlying object
        //  var relation = comment.related_sources[0];  // TODO: can be also destination
        //   if (relationy.type !== 'Relationship') {
        //     return;
        //   }

        //   var relatedObj = relation.reify().source;  // or destination if reverse
        //   if (!(relatedObj.type in {'Assessment': 1, 'Request': 1})) {
        //     return;
        //   }

        //   relatedObj = relatedObj.reify();
        // }

        // if  comment owner: yes, unless the underlying object is in
        // verified/final state

        // TODO: react when the underlying object's state changes!
        // add a listener? (make it can.Observable?)
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
