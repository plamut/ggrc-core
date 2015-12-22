/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

//= require can.jquery-all

(function (can, $) {
  var CoreExtension = {};

  CoreExtension.name = "core";
  GGRC.extensions.push(CoreExtension);
  _.extend(CoreExtension, {
    object_type_decision_tree: function () {
      return {
        "program": CMS.Models.Program,
        "audit": CMS.Models.Audit,
        "contract": CMS.Models.Contract,
        "policy": CMS.Models.Policy,
        "standard": CMS.Models.Standard,
        "regulation": CMS.Models.Regulation,
        "org_group": CMS.Models.OrgGroup,
        "vendor": CMS.Models.Vendor,
        "project": CMS.Models.Project,
        "facility": CMS.Models.Facility,
        "product": CMS.Models.Product,
        "data_asset": CMS.Models.DataAsset,
        "access_group": CMS.Models.AccessGroup,
        "market": CMS.Models.Market,
        "system_or_process": {
          _discriminator: function (data) {
            if (data.is_biz_process) {
              return CMS.Models.Process;
            }
            return CMS.Models.System;
          }
        },
        "system": CMS.Models.System,
        "process": CMS.Models.Process,
        "control": CMS.Models.Control,
        "control_assessment": CMS.Models.ControlAssessment,
        "request": CMS.Models.Request,
        "issue" : CMS.Models.Issue,
        "objective": CMS.Models.Objective,
        "section": CMS.Models.Section,
        "clause": CMS.Models.Clause,
        "person": CMS.Models.Person,
        "role": CMS.Models.Role,
        "threat": CMS.Models.Threat,
        "vulnerability": CMS.Models.Vulnerability,
        "template": CMS.Models.Template
      };
    },
    init_widgets: function () {
      var base_widgets_by_type = GGRC.tree_view.base_widgets_by_type,
          widget_list = new GGRC.WidgetList("ggrc_core"),
          object_class = GGRC.infer_object_type(GGRC.page_object),
          object_table = object_class && object_class.table_plural,
          object = GGRC.page_instance();

      // TODO: Really ugly way to avoid executing IIFE - needs cleanup
      if (!GGRC.page_object) {
        return;
      }
      // Info widgets display the object information instead of listing connected
      //  objects.
      var info_widget_views = {
        'programs': GGRC.mustache_path + "/programs/info.mustache",
        'audits': GGRC.mustache_path + "/audits/info.mustache",
        'people': GGRC.mustache_path + "/people/info.mustache",
        'policies': GGRC.mustache_path + "/policies/info.mustache",
        'objectives': GGRC.mustache_path + "/objectives/info.mustache",
        'controls': GGRC.mustache_path + "/controls/info.mustache",
        'systems': GGRC.mustache_path + "/systems/info.mustache",
        'processes': GGRC.mustache_path + "/processes/info.mustache",
        'products': GGRC.mustache_path + "/products/info.mustache",
        'control_assessments': GGRC.mustache_path + "/control_assessments/info.mustache",
        'requests': GGRC.mustache_path + "/requests/info.mustache",
        'issues': GGRC.mustache_path + "/issues/info.mustache"
      };
      widget_list.add_widget(object.constructor.shortName, "info", {
        widget_id: "info",
        content_controller: GGRC.Controllers.InfoWidget,
        instance: object,
        widget_view: info_widget_views[object_table]
      });

      var model_names = Object.keys(base_widgets_by_type);
      model_names.sort();
      var possible_model_type = model_names.slice();
      possible_model_type.push("Request"); //Missing model-type by selection
      can.each(model_names, function (name) {
        GGRC.tree_view.basic_model_list.push({model_name: name, display_name: CMS.Models[name].title_singular});
        //Initialize child_model_list, and child_display_list each model_type
        var w_list  = base_widgets_by_type[name], child_model_list = [];
        w_list.sort();
        can.each(w_list, function (item) {
          if (possible_model_type.indexOf(item) !== -1) {
            child_model_list.push({model_name: item, display_name: CMS.Models[item].title_singular});
          }
        });
        GGRC.tree_view.sub_tree_for[name] = {
          model_list: child_model_list,
          display_list : CMS.Models[name].tree_view_options.child_tree_display_list || w_list
        };
      });

      function sort_sections(sections) {
        return can.makeArray(sections).sort(window.natural_comparator);
      }

      function apply_mixins(definitions) {
        var mappings = {};

        // Recursively handle mixins
        function reify_mixins(definition) {
          var final_definition = {};
          if (definition._mixins) {
            can.each(definition._mixins, function (mixin) {
              if (typeof (mixin) === "string") {
                // If string, recursive lookup
                if (!definitions[mixin])
                  console.debug("Undefined mixin: " + mixin, definitions);
                else
                  can.extend(final_definition, reify_mixins(definitions[mixin]));
              } else if (can.isFunction(mixin)) {
                // If function, call with current definition state
                mixin(final_definition);
              } else {
                // Otherwise, assume object and extend
                can.extend(final_definition, mixin);
              }
            });
          }
          can.extend(final_definition, definition);
          delete final_definition._mixins;
          return final_definition;
        }

        can.each(definitions, function (definition, name) {
          // Only output the mappings if it's a model, e.g., uppercase first letter
          if (name[0] === name[0].toUpperCase())
            mappings[name] = reify_mixins(definition);
        });

        return mappings;
      }

      var far_models = base_widgets_by_type[object.constructor.shortName],
        model_widget_descriptors = {},
        model_default_widgets = [],

        // here we are going to define extra descriptor options, meaning that
        //  these will be used as extra options to create widgets on top of

      extra_descriptor_options = {
        all: {
          Person: {
            widget_icon: 'grcicon-user-black'
          },
          Document: {
            widget_icon: 'grcicon-link'
          }
        },
        Contract: {
          Clause: {
            widget_name: function () {
              var $objectArea = $(".object-area");
              if ($objectArea.hasClass("dashboard-area")) {
                return "Clauses";
              } else {
                return "Mapped Clauses";
              }
            }
          }
        },
        Program: {
          Person: {
            widget_id: "person",
            widget_name: "People",
            widget_icon: "person",
            content_controller: GGRC.Controllers.TreeView
          }
        },
        Audit: {
          Person: {
            widget_id: "person",
            widget_name: "People",
            widget_icon: "person",
            content_controller: GGRC.Controllers.TreeView,
            content_controller_options: {
              mapping: "authorized_people",
              allow_mapping: false,
              allow_creating: false
            }
          },
          Request: {
            widget_id: "Request",
            widget_name: "Open Requests"
          },
          history: {
            widget_id: "history",
            widget_name: "Complete",
            widget_icon: "history"
          },
          Control: {
            widget_id: "control",
            widget_name: "In Scope Controls",
            widget_icon: "control"
          },
          program: {
            widget_id: "program",
            widget_name: "Program",
            widget_icon: "program"
          },
        },
        Control: {
          Request: {
            widget_id: "Request",
            widget_name: "Requests"
          }
        },
        Person: {
          Request: {
            widget_id: "Request",
            widget_name: "Requests"
          }
        }
      },
      // Prevent widget creation with <model_name>: false
      // e.g. to prevent ever creating People widget:
      //     { all : { Person: false }}
      // or to prevent creating People widget on Objective page:
      //     { Objective: { Person: false } }
      overridden_models = {
        Program: {
          //  Objective: false
          //, Control: false
          //, Regulation: false
          //, Policy: false
          //, Standard: false
          //, Contract: false
        },
        all: {
          Document: false,
          DocumentationResponse: false,
          InterviewResponse: false,
          PopulationSampleResponse: false
        }
      },
      related_objects_child_options = {
        model: can.Model.Cacheable,
        mapping: "related_objects",
        show_view: GGRC.mustache_path + "/base_objects/tree.mustache",
        footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
        add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
        draw_children: true
      },
      extra_content_controller_options = apply_mixins({
        objectives: {
          Objective: {
            mapping: "objectives",
            draw_children: true,
            show_view: GGRC.mustache_path + "/objectives/tree.mustache",
            footer_view: GGRC.mustache_path + "/objectives/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/objectives/tree_add_item.mustache"
          }
        },
        controls: {
          Control: {
            mapping: "controls",
            draw_children: true,
            show_view: GGRC.mustache_path + "/controls/tree.mustache",
            footer_view: GGRC.mustache_path + "/controls/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/controls/tree_add_item.mustache"
          }
        },
        business_objects: {
          AccessGroup: {
            mapping: "related_access_groups",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          DataAsset: {
            mapping: "related_data_assets",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Facility: {
            mapping: "related_facilities",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Market: {
            mapping: "related_markets",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          OrgGroup: {
            mapping: "related_org_groups",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Vendor: {
            mapping: "related_vendors",
            hild_options: [related_objects_child_options],
            draw_children: true
          },
          Process: {
            mapping: "related_processes",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Product: {
            mapping: "related_products",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Project: {
            mapping: "related_projects",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          System: {
            mapping: "related_systems",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          ControlAssessment: {
            mapping: "related_control_assessments",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Request: {
            mapping: "related_requests",
            child_options: [
              _.extend({}, related_objects_child_options, {
                mapping: "info_related_objects"
              })
            ],
            draw_children: true
          },
          Document: {
            mapping: "documents"
          },
          Person: {
            mapping: "people"
          },
          Program: {
            mapping: "programs",
            child_options: [related_objects_child_options],
            draw_children: true
          },
        },
        issues: {
          Issue: {
            mapping: "related_issues",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
            child_options: [related_objects_child_options],
            draw_children: true
          }
        },
        governance_objects: {
          Regulation: {
            mapping: "regulations",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache",
            footer_view: GGRC.mustache_path + "/directives/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/directives/tree_add_item.mustache"
          },
          Contract: {
            mapping: "contracts",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache",
            footer_view: GGRC.mustache_path + "/directives/tree_footer.mustache",
          },
          Policy: {
            mapping: "policies",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache",
            footer_view: GGRC.mustache_path + "/directives/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/directives/tree_add_item.mustache"
          },
          Standard: {
            mapping: "standards",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache",
            footer_view: GGRC.mustache_path + "/directives/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/directives/tree_add_item.mustache"
          },
          Control: {
            mapping: "controls"
          },
          Objective: {
            mapping: "objectives"
          },
          Section: {
            mapping: "sections"
          },
          Clause: {
            mapping: "clauses"
          }
        },
        Program: {
          _mixins: [
            "governance_objects", "objectives", "controls", "business_objects", "issues"
          ],
          Audit: {
            mapping: "audits",
            allow_mapping: true,
            draw_children: true,
            show_view: GGRC.mustache_path + "/audits/tree.mustache",
            header_view: GGRC.mustache_path + "/audits/tree_header.mustache",
            footer_view: GGRC.mustache_path + "/audits/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/audits/tree_add_item.mustache"
          },
          Person: {
            show_view: GGRC.mustache_path + "/ggrc_basic_permissions/people_roles/authorizations_by_person_tree.mustache",
            footer_view: GGRC.mustache_path + "/ggrc_basic_permissions/people_roles/authorizations_by_person_tree_footer.mustache",
            parent_instance: GGRC.page_instance(),
            allow_reading: true,
            allow_mapping: true,
            allow_creating: true,
            model: CMS.Models.Person,
            mapping: "mapped_and_or_authorized_people"
          }
        },
        Audit: {
          _mixins: ["issues"],
          Request: {
            mapping: "active_requests",
            draw_children: true,
            show_view: GGRC.mustache_path + "/requests/tree.mustache",
            footer_view: GGRC.mustache_path + "/requests/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/requests/tree_add_item.mustache"
          },
          history: {
            mapping: "history",
            parent_instance: GGRC.page_instance(),
            draw_children: true,
            model: "Request",
            show_view: GGRC.mustache_path + "/requests/tree.mustache",
            footer_view: GGRC.mustache_path + "/requests/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/requests/tree_add_item.mustache",
            allow_mapping: false,
            allow_creating: false
          },
          Control: {
            mapping: "program_controls",
            parent_instance: GGRC.page_instance(),
            draw_children: true,
            model: CMS.Models.Control,
            show_view: GGRC.mustache_path + "/controls/tree.mustache",
            footer_view: GGRC.mustache_path + "/controls/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/controls/tree_add_item.mustache",
            allow_mapping: false,
            allow_creating: false
          },
          Program: {
            mapping: "_program",
            parent_instance: GGRC.page_instance(),
            draw_children: false,
            model: CMS.Models.Program,
            show_view: GGRC.mustache_path + "/programs/tree.mustache",
            allow_mapping: false,
            allow_creating: false
          },
          Section: {
            mapping: "sections",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Clause: {
            mapping: "clauses",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          ControlAssessment: {
            mapping: "related_control_assessments",
            parent_instance: GGRC.page_instance(),
            allow_mapping: true,
            child_options: [related_objects_child_options],
            draw_children: true,
            model: CMS.Models.ControlAssessment,
            show_view: GGRC.mustache_path + "/base_objects/tree.mustache",
            header_view: GGRC.mustache_path + "/base_objects/tree_header.mustache",
            footer_view: GGRC.mustache_path + "/control_assessments/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/control_assessments/tree_add_item.mustache"
          }
        },
        directive: {
          _mixins: [
            "objectives", "controls", "business_objects"
          ],
          Section: {
            mapping: "sections",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Clause: {
            mapping: "clauses",
            child_options: [related_objects_child_options],
            draw_children: true
          }
         },
        Regulation: {
          _mixins: ["directive", "issues"]
        },
        Standard: {
          _mixins: ["directive", "issues"]
        },
        Policy: {
          _mixins: ["directive", "issues"]
        },
        Contract: {
          _mixins: ["directive", "issues"]
        },
        extended_audits: {
          Audit: {
            mapping: "related_audits_via_related_responses",
            allow_mapping: false,
            allow_creating: false,
            draw_children: true,
            show_view: GGRC.mustache_path + "/audits/tree.mustache",
            footer_view: null
          },
        },
        Clause: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Section: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Objective: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Control: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"],
        },
        Request: {
          _mixins: ["governance_objects", "business_objects", "issues"],
          Audit: {
            mapping: "audits",
            draw_children: true,
            allow_creating: false,
            allow_mapping: false,
            show_view: GGRC.mustache_path + "/audits/tree.mustache",
            add_item_view: GGRC.mustache_path + "/audits/tree_add_item.mustache"
          },
        },
        ControlAssessment: {
          _mixins: ["governance_objects", "business_objects", "issues"],
          Audit: {
            mapping: "related_audits",
            draw_children: true,
            allow_creating: false,
            allow_mapping: true,
            show_view: GGRC.mustache_path + "/audits/tree.mustache",
            add_item_view: GGRC.mustache_path + "/audits/tree_add_item.mustache"
          },
          Section: {
            mapping: "sections",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Clause: {
            mapping: "clauses",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Request: {
            mapping: "related_requests",
            draw_children: true,
            show_view: GGRC.mustache_path + "/requests/tree.mustache",
            footer_view: GGRC.mustache_path + "/requests/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/requests/tree_add_item.mustache"
          }
        },
        Issue: {
          _mixins: ["governance_objects", "business_objects"],
          Control: {
            mapping: "related_controls",
            draw_children: true,
            show_view: GGRC.mustache_path + "/controls/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache"
          },
          Issue: {
            mapping: "related_issues",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache"
          },
          Audit: {
            mapping: "related_audits",
            draw_children: true,
            show_view: GGRC.mustache_path + "/audits/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache"
          },
        },
        AccessGroup: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        DataAsset: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Facility: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Market: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        OrgGroup: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Vendor: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Process: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Product: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Project: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        System: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Document: {
          _mixins: ["governance_objects", "business_objects", "extended_audits", "issues"]
        },
        Person: {
          _mixins: ["issues"],
          Request: {
            //mapping: "open_audit_requests",
            mapping: (/^\/objectBrowser\/?$/.test(window.location.pathname)) ?
              "all_open_audit_requests" : "open_audit_requests",
            draw_children: true,
            show_view: GGRC.mustache_path + "/requests/tree.mustache",
            footer_view: GGRC.mustache_path + "/requests/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/requests/tree_add_item.mustache"
          },
          Program: {
            mapping: "extended_related_programs_via_search",
            child_options: [related_objects_child_options],
            draw_children: true,
            fetch_post_process: sort_sections
          },
          Regulation: {
            mapping: "extended_related_regulations_via_search",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache"
          },
          Contract: {
            mapping: "extended_related_contracts_via_search",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache"
          },
          Standard: {
            mapping: "extended_related_standards_via_search",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache"
          },
          Policy: {
            mapping: "extended_related_policies_via_search",
            draw_children: true,
            child_options: [related_objects_child_options],
            fetch_post_process: sort_sections,
            show_view: GGRC.mustache_path + "/directives/tree.mustache"
          },
          Audit: {
            mapping: "extended_related_audits_via_search",
            draw_children: true,
            show_view: GGRC.mustache_path + "/audits/tree.mustache"
          },
          Section: {
            model: CMS.Models.Section,
            mapping: "extended_related_sections_via_search",
            show_view: GGRC.mustache_path + "/sections/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
            draw_children: true
          },
          Clause: {
            model: CMS.Models.Clause,
            mapping: "extended_related_clauses_via_search",
            show_view: GGRC.mustache_path + "/sections/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
            draw_children: true
          },
          Objective: {
            mapping: "extended_related_objectives_via_search",
            draw_children: true,
            show_view: GGRC.mustache_path + "/objectives/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache"
          },
          Control: {
            mapping: "extended_related_controls_via_search",
            draw_children: true,
            show_view: GGRC.mustache_path + "/controls/tree.mustache",
            footer_view: GGRC.mustache_path + "/base_objects/tree_footer.mustache",
            add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache"
          },
          Issue: {
            mapping: "extended_related_issues_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          AccessGroup: {
            mapping: "extended_related_access_groups_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          DataAsset: {
            mapping: "extended_related_data_assets_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Facility: {
            mapping: "extended_related_facilities_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Market: {
            mapping: "extended_related_markets_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          OrgGroup: {
            mapping: "extended_related_org_groups_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Vendor: {
            mapping: "extended_related_vendors_via_search",
            hild_options: [related_objects_child_options],
            draw_children: true
          },
          Process: {
            mapping: "extended_related_processes_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Product: {
            mapping: "extended_related_products_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Project: {
            mapping: "extended_related_projects_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          System: {
            mapping: "extended_related_systems_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          },
          Document: {
            mapping: "extended_related_documents_via_search"
          },
          ControlAssessment: {
            mapping: "extended_related_control_assessment_via_search",
            child_options: [related_objects_child_options],
            draw_children: true
          }
        }
      });

      // Disable editing on profile pages, as long as it isn't audits on the dashboard
      if (GGRC.page_instance() instanceof CMS.Models.Person) {
        var person_options = extra_content_controller_options.Person;
        can.each(person_options, function (options, model_name) {
          if (model_name !== 'Audit' || !/dashboard/.test(window.location)) {
            can.extend(options, {
              allow_creating: false,
              allow_mapping: false
            });
          }
        });
      }

      can.each(far_models, function (model_name) {
        if ((overridden_models.all && overridden_models.all.hasOwnProperty(model_name) && !overridden_models[model_name]) || (overridden_models[object.constructor.shortName] && overridden_models[object.constructor.shortName].hasOwnProperty(model_name) && !overridden_models[object.constructor.shortName][model_name]))
          return;
        var sources = [],
          far_model, descriptor = {},
          widget_id;

        far_model = CMS.Models[model_name];
        if (far_model) {
          widget_id = far_model.table_singular;
          descriptor = {
            instance: object,
            far_model: far_model,
            mapping: GGRC.Mappings.get_canonical_mapping(object.constructor.shortName, far_model.shortName)
          };
        } else {
          widget_id = model_name;
        }

        // Custom overrides
        if (extra_descriptor_options.all && extra_descriptor_options.all[model_name]) {
          $.extend(descriptor, extra_descriptor_options.all[model_name]);
        }

        if (extra_descriptor_options[object.constructor.shortName] && extra_descriptor_options[object.constructor.shortName][model_name]) {
          $.extend(descriptor, extra_descriptor_options[object.constructor.shortName][model_name]);
        }

        if (extra_content_controller_options.all && extra_content_controller_options.all[model_name]) {
          $.extend(true, descriptor, {
            content_controller_options: extra_content_controller_options.all[model_name]
          });
        }

        if (extra_content_controller_options[object.constructor.shortName] && extra_content_controller_options[object.constructor.shortName][model_name]) {
          $.extend(true, descriptor, {
            content_controller_options: extra_content_controller_options[object.constructor.shortName][model_name]
          });
        }

        widget_list.add_widget(object.constructor.shortName, widget_id, descriptor);
      });
    }
  });
})(window.can, window.can.$);
