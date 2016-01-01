# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: anze@reciprocitylabs.com
# Maintained By: anze@reciprocitylabs.com

from ggrc_basic_permissions.roles.Creator import owner_update

scope = "System"
description = """
  This role grants a user basic, read-only, access permission to a gGRC
  instance.
  """
permissions = {
    "read": [
        "Audit",
        "Categorization",
        "Category",
        "ControlCategory",
        "ControlAssertion",
        "Control",
        "ControlAssessment",
        "CustomAttributeDefinition",
        "CustomAttributeValue",
        "Issue",
        "ControlControl",
        "DataAsset",
        "AccessGroup",
        "Directive",
        "Contract",
        "Policy",
        "Regulation",
        "Standard",
        "Document",
        "Facility",
        "Help",
        "Market",
        "Objective",
        "ObjectControl",
        "ObjectDocument",
        "ObjectObjective",
        "ObjectPerson",
        "Option",
        "OrgGroup",
        "Vendor",
        "PopulationSample",
        "Product",
        "ProgramControl",
        "ProgramDirective",
        "Project",
        "Relationship",
        "Section",
        "Clause",
        "SystemOrProcess",
        "System",
        "Process",
        "SystemControl",
        "SystemSystem",
        "ObjectOwner",
        "Person",
        "Program",
        "Request",
        "Response",
        "DocumentationResponse",
        "InterviewResponse",
        "PopulationSampleResponse",
        "Role",
        "UserRole",
        "Context",
        {
            "type": "BackgroundTask",
            "terms": {
                "property_name": "modified_by",
                "value": "$current_user"
            },
            "condition": "is"
        },
    ],
    "create": [
        "Workflow"
        "Categorization",
        "Category",
        "ControlCategory",
        "ControlAssertion",
        "Control",
        "ControlAssessment",
        "Issue",
        "DataAsset",
        "AccessGroup",
        "Directive",
        "Contract",
        "Policy",
        "Regulation",
        "Standard",
        "Document",
        "Facility",
        "Help",
        "Market",
        "Objective",
        "ObjectDocument",
        "ObjectPerson",
        "Option",
        "OrgGroup",
        "Vendor",
        "PopulationSample",
        "Product",
        "Project",
        {
            "type": "Relationship",
            "terms": {
                "property_name": "source,destination",
                "action": "update"
            },
            "condition": "relationship",
        },
        "Section",
        "Clause",
        "SystemOrProcess",
        "System",
        "Process",
        {
            "type": "ObjectOwner",
            "terms": {
                "property_name": "ownable.modified_by",
                "value": "$current_user"
            },
            "condition": "is"
        },
        "Person",
        "Program",
        "Role",
        "UserRole",
        "Context",
        "BackgroundTask",
    ],
    "view_object_page": [
        "__GGRC_ALL__"
    ],
    "update": owner_update,
    "delete": owner_update,
}
