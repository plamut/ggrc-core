/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (can) {
  function update_program_authorizations(programs, person) {
    return $.when(
      programs[0],
      programs[0].get_binding('program_authorized_people').refresh_instances(),
      programs[0].get_binding('program_authorizations').refresh_instances(),
      CMS.Models.Role.findAll({
        name: 'ProgramReader'
      }),
      CMS.Models.Role.findAll({
        name: 'ProgramEditor'
      })
    ).then(function (program, people_bindings, auth_bindings,
                     reader_roles, editor_roles) {
      // ignore readers.  Give users an editor role
      var reader_authorizations = [];
      var delete_dfds;
      var editor_authorized_people = can.map(auth_bindings, function (ab) {
        if (~can.inArray(ab.instance.role.reify(), reader_roles)) {
          reader_authorizations.push(ab.instance);
        } else {
          return ab.instance.person.reify();
        }
      });

      if (Permission.is_allowed('create', 'UserRole', program.context.id) &&
          !~can.inArray(person.reify(), editor_authorized_people)) {
        delete_dfds = can.map(reader_authorizations, function (ra) {
          if (ra.person.reify() === person.reify()) {
            return ra.refresh().then(function () {
              return ra.destroy();
            });
          }
        });
        return $.when.apply($, delete_dfds).then(function () {
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
    }
    return 0;
  }
  can.Model.Cacheable('CMS.Models.Audit', {
    root_object: 'audit',
    root_collection: 'audits',
    category: 'programs',
    findAll: 'GET /api/audits',
    findOne: 'GET /api/audits/{id}',
    update: 'PUT /api/audits/{id}',
    destroy: 'DELETE /api/audits/{id}',
    create: 'POST /api/audits',
    mixins: ['contactable', 'unique_title'],
    is_custom_attributable: true,
    attributes: {
      context: 'CMS.Models.Context.stub',
      program: 'CMS.Models.Program.stub',
      requests: 'CMS.Models.Request.stubs',
      modified_by: 'CMS.Models.Person.stub',
      start_date: 'date',
      end_date: 'date',
      report_start_date: 'date',
      report_end_date: 'date',
      object_people: 'CMS.Models.ObjectPerson.stubs',
      people: 'CMS.Models.Person.stubs',
      audit_firm: 'CMS.Models.OrgGroup.stub',
      audit_objects: 'CMS.Models.AuditObject.stubs',
      custom_attribute_values: 'CMS.Models.CustomAttributeValue.stubs'
    },
    defaults: {
      status: 'Draft',
      object_type: 'Assessment'
    },
    obj_nav_options: {
      show_all_tabs: false,
      force_show_list: ['In Scope Controls', 'Open Requests',
                        'Issues', 'Assessments']
    },
    tree_view_options: {
      header_view: GGRC.mustache_path + '/audits/tree_header.mustache',
      attr_list: [{
        attr_title: 'Title',
        attr_name: 'title'
      }, {
        attr_title: 'Audit Lead',
        attr_name: 'audit_lead',
        attr_sort_field: 'contact.name|email'
      }, {
        attr_title: 'Code',
        attr_name: 'slug'
      }, {
        attr_title: 'Status',
        attr_name: 'status'
      }, {
        attr_title: 'Last Updated',
        attr_name: 'updated_at'
      }, {
        attr_title: 'Start Date',
        attr_name: 'start_date'
      }, {
        attr_title: 'End Date',
        attr_name: 'end_date'
      }, {
        attr_title: 'Report Period',
        attr_name: 'report_period',
        attr_sort_field: 'report_end_date'
      }, {
        attr_title: 'Audit Firm',
        attr_name: 'audit_firm'
      }],
      draw_children: true,
      child_options: [{
        model: 'Request',
        mapping: 'requests',
        allow_creating: true,
        parent_find_param: 'audit.id'
      }, {
        model: 'Request',
        mapping: 'related_owned_requests',
        allow_creating: true,
        parent_find_param: 'audit.id'
      }, {
        model: 'Request',
        mapping: 'related_mapped_requests',
        allow_creating: false,
        parent_find_param: 'audit.id'
      }]
    },
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.validatePresenceOf('program');
      this.validatePresenceOf('contact');
      this.validateNonBlank('title');
      this.validate(['_transient.audit_firm', 'audit_firm'],
        function (newVal, prop) {
          var audit_firm = this.attr('audit_firm');
          var transient_audit_firm = this.attr('_transient.audit_firm');

          if (!audit_firm && transient_audit_firm) {
            if (_.isObject(transient_audit_firm) && (audit_firm.reify().title !== transient_audit_firm.reify().title) || (transient_audit_firm !== '' && transient_audit_firm !== null && audit_firm !== null && transient_audit_firm !== audit_firm.reify().title)) {
              return 'No valid org group selected for firm';
            }
          }
        }
      );
      // Preload auditor role:
      CMS.Models.Role.findAll({
        name__in: 'Auditor'
      });
    }
  }, {
    object_model: can.compute(function () {
      return CMS.Models[this.attr('object_type')];
    }),
    save: function () {
      // Make sure the context is always set to the parent program
      if (!this.context || !this.context.id) {
        this.attr('context', this.program.reify().context);
      }
      return this._super.apply(this, arguments);
    },
    after_save: function () {
      var dfd;

      dfd = $.when(
        new RefreshQueue().enqueue(this.program.reify()).trigger(),
        this.contact
      ).then(update_program_authorizations);
      GGRC.delay_leaving_page_until(dfd);
    },
    findAuditors: function (return_list) {
      // If return_list is true, use findAuditors in the
      //  classical way, where the exact state of the list
      //  isn't needed immeidately (as in a Mustache helper);
      //  if false, return a deferred that resolves to the list
      //  when the list is fully ready, for cases like permission
      //  checks for other modules.
      var loader = this.get_binding('authorizations');
      var auditors_list = new can.List();
      var dfds = [];

      if (return_list) {
        $.map(loader.list, function (binding) {
          // FIXME: This works for now, but is sad.
          var role;
          if (!binding.instance.selfLink) {
            return;
          }
          role = binding.instance.role.reify();

          function checkRole() {
            if (role.attr('name') === 'Auditor') {
              auditors_list.push({
                person: binding.instance.person.reify(),
                binding: binding.instance
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
      return loader.refresh_instances().then(function () {
        $.map(loader.list, function (binding) {
          // FIXME: This works for now, but is sad.
          dfds.push(new $.Deferred(function (dfd) {
            if (!binding.instance.selfLink) {
              binding.instance.refresh().then(function () {
                dfd.resolve(binding.instance);
              });
            } else {
              dfd.resolve(binding.instance);
            }
          }).then(function (instance) {
            var role = instance.role.reify();

            function checkRole() {
              if (role.attr('name') === 'Auditor') {
                auditors_list.push({
                  person: instance.person.reify(),
                  binding: instance
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
        return $.when.apply($, dfds).then(function () {
          return auditors_list;
        });
      });
    },
    get_filter_vals: function () {
      var filter_vals = can.Model.Cacheable.prototype.get_filter_vals;
      var mappings = jQuery.extend({}, this.class.filter_mappings, {
        code: 'slug',
        'audit lead': 'assignee',
        state: 'status'
      });
      var keys = this.class.filter_keys.concat([
        'state', 'code', 'audit lead'
      ]);
      var vals = filter_vals.apply(this, [keys, mappings]);

      try {
        if (this.contact) {
          vals.assignee = filter_vals.apply(this.contact.reify(), [
            ['email', 'name']
          ]);
        }
      } catch (e) {}
      return vals;
    }
  });

  can.Model.Mixin('requestorable', {
    before_create: function () {
      if (!this.requestor) {
        this.attr('requestor', {
          id: GGRC.current_user.id,
          type: 'Person'
        });
      }
    },
    form_preload: function (new_object_form) {
      if (new_object_form) {
        if (!this.requestor) {
          this.attr('requestor', {
            id: GGRC.current_user.id,
            type: 'Person'
          });
        }
      }
    }
  });

  can.Model.Cacheable('CMS.Models.Comment', {
    root_object: 'comment',
    root_collection: 'comments',
    findOne: 'GET /api/comments/{id}',
    findAll: 'GET /api/comments',
    update: 'PUT /api/comments/{id}',
    destroy: 'DELETE /api/comments/{id}',
    create: 'POST /api/comments',
    mixins: [],
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub'
    },
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.validatePresenceOf('description');
    },
    info_pane_options: {
      documents: {
        model: CMS.Models.Document,
        mapping: 'documents_and_urls',
        show_view: GGRC.mustache_path + '/base_templates/attachment.mustache',
        sort_function: _comment_sort
      },
      urls: {
        model: CMS.Models.Document,
        mapping: 'urls',
        show_view: GGRC.mustache_path + '/base_templates/urls.mustache'
      }
    }
  }, {
    form_preload: function (new_object_form) {
      var page_instance = GGRC.page_instance();
      this.attr('comment', page_instance);
    },
    /**
     * Update the description of an instance. Mainly used as an event handler for
     * updating Requests' and Audits' comments.
     *
     * @param {can.Map} instance - the (Comment) instance to update
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the onUpdate event object
     */
    updateDescription: function (instance, $el, ev) {
      var $body = $(document.body);

      // for some reson the instance must be refreshed before saving to avoid
      // the HTTP "precondition reqired" error
      this.refresh()
        .then(function () {
          this.attr('description', ev.newVal);
          return this.save();
        }.bind(this))
        .done(function () {
          $body.trigger('ajax:flash', {
            success: 'Saved.'
          });
        })
        .fail(function () {
          $body.trigger('ajax:flash', {
            error: 'There was a problem with saving.'
          });
          this.attr('description', ev.oldVal);
        }.bind(this));
    }
  });

  can.Model.Cacheable('CMS.Models.Request', {
    root_object: 'request',
    filter_keys: ['assignee', 'audit', 'code', 'company', 'control', 'due on',
      'due', 'name', 'notes', 'request', 'starts', 'starts on', 'status',
      'test', 'title', 'request_type', 'type', 'request type',
      'request_object', 'request object', 'request title',
      'verified', 'verified_date', 'finished_date'
    ],
    filter_mappings: {
      type: 'request_type',
      'request title': 'title',
      'request description': 'description',
      'request type': 'request_type',
      'verified date': 'verified_date',
      'finished date': 'finished_date',
      'request date': 'requested_on'
    },
    root_collection: 'requests',
    findAll: 'GET /api/requests',
    findOne: 'GET /api/requests/{id}',
    create: 'POST /api/requests',
    update: 'PUT /api/requests/{id}',
    destroy: 'DELETE /api/requests/{id}',
    mixins: ['unique_title', 'relatable'],
    relatable_options: {
      relevantTypes: {
        Audit: {
          objectBinding: 'audits',
          relatableBinding: 'program_requests',
          weight: 5
        },
        Regulation: {
          objectBinding: 'related_regulations',
          relatableBinding: 'related_requests',
          weight: 3
        },
        Control: {
          objectBinding: 'related_controls',
          relatableBinding: 'related_requests',
          weight: 10
        }
      },
      threshold: 5
    },
    is_custom_attributable: true,
    attributes: {
      context: 'CMS.Models.Context.stub',
      assignee: 'CMS.Models.Person.stub',
      start_date: 'date',
      end_date: 'date',
      finished_date: 'date',
      verified_date: 'date',
      documents: 'CMS.Models.Document.stubs',
      audit: 'CMS.Models.Audit.stub',
      custom_attribute_values: 'CMS.Models.CustomAttributeValue.stubs'
    },
    defaults: {
      status: 'Not Started',
      start_date: moment().toDate(),
      end_date: GGRC.Utils.firstWorkingDay(moment().add(1, 'weeks'))
    },
    info_pane_options: {
      mapped_objects: {
        model: can.Model.Cacheable,
        mapping: 'info_related_objects',
        show_view: GGRC.mustache_path + '/base_templates/subtree.mustache'
      },
      evidence: {
        model: CMS.Models.Document,
        mapping: 'all_documents',
        show_view: GGRC.mustache_path + '/base_templates/attachment.mustache',
        sort_function: _comment_sort
      },
      comments: {
        model: can.Model.Cacheable,
        mapping: 'comments',
        show_view: GGRC.mustache_path +
          '/base_templates/comment_subtree.mustache',
        sort_function: _comment_sort
      },
      urls: {
        model: CMS.Models.Document,
        mapping: 'all_urls',
        show_view: GGRC.mustache_path + '/base_templates/urls.mustache'
      }
    },
    tree_view_options: {
      show_view: GGRC.mustache_path + '/requests/tree.mustache',
      header_view: GGRC.mustache_path + '/requests/tree_header.mustache',
      footer_view: GGRC.mustache_path + '/requests/tree_footer.mustache',
      add_item_view: GGRC.mustache_path + '/requests/tree_add_item.mustache',
      attr_list: [{
        attr_title: 'Title',
        attr_name: 'title'
      }, {
        attr_title: 'Status',
        attr_name: 'status'
      }, {
        attr_title: 'Verified',
        attr_name: 'verified',
        attr_sort_field: 'verified'
      }, {
        attr_title: 'Last Updated',
        attr_name: 'updated_at'
      }, {
        attr_title: 'Starts On',
        attr_name: 'start_date',
        attr_sort_field: 'start_date'
      }, {
        attr_title: 'Due On',
        attr_name: 'end_date',
        attr_sort_field: 'end_date'
      }, {
        attr_title: 'Verified Date',
        attr_name: 'verified_date',
        attr_sort_field: 'verified_date'
      }, {
        attr_title: 'Finished Date',
        attr_name: 'finished_date',
        attr_sort_field: 'finished_date'
      }, {
        attr_title: 'Request Type',
        attr_name: 'request_type'
      }, {
        attr_title: 'Code',
        attr_name: 'slug'
      }, {
        attr_title: 'Audit',
        attr_name: 'audit'
      }],
      display_attr_names: ['title', 'assignee', 'end_date',
        'status', 'request_type'],
      mandatory_attr_names: ['title'],
      draw_children: true,
      child_options: [{
        model: can.Model.Cacheable,
        mapping: 'info_related_objects',
        allow_creating: true
      }]
    },
    assignable_list: [{
      type: 'requester',
      mapping: 'related_requesters',
      required: true
    }, {
      type: 'assignee',
      mapping: 'related_assignees',
      required: true
    }, {
      type: 'verifier',
      mapping: 'related_verifiers',
      required: false
    }],
    init: function () {
      this._super.apply(this, arguments);
      this.validateNonBlank('title');
      this.validateNonBlank('end_date');
      this.validateNonBlank('start_date');
      this.validatePresenceOf('validate_assignee');
      this.validatePresenceOf('validate_requester');
      this.validatePresenceOf('audit');

      this.validate(['start_date', 'end_date'], function (newVal, prop) {
        var dates_are_valid;

        if (this.start_date && this.end_date) {
          dates_are_valid = this.end_date >= this.start_date;
        }

        if (!dates_are_valid) {
          return 'Start and/or Due date is invalid';
        }
      });

      this.validate(['validate_assignee', 'validate_requester'],
        function (newVal, prop) {
          if (!this.validate_assignee) {
            return 'You need to specify at least one assignee';
          }
          if (!this.validate_requester) {
            return 'You need to specify at least one requester';
          }
        }
      );

      if (this === CMS.Models.Request) {
        this.bind('created', function (ev, instance) {
          if (instance.constructor === CMS.Models.Request) {
            instance.audit.reify().refresh();
          }
        });
      }
    }
  }, {
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
    },
    display_name: function () {
      var desc = this.title;
      var max_len = 20;
      var out_name = desc;
      // Truncate if greater than max_len chars
      if (desc.length > max_len) {
        out_name = desc.slice(0, max_len) + ' ...';
      }
      return 'Request "' + out_name + '"';
    },
    form_preload: function (new_object_form) {
      var audit;
      var that = this;
      var assignees = {};
      var current_user = CMS.Models.get_instance('Person',
                                                 GGRC.current_user.id);
      var contact;

      if (new_object_form) {
        // Current user should be Requester
        assignees[current_user.email] = 'Requester';

        if (_.exists(GGRC, 'page_model.type') === 'Audit') {
          this.attr('audit', {
            id: GGRC.page_model.id,
            type: 'Audit'
          });
        }

        if (this.audit) {
          audit = this.audit.reify();

          // Audit leads should be default assignees
          (audit.selfLink ? $.when(audit) : audit.refresh())
          .then(function (audit) {
            contact = audit.contact.reify();

            if (assignees[contact.email]) {
              assignees[contact.email] += ',Assignee';
            } else {
              assignees[contact.email] = 'Assignee';
            }
          });

          // Audit auditors should be default verifiers
          $.when(audit.findAuditors()).then(function (auditors) {
            auditors.each(function (elem) {
              elem.each(function (obj) {
                if (obj.type === 'Person') {
                  if (assignees[obj.email]) {
                    assignees[obj.email] += ',Verifier';
                  } else {
                    assignees[obj.email] = 'Verifier';
                  }
                }
              });
            });
          });
        }

        // Assign assignee roles
        can.each(assignees, function (value, key) {
          var person = CMS.Models.Person.findInCacheByEmail(key);
          that.mark_for_addition('related_objects_as_destination', person, {
            attrs: {
              AssigneeType: value
            }
          });
        });
      } // /new_object_form
    },
    get_filter_vals: function () {
      var filterVals = can.Model.Cacheable.prototype.get_filter_vals;
      var mappings = $.extend({}, this.class.filter_mappings, {
        audit: 'audit',
        code: 'slug',
        description: 'description',
        due: 'end_date',
        'due on': 'end_date',
        starts: 'start_date',
        'starts on': 'start_date',
        state: 'status',
        title: 'title'
      });
      var keys = _.union(this.class.filter_keys, ['state'], _.keys(mappings));
      var vals = filterVals.call(this, keys, mappings);

      try {
        vals.starts = moment(this.start_date).format('YYYY-MM-DD');
        vals['starts on'] = vals.starts;
        vals.due = moment(this.end_date).format('YYYY-MM-DD');
        vals['due on'] = vals.due;
        if (this.assignee) {
          vals.assignee = filterVals.apply(this.assignee.reify(), []);
        }
      } catch (e) {}

      return vals;
    },
    save: function () {
      // Make sure the context is always set to the parent audit
      if (!this.context || !this.context.id) {
        this.attr('context', this.audit.reify().context);
      }
      return this._super.apply(this, arguments);
    },
    after_save: function () {
      // Create a relationship between request & assessment
      // if the request is created from the assessment view page
      var dfd;
      if (!(this.attr('assessment') && this.attr('assessment').stub)) {
        return;
      }
      dfd = new CMS.Models.Relationship({
        source: this.attr('assessment').stub(),
        destination: this.stub(),
        context: this.context.stub()
      }).save();
      GGRC.delay_leaving_page_until(dfd);
    },
    _refresh: function (bindings) {
      var refresh_queue = new RefreshQueue();
      can.each(bindings, function (binding) {
        refresh_queue.enqueue(binding.instance);
      });
      return refresh_queue.trigger();
    }
  });

  can.Model.Cacheable('CMS.Models.Meeting', {
    root_collection: 'meetings',
    root_object: 'meeting',
    findAll: 'GET /api/meetings',
    create: 'POST /api/meetings',
    update: 'PUT /api/meetings/{id}',
    destroy: 'DELETE /api/meetings/{id}',
    attributes: {
      context: 'CMS.Models.Context.stub',
      people: 'CMS.Models.Person.stubs',
      object_people: 'CMS.Models.ObjectPerson.stubs',
      start_at: 'datetime',
      end_at: 'datetime'
    },
    defaults: {},
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.validateNonBlank('title');
      this.validateNonBlank('start_at');
      this.validateNonBlank('end_at');
    }
  }, {
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.each(function (value, name) {
        if (value === null) {
          this.removeAttr(name);
        }
      }.bind(this));
      this.bind('change', function () {
        if (typeof this.response !== 'undefined' && !this._preloaded_people) {
          this._preloaded_people = true;
          _.map(this.response.reify().people, function (person) {
            this.mark_for_addition('people', person);
          }.bind(this));
        }
      }.bind(this));
    }
  });

  can.Model.Cacheable('CMS.Models.Assessment', {
    root_object: 'assessment',
    root_collection: 'assessments',
    findOne: 'GET /api/assessments/{id}',
    findAll: 'GET /api/assessments',
    update: 'PUT /api/assessments/{id}',
    destroy: 'DELETE /api/assessments/{id}',
    create: 'POST /api/assessments',
    mixins: ['ownable', 'contactable', 'unique_title', 'relatable'],
    relatable_options: {
      relevantTypes: {
        Audit: {
          objectBinding: 'audits',
          relatableBinding: 'program_assessments',
          weight: 5
        },
        Regulation: {
          objectBinding: 'related_regulations',
          relatableBinding: 'related_assessments',
          weight: 3
        },
        Control: {
          objectBinding: 'related_controls',
          relatableBinding: 'related_assessments',
          weight: 10
        }
      },
      threshold: 5
    },
    is_custom_attributable: true,
    attributes: {
      control: 'CMS.Models.Control.stub',
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      custom_attribute_values: 'CMS.Models.CustomAttributeValue.stubs',
      start_date: 'date',
      end_date: 'date',
      finished_date: 'date',
      verified_date: 'date'
    },
    defaults: {
      status: 'Not Started'
    },
    filter_keys: ['title', 'state', 'operationally', 'operational', 'design',
                  'finished_date', 'verified_date', 'verified'],
    filter_mappings: {
      operational: 'operationally',
      'verified date': 'verified_date',
      'finished date': 'finished_date'
    },
    tree_view_options: {
      add_item_view: GGRC.mustache_path +
        '/base_objects/tree_add_item.mustache',
      attr_list: [{
        attr_title: 'Title',
        attr_name: 'title'
      }, {
        attr_title: 'Code',
        attr_name: 'slug'
      }, {
        attr_title: 'State',
        attr_name: 'status'
      }, {
        attr_title: 'Verified',
        attr_name: 'verified'
      }, {
        attr_title: 'Primary Contact',
        attr_name: 'contact',
        attr_sort_field: 'contact.name|email'
      }, {
        attr_title: 'Secondary Contact',
        attr_name: 'secondary_contact',
        attr_sort_field: 'secondary_contact.name|email'
      }, {
        attr_title: 'Last Updated',
        attr_name: 'updated_at'
      }, {
        attr_title: 'Conclusion: Design',
        attr_name: 'design'
      }, {
        attr_title: 'Conclusion: Operation',
        attr_name: 'operationally'
      }, {
        attr_title: 'Finished Date',
        attr_name: 'finished_date'
      }, {
        attr_title: 'Verified Date',
        attr_name: 'verified_date'
      }, {
        attr_title: 'URL',
        attr_name: 'url'
      }, {
        attr_title: 'Reference URL',
        attr_name: 'reference_url'
      }]
    },
    info_pane_options: {
      mapped_objects: {
        model: can.Model.Cacheable,
        mapping: 'info_related_objects',
        show_view: GGRC.mustache_path + '/base_templates/subtree.mustache'
      },
      evidence: {
        model: CMS.Models.Document,
        mapping: 'all_documents',
        show_view: GGRC.mustache_path + '/base_templates/attachment.mustache',
        sort_function: _comment_sort
      },
      comments: {
        model: can.Model.Cacheable,
        mapping: 'comments',
        show_view: GGRC.mustache_path +
          '/base_templates/comment_subtree.mustache',
        sort_function: _comment_sort
      },
      urls: {
        model: CMS.Models.Document,
        mapping: 'all_urls',
        show_view: GGRC.mustache_path + '/base_templates/urls.mustache'
      }
    },
    assignable_list: [{
      type: 'creator',
      mapping: 'related_creators',
      required: true
    }, {
      type: 'assessor',
      mapping: 'related_assessors',
      required: true
    }, {
      type: 'verifier',
      mapping: 'related_verifiers',
      required: false
    }],
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.validatePresenceOf('object');
      this.validatePresenceOf('audit');
      this.validatePresenceOf('validate_creator');
      this.validatePresenceOf('validate_assessor');
      this.validateNonBlank('title');

      this.validate(['validate_creator', 'validate_assessor'],
        function (newVal, prop) {
          if (!this.validate_creator) {
            return 'You need to specify at least one creator';
          }
          if (!this.validate_assessor) {
            return 'You need to specify at least one assessor';
          }
        }
      );
    }
  }, {
    form_preload: function (newObjectForm) {
      var pageInstance = GGRC.page_instance();
      var currentUser = CMS.Models.get_instance('Person',
        GGRC.current_user.id, GGRC.current_user);

      if (!newObjectForm) {
        return;
      }

      if (pageInstance && pageInstance.type === 'Audit' && !this.audit) {
        this.attr('audit', pageInstance);
      }
      this.mark_for_addition('related_objects_as_destination', currentUser, {
        attrs: {
          AssigneeType: 'Creator'
        }
      });
    },
    info_pane_preload: function () {
      if (!this._pane_preloaded) {
        this._set_mandatory_msgs();
        this.get_mapping('comments').bind('length',
            this._set_mandatory_msgs.bind(this));
        this.get_mapping('all_documents').bind('length',
            this._set_mandatory_msgs.bind(this));
        this._pane_preloaded = true;
      }
    },
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
    },
    save: function () {
      if (!this.attr('program')) {
        this.attr('program', this.attr('audit.program'));
      }
      return this._super.apply(this, arguments);
    },
    after_save: function () {
      this._set_mandatory_msgs();
    },
    _set_mandatory_msgs: function () {
      var instance = this;
      var FLAGS = {
        COMMENT: 1,
        ATTACHMENT: 2 // binary 10
      };
      var needed = {
        attachment: [],
        comment: [],
        value: []
      };
      var rq = new RefreshQueue();

      if (!instance.custom_attribute_definitions) {
        instance.load_custom_attribute_definitions();
      }

      _.each(instance.custom_attribute_values, function (cav) {
        rq.enqueue(cav);
      });
      $.when(
          instance.refresh_all('custom_attribute_values'),
          instance.get_binding('comments').refresh_count(),
          instance.get_binding('all_documents').refresh_count(),
          rq.trigger()
      ).then(function (customAttrVals, commentCount, attachmentCount, rqRes) {
        var values = _.map(instance.custom_attribute_values, function (cav) {
          return cav.reify();
        });
        commentCount = commentCount();
        attachmentCount = attachmentCount();
        _.each(instance.custom_attribute_definitions, function (definition) {
          var pred = {custom_attribute_id: definition.id};
          if (definition.mandatory && !_.some(values, pred)) {
            needed.value.push(definition.title);
          }
        });
        _.each(values, function (cav) {
          var definition;
          var i;
          var mandatory;
          definition = _.find(instance.custom_attribute_definitions, {
            id: cav.custom_attribute_id
          });
          if (!definition.multi_choice_options ||
              !definition.multi_choice_mandatory) {
            return;
          }
          i = definition.multi_choice_options.split(',')
                    .indexOf(cav.attribute_value);
          mandatory = definition.multi_choice_mandatory.split(',')[i];
          if (mandatory === undefined) {
            return;
          }
          mandatory = Number(mandatory);
          if (mandatory & FLAGS.COMMENT) {
            needed.comment.push(definition.title + ': ' + cav.attribute_value);
          }
          if (mandatory & FLAGS.ATTACHMENT) {
            needed.attachment.push(definition.title + ': ' +
                                   cav.attribute_value);
          }
        });
        if (!commentCount && needed.comment.length) {
          instance.attr(
              '_mandatory_comment_msg',
              'Comment required by: ' + needed.comment.join(', ')
          );
        } else {
          instance.removeAttr('_mandatory_comment_msg');
        }
        if (!attachmentCount && needed.attachment.length) {
          instance.attr(
              '_mandatory_attachment_msg',
              'Evidence required by: ' + needed.attachment.join(', ')
          );
        } else {
          instance.removeAttr('_mandatory_attachment_msg');
        }
        if (needed.value.length) {
          instance.attr(
              '_mandatory_value_msg',
              'Values required for: ' + needed.value.join(', ')
          );
        } else {
          instance.removeAttr('_mandatory_value_msg');
        }
        instance.attr(
            '_mandatory_msg',
            _.filter([
              instance.attr('_mandatory_value_msg'),
              instance.attr('_mandatory_attachment_msg'),
              instance.attr('_mandatory_comment_msg')
            ]).join('; <br />') || null
        );
      });
    },
    related_issues: function () {
      var relevantTypes = {
        Audit: {
          objectBinding: 'audits',
          relatableBinding: 'program_issues',
          weight: 5
        },
        Regulation: {
          objectBinding: 'related_regulations',
          relatableBinding: 'related_issues',
          weight: 3
        },
        Control: {
          objectBinding: 'related_controls',
          relatableBinding: 'related_issues',
          weight: 10
        }
      };
      return this._related(relevantTypes, 5);
    },
    related_requests: function () {
      var relevantTypes = {
        Audit: {
          objectBinding: 'audits',
          relatableBinding: 'program_requests',
          weight: 5
        },
        Regulation: {
          objectBinding: 'related_regulations',
          relatableBinding: 'related_requests',
          weight: 3
        },
        Control: {
          objectBinding: 'related_controls',
          relatableBinding: 'related_requests',
          weight: 10
        }
      };
      return this._related(relevantTypes, 5);
    }
  });

  /**
   * A model describing a template for the newly created Assessment objects.
   *
   * This is useful when creating multiple similar Assessment objects. Using an
   * AssessmentTemplate helps avoiding repeatedly defining the same set of
   * Assessment object properties for each new instance.
   */
  can.Model.Cacheable('CMS.Models.AssessmentTemplate', {
    root_object: 'assessment_template',
    root_collection: 'assessment_templates',
    model_singular: 'AssessmentTemplate',
    model_plural: 'AssessmentTemplates',
    title_singular: 'Assessment Template',
    title_plural: 'Assessment Templates',
    table_singular: 'assessment_template',
    table_plural: 'assessment_templates',

    findOne: 'GET /api/assessment_templates/{id}',
    findAll: 'GET /api/assessment_templates',
    update: 'PUT /api/assessment_templates/{id}',
    destroy: 'DELETE /api/assessment_templates/{id}',
    create: 'POST /api/assessment_templates',

    is_custom_attributable: false,

    attributes: {
      audit: 'CMS.Models.Audit.stub',
      context: 'CMS.Models.Context.stub'
    },

    defaults: {
      test_plan_procedure: false,
      template_object_type: 'Control',
      default_people: {
        assessors: 'Object Owners',
        verifiers: 'Object Owners'
      },
      // the custom lists of assessor / verifier IDs if "other" is selected for
      // the corresponding default_people setting
      assessorsList: {},
      verifiersList: {},
      people_values: [
        {value: 'Object Owners', title: 'Object Owners'},
        {value: 'Audit Lead', title: 'Audit Lead'},
        {value: 'Auditors', title: 'Auditors'},
        {value: 'Primary Assessor', title: 'Principal Assessor'},
        {value: 'Secondary Assessors', title: 'Secondary Assessors'},
        {value: 'Primary Contact', title: 'Primary Contact'},
        {value: 'Secondary Contact', title: 'Secondary Contact'},
        {value: 'other', title: 'Others...'}
      ]
    },

    /**
     * Initialize the newly created object instance. Essentially just validate
     * that its title is non-blank.
     */
    init: function () {
      this._super.apply(this, arguments);
      this.validateNonBlank('title');
    }
  }, {
    // the object types that are not relevant to the AssessmentTemplate,
    // i.e. it does not really make sense to assess them
    _NON_RELEVANT_OBJ_TYPES: Object.freeze({
      AssessmentTemplate: true,
      Assessment: true,
      Audit: true,
      CycleTaskGroupObjectTask: true,
      Request: true,
      TaskGroup: true,
      TaskGroupTask: true,
      Workflow: true
    }),

    /**
     * An event handler when the add/edit form is about to be displayed.
     *
     * It builds a list of all object types used to populate the corresponding
     * dropdown menu on the form.
     * It also deserializes the default people settings so that those form
     * fields are correctly populated.
     *
     * @param {Boolean} isNewObject - true if creating a new instance, false if
     *   editing and existing one
     *
     */
    form_preload: function (isNewObject) {
      if (!this.custom_attribute_definitions) {
        this.attr('custom_attribute_definitions', new can.List());
      }
      this.attr('_objectTypes', this._choosableObjectTypes());
      this._unpackPeopleData();

      this._updateDropdownEnabled('assessors');
      this._updateDropdownEnabled('verifiers');
    },

    /**
     * Save the model instance by sending a POST/PUT request to the server
     *
     * @return {can.Deferred} - a deferred object resolved or rejected
     *   depending on the outcome of the undrelying API request
     */
    save: function () {
      this.attr('default_people', this._packPeopleData());

      return this._super.apply(this, arguments);
    },

    /**
     * Event handler when an assessor is picked in an autocomplete form field.
     * It adds the picked assessor's ID to the assessors list.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    assessorAdded: function (context, $el, ev) {
      var user = ev.selectedItem;
      this.assessorsList.attr(user.id, true);
    },

    /**
     * Event handler when a user clicks to remove an assessor from the
     * assessors list. It removes the corresponding assessor ID from the list.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    assessorRemoved: function (context, $el, ev) {
      var user = ev.person;
      this.assessorsList.removeAttr(String(user.id));
    },

    /**
     * Event handler when a verifier is picked in an autocomplete form field.
     * It adds the picked verifier's ID to the verifiers list.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    verifierAdded: function (context, $el, ev) {
      var user = ev.selectedItem;
      this.verifiersList.attr(user.id, true);
    },

    /**
     * Event handler when a user clicks to remove a verifier from the verifiers
     * list. It removes the corresponding verifier ID from the list.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    verifierRemoved: function (context, $el, ev) {
      var user = ev.person;
      this.verifiersList.removeAttr(String(user.id));
    },

    /**
     * Event handler when a user changes the default assessors option.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    defaultAssesorsChanged: function (context, $el, ev) {
      this._updateDropdownEnabled('assessors');
    },

    /**
     * Event handler when a user changes the default verifiers option.
     *
     * @param {can.Map} context - the Mustache context of the `$el`
     * @param {jQuery.Element} $el - the source of the event `ev`
     * @param {jQuery.Event} ev - the event that was triggered
     */
    defaultVerifiersChanged: function (context, $el, ev) {
      this._updateDropdownEnabled('verifiers');
    },

    /**
     * Update the autocomplete field's disabled flag based on the current value
     * of the corresponding dropdown.
     *
     * @param {String} name - the value to inspect, must be either "assessors"
     *   or "verifiers"
     */
    _updateDropdownEnabled: function (name) {
      var disable = this.attr('default_people.' + name) !== 'other';
      this.attr(name + 'ListDisable', disable);
    },

    /**
     * Pack the "default people" form data into a JSON string.
     *
     * @return {String} - the JSON-packed default people data
     */
    _packPeopleData: function () {
      var data = {};
      /**
       * Create a sorted (ascending) list of numbers from the given map's keys.
       *
       * @param {can.Map} peopleIds - the map to convert
       * @return {Array} - ordered IDs
       */
      function makeList(peopleIds) {
        var result = Object.keys(peopleIds.attr()).map(Number);
        return result.sort(function (x, y) {
          return x - y;
        });
      }

      data.assessors = this.attr('default_people.assessors');
      data.verifiers = this.attr('default_people.verifiers');

      if (data.assessors === 'other') {
        data.assessors = makeList(this.attr('assessorsList'));
      }

      if (data.verifiers === 'other') {
        data.verifiers = makeList(this.attr('verifiersList'));
      }

      return JSON.stringify(data);
    },

    /**
     * Inspect the default people settings object, convert any lists of
     * user IDs to comma-separated strings, and use that to populate the
     * corresponding text input fields.
     */
    _unpackPeopleData: function () {
      var instance = this;  // the AssessmentTemplate model instance
      var peopleData = instance.default_people;

      ['assessors', 'verifiers'].forEach(function (name) {
        var idsMap;
        var peopleIds = peopleData[name];

        if (peopleIds instanceof can.List) {
          idsMap = new can.Map();
          peopleIds.forEach(function (id) {
            idsMap.attr(id, true);
          });
          instance.attr(name + 'List', idsMap);
          instance.attr('default_people.' + name, 'other');
        } else {
          instance.attr(name + 'List', {});
        }
      });
    },

    /**
     * Return the object types that can be assessed.
     *
     * Used to populate the "Objects under assessment" dropdown on the modal
     * AssessmentTemplate's modal form.
     *
     * @return {Object} - the "assessable" object types
     */
    _choosableObjectTypes: function () {
      var ignoreTypes = this._NON_RELEVANT_OBJ_TYPES;
      var mapper;
      var MapperModel = GGRC.Models.MapperModel;
      var objectTypes;

      mapper = new MapperModel({
        object: 'MultitypeSearch',
        search_only: true
      });
      objectTypes = mapper.types();

      // the all objects group is not needed
      delete objectTypes.all_objects;

      // remove ignored types and sort the rest
      _.each(objectTypes, function (objGroup) {
        objGroup.items = _.filter(objGroup.items, function (item) {
          return !ignoreTypes[item.value];
        });
        objGroup.items = _.sortBy(objGroup.items, 'name');
      });

      // remove the groups that have ended up being empty
      objectTypes = _.pick(objectTypes, function (objGroup) {
        return objGroup.items.length > 0;
      });

      return objectTypes;
    },
    ignore_ca_errors: true
  });
})(this.can);
