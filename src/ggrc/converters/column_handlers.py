# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com


from ggrc.converters.handlers import handlers
from ggrc.converters.handlers import related_person
from ggrc.extensions import get_extension_modules

_column_handlers = {
    "assertions": handlers.ControlAssertionColumnHandler,
    "assignee": handlers.UserColumnHandler,
    "audit": handlers.AuditColumnHandler,
    "categories": handlers.ControlCategoryColumnHandler,
    "company": handlers.TextColumnHandler,
    "contact": handlers.UserColumnHandler,
    "delete": handlers.DeleteColumnHandler,
    "description": handlers.TextareaColumnHandler,
    "design": handlers.ConclusionColumnHandler,
    "directive": handlers.SectionDirectiveColumnHandler,
    "documents": handlers.DocumentsColumnHandler,
    "due_on": handlers.DateColumnHandler,
    "email": handlers.EmailColumnHandler,
    "end_date": handlers.DateColumnHandler,
    "fraud_related": handlers.CheckboxColumnHandler,
    "is_enabled": handlers.CheckboxColumnHandler,
    "key_control": handlers.CheckboxColumnHandler,
    "kind": handlers.OptionColumnHandler,
    "link": handlers.TextColumnHandler,
    "mapped_objects": handlers.ResponseMappedObjectsColumnHandler,
    "means": handlers.OptionColumnHandler,
    "name": handlers.TextColumnHandler,
    "network_zone": handlers.OptionColumnHandler,
    "notes": handlers.TextareaColumnHandler,
    "operationally": handlers.ConclusionColumnHandler,
    "owners": handlers.OwnerColumnHandler,
    "principal_assessor": handlers.UserColumnHandler,
    "private": handlers.CheckboxColumnHandler,
    "program": handlers.ProgramColumnHandler,
    "program_mapped": handlers.ObjectPersonColumnHandler,
    "reference_url": handlers.TextColumnHandler,
    "related_assignees": related_person.RelatedAssigneesColumnHandler,
    "related_requesters": related_person.RelatedRequestersColumnHandler,
    "related_verifiers": related_person.RelatedVerifiersColumnHandler,
    "report_end_date": handlers.DateColumnHandler,
    "report_start_date": handlers.DateColumnHandler,
    "request": handlers.RequestColumnHandler,
    "request_audit": handlers.RequestAuditColumnHandler,
    "requested_on": handlers.DateColumnHandler,
    "response_type": handlers.ResponseTypeColumnHandler,
    "secondary_assessor": handlers.UserColumnHandler,
    "secondary_contact": handlers.UserColumnHandler,
    "slug": handlers.SlugColumnHandler,
    "start_date": handlers.DateColumnHandler,
    "status": handlers.StatusColumnHandler,
    "test_plan": handlers.TextareaColumnHandler,
    "title": handlers.RequiredTextColumnHandler,
    "url": handlers.TextColumnHandler,
    "verify_frequency": handlers.OptionColumnHandler,

    # Mapping column handlers
    "__mapping__:person": handlers.PersonMappingColumnHandler,
    "__unmapping__:person": handlers.PersonUnmappingColumnHandler,
    "control": handlers.ControlColumnHandler,
    "directive": handlers.SectionDirectiveColumnHandler,
}


def get_all_column_handlers():
  extension_handlers = _column_handlers
  for extension_module in get_extension_modules():
    contributed_handlers = getattr(
        extension_module, "contributed_column_handlers", None)
    if callable(contributed_handlers):
      extension_handlers.update(contributed_handlers())
    elif type(contributed_handlers) == dict:
      extension_handlers.update(contributed_handlers)
  return extension_handlers


COLUMN_HANDLERS = get_all_column_handlers()
