/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

;(function(can) {

function update_program_authorizations(programs, person) {
  return $.when(
    programs[0],
    programs[0].get_binding("program_authorized_people").refresh_instances(),
    programs[0].get_binding("program_authorizations").refresh_instances(),
    CMS.Models.Role.findAll({ name : "ProgramReader" }),
    CMS.Models.Role.findAll({ name : "ProgramEditor" })
  ).then(function(program, people_bindings, auth_bindings, reader_roles, editor_roles) {
    // ignore readers.  Give users an editor role
    var reader_authorizations = [],
        delete_dfds,
        authorized_people = can.map(people_bindings, function(pb) {
          return pb.instance;
        }),
        editor_authorized_people = can.map(auth_bindings, function(ab) {
          if(~can.inArray(ab.instance.role.reify(), reader_roles)) {
            reader_authorizations.push(ab.instance);
          } else {
            return ab.instance.person.reify();
          }
        });

    if(Permission.is_allowed("create", "UserRole", program.context.id)
      && !~can.inArray(
        person.reify(),
        editor_authorized_people
    )) {
      delete_dfds = can.map(reader_authorizations, function(ra) {
        if(ra.person.reify() === person.reify()) {
          return ra.refresh().then(function() {
            return ra.destroy();
          });
        }
      });
      return $.when.apply($, delete_dfds).then(function() {
        return new CMS.Models.UserRole({
          person: person,
          role: editor_roles[0].stub(),
          context: program.context
        }).save();
      });
    }
  }).then(Permission.refresh());
}

function _comment_sort(a, b) {
  if (a.created_at < b.created_at) {
    return 1;
  } else if (a.created_at > b.created_at) {
    return -1;
  } else {
    return 0;
  }
}

can.Model.Cacheable("CMS.Models.Audit", {
  root_object : "audit"
  , root_collection : "audits"
  , category : "programs"
  , findAll : "GET /api/audits"
  , findOne : "GET /api/audits/{id}"
  , update : "PUT /api/audits/{id}"
  , destroy : "DELETE /api/audits/{id}"
  , create : "POST /api/audits"
  , mixins : ["contactable", "unique_title"]
  , is_custom_attributable: true
  , attributes : {
      context : "CMS.Models.Context.stub"
    , program: "CMS.Models.Program.stub"
    , requests : "CMS.Models.Request.stubs"
    , modified_by : "CMS.Models.Person.stub"
    , start_date : "date"
    , end_date : "date"
    , report_start_date : "date"
    , report_end_date : "date"
    , object_people : "CMS.Models.ObjectPerson.stubs"
    , people : "CMS.Models.Person.stubs"
    , audit_firm : "CMS.Models.OrgGroup.stub"
    , audit_objects : "CMS.Models.AuditObject.stubs"
    , custom_attribute_values : "CMS.Models.CustomAttributeValue.stubs"
  }
  , defaults : {
    status : "Draft",
    object_type: "ControlAssessment"
  }
  , obj_nav_options: {
    show_all_tabs: true,
  }
  , tree_view_options : {
    header_view : GGRC.mustache_path + "/audits/tree_header.mustache"
    , attr_list : [
      {attr_title: 'Title', attr_name: 'title'},
      {attr_title: 'Audit Lead', attr_name: 'audit_lead', attr_sort_field: 'contact.name|email'},
      {attr_title: 'Code', attr_name: 'slug'},
      {attr_title: 'Status', attr_name: 'status'},
      {attr_title: 'Last Updated', attr_name: 'updated_at'},
      {attr_title: 'Start Date', attr_name: 'start_date'},
      {attr_title: 'End Date', attr_name: 'end_date'},
      {attr_title: 'Report Period', attr_name: 'report_period', attr_sort_field: 'report_end_date'},
      {attr_title: 'Audit Firm', attr_name: 'audit_firm'}
    ]
    , draw_children : true
    , child_options : [{
      model : "Request"
      , mapping: "requests"
      , allow_creating : true
      , parent_find_param : "audit.id"
    },
    {
      model : "Request"
      , mapping: "related_owned_requests"
      , allow_creating : true
      , parent_find_param : "audit.id"
    },
    {
      model : "Response"
      , mapping: "related_owned_responses"
      , allow_creating : false
      , parent_find_param : "audit.id"
    },
    {
      model : "Request"
      , mapping: "related_mapped_requests"
      , allow_creating : false
      , parent_find_param : "audit.id"
    },
    {
      model : "Response"
      , mapping: "related_mapped_responses"
      , allow_creating : false
      , parent_find_param : "audit.id"
    }]
  }
  , init : function() {
    this._super && this._super.apply(this, arguments);
    this.validatePresenceOf("program");
    this.validatePresenceOf("contact");
    this.validateNonBlank("title");
    this.validate(["_transient.audit_firm", "audit_firm"], function (newVal, prop) {
      var audit_firm = this.attr("audit_firm"),
          transient_audit_firm = this.attr("_transient.audit_firm");

      if (!audit_firm && transient_audit_firm) {
        if (_.isObject(transient_audit_firm) && (audit_firm.reify().title !== transient_audit_firm.reify().title)
          || (transient_audit_firm !== "" && transient_audit_firm != null && audit_firm != null && transient_audit_firm !== audit_firm.reify().title)) {
            return "No valid org group selected for firm";
        }
      }
    });
    // Preload auditor role:
    CMS.Models.Role.findAll({name__in: "Auditor"});
  }
}, {
  object_model: can.compute(function() {
    return CMS.Models[this.attr("object_type")];
  }),
  save : function() {

    var that = this;
    // Make sure the context is always set to the parent program
    if (!this.context || !this.context.id) {
      this.attr('context', this.program.reify().context);
    }


    return this._super.apply(this, arguments);
  },
  after_save: function() {
    var dfd;

    dfd = $.when(
      new RefreshQueue().enqueue(this.program.reify()).trigger(),
      this.contact
    ).then(update_program_authorizations);
    GGRC.delay_leaving_page_until(dfd);
  },
  findAuditors : function(return_list) {
    // If return_list is true, use findAuditors in the
    //  classical way, where the exact state of the list
    //  isn't needed immeidately (as in a Mustache helper);
    //  if false, return a deferred that resolves to the list
    //  when the list is fully ready, for cases like permission
    //  checks for other modules.
    var loader = this.get_binding('authorizations'),
      auditors_list = new can.List(),
      dfds = []
      ;

    if (return_list) {
      $.map(loader.list, function(binding) {
        // FIXME: This works for now, but is sad.
        if (!binding.instance.selfLink) {
          return;
        }
        var role = binding.instance.role.reify();
        function checkRole() {
          if (role.attr('name') === 'Auditor') {
            auditors_list.push({
              person: binding.instance.person.reify()
              , binding: binding.instance
            });
          }
        }
        if (role.selfLink) {
          checkRole();
        } else {
          role.refresh().then(checkRole);
        }
      });
      return auditors_list;
    }
    return loader.refresh_instances().then(function() {
      $.map(loader.list, function (binding) {
        // FIXME: This works for now, but is sad.
        dfds.push(new $.Deferred(function(dfd) {
          if (!binding.instance.selfLink) {
            binding.instance.refresh().then(function() {
              dfd.resolve(binding.instance);
            });
          } else {
            dfd.resolve(binding.instance);
          }
        }).then(function(instance) {
          var role = instance.role.reify();
          function checkRole() {
            if (role.attr('name') === 'Auditor') {
              auditors_list.push({
                person: instance.person.reify()
                , binding: instance
              });
            }
          }
          if (role.selfLink) {
            checkRole();
          } else {
            return role.refresh().then(checkRole);
          }
        }));
      });
      return $.when.apply($, dfds).then(function() {
        return auditors_list;
      });
    });
  },
  get_filter_vals: function(){
    var filter_vals = can.Model.Cacheable.prototype.get_filter_vals,
        mappings = jQuery.extend({}, this.class.filter_mappings, {
          'code': 'slug',
          'audit lead': 'assignee',
          'state': 'status'
        }),
        keys = this.class.filter_keys.concat([
          'state', 'code', 'audit lead'
        ]),
        vals = filter_vals.apply(this, [keys, mappings]);

    try {
      if (this.contact){
        vals['assignee'] = filter_vals.apply(this.contact.reify(), [['email', 'name']]);
      }
    } catch (e) {}

    return vals;
  }
});

can.Model.Mixin("requestorable", {
  before_create : function() {
    if(!this.requestor) {
      this.attr('requestor', { id: GGRC.current_user.id, type : "Person" });
    }
  }
  , form_preload : function(new_object_form) {
    if(new_object_form) {
      if(!this.requestor) {
        this.attr('requestor', { id: GGRC.current_user.id, type : "Person" });
      }
    }
  }
});

can.Model.Cacheable("CMS.Models.Comment", {
    root_object : "comment",
    root_collection : "comments",
    findOne : "GET /api/comments/{id}",
    findAll : "GET /api/comments",
    update : "PUT /api/comments/{id}",
    destroy : "DELETE /api/comments/{id}",
    create : "POST /api/comments",
    mixins : [],
    attributes : {
      context: "CMS.Models.Context.stub",
      modified_by: "CMS.Models.Person.stub"
    },
    init : function() {
      this._super && this._super.apply(this, arguments);
      this.validatePresenceOf("description");
    }
    , info_pane_options: {
      documents: {
        model: CMS.Models.Document,
        mapping: "documents_and_urls",
        show_view: GGRC.mustache_path + "/base_templates/attachment.mustache",
        sort_function: _comment_sort,
      },
      urls: {
        model: CMS.Models.Document,
        mapping: "urls",
        show_view: GGRC.mustache_path + "/base_templates/urls.mustache",
      }
    }
  }, {
    form_preload : function(new_object_form) {
      var page_instance = GGRC.page_instance();
      this.attr("comment", page_instance);
    }
});

can.Model.Cacheable("CMS.Models.Request", {
  root_object : "request",
  filter_keys : ["assignee", "audit", "code", "company", "control",
                 "due date", "due", "name", "notes", "request",
                 "requested on", "status", "test", "title", "request_type",
                 "type", "request type", "due_on", "request_object",
                 "request object", "request title"
  ],
  filter_mappings: {
    "type": "request_type",
    "request title": "title",
    "request description": "description",
    "request type": "request_type",
  },
  root_collection : "requests"
  , findAll: "GET /api/requests"
  , findOne : "GET /api/requests/{id}"
  , create : "POST /api/requests"
  , update : "PUT /api/requests/{id}"
  , destroy : "DELETE /api/requests/{id}"
  , mixins : ["unique_title"]
  , is_custom_attributable: true
  , attributes : {
      context : "CMS.Models.Context.stub"
    , assignee : "CMS.Models.Person.stub"
    , requested_on : "date"
    , due_on : "date"
    , documents : "CMS.Models.Document.stubs"
    , audit : "CMS.Models.Audit.stub"
    , custom_attribute_values : "CMS.Models.CustomAttributeValue.stubs"
  }
  , defaults : {
    status: "Open",
    requested_on: moment().toDate(),
    due_on: GGRC.Utils.firstWorkingDay(moment().add(1, "weeks"))
  }
  , info_pane_options: {
    mapped_objects: {
      model: can.Model.Cacheable,
      mapping: "info_related_objects",
      show_view: GGRC.mustache_path + "/requests/subtree.mustache",
    },
    evidence: {
      model: CMS.Models.Document,
      mapping: "all_documents",
      show_view: GGRC.mustache_path + "/base_templates/attachment.mustache",
      sort_function: _comment_sort,
    },
    comments: {
      model: can.Model.Cacheable,
      mapping: "comments",
      show_view: GGRC.mustache_path + "/base_templates/comment_subtree.mustache",
      sort_function: _comment_sort,
    },
    urls: {
      model: CMS.Models.Document,
      mapping: "all_urls",
      show_view: GGRC.mustache_path + "/base_templates/urls.mustache",
    },
  }
  , tree_view_options : {
    show_view : GGRC.mustache_path + "/requests/tree.mustache"
    , header_view : GGRC.mustache_path + "/requests/tree_header.mustache"
    , footer_view : GGRC.mustache_path + "/requests/tree_footer.mustache"
    , add_item_view : GGRC.mustache_path + "/requests/tree_add_item.mustache"
    , attr_list : [
      {attr_title: 'Title', attr_name: 'title'},
      {attr_title: 'Status', attr_name: 'status'},
      {attr_title: 'Last Updated', attr_name: 'updated_at'},
      {attr_title: 'Request Date', attr_name: 'requested_on', attr_sort_field: 'report_start_date'},
      {attr_title: 'Due Date', attr_name: 'due_on', attr_sort_field: 'due_on'},
      {attr_title: 'Request Type', attr_name: 'request_type'},
      {attr_title: 'Code', attr_name: 'slug'},
      {attr_title: 'Audit', attr_name: 'audit'},
    ]
    , display_attr_names : ['title', 'assignee', 'due_on', 'status', 'request_type']
    , mandatory_attr_names : ['title']
    , draw_children : true
    , child_options: [{
      model : can.Model.Cacheable,
      mapping: "info_related_objects",
      allow_creating : true,
    }]
  }
  , init : function() {
    this._super.apply(this, arguments);
    this.validateNonBlank("title");
    this.validateNonBlank("due_on");
    this.validateNonBlank("requested_on");
    this.validatePresenceOf("validate_assignee");
    this.validatePresenceOf("validate_requester");
    this.validatePresenceOf("audit");

    this.validate(["requested_on", "due_on"], function (newVal, prop) {
      var dates_are_valid;

      if (this.requested_on && this.due_on) {
        dates_are_valid = this.due_on >= this.requested_on;
      }

      if (!dates_are_valid) {
        return "Requested and/or Due date is invalid";
      }
    });

    this.validate(["validate_assignee", "validate_requester"], function (newVal, prop) {
      if (!this.validate_assignee) {
        return "You need to specify at least one assignee";
      }
      if (!this.validate_requester) {
        return "You need to specify at least one requester";
      }
    });

    if (this === CMS.Models.Request) {
      this.bind("created", function (ev, instance) {
        if (instance.constructor === CMS.Models.Request) {
          instance.audit.reify().refresh();
        }
      });
    }
  }
}, {
  init : function() {
    this._super && this._super.apply(this, arguments);
  }

  , display_name : function() {
      var desc = this.title
        , max_len = 20;
      out_name = desc;
      // Truncate if greater than max_len chars
      if (desc.length > max_len) {
        out_name = desc.slice(0, max_len) + " ...";
      }
      return 'Request "' + out_name + '"';
    }
  , form_preload : function(new_object_form) {
    var audit,
        that = this,
        assignees = {},
        current_user = CMS.Models.get_instance(GGRC.current_user),
        contact;

    if (new_object_form) {
      // Current user should be Requester
      assignees[current_user.email] = "Requester";

      if (GGRC.page_model.type == "Audit") {
        this.attr("audit", { id: GGRC.page_model.id, type: "Audit" });
      }

      if (this.audit) {
        audit = this.audit.reify();

        // Audit leads should be default assignees
        (audit.selfLink ? $.when(audit) : audit.refresh())
        .then(function (audit) {
          contact = audit.contact.reify();

          if (assignees[contact.email]) {
            assignees[contact.email] += ",Assignee"
          } else {
            assignees[contact.email] = "Assignee";
          }
        }.bind(this));

        // Audit auditors should be default verifiers
        $.when(audit.findAuditors()).then(function (auditors) {
          auditors.each(function (elem) {
            elem.each(function (obj) {
              if (obj.type == "Person") {
                if (assignees[obj.email]) {
                  assignees[obj.email] += ",Verifier"
                } else {
                  assignees[obj.email] = "Verifier"
                }
              }
            });
          });
        });
      }

      // Assign assignee roles
      can.each(assignees, function (value, key) {
        var person = CMS.Models.Person.findInCacheByEmail(key);
        that.mark_for_addition("related_objects_as_destination", person, {
          attrs: {
            "AssigneeType": value
          }
        });
      });
    } // /new_object_form
  }
  , get_filter_vals: function () {
    var filter_vals = can.Model.Cacheable.prototype.get_filter_vals,
        mappings = $.extend({}, this.class.filter_mappings, {
          "title": "title",
          "description": "description",
          "state": "status",
          "due date": "due_on",
          "due": "due_on"
        }),
        keys, vals;

    keys = _.union(this.class.filter_keys, ["state"], _.keys(mappings));
    vals = filter_vals.call(this, keys, mappings);
    try {
      vals["due_on"] = moment(this["due_on"]).format("YYYY-MM-DD");
      vals["due"] = vals["due date"] = vals["due_on"];
      if (this.assignee) {
        vals["assignee"] = filter_vals.apply(this.assignee.reify(), []);
      }
    } catch (e) {}

    return vals;
  },
  save: function() {
      // Make sure the context is always set to the parent audit
      if (!this.context || !this.context.id) {
        this.attr('context', this.audit.reify().context);
      }
      return this._super.apply(this, arguments);
  },
  after_save: function() {
    // Create a relationship between request & control_assessment & control
    var dfds = can.map(['control', 'control_assessment'], function(obj){
      if (!(this.attr(obj) && this.attr(obj).stub)) {
        return;
      }
      return new CMS.Models.Relationship({
        source: this.attr(obj).stub(),
        destination: this.stub(),
        context: this.context.stub(),
      }).save();
    }.bind(this));
    GGRC.delay_leaving_page_until($.when.apply($, dfds));
  },
  _refresh: function (bindings) {
    var refresh_queue = new RefreshQueue();
    can.each(bindings, function(binding) {
      refresh_queue.enqueue(binding.instance);
    });
    return refresh_queue.trigger();
  }
});

can.Model.Cacheable("CMS.Models.Response", {
  root_object : "response"
  , root_collection : "responses"
  , subclasses : []
  , init : function() {
    this._super && this._super.apply(this, arguments);

    function refresh_request(ev, instance) {
      if(instance instanceof CMS.Models.Response) {
        instance.request.reify().refresh();
      }
    }
    this.cache = {};
    if(this !== CMS.Models.Response) {
      CMS.Models.Response.subclasses.push(this);
    } else {
      this.bind("created", refresh_request);
      this.bind("destroyed", refresh_request);
    }

    this.validateNonBlank("description");
    this.validatePresenceOf("contact");
  }
  , create : "POST /api/responses"
  , update : "PUT /api/responses/{id}"

  , findAll : "GET /api/responses"
  , findOne : "GET /api/responses/{id}"
  , destroy : "DELETE /api/responses/{id}"
  , model : function(params) {
    var found = false;
    if (this.shortName !== 'Response')
      return this._super(params);
    if (!params
        || (params instanceof CMS.Models.Response
            && params.constructor !== CMS.Models.Response
       ))
      return params;
    params = this.object_from_resource(params);
    if (!params.selfLink) {
      if (params.type && params.type !== 'Response')
        return CMS.Models[params.type].model(params);
    } else {
      can.each(this.subclasses, function(m) {
        if(m.root_object === params.response_type + "_response") {
          params = m.model(params);
          found = true;
          return false;
        } else if(m.root_object in params) {
          params = m.model(m.object_from_resource(params));
          found = true;
          return false;
        }
      });
    }
    if(found) {
      return params;
    } else {
      console.debug("Invalid Response:", params);
    }
  }

  , attributes : {
      context : "CMS.Models.Context.stub"
    , object_documents : "CMS.Models.ObjectDocument.stubs"
    , documents : "CMS.Models.Document.stubs"
    , population_worksheet : "CMS.Models.Document.stub"
    , sample_worksheet : "CMS.Models.Document.stub"
    , sample_evidence : "CMS.Models.Document.stub"
    , object_people : "CMS.Models.ObjectPerson.stubs"
    , people : "CMS.Models.Person.stubs"
    , meetings : "CMS.Models.Meeting.stubs"
    , request : "CMS.Models.Request.stub"
    , related_sources : "CMS.Models.Relationship.stubs"
    , related_destinations : "CMS.Models.Relationship.stubs"
    , controls : "CMS.Models.Control.stubs"
    , contact : "CMS.Models.Person.stub"
  }
  , defaults : {
    status : "Assigned"
  }
  , tree_view_options : {
    show_view : GGRC.mustache_path + "/responses/tree.mustache"
    , add_item_view : GGRC.mustache_path + "/responses/tree_add_item.mustache"
    , draw_children : true
    , child_options : [{
      //0: mapped objects
      mapping : "business_objects"
      , model : can.Model.Cacheable
      , show_view : GGRC.mustache_path + "/base_objects/tree.mustache"
      , footer_view : GGRC.mustache_path + "/base_objects/tree_footer.mustache"
      , add_item_view : GGRC.mustache_path + "/base_objects/tree_add_item.mustache"
      , allow_mapping : false
      , allow_creating: false
      , exclude_option_types : function() {
        var types = {
          "DocumentationResponse" : "Document"
          , "InterviewResponse" : "Person"
        };
        return types[this.parent_instance.constructor.shortName] || "";
      }
    }, {
      //1: Document Evidence
      model : "Document"
      , mapping : "documents"
      , show_view : GGRC.mustache_path + "/documents/pbc_tree.mustache"
      , allow_mapping: false
      , allow_creating: false
    }, {
      //3: Meeting participants
      model : "Person"
      , mapping : "people"
      , show_view : GGRC.mustache_path + "/people/tree.mustache"
      , footer_view : GGRC.mustache_path + "/people/tree_footer.mustache"
      , add_item_view : GGRC.mustache_path + "/people/tree_add_item.mustache"
      , allow_mapping: false
      , allow_creating: false
    }, {
      //2: Meetings
      model : "Meeting"
      , mapping : "meetings"
      , show_view : GGRC.mustache_path + "/meetings/tree.mustache"
      , footer_view : GGRC.mustache_path + "/meetings/tree_footer.mustache"
      , add_item_view : GGRC.mustache_path + "/meeting/tree_add_item.mustache"
      , allow_mapping: false
      , allow_creating: false
    }]
  }
}, {
    display_name : function() {
      var desc = this.description
        , max_len = 20
        , out_name = desc;
      // Truncate if greater than max_len chars
      if (desc.length > max_len) {
        out_name = desc.slice(0, max_len) + " ...";
      }
      return 'Response "' + out_name + '"';
    }
  , before_create : function() {
    if(!this.contact) {
      this.attr("contact", this.request.reify().assignee);
    }
  }
  , form_preload : function(new_object_form) {
    if(new_object_form && !this.contact) {
      if (!this.request) {
        this.bind("request", function (ev, request) {
          if (request && request.reify) {
            this.attr('contact', request.reify().assignee);
          }
        });
      } else {
        this.attr('contact', this.request.reify().assignee);
      }
    }
  }

});

CMS.Models.Response("CMS.Models.DocumentationResponse", {
  root_object : "documentation_response"
  , root_collection : "documentation_responses"
  , create : "POST /api/documentation_responses"
  , update : "PUT /api/documentation_responses/{id}"
  , findAll : "GET /api/documentation_responses"
  , findOne : "GET /api/documentation_responses/{id}"
  , destroy : "DELETE /api/documentation_responses/{id}"
  , attributes : {}
  , init : function() {
    this._super && this._super.apply(this, arguments);
    can.extend(this.attributes, CMS.Models.Response.attributes);
    this.cache = CMS.Models.Response.cache;
  }
  , process_args : function(args, names) {
    var params = this._super(args, names);
    params[this.root_object].response_type = "documentation";
    return params;
  }
}, {});

CMS.Models.Response("CMS.Models.InterviewResponse", {
  root_object : "interview_response"
  , root_collection : "interview_responses"
  , create : "POST /api/interview_responses"
  , update : "PUT /api/interview_responses/{id}"
  , findAll : "GET /api/interview_responses"
  , findOne : "GET /api/interview_responses/{id}"
  , destroy : "DELETE /api/interview_responses/{id}"
  , attributes : {}
  , init : function() {
    this._super && this._super.apply(this, arguments);
    can.extend(this.attributes, CMS.Models.Response.attributes);
    this.cache = CMS.Models.Response.cache;
  }
  , process_args : function(args, names) {
    var params = this._super(args, names);
    params[this.root_object].response_type = "interview";
    return params;
  }
}, {
  save : function() {
    var that = this;
    if(this.isNew()) {
      var audit = this.request.reify().audit.reify()
        , auditors_dfd = audit.findAuditors();

      return auditors_dfd.then(function(auditors) {
        if(auditors.length > 0){
          that.mark_for_addition("people", auditors[0].person);
        }
        that.mark_for_addition("people", that.contact);
        return that._super.apply(that, arguments);
      });
    } else {
      return this._super.apply(this, arguments);
    }
  }
});

CMS.Models.Response("CMS.Models.PopulationSampleResponse", {
  root_object : "population_sample_response"
  , root_collection : "population_sample_responses"
  , create : "POST /api/population_sample_responses"
  , update : "PUT /api/population_sample_responses/{id}"
  , findAll : "GET /api/population_sample_responses"
  , findOne : "GET /api/population_sample_responses/{id}"
  , destroy : "DELETE /api/population_sample_responses/{id}"
  , attributes : {}
  , init : function() {
    this._super && this._super.apply(this, arguments);
    can.extend(this.attributes, CMS.Models.Response.attributes);
    this.cache = CMS.Models.Response.cache;
  }
  , process_args : function(args, names) {
    var params = this._super(args, names);
    params[this.root_object].response_type = "population sample";
    return params;
  }
}, {});

can.Model.Cacheable("CMS.Models.Meeting", {
  root_collection : "meetings"
  , root_object : "meeting"
  , findAll : "GET /api/meetings"
  , create : "POST /api/meetings"
  , update : "PUT /api/meetings/{id}"
  , destroy : "DELETE /api/meetings/{id}"
  , attributes : {
      context : "CMS.Models.Context.stub"
    , response : "CMS.Models.Response.stub"
    , people : "CMS.Models.Person.stubs"
    , object_people : "CMS.Models.ObjectPerson.stubs"
    , start_at : "datetime"
    , end_at : "datetime"
  }
  , defaults : {}
  , init : function() {
    this._super && this._super.apply(this, arguments);
    this.validateNonBlank("title");
    this.validateNonBlank("start_at");
    this.validateNonBlank("end_at");
  }
}, {
  init : function () {
      this._super && this._super.apply(this, arguments);
      this.each(function (value, name) {
        if (value === null) {
          this.removeAttr(name);
        }
      }.bind(this));
      this.bind("change", function () {
        if (typeof this.response !== "undefined" && !this._preloaded_people) {
          this._preloaded_people = true;
          _.map(this.response.reify().people, function (person) {
            this.mark_for_addition("people", person);
          }.bind(this));
        }
      }.bind(this));
  }

});

can.Model.Cacheable("CMS.Models.ControlAssessment", {
  root_object : "control_assessment",
  root_collection : "control_assessments",
  findOne : "GET /api/control_assessments/{id}",
  findAll : "GET /api/control_assessments",
  update : "PUT /api/control_assessments/{id}",
  destroy : "DELETE /api/control_assessments/{id}",
  create : "POST /api/control_assessments",
  mixins : ["ownable", "contactable", "unique_title"],
  is_custom_attributable: true,
  attributes : {
    control : "CMS.Models.Control.stub",
    context : "CMS.Models.Context.stub",
    modified_by : "CMS.Models.Person.stub",
    custom_attribute_values : "CMS.Models.CustomAttributeValue.stubs",
    start_date: "date",
    end_date: "date"
  },
  filter_keys : ["operationally", "operational", "design"
  ],
  filter_mappings: {
    "operational": "operationally"
  },
  tree_view_options : {
    add_item_view: GGRC.mustache_path + "/base_objects/tree_add_item.mustache",
    attr_list : can.Model.Cacheable.attr_list.concat([
        {attr_title: 'Conclusion: Design', attr_name: 'design'},
        {attr_title: 'Conclusion: Operation', attr_name: 'operationally'},
        {attr_title: 'URL', attr_name: 'url'},
        {attr_title: 'Reference URL', attr_name: 'reference_url'}
    ])
  },
  init: function () {
    this._super && this._super.apply(this, arguments);
    this.validatePresenceOf("control");
    this.validatePresenceOf("audit");
    this.validateNonBlank("title");
  }
}, {
  form_preload: function (new_object_form) {
    var page_instance = GGRC.page_instance();
    if (new_object_form && page_instance && page_instance.type === "Audit") {
      if (!this.audit) {
        this.attr("audit", page_instance);
        this.mark_for_addition("related_objects_as_destination", page_instance.program);
      }
    }
  }
});

})(this.can);
