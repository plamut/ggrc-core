/*!
 Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 Created By: swizec@reciprocitylabs.com
 Maintained By: anze@reciprocitylabs.com
 */

/*

Spec setup file.
*/

window.GGRC = window.GGRC || {};
GGRC.current_user = GGRC.current_user || {
  id: 1,
  type: 'Person'
};
GGRC.permissions = {
  create: {},
  'delete': {},
  read: {},
  update: {},
  view_object_page: {}
};
GGRC.config = {};
GGRC.Bootstrap = {
  exportable: [{
    title_plural: 'Audits',
    model_singular: 'Audit'
  }, {
    title_plural: 'Clauses',
    model_singular: 'Clause'
  }, {
    title_plural: 'Contracts',
    model_singular: 'Contract'
  }, {
    title_plural: 'Controls',
    model_singular: 'Control'
  }, {
    title_plural: 'Control Assessments',
    model_singular: 'ControlAssessment'
  }, {
    title_plural: 'Cycles',
    model_singular: 'Cycle'
  }, {
    title_plural: 'Cycle Task Groups',
    model_singular: 'CycleTaskGroup'
  }, {
    title_plural: 'Cycle Task Group Object Tasks',
    model_singular: 'CycleTaskGroupObjectTask'
  }, {
    title_plural: 'Data Assets',
    model_singular: 'DataAsset'
  }, {
    title_plural: 'Facilities',
    model_singular: 'Facility'
  }, {
    title_plural: 'Issues',
    model_singular: 'Issue'
  }, {
    title_plural: 'Markets',
    model_singular: 'Market'
  }, {
    title_plural: 'Objectives',
    model_singular: 'Objective'
  }, {
    title_plural: 'Org Groups',
    model_singular: 'OrgGroup'
  }, {
    title_plural: 'People',
    model_singular: 'Person'
  }, {
    title_plural: 'Policies',
    model_singular: 'Policy'
  }, {
    title_plural: 'Processes',
    model_singular: 'Process'
  }, {
    title_plural: 'Products',
    model_singular: 'Product'
  }, {
    title_plural: 'Programs',
    model_singular: 'Program'
  }, {
    title_plural: 'Projects',
    model_singular: 'Project'
  }, {
    title_plural: 'Regulations',
    model_singular: 'Regulation'
  }, {
    title_plural: 'Requests',
    model_singular: 'Request'
  }, {
    title_plural: 'Responses',
    model_singular: 'Response'
  }, {
    title_plural: 'Risk Assessments',
    model_singular: 'RiskAssessment'
  }, {
    title_plural: 'Sections',
    model_singular: 'Section'
  }, {
    title_plural: 'Standards',
    model_singular: 'Standard'
  }, {
    title_plural: 'Systems',
    model_singular: 'System'
  }, {
    title_plural: 'Task Groups',
    model_singular: 'TaskGroup'
  }, {
    title_plural: 'Task Group Tasks',
    model_singular: 'TaskGroupTask'
  }, {
    title_plural: 'Vendors',
    model_singular: 'Vendor'
  }, {
    title_plural: 'Workflows',
    model_singular: 'Workflow'
  }],
  importable: [{
    title_plural: 'Audits',
    model_singular: 'Audit'
  }, {
    title_plural: 'Clauses',
    model_singular: 'Clause'
  }, {
    title_plural: 'Contracts',
    model_singular: 'Contract'
  }, {
    title_plural: 'Controls',
    model_singular: 'Control'
  }, {
    title_plural: 'Control Assessments',
    model_singular: 'ControlAssessment'
  }, {
    title_plural: 'Data Assets',
    model_singular: 'DataAsset'
  }, {
    title_plural: 'Facilities',
    model_singular: 'Facility'
  }, {
    title_plural: 'Issues',
    model_singular: 'Issue'
  }, {
    title_plural: 'Markets',
    model_singular: 'Market'
  }, {
    title_plural: 'Objectives',
    model_singular: 'Objective'
  }, {
    title_plural: 'Org Groups',
    model_singular: 'OrgGroup'
  }, {
    title_plural: 'People',
    model_singular: 'Person'
  }, {
    title_plural: 'Policies',
    model_singular: 'Policy'
  }, {
    title_plural: 'Processes',
    model_singular: 'Process'
  }, {
    title_plural: 'Products',
    model_singular: 'Product'
  }, {
    title_plural: 'Programs',
    model_singular: 'Program'
  }, {
    title_plural: 'Projects',
    model_singular: 'Project'
  }, {
    title_plural: 'Regulations',
    model_singular: 'Regulation'
  }, {
    title_plural: 'Requests',
    model_singular: 'Request'
  }, {
    title_plural: 'Responses',
    model_singular: 'Response'
  }, {
    title_plural: 'Risk Assessments',
    model_singular: 'RiskAssessment'
  }, {
    title_plural: 'Sections',
    model_singular: 'Section'
  }, {
    title_plural: 'Standards',
    model_singular: 'Standard'
  }, {
    title_plural: 'Systems',
    model_singular: 'System'
  }, {
    title_plural: 'Task Groups',
    model_singular: 'TaskGroup'
  }, {
    title_plural: 'Task Group Tasks',
    model_singular: 'TaskGroupTask'
  }, {
    title_plural: 'Vendors',
    model_singular: 'Vendor'
  }, {
    title_plural: 'Workflows',
    model_singular: 'Workflow'
  }]
};
