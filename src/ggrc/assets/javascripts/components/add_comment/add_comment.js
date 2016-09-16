/*!
  Copyright (C) 2016 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (GGRC, can) {
  'use strict';

/**
   * A component that takes care of adding comments with attachments
   *
   */
  GGRC.Components('addComment', {
    tag: 'add-comment',
    template: can.view('/static/mustache/base_templates/add_comment.mustache'),
    scope: {
      attachments: new can.List(),
      parent_instance: null,
      instance: null,
      instance_attr: '@',
      source_mapping: null,
      source_mapping_source: '@',
      mapping: '@',
      deferred: '@',
      isSaving: false,  // is there a save operation currently in progress
      attributes: {},
      list: [],
      // the following are just for the case when we have no object to start with,
      changes: [],
      description: null,
      sendNotification: false,
      removePending: function (scope, el, ev) {
        var joins = this.instance._pending_joins;
        var model = scope.what;
        var index = _.findIndex(joins.serialize(), function (join) {
          return join.what.id === model.id &&
            join.what.type === model.type;
        });

        model.refresh().then(function () {
          model.destroy();
          joins.splice(index, 1);
        });
      },
      get_assignee_type: function () {
        var types = new Map([
          ['related_verifiers', 'verifier'],
          ['related_assessors', 'assessor'],
          ['related_assignees', 'assignee'],
          ['related_requesters', 'requester'],
          ['related_creators', 'creator']
        ]);

        var instance = this.attr('parent_instance');
        var user = GGRC.current_user;
        var user_type;

        if (!instance || !user) {
          return;
        }
        types.forEach(function (type, mapping) {
          var mappings = instance.get_mapping(mapping);
          if (!mappings.length) {
            return;
          }
          if (_.filter(mappings, function (mapping) {
            return mapping.instance.id === user.id;
          }).length) {
            type = can.capitalize(type);
            user_type = user_type ? (user_type + ',' + type) : type;
          }
        });
        return user_type;
      }
    },
    events: {
      inserted: function () {
        if (!this.scope.attr('source_mapping')) {
          this.scope.attr('source_mapping', GGRC.page_instance());
        }
        this.scope.attr('sendNotification',
          this.scope.attr('parent_instance.send_by_default'));
        this.newInstance();
      },
      newInstance: function () {
        var instance = CMS.Models.Comment();
        instance.attr({
          _source_mapping: this.scope.attr('source_mapping'),
          context: this.scope.attr('parent_instance.context')
        });
        this.scope.attr('instance', instance);
      },
      cleanPanel: function () {
        this.scope.attachments.replace([]);
        this.scope.attr('description', null);
      },
      /**
       * The component's click event (happens when the user clicks add comment),
       * takes care of saving the comment with appended evidence.
       */
      '.btn-success click': function (el, ev) {
        var description = $.trim(this.scope.description);
        var attachments = this.scope.attachments;
        var source = this.scope.source_mapping;
        var instance = this.scope.instance;
        var data;

        if (!description.length && !attachments.length) {
          return;
        }
        data = {
          description: description,
          send_notification: this.scope.attr('sendNotification'),
          context: source.context,
          assignee_type: this.scope.get_assignee_type()
        };

        this.scope.attr('isSaving', true);

        instance.attr(data).save()
          .then(function () {
            return instance.constructor.resolve_deferred_bindings(instance);
          })
          .then(function () {
            this.newInstance();
            this.cleanPanel();
          }.bind(this))
          .always(function () {
            this.scope.attr('isSaving', false);
          }.bind(this));
      }
    }
  });
})(window.GGRC, window.can);
