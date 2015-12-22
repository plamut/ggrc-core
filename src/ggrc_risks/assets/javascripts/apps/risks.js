/*
 * Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: silas@reciprocitylabs.com
 * Maintained By: silas@reciprocitylabs.com
 */


(function ($, CMS, GGRC) {
  var RisksExtension = {};

  // Insert risk mappings to all gov/business object types
  var _risk_object_types = [
      "Program", "Regulation", "Standard", "Policy", "Contract",
      "Objective", "Control", "Section", "Clause", "System", "Process",
      "DataAsset", "Facility", "Market", "Product", "Project",
      "MultitypeSearch", "Issue", "ControlAssessment", "AccessGroup", "Request",
      "Person", "OrgGroup", "Vendor"
    ],
    related_object_descriptors = {},
    threat_descriptor, risk_descriptor;

  // Register `risks` extension with GGRC
  GGRC.extensions.push(RisksExtension);

  RisksExtension.name = "risks";

  // Register Risk Assessment models for use with `infer_object_type`
  RisksExtension.object_type_decision_tree = function () {
    return {
      "risk": CMS.Models.Risk,
      "threat": CMS.Models.Threat
    };
  };

  // Configure mapping extensions for ggrc_risks
  RisksExtension.init_mappings = function init_mappings() {
    var Proxy = GGRC.MapperHelpers.Proxy,
      Direct = GGRC.MapperHelpers.Direct,
      Cross = GGRC.MapperHelpers.Cross,
      CustomFilter = GGRC.MapperHelpers.CustomFilter,
      Reify = GGRC.MapperHelpers.Reify,
      Search = GGRC.MapperHelpers.Search,
      TypeFilter = GGRC.MapperHelpers.TypeFilter,
      Multi = GGRC.MapperHelpers.Multi,
      Indirect = GGRC.MapperHelpers.Indirect;

    // Add mappings for risk objects
    var mappings = {

      related: {
        related_objects_as_source: Proxy(
          null, "destination", "Relationship", "source", "related_destinations"),
        related_objects_as_destination: Proxy(
          null, "source", "Relationship", "destination", "related_sources"),
        related_objects: Multi(["related_objects_as_source", "related_objects_as_destination"]),
      },
      related_objects: {
        _canonical: {
          "related_objects_as_source": _risk_object_types,
        },
        related_programs: TypeFilter("related_objects", "Program"),
        related_data_assets: TypeFilter("related_objects", "DataAsset"),
        related_access_groups: TypeFilter("related_objects", "AccessGroup"),
        related_facilities: TypeFilter("related_objects", "Facility"),
        related_markets: TypeFilter("related_objects", "Market"),
        related_processes: TypeFilter("related_objects", "Process"),
        related_products: TypeFilter("related_objects", "Product"),
        related_projects: TypeFilter("related_objects", "Project"),
        related_systems: TypeFilter("related_objects", "System"),
        related_controls: TypeFilter("related_objects", "Control"),
        related_clauses: TypeFilter("related_objects", "Clause"),
        related_sections: TypeFilter("related_objects", "Section"),
        related_regulations: TypeFilter("related_objects", "Regulation"),
        related_contracts: TypeFilter("related_objects", "Contract"),
        related_policies: TypeFilter("related_objects", "Policy"),
        related_standards: TypeFilter("related_objects", "Standard"),
        related_objectives: TypeFilter("related_objects", "Objective"),
        related_issues: TypeFilter("related_objects", "Issue"),
        related_control_assessments: TypeFilter("related_objects", "ControlAssessment"),
        related_requests: TypeFilter("related_objects", "Request"),
        related_people: TypeFilter("related_objects", "Person"),
        related_org_groups: TypeFilter("related_objects", "OrgGroup"),
        related_vendors: TypeFilter("related_objects", "Vendor")

      },
      related_risk: {
        _canonical: {
          "related_objects_as_source": ['Risk'].concat(_risk_object_types)
        },
        related_risks: TypeFilter("related_objects", "Risk"),
      },
      related_threat: {
        _canonical: {
          "related_objects_as_source": ['Threat'].concat(_risk_object_types)
        },
        related_threats: TypeFilter("related_objects", "Threat"),
      },
      ownable: {
        owners: Proxy(
          "Person", "person", "ObjectOwner", "ownable", "object_owners")
      },
      Risk: {
        _mixins: ['related', 'related_objects', 'related_threat', 'ownable'],
        orphaned_objects: Multi([]),
      },
      Threat: {
        _mixins: ['related', 'related_objects', 'related_risk', 'ownable'],
        orphaned_objects: Multi([])
      },
      Person: {
        owned_risks: Indirect("Risk", "contact"),
        owned_threats: Indirect("Threat", "contact"),
      },
    };

    can.each(_risk_object_types, function (type) {
        mappings[type] = _.extend(mappings[type] || {}, {
          _canonical: {
            "related_objects_as_source": ["Risk", "Threat"]
          },
          _mixins: ["related", "related_risk", "related_threat"],
        });
    });
    new GGRC.Mappings("ggrc_risks", mappings);
  };

  // Override GGRC.extra_widget_descriptors and GGRC.extra_default_widgets
  // Initialize widgets for risk page
  RisksExtension.init_widgets = function init_widgets() {
    var page_instance = GGRC.page_instance(),
        is_my_work = function is_my_work() {
          return page_instance && page_instance.type === "Person";
        },
        related_or_owned = is_my_work() ? 'owned_' : 'related_',
        sorted_widget_types = _.sortBy(_risk_object_types, function(type) {
          var model = CMS.Models[type] || {};
          return model.title_plural || type;
        });

    // Init widget descriptors:
    can.each(sorted_widget_types, function (model_name) {
      var widgets_by_type = GGRC.tree_view.base_widgets_by_type,
          model;

      if (model_name === "MultitypeSearch" || !widgets_by_type[model_name]) {
        return;
      }
      model = CMS.Models[model_name];
      widgets_by_type[model_name] = widgets_by_type[model_name].concat(["Risk", "Threat"]);

      related_object_descriptors[model_name] = {
        content_controller: CMS.Controllers.TreeView,
        content_controller_selector: "ul",
        widget_initial_content: '<ul class="tree-structure new-tree"></ul>',
        widget_id: model.table_plural,
        widget_name: model.model_plural,
        widget_icon: model.table_singular,
        content_controller_options: {
          add_item_view : GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
          child_options: [],
          draw_children: false,
          parent_instance: page_instance,
          model: model,
          mapping: "related_" + model.table_plural,
        }
      };
    });
    threat_descriptor = {
      content_controller: CMS.Controllers.TreeView,
      content_controller_selector: "ul",
      widget_initial_content: '<ul class="tree-structure new-tree"></ul>',
      widget_id: CMS.Models.Threat.table_plural,
      widget_name: CMS.Models.Threat.title_plural,
      widget_icon: CMS.Models.Threat.table_singular,
      content_controller_options: {
        child_options: [],
        draw_children: false,
        parent_instance: page_instance,
        model: CMS.Models.Threat,
        mapping: related_or_owned + CMS.Models.Threat.table_plural,
        footer_view: is_my_work() ? null : GGRC.mustache_path + "/base_objects/tree_footer.mustache"
      }
    };
    risk_descriptor = {
      content_controller: CMS.Controllers.TreeView,
      content_controller_selector: "ul",
      widget_initial_content: '<ul class="tree-structure new-tree"></ul>',
      widget_id: CMS.Models.Risk.table_plural,
      widget_name: CMS.Models.Risk.title_plural,
      widget_icon: CMS.Models.Risk.table_singular,
      content_controller_options: {
        child_options: [],
        draw_children: false,
        parent_instance: page_instance,
        model: CMS.Models.Risk,
        mapping: related_or_owned + CMS.Models.Risk.table_plural,
        footer_view: is_my_work() ? null : GGRC.mustache_path + "/base_objects/tree_footer.mustache"
      }
    };

    if (page_instance instanceof CMS.Models.Risk) {
      RisksExtension.init_widgets_for_risk_page();
    } else if (page_instance instanceof CMS.Models.Threat) {
      RisksExtension.init_widgets_for_threat_page();
    } else if (page_instance instanceof CMS.Models.Person) {
      RisksExtension.init_widgets_for_person_page();
    } else {
      RisksExtension.init_widgets_for_other_pages();
    }
  };

  RisksExtension.init_widgets_for_risk_page =
    function init_widgets_for_risk_page() {
      var risk_descriptors = $.extend({},
        related_object_descriptors, {
          Threat: threat_descriptor
        }
      );
      new GGRC.WidgetList("ggrc_risks", {
        Risk: risk_descriptors
      });
  };

  RisksExtension.init_widgets_for_threat_page =
    function init_widgets_for_threat_page() {
      var threat_descriptors = $.extend({},
        related_object_descriptors, {
          Risk: risk_descriptor
        }
      );
      new GGRC.WidgetList("ggrc_risks", {
        Threat: threat_descriptors
      });
  };

  RisksExtension.init_widgets_for_person_page =
    function init_widgets_for_person_page() {
      var people_widgets = $.extend({}, {
          Threat: threat_descriptor
        }, {
          Risk: risk_descriptor
        }
      );

      new GGRC.WidgetList("ggrc_risks", {
        Person: people_widgets,
      });
  };

  RisksExtension.init_widgets_for_other_pages =
    function init_widgets_for_other_pages() {
      var descriptor = {},
          page_instance = GGRC.page_instance();
      if (page_instance && ~can.inArray(page_instance.constructor.shortName, _risk_object_types)) {
        descriptor[page_instance.constructor.shortName] = {
          risk: risk_descriptor,
          threat: threat_descriptor,
        };
      }
      new GGRC.WidgetList("ggrc_risks", descriptor);
  };



  GGRC.register_hook("LHN.Sections_risk", GGRC.mustache_path + "/dashboard/lhn_risks");

  RisksExtension.init_mappings();

})(this.can.$, this.CMS, this.GGRC);
