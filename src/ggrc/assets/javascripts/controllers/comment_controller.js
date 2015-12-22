/*!
 Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 Created By: urban@reciprocitylabs.com
 Maintained By: urban@reciprocitylabs.com
 */


(function(can, $) {
  can.Component.extend({
    tag: "add-comment",
    template: can.view("/static/mustache/base_templates/add_comment.mustache"),
    scope: {
      attachments: new can.List(),
      parent_instance: null,
      instance: null,
      instance_attr: "@",
      source_mapping: null,
      source_mapping_source: "@",
      mapping: "@",
      deferred: "@",
      attributes: {},
      list: [],
      // the following are just for the case when we have no object to start with,
      changes: [],
      get_assignee_type: can.compute(function () {
        // TODO: We prioritize order V > A > R
        var types = {
              related_verifiers: "verifier",
              related_assignees: "assignee",
              related_requesters: "requester"
            },
            instance = this.attr("parent_instance"),
            user = GGRC.current_user,
            user_type;

        if (!instance || !user) {
          return;
        }
        _.each(types, function (type, mapping) {
          var mappings = instance.get_mapping(mapping);
          if (!mappings.length) {
            return;
          }
          if (_.filter(mappings, function (mapping) {
              return mapping.instance.id === user.id;
            }).length) {
            type = can.capitalize(type);
            user_type = user_type ? (user_type + "," + type) : type;
          }
        });
        return user_type;
      })
    },
    events: {
      init: function() {
        if (!this.scope.attr("source_mapping")) {
          this.scope.attr("source_mapping", GGRC.page_instance());
        }
        this.newInstance();
      },
      newInstance: function () {
        var instance = CMS.Models.Comment();
        instance._source_mapping = this.scope.attr("source_mapping");
        this.scope.attr("instance", instance);
      },
      "cleanPanel": function () {
        this.scope.attachments.replace([]);
        this.element.find("textarea").val("");
      },
      ".btn-success click": function (el, ev) {
        var $textarea = this.element.find(".add-comment textarea"),
            description = $.trim($textarea.val()),
            attachments = this.scope.attachments,
            source = this.scope.source_mapping,
            instance = this.scope.instance,
            data;

        if (!description.length && !attachments.length) {
          return;
        }
        data = {
          description: description,
          context: source.context,
          assignee_type: this.scope.attr("get_assignee_type")
        };
        instance.attr(data).save().then(function () {
          return instance.constructor.resolve_deferred_bindings(instance);
        }).then(function () {
          this.newInstance();
          this.cleanPanel();
        }.bind(this));

      }
    }
  });

  can.Control("GGRC.Controllers.Comments", {

  }, {
    _create_relationship: function(source, destination) {

      if (!destination) {
        return $.Deferred().resolve();
      }

      return new CMS.Models.Relationship({
        source: source.stub(),
        destination: destination,
        context: source.context,
      }).save();
    },
    "{CMS.Models.Comment} created": function(model, ev, instance) {
      if (!(instance instanceof  CMS.Models.Comment)) {
        return;
      }
      var source = instance._source_mapping || GGRC.page_instance(),
          parent_dfd = this._create_relationship(source, instance);
      instance.delay_resolving_save_until($.when(parent_dfd));
    }
  });

  $(function() {
    $(document.body).ggrc_controllers_comments();
  });

})(this.can, this.can.$);
