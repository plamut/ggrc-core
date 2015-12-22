/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/

(function(can, $) {
  "use strict";
  var MapperModel = can.Map({
      type: "AllObject", // We set default as All Object
      contact: {},
      deferred: "@",
      deferred_to: "@",
      term: "",
      object: "",
      model: {},
      bindings: {},
      is_loading: false,
      page_loading: false,
      is_saving: false,
      all_selected: false,
      search_only: false,
      join_object_id: "",
      selected: new can.List(),
      entries: new can.List(),
      options: new can.List(),
      relevant: new can.List(),
      get_instance: can.compute(function () {
        return CMS.Models.get_instance(this.attr("object"), this.attr("join_object_id"));
      }),
      get_binding_name: function (instance, plural) {
        return (instance.has_binding(plural) ? "" : "related_") + plural;
      },
      model_from_type: function (type) {
        var types = _.reduce(_.values(this.types()), function (memo, val) {
          if (val.items) {
            return memo.concat(val.items);
          }
          return memo;
        }, []);
        return _.findWhere(types, {value: type});
      },
      get_forbidden: function (type) {
        var forbidden = {
          "Program": ["Audit"],
          "Audit": ["ControlAssessment", "Program", "Request"],
          "ControlAssessment": ["Control"],
          "Request": ["Workflow", "TaskGroup"]
        };
        return forbidden[type] ? forbidden[type] : [];
      },
      get_whitelist: function () {
        var whitelisted = ["TaskGroupTask", "TaskGroup", "CycleTaskGroupObjectTask"];
        return this.attr("search_only") ? whitelisted : [];
      },
      types: can.compute(function () {
        var selector_list,
            canonical = GGRC.Mappings.get_canonical_mappings_for(this.object),
            list = GGRC.tree_view.base_widgets_by_type[this.object],
            forbidden = this.get_forbidden(this.object),
            whitelist = this.get_whitelist(),
            groups = {
              "all_objects": {
                name: "All Objects",
                value: "AllObject",
                plural: "allobjects",
                table_plural: "allobjects",
                singular: "AllObject",
                models: []
              },
              "entities": {
                name: "People/Groups",
                items: []
              },
              "business": {
                name: "Assets/Business",
                items: []
              },
              "governance": {
                name: "Governance",
                items: []
              }
            };

        selector_list = _.intersection.apply(_, _.compact([_.keys(canonical), list]));
        selector_list = _.union(selector_list, whitelist);
        can.each(selector_list, function (model_name) {
          if (!model_name || !CMS.Models[model_name] || ~forbidden.indexOf(model_name)) {
            return;
          }
          var cms_model = CMS.Models[model_name],
              group = !groups[cms_model.category] ? "governance" : cms_model.category;

          groups[group]["items"].push({
            name: cms_model.title_plural,
            value: cms_model.shortName,
            singular: cms_model.shortName,
            plural: cms_model.title_plural.toLowerCase().replace(/\s+/, "_"),
            table_plural: cms_model.table_plural,
            title_singular: cms_model.title_singular,
            isSelected: cms_model.shortName === this.type
          });
          groups["all_objects"]["models"].push(cms_model.shortName);
        }, this);
        if (groups["all_objects"]["models"].length < 2) {
          delete groups["all_objects"];
        }
        return groups;
      })
    });

  can.Component.extend({
    tag: "modal-mapper",
    template: can.view(GGRC.mustache_path + "/modals/mapper/base.mustache"),
    scope: function (attrs, parentScope, el) {
      var $el = $(el),
          data = {},
          id = +$el.attr("join-object-id"),
          object = $el.attr("object"),
          type = $el.attr("type"),
          tree_view = GGRC.tree_view.sub_tree_for[object];

      if ($el.attr("search-only")) {
        data["search_only"] =  /true/i.test($el.attr("search-only"));
      }
      if (object) {
        data["object"] = object;
      }

      type = CMS.Models[type] && type;
      if (!data["search_only"]) {
        if (type) {
          data["type"] = type;
        } else if (id === GGRC.page_instance().id || !tree_view) {
          data["type"] = "AllObject";
        } else {
          data["type"] = tree_view.display_list[0];
        }
      }
      if (id || GGRC.page_instance()) {
        data["join_object_id"] = id || GGRC.page_instance().id;
      }
      return {
        mapper: new MapperModel(data)
      };
    },
    events: {
      "inserted": function () {
        this.setModel();
        this.setBinding();
      },
      "deferredSave": function () {
        var source = this.scope.attr("deferred_to").instance || this.scope.attr("mapper.object"),
            data = {
              multi_map: true,
              arr: _.compact(_.map(this.scope.attr("mapper.selected"), function (desination) {
                    var isAllowed = GGRC.Utils.allowed_to_map(source, desination),
                        inst = _.find(this.scope.attr("mapper.entries"), function (entry) {
                          return entry.instance.id === desination.id && entry.instance.type === desination.type;
                        });
                    if (inst && isAllowed) {
                      return inst.instance;
                    }
                  }.bind(this)))
            };
        this.scope.attr("deferred_to").controller.element.trigger("defer:add", [data, {map_and_save: true}]);
        // TODO: Find proper way to dismiss the modal
        this.element.find(".modal-dismiss").trigger("click");
      },
      ".add-button .btn modal:added": "addNew",
      ".add-button .btn modal:success": "addNew",
      "addNew": function (el, ev, model) {
        var entries = this.scope.attr("mapper.entries"),
            len = entries.length,
            get_binding_name = this.scope.attr("mapper").get_binding_name,
            binding, mapping, selected, item;

        selected = this.scope.attr("mapper.get_instance");
        binding = selected.get_binding(get_binding_name(selected, model.constructor.table_plural));
        mapping = GGRC.Mappings.get_canonical_mapping_name(selected.type, model.type);
        mapping = model.get_mapping(mapping);

        item = new GGRC.ListLoaders.MappingResult(model, mapping, binding);
        item.append = true;
        entries.unshift(item);
      },
      ".modal-footer .btn-map click": function (el, ev) {
        ev.preventDefault();
        if (el.hasClass("disabled")) {
          return;
        }
        // TODO: Figure out nicer / proper way to handle deferred save
        if (this.scope.attr("deferred")) {
          return this.deferredSave();
        }

        var type = this.scope.attr("mapper.type"),
            object = this.scope.attr("mapper.object"),
            isAllObject = type === "AllObject",
            instance = CMS.Models[object].findInCacheById(this.scope.attr("mapper.join_object_id")),
            mapping, Model, data = {}, defer = [],
            que = new RefreshQueue();

        this.scope.attr("mapper.is_saving", true);
        que.enqueue(instance).trigger().done(function (inst) {
          data["context"] = instance.context || null;
          _.each(this.scope.attr("mapper.selected"), function (destination) {
            var modelInstance,
                isMapped = GGRC.Utils.is_mapped(instance, destination),
                isAllowed = GGRC.Utils.allowed_to_map(instance, destination);

            if (isMapped || !isAllowed) {
              return;
            }
            mapping = GGRC.Mappings.get_canonical_mapping(object, isAllObject ? destination.type : type);
            Model = CMS.Models[mapping.model_name];
            data[mapping.object_attr] = {
              href: instance.href,
              type: instance.type,
              id: instance.id
            };
            data[mapping.option_attr] = destination;
            modelInstance = new Model(data);
            defer.push(modelInstance.save());
          }, this);

          $.when.apply($, defer)
            .fail(function (response, message) {
              $("body").trigger("ajax:flash", {"error": message});
            }.bind(this))
            .always(function () {
              this.scope.attr("mapper.is_saving", false);
              // TODO: Find proper way to dismiss the modal
              this.element.find(".modal-dismiss").trigger("click");

              // there is some kind of a race condition when filling the treview with new elements
              // so many don't get rendered. To solve it, at the end of the loading
              // we refresh the whole tree view. Other solutions could be to batch add the objects.
              $(".cms_controllers_tree_view:visible").each(function () {
                // TODO: This is terrible solution, but it's only way to refresh all tree views on page
                var control = $(this).control();
                if (control) {
                  control.reload_list();
                }
              });
            }.bind(this));
        }.bind(this));
      },
      "setBinding": function () {
        if (this.scope.attr("mapper.search_only")) {
          return;
        }
        var get_binding_name = this.scope.attr("mapper").get_binding_name,
            selected = this.scope.attr("mapper.get_instance"),
            table_plural = get_binding_name(selected, this.scope.attr("mapper.model.table_plural")),
            binding;

        if (!selected.has_binding(table_plural)) {
          return;
        }
        binding = selected.get_binding(table_plural);
        binding.refresh_list().then(function (mappings) {
          can.each(mappings, function (mapping) {
            this.scope.attr("mapper.bindings")[mapping.instance.id] = mapping;
          }, this);
        }.bind(this));
      },
      "setModel": function () {
        var type = this.scope.attr("mapper.type"),
            types = this.scope.attr("mapper.types");

        if (~["All Object", "AllObject"].indexOf(type)) {
          return this.scope.attr("mapper.model", types["all_objects"]);
        }
        this.scope.attr("mapper.model", this.scope.mapper.model_from_type(type));
      },
      "{mapper} type": function () {
        this.scope.attr("mapper.term", "");
        this.scope.attr("mapper.contact", {});
        this.scope.attr("mapper.relevant", []);

        this.setModel();
        this.setBinding();
      },
      "#search-by-owner autocomplete:select": function (el, ev, data) {
        this.scope.attr("mapper.contact", data.item);
      },
      "#search-by-owner keyup": function (el, ev) {
        if (!el.val()) {
          this.scope.attr("mapper.contact", {});
        }
      },
      "allSelected": function () {
        var selected = this.scope.attr("mapper.selected"),
            entries = this.scope.attr("mapper.entries");

        if (!entries.length && !selected.length) {
          return;
        }
        this.scope.attr("mapper.all_selected", selected.length === entries.length);
      },
      "{mapper.entries} length": "allSelected",
      "{mapper.selected} length": "allSelected"
    },
    helpers: {
      "get_title": function (options) {
        var instance = this.attr("mapper.get_instance");
        return instance && instance.title ? instance.title : this.attr("mapper.object");
      },
      "get_object": function (options) {
        var type = CMS.Models[this.attr("mapper.type")];
        if (type && type.title_plural) {
          return type.title_plural;
        }
        return "Objects";
      },
      "loading_or_saving": function (options) {
        if (this.attr("mapper.page_loading") || this.attr("mapper.is_saving")) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });

  can.Component.extend({
    tag: "mapper-checkbox",
    template: "<content />",
    scope: {
      "instance_id": "@",
      "instance_type": "@",
      "is_mapped": "@",
      "is_allowed_to_map": "@",
      "checkbox": can.compute(function (status) {
        return /true/gi.test(this.attr("is_mapped")) || this.attr("select_state") || this.attr("appended");
      })
    },
    events: {
      "{scope} selected": function () {
        this.element.find(".object-check-single").prop("checked", _.findWhere(this.scope.attr("selected"), {
          id: +this.scope.attr("instance_id")
        }));
      },
      ".object-check-single change": function (el, ev) {
        if (el.prop("disabled") || el.hasClass("disabled")) {
          return false;
        }
        var scope = this.scope,
            uid = +scope.attr("instance_id"),
            type = scope.attr("instance_type"),
            item = _.find(scope.attr("options"), function (option) {
              return option.instance.id === uid && option.instance.type === type;
            }),
            status = el.prop("checked"),
            selected = this.scope.attr("selected"),
            needle = {id: item.instance.id, type: item.instance.type},
            index;

        if (!status) {
          index = _.findIndex(selected, needle);
          selected.splice(index, 1);
        } else {
          _.findWhere(selected, needle) || selected.push({
            id: item.instance.id,
            type: item.instance.type,
            href: item.instance.href
          });
        }
      }
    },
    helpers: {
      "not_allowed_to_map": function (options) {
        if (/false/gi.test(this.attr("is_allowed_to_map"))) {
          return options.fn();
        }
        return options.inverse();
      },
      "is_disabled": function (options) {
        if (/true/gi.test(this.attr("is_mapped"))
            || this.attr("is_saving")
            || this.attr("is_loading")
            || /false/gi.test(this.attr("is_allowed_to_map"))) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });

  can.Component.extend({
    tag: "mapper-results",
    template: "<content />",
    scope: {
      "items-per-page": "@",
      page: 0,
      page_loading: false,
      select_state: false,
      loading_or_saving: can.compute(function () {
        return this.attr("page_loading") || this.attr("mapper.is_saving");
      })
    },
    events: {
      "inserted":  function () {
        this.element.find(".results-wrap").cms_controllers_infinite_scroll();
        this.getResults();
      },
      ".modalSearchButton click": "getResults",
      "{scope} type": "getResults",
      "{scope.entries} add": function (list, ev, added) {
        // TODO: I'm assuming we are adding only one item manually
        if (!added[0].append) {
          return;
        }
        var instance = added[0].instance,
            option = this.getItem(instance);
        option.appended = true;
        this.scope.attr("options").unshift(option);
        this.scope.attr("selected").push({
          id: instance.id,
          type: instance.type,
          href: instance.href
        });
      },
      ".results-wrap scrollNext": "drawPage",
      ".object-check-all click": function (el, ev) {
        ev.preventDefault();
        if (el.hasClass("disabled")) {
          return;
        }
        var que = new RefreshQueue(),
            entries = this.scope.attr("entries");

        this.scope.attr("select_state", true);
        this.scope.attr("mapper.all_selected", true);
        this.scope.attr("is_loading", true);
        que.enqueue(_.pluck(entries, "instance")).trigger().then(function (models) {
          this.scope.attr("is_loading", false);
          this.scope.attr("selected", _.map(models, function (model) {
            return {
              id: model.id,
              type: model.type,
              href: model.href
            };
          }));
        }.bind(this));
      },
      "getItem": function (model) {
        if (!model.type) {
          return;
        }
        if (this.scope.attr("mapper.search_only")) {
          return {
            instance: model,
            selected_object: false,
            binding: {},
            mappings: []
          };
        }
        var selected = this.scope.attr("mapper.get_instance"),
            mapper = this.scope.mapper.model_from_type(model.type),
            binding, bindings = this.scope.attr("mapper.bindings");

        if (bindings[model.id]) {
          return _.extend(bindings[model.id], {
            selected_object: selected
          });
        }
        if (selected.has_binding(mapper.plural.toLowerCase())) {
          binding = selected.get_binding(mapper.plural.toLowerCase());
        }
        return {
          instance: model,
          selected_object: selected,
          binding: binding,
          mappings: []
        };
      },
      "drawPage": function () {
        if (this.scope.attr("mapper.page_loading")) {
          return;
        }
        var page = this.scope.attr("page"),
            next_page = page + 1,
            per_page = +this.scope.attr("items-per-page"),
            page_items = this.scope.attr("entries").slice(page * per_page, next_page * per_page),
            options = this.scope.attr("options"),
            que = new RefreshQueue();

        if (!page_items.length) {
          return;
        }
        this.scope.attr("mapper.page_loading", true);

        return que.enqueue(_.pluck(page_items, "instance")).trigger().then(function (models) {
          this.scope.attr("mapper.page_loading", false);
          this.scope.attr("page", next_page);

          options.push.apply(options, can.map(models, this.getItem.bind(this)));
        }.bind(this));
      },
      "searchFor": function (data) {
        data.options = data.options || {};
        var join_model = GGRC.Mappings.join_model_name_for(this.scope.attr("mapper.object"), data.model_name);

        if (join_model !== "TaskGroupObject" && data.model_name === "Program") {
          data.options.permission_parms = {
            __permission_model: join_model
          };
        }
        if (!_.includes(["ObjectPerson", "WorkflowPerson"], join_model) &&
            !this.options.scope.attr("mapper.search_only")) {
          data.options.__permission_type = data.options.__permission_type || "update";
        }
        data.model_name = _.isString(data.model_name) ? [data.model_name] : data.model_name;

        return GGRC.Models.Search.search_for_types(data.term || "", data.model_name, data.options);
      },
      "getResults": function () {
        if (this.scope.attr("mapper.page_loading") || this.scope.attr("mapper.is_saving")) {
          return;
        }
        var model_name = this.scope.attr("type"),
            contact = this.scope.attr("contact"),
            permission_parms = {},
            search = [],
            filters,
            list;

        this.scope.attr("page", 0);
        this.scope.attr("entries", []);
        this.scope.attr("selected", []);
        this.scope.attr("options", []);
        this.scope.attr("select_state", false);
        this.scope.attr("mapper.all_selected", false);

        filters = _.compact(_.map(this.scope.attr("mapper.relevant"), function (relevant) {
          if (!relevant.value) {
            return;
          }
          var mappings, Loader;
          if (model_name === "AllObject") {
            Loader = GGRC.ListLoaders.MultiListLoader;
            mappings = _.compact(_.map(GGRC.Mappings.get_mappings_for(relevant.filter.constructor.shortName), function (mapping) {
              if (mapping instanceof GGRC.ListLoaders.DirectListLoader
                  || mapping instanceof GGRC.ListLoaders.ProxyListLoader) {
                return mapping;
              }
            }));
          } else {
            Loader = GGRC.ListLoaders.TypeFilteredListLoader;
            mappings = GGRC.Mappings.get_canonical_mapping_name(relevant.model_name, model_name);
            mappings = mappings.replace("_as_source", "");
          }
          return new Loader(mappings, [model_name]).attach(relevant.filter);
        }));
        if (model_name === "AllObject") {
          model_name = this.scope.attr("types.all_objects.models");
        }
        if (!_.isEmpty(contact)) {
          permission_parms.contact_id = contact.id;
        }

        this.scope.attr("mapper.page_loading", true);
        search = new GGRC.ListLoaders.SearchListLoader(function (binding) {
            return this.searchFor({
              term: this.scope.attr("term"),
              model_name: model_name,
              options: permission_parms
            }).then(function (mappings) {
              return mappings.entries;
            });
          }.bind(this)).attach({});

        search = filters.concat(search);
        list = (search.length > 1) ?
                  new GGRC.ListLoaders.IntersectingListLoader(search).attach()
                : search[0];

        list.refresh_stubs().then(function (options) {
          this.scope.attr("mapper.page_loading", false);
          this.scope.attr("entries", options);
          this.drawPage();
        }.bind(this));
      }
    }
  });


  $("body").on("click",
  '[data-toggle="unified-mapper"], \
   [data-toggle="unified-search"]',
  function (ev) {
    ev.preventDefault();
    var btn = $(ev.currentTarget),
        data = {},
        isSearch;

    _.each(btn.data(), function (val, key) {
      data[can.camelCaseToUnderscore(key)] = val;
    });

    if (data.tooltip) {
      data.tooltip.hide();
    }
    isSearch = /unified-search/ig.test(data.toggle);
    GGRC.Controllers.MapperModal.launch($(this), _.extend({
      "object": btn.data("join-object-type"),
      "type": btn.data("join-option-type"),
      "join-object-id": btn.data("join-object-id"),
      "search-only": isSearch
    }, data));
  });
})(window.can, window.can.$);
