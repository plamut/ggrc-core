/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $, CMS) {
  var ApprovalWorkflowErrors = function () {
    var errors = null;
    if (!this.attr('contact')) {
      errors = {
        contact: 'Must be defined'
      };
    }
    if (!this.attr('end_date')) {
      errors = $.extend(errors, {
        end_date: 'Must be defined'
      });
    }
    return errors;
  };

  can.Observe('CMS.ModelHelpers.CycleTask', {
    findInCacheById: function () {
      return null;
    }
  }, {
    init: function () {
      this.attr('owners', new CMS.Models.Person.List(this.owners));
    },
    save: function () {
      var Task;

      // FIXME: temporary fix for 'Could not get any raw data while
      // converting using .models'
      this._data.owners = $.map(this._data.owners, function (owner) {
        return {
          id: owner.id,
          type: owner.type
        };
      });

      Task = new CMS.Models.TaskGroupTask({
        task_group: this.task_group,
        title: this.title,
        description: this.description,
        sort_index: Number.MAX_SAFE_INTEGER / 2,
        contact: this.contact,
        context: this.context
      });

      return Task.save()
        .then(function (taskGroupTask) {
          var CycleTask = new CMS.Models.CycleTaskGroupObjectTask({
            cycle: this.cycle,
            start_date: this.cycle.reify().start_date,
            end_date: this.cycle.reify().end_date,
            task_group_task: taskGroupTask,
            sort_index: this.sort_index,
            title: this.title,
            description: this.description,
            status: 'Assigned',
            contact: this.contact,
            context: this.context
          });
          return CycleTask.save();
        }.bind(this));
    },
    computed_errors: function () {
      var errors = null;
      if (!this.attr('title')) {
        errors = {
          title: 'Must be defined'
        };
      }
      return errors;
    }
  });

  can.Observe('CMS.ModelHelpers.ApprovalWorkflow', {
    defaults: {
      original_object: null
    }
  }, {
    save: function () {
      var that = this;
      var aws_dfd = this.original_object.get_binding('approval_workflows').refresh_list();
      var reviewTemplate = _.template('Object review for ${type} "${title}"');
      var notifyTemplate = _.template('<br/><br/> ${name} (${email}) asked ' +
        'you to review newly created ${type} "${title}" before ${before}. ' +
        'Click <a href="${href}#workflows_widget">here</a> to perform a review.'
      );

      return aws_dfd.then(function (aws) {
        var ret;
        if (aws.length < 1) {
          ret = $.when(
            new CMS.Models.Workflow({
              frequency: 'one_time',
              status: 'Active',
              title: reviewTemplate({
                type: that.original_object.constructor.title_singular,
                title: that.original_object.title
              }),
              object_approval: true,
              notify_on_change: true,
              notify_custom_message: notifyTemplate({
                name: GGRC.current_user.name,
                email: GGRC.current_user.email,
                type: that.original_object.constructor.model_singular,
                title: that.original_object.title,
                before: moment(that.end_date).format('MM/DD/YYYY'),
                href: window.location.href.replace(/#.*$/, '')
              }),
              context: that.original_object.context
            }).save()
          ).then(function(wf) {
              return $.when(
                wf,
                new CMS.Models.TaskGroup({
                  workflow : wf,
                  title: reviewTemplate({
                    type: that.original_object.constructor.title_singular,
                    title: that.original_object.title
                  }),
                  contact: that.contact,
                  context: wf.context
                }).save()
              );
          }).then(function(wf, tg) {
              return $.when(
                wf,
                new CMS.Models.TaskGroupTask({
                  task_group: tg,
                  start_date: moment().format('MM/DD/YYYY'),
                  end_date: that.end_date,
                  object_approval: true,
                  sort_index: (Number.MAX_SAFE_INTEGER / 2).toString(10),
                  contact: that.contact,
                  context: wf.context,
                  task_type: "text",
                  title: reviewTemplate({
                    type: that.original_object.constructor.title_singular,
                    title: that.original_object.title
                  })
                }).save(),
                new CMS.Models.TaskGroupObject({
                  task_group: tg,
                  object: that.original_object,
                  context: wf.context
                }).save()
              );
          });
        } else {
          ret = $.when(
            aws[0].instance.refresh(),
            $.when.apply(
              $,
              can.map(aws[0].instance.task_groups.reify(), function(tg) {
                return tg.refresh();
              })
            ).then(function() {
              return $.when.apply($, can.map(can.makeArray(arguments), function(tg) {
                return tg.attr("contact", that.contact).save().then(function(tg) {
                  return $.when.apply($, can.map(tg.task_group_tasks.reify(), function(tgt) {
                    return tgt.refresh().then(function(tgt) {
                      return tgt.attr({
                        'contact': that.contact,
                        'end_date': that.end_date,
                        'start_date': moment().format('MM/DD/YYYY'),
                        'task_type': tgt.task_type || 'text'
                        }).save();
                    });
                  }));
                });
              }));
            })
          );
        }

        return ret.then(function (wf) {
          var cycleDfd = new CMS.Models.Cycle({
            workflow: wf,
            autogenerate: true,
            context: wf.context
          }).save();
          cycleDfd.then(function () {
            return that.original_object.refresh();
          });
          return cycleDfd;
        });
      });
    },
    computed_errors: ApprovalWorkflowErrors,
    computed_unsuppressed_errors: ApprovalWorkflowErrors
  });
})(this.can, this.can.$, this.CMS);
