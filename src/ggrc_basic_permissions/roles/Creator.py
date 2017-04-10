# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

scope = "System"
description = """
  This role grants a user basic object creation and editing permission.
  """

owner_base = [
    "Categorization",
    "Category",
    "ControlCategory",
    "ControlAssertion",
    {
        "type": "Control",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "DataAsset",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "AccessGroup",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Directive",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Contract",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Policy",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Regulation",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Standard",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Facility",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Market",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Objective",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    "ObjectDocument",
    "ObjectOwner",
    "ObjectPerson",
    "Option",
    {
        "type": "OrgGroup",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Vendor",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Product",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Section",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Clause",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "SystemOrProcess",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "System",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Process",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "Project",
        "terms": {
            "list_property": "owners",
            "value": "$current_user"
        },
        "condition": "contains"
    },
    {
        "type": "BackgroundTask",
        "terms": {
            "property_name": "modified_by",
            "value": "$current_user"
        },
        "condition": "is"
    },
    "CustomAttributeDefinition",
    "CustomAttributeValue",
]
owner_read = owner_base + [
    "AccessControlList",
    {
        "type": "Relationship",
        "terms": {
            "property_name": "source,destination",
            "action": "read"
        },
        "condition": "relationship",
    },
    "Role",
    "UserRole",
    "Context",
    "Person",
]

owner_update = owner_base + [
    {
        "type": "Relationship",
        "terms": {
            "property_name": "source,destination",
            "action": "update"
        },
        "condition": "relationship",
    },
    {
        "type": "Comment",
        "terms": {
            "property_name": "modified_by",
            "value": "$current_user"
        },
        "condition": "is"
    },
]

permissions = {
    "read": owner_read,
    "create": [
        "Workflow"
        "Categorization",
        "Category",
        "ControlCategory",
        "ControlAssertion",
        "Control",
        "Comment",
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
        "Program",
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
    "view_object_page": owner_read,
    "update": owner_update,
    "delete": owner_update,
}
