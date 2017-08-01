# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Relationship creation/modification hooks."""

import sqlalchemy as sa

from ggrc import db
from ggrc.models import all_models
from ggrc.services import signals
from ggrc.services.common import log_event


def init_hook():
  """Initialize Relationship-related hooks."""
  # pylint: disable=unused-variable

  sa.event.listen(all_models.Relationship, "before_insert",
                  all_models.Relationship.validate_attrs)
  sa.event.listen(all_models.Relationship, "before_update",
                  all_models.Relationship.validate_attrs)

  @signals.Restful.model_posted_after_commit.connect_via(
      all_models.Relationship)
  def handle_relationship_post(*args, **kwargs):
    _handle_relationship_change(*args, **kwargs)

  @signals.Restful.model_deleted_after_commit.connect_via(
      all_models.Relationship)
  def handle_relationship_delete(*args, **kwargs):
    _handle_relationship_change(*args, **kwargs)

  def _handle_relationship_change(
      obj_type,
      obj=None,
      src=None,
      service=None,
      event=None
  ):
    """Handle a change to a Relationship instance (creation/removal).

    If the Relationship represents a link between an object and a Document,
    a new revision for that object is created.

    Args:
      obj_type: type(relationship)
      obj: Relationship instance that was created/destroyed.
      src: dictionary containing raw Relationship data sent with client request
      service: instance of the service that handled the client request
      event: ggrc.models.event.Event instance representing the event that has
             occurred (e.g. object modified)

    Returns:
      None
    """
    # pylint: disable=unused-argument
    doc_parent = None

    if obj.source_type == 'Document':
      doc_parent = obj.destination
    elif obj.destination_type == 'Document':
      doc_parent = obj.source

    if not doc_parent:
      return

    log_event(db.session, doc_parent, force_obj=True)
