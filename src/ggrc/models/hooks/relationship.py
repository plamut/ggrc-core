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
  def handle_relationship_post(
      obj_type, obj=None, src=None, service=None, event=None
  ):
    """TODO docstring... better param names"""
    # pylint: disable=unused-argument
    doc_parent = None

    if obj.source_type == 'Document':
      doc_parent = obj.destination
    elif obj.destination_type == 'Document':
      doc_parent = obj.source

    if not doc_parent:
      return

    # TODO: only for revisionable objects?

    log_event(db.session, doc_parent, force_obj=True)
    # TODO: anything to do with event returned by log_event?

    return

  @signals.Restful.model_deleted_after_commit.connect_via(
      all_models.Relationship)
  def handle_relationship_delete(obj_type, obj=None, service=None, event=None):
    """TODO docstring... better param names"""
    # pylint: disable=unused-argument
    doc_parent = None

    # TODO: examine args
    if obj.source_type == 'Document':
      doc_parent = obj.destination
    elif obj.destination_type == 'Document':
      doc_parent = obj.source

    if not doc_parent:
      return

    # TODO: only for revisionable objects?

    log_event(db.session, doc_parent, force_obj=True)
    # TODO: anything to do with event returned by log_event?

    return
