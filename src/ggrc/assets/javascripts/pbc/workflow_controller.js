/*
 * Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: brad@reciprocitylabs.com
 * Maintained By: brad@reciprocitylabs.com
 */


(function(can, $) {

can.Control("GGRC.Controllers.PbcWorkflows", {

}, {
  "{CMS.Models.ControlAssessment} created": function(model, ev, instance) {

    if(!(instance instanceof CMS.Models.ControlAssessment)) {
      return;
    }

    var audit_dfd, control_dfd;

    audit_dfd = this._create_relationship(instance, instance.audit, instance.audit.context);
    control_dfd = this._create_relationship(instance, instance.control, instance.audit.context);
    instance.delay_resolving_save_until($.when(audit_dfd, control_dfd));

  },
  "{CMS.Models.Issue} created": function(model, ev, instance) {

    if(!(instance instanceof CMS.Models.Issue)) {
      return;
    }

    var audit_dfd, control_dfd, program_dfd, control_assessment_dfd;

    audit_dfd = this._create_relationship(instance, instance.audit);
    control_dfd = this._create_relationship(instance, instance.control);
    program_dfd = this._create_relationship(instance, instance.program);
    control_assessment_dfd = this._create_relationship(instance, instance.control_assessment);
    instance.delay_resolving_save_until($.when(audit_dfd, control_dfd));

  },
  "{CMS.Models.Section} created": function(model, ev, instance) {

    if(!(instance instanceof CMS.Models.Section)) {
      return;
    }

    var directive_dfd;

    directive_dfd = this._create_relationship(instance, instance.directive);
    instance.delay_resolving_save_until($.when(directive_dfd));

  },
  "{CMS.Models.UserRole} created": function(model, ev, instance) {
    if(!(instance instanceof CMS.Models.UserRole)) {
      return;
    }
    if (instance.role_name !== "Auditor") {
      return;
    }
    // Find the program context
    var dfd = instance.refresh_all("context", "related_object", "program", "context").then(function (program_context) {
      // Find existing auditor roles for program context
      return $.when(
          program_context,
          CMS.Models.UserRole.findAll({context_id: program_context.id, person_id: instance.person.id}),
          CMS.Models.Role.findAll({ name : "ProgramReader" }));
    }).then(function (program_context, auditor_program_roles, reader_roles) {
      // Check if there are any existing roles for the user and program context
      if (auditor_program_roles.length) {
        return;
      }
      // If no program role exists for the user, we create a reader role
      return new CMS.Models.UserRole({
        person: instance.person,
        role: reader_roles[0].stub(),
        context: program_context
      }).save();
    });
    instance.delay_resolving_save_until(dfd);
  },
  _create_relationship: function(source, destination, context) {

    if (!destination) {
      return $.Deferred().resolve();
    }
    if (!context) {
      context = source.context;
    }
    return new CMS.Models.Relationship({
      source: source.stub(),
      destination: destination,
      context: context
    }).save();
  }
});

$(function() {
  $(document.body).ggrc_controllers_pbc_workflows();
});

})(this.can, this.can.$);
