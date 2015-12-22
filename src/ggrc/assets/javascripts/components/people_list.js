/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: andraz@reciprocitylabs.com
  Maintained By: andraz@reciprocitylabs.com
*/

(function (can) {
  can.Component.extend({
    tag: "people-list",
    template: can.view(GGRC.mustache_path + "/base_templates/people_list.mustache"),
    scope: {
      editable: "@",
      deferred: "@",
    }
  });

  can.Component.extend({
    tag: "people-group",
    template: can.view(GGRC.mustache_path + "/base_templates/people_group.mustache"),
    scope: {
      limit: "@",
      mapping: "@",
      required: "@",
      type: "@",
      toggle_add: false,
      mapped_people: [],
      remove_role: function (parent_scope, target) {
        var person = CMS.Models.Person.findInCacheById(target.data("person")),
            rel = function (obj) {
              return _.map(obj.related_sources.concat(obj.related_destinations), function (r) {
                return r.id;
              });
            },
            ids = _.intersection(rel(person), rel(this.instance)),
            type = this.attr("type");

        _.each(ids, function (id) {
          var rel = CMS.Models.Relationship.findInCacheById(id);
          if (rel.attrs && rel.attrs.AssigneeType) {
            rel.refresh().then(function (rel) {
              var roles = rel.attrs.AssigneeType.split(",");
              roles = _.filter(roles, function (role) {
                return role && (role.toLowerCase() !== type);
              });
              if (roles.length) {
                rel.attrs.attr("AssigneeType", roles.join(","));
                rel.save();
              } else {
                rel.destroy();
              }
            }.bind(this));
          }
        }, this);
      },
    },
    events: {
      "init": function () {
        if (!this.scope.attr("required")) {
          return;
        }

        var instance = this.scope.attr("instance"),
            mapping = this.scope.attr("mapping");

        this.scope.attr("mapped_people", this.scope.attr("deferred") ? instance._pending_joins : instance.get_mapping(mapping));
        this.validate();
      },
      "validate": function () {
        var list = _.filter(this.scope.attr("mapped_people"), function (person) {
              if (this.scope.attr("deferred")) {
                var roles = can.getObject("extra.attrs", person);
                return person.what.type === "Person" && (roles && _.contains(roles.AssigneeType.split(","), can.capitalize(this.scope.type)));
              }
              return person;
            }.bind(this));
        this.scope.attr("instance").attr("validate_" + this.scope.attr("type"), !!list.length);
      },
      "{scope.mapped_people} change": "validate",
      ".person-selector input autocomplete:select": function (el, ev, ui) {
        var person = ui.item,
            role = can.capitalize(this.scope.type),
            destination = this.scope.attr("instance"),
            deferred = this.scope.attr("deferred"),
            pending, model;

        if (deferred === "true") {
          pending = true;
          if (destination._pending_joins) {
            _.each(destination._pending_joins, function (join) {
              if (join.what === person) {
                var existing= join.extra.attr("attrs.AssigneeType") || "";
                existing = _.filter(existing.split(","));
                var roles = _.union(existing, [role]).join(",");
                join.extra.attr("attrs.AssigneeType", roles);
                pending = false;
              }
            });

          }
          if (pending) {
            destination.mark_for_addition("related_objects_as_destination", person, {
              attrs: {
                "AssigneeType": role,
              },
              context: destination.context,
            });
          }
        } else {
          model = CMS.Models.Relationship.get_relationship(person, destination);
          if (!model) {
            model = new CMS.Models.Relationship({
              attrs: {
                "AssigneeType": role,
              },
              source: {
                href: person.href,
                type: person.type,
                id: person.id
              },
              context: destination.context,
              destination: {
                href: destination.href,
                type: destination.type,
                id: destination.id
              }
            });
            model = $.Deferred().resolve(model);
          } else {
            model = model.refresh();
          }

          model.then(function (model) {
            var type = model.attr("attrs.AssigneeType");
            model.attr("attrs.AssigneeType", role + (type ? "," + type : ""));
            model.save();
          }.bind(this));
        }
      },
    },
    helpers: {
      can_unmap: function (options) {
        var num_mappings = this.attr("instance").get_mapping(this.attr("mapping")).length,
            required = this.attr("required");

        if (required) {
          if (num_mappings > 1) {
            return options.fn(options.context);
          }
          return options.inverse(options.context);
        } else {
          return options.fn(options.context);
        }
      },
      show_add: function (options) {
        if (this.attr("editable") === "true") {
          return options.fn(options.context);
        }
        return options.inverse(options.context);
      },
      if_has_role: function (roles, role, options) {
        roles = _.filter(Mustache.resolve(roles).toLowerCase().split(","));
        role = Mustache.resolve(role).toLowerCase();
        return options[_.includes(roles, role) ? "fn" : "inverse"](options.contexts);
      },
    }
  });
})(window.can);
