/*!
 Copyright (C) 2016 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */
(function (can, GGRC, CMS) {
  can.Model.Cacheable('CMS.Models.Assessment', {
    root_object: 'assessment',
    root_collection: 'assessments',
    findOne: 'GET /api/assessments/{id}',
    findAll: 'GET /api/assessments',
    update: 'PUT /api/assessments/{id}',
    destroy: 'DELETE /api/assessments/{id}',
    create: 'POST /api/assessments',
    mixins: [
      'ownable', 'contactable', 'unique_title', 'relatable',
      'autoStatusChangeable', 'timeboxed'
    ],
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
      related_sources: 'CMS.Models.Relationship.stubs',
      related_destinations: 'CMS.Models.Relationship.stubs',
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      finished_date: 'date',
      verified_date: 'date',
      custom_attribute_values: 'CMS.Models.CustomAttributeValue.models'
    },
    defaults: {
      status: 'Not Started'
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
        sort_function: GGRC.Utils.sortingHelpers.commentSort
      },
      comments: {
        model: can.Model.Cacheable,
        mapping: 'comments',
        show_view: GGRC.mustache_path +
        '/base_templates/comment_subtree.mustache',
        sort_function: GGRC.Utils.sortingHelpers.commentSort
      },
      urls: {
        model: CMS.Models.Document,
        mapping: 'all_urls',
        show_view: GGRC.mustache_path + '/base_templates/urls.mustache'
      }
    },
    confirmEditModal: {
      title: 'Confirm moving Request to "In Progress"',
      description: 'You are about to move request from ' +
      '"{{status}}" to "In Progress" - are you sure about that?',
      button: 'Confirm'
    },
    assignable_list: [{
      title: 'Creator(s)',
      type: 'creator',
      mapping: 'related_creators',
      required: true
    }, {
      title: 'Assignee(s)',
      type: 'assessor',
      mapping: 'related_assessors',
      required: true
    }, {
      title: 'Verifier(s)',
      type: 'verifier',
      mapping: 'related_verifiers',
      required: false
    }],
    conflicts: [
      ['assessor', 'verifier']
    ],
    conclusions: ['Effective', 'Ineffective', 'Needs improvement',
      'Not Applicable'],
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.validatePresenceOf('audit');
      this.validateNonBlank('title');

      this.validate(
        'validate_creator',
        function () {
          if (!this.validate_creator) {
            return 'You need to specify at least one creator';
          }
        }
      );
      this.validate(
        'validate_assessor',
        function () {
          if (!this.validate_assessor) {
            return 'You need to specify at least one assignee';
          }
        }
      );
    }
  }, {
    init: function () {
      if (this._super) {
        this._super.apply(this, arguments);
      }
      this.setIsReadyForRender(false);
    },
    save: function () {
      if (!this.attr('program')) {
        this.attr('program', this.attr('audit.program'));
      }
      return this._super.apply(this, arguments);
    },
    after_save: function () {
      this.updateValidation();
      if (this.audit && this.audit.selfLink) {
        this.audit.refresh();
      }
    },
    setIsReadyForRender: function (isReady) {
      this.attr('isReadyForRender', isReady);
    },
    updateValidation: function () {
      var values = this.attr('custom_attribute_values');
      var definitions = this.attr('custom_attribute_definitions');
      var errorsList = {
        attachment: [],
        comment: [],
        value: []
      };
      this.setIsReadyForRender(false);
      this.validateValues(definitions, values, errorsList);
      this.setErrorMessages(errorsList);
      this.setAggregatedErrorMessage();
      this.setIsReadyForRender(true);
    },
    validateValues: function (definitions, values, errorsList) {
      can.each(definitions, function (cad) {
        var cav;
        var value;

        can.each(values, function (item) {
          if (item.custom_attribute_id === cad.id) {
            cav = item;
            value = cav.attribute_value;
          }
        });
        if (cad.mandatory &&
            GGRC.Utils.isEmptyCA(value, cad.attribute_type)) {
          // If Custom Attribute is mandatory and empty
          errorsList.value.push(cad.title);
        } else if (cav) {
          // If Custom Attribute Value is presented - do all required checks
          cav.preconditions_failed = cav.preconditions_failed || [];
          if (cav.preconditions_failed.indexOf('comment') > -1) {
            errorsList.comment.push(cad.title + ': ' + value);
          }
          if (cav.preconditions_failed.indexOf('evidence') > -1) {
            errorsList.attachment.push(cad.title + ': ' + value);
          }
        }
      });
    },
    setErrorMessages: function (needed) {
      if (needed.comment.length) {
        this.attr('_mandatory_comment_msg',
          'Comment required by: ' + needed.comment.join(', '));
      } else {
        this.removeAttr('_mandatory_comment_msg');
      }

      if (needed.attachment.length) {
        this.attr('_mandatory_attachment_msg',
          'Evidence required by: ' + needed.attachment.join(', '));
      } else {
        this.removeAttr('_mandatory_attachment_msg');
      }

      if (needed.value.length) {
        this.attr(
          '_mandatory_value_msg',
          'Values required for: ' + needed.value.join(', ')
        );
      } else {
        this.removeAttr('_mandatory_value_msg');
      }
    },
    setAggregatedErrorMessage: function () {
      this.attr('_mandatory_msg',
        _.filter([
          this.attr('_mandatory_value_msg'),
          this.attr('_mandatory_attachment_msg'),
          this.attr('_mandatory_comment_msg')
        ]).join('; <br />') || null
      );
    },
    form_preload: function (newObjectForm) {
      var pageInstance = GGRC.page_instance();
      var currentUser = CMS.Models.get_instance('Person',
        GGRC.current_user.id, GGRC.current_user);
      var auditLead;

      if (!newObjectForm) {
        return;
      }

      if (pageInstance && pageInstance.type === 'Audit' && !this.audit) {
        this.attr('audit', pageInstance);
      }

      if (this.audit) {
        auditLead = this.audit.contact.reify();
        if (currentUser === auditLead) {
          markForAddition(this, auditLead, 'Creator,Assessor');
        } else {
          markForAddition(this, auditLead, 'Assessor');
          markForAddition(this, currentUser, 'Creator');
        }
      } else {
        markForAddition(this, currentUser, 'Creator');
      }

      function markForAddition(instance, user, type) {
        instance.mark_for_addition('related_objects_as_destination', user, {
          attrs: {
            AssigneeType: type
          }
        });
      }
    },
    refreshInstance: function () {
      return this.refresh().then(function () {
        this.updateValidation();
      }.bind(this));
    },
    info_pane_preload: function () {
      if (!this._pane_preloaded) {
        this.get_mapping('comments').bind('length',
          this.refreshInstance.bind(this));
        this.get_mapping('all_documents').bind('length',
          this.refreshInstance.bind(this));
        this.refreshInstance();
        this._pane_preloaded = true;
      }
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
    }
  });
})(window.can, window.GGRC, window.CMS);
