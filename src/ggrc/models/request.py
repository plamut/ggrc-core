# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com

import datetime

from ggrc import db
from sqlalchemy import or_
from sqlalchemy import and_
from sqlalchemy import inspect
from sqlalchemy import orm


from ggrc.models import person
from ggrc.models import audit
from ggrc.models import reflection
from ggrc.models.mixins import Assignable
from ggrc.models.mixins import Base
from ggrc.models.mixins import CustomAttributable
from ggrc.models.mixins import deferred
from ggrc.models.mixins import Described
from ggrc.models.mixins import Slugged
from ggrc.models.mixins import Titled
from ggrc.models.object_document import Documentable
from ggrc.models.object_document import ObjectDocument
from ggrc.models.object_person import Personable
from ggrc.models.relationship import Relatable
from ggrc.models import relationship
from ggrc.services.common import Resource


class Request(Assignable, Documentable, Personable, CustomAttributable,
              Relatable, Titled, Slugged, Described, Base, db.Model):
  __tablename__ = 'requests'
  _title_uniqueness = False

  VALID_TYPES = (u'documentation', u'interview')
  VALID_STATES = (u'Open', u'In Progress', u'Finished', u'Verified', u'Final')
  ASSIGNEE_TYPES = (u'Assignee', u'Requester', u'Verifier')

  # TODO Remove requestor and requestor_id on database cleanup
  requestor_id = db.Column(db.Integer, db.ForeignKey('people.id'))
  requestor = db.relationship('Person', foreign_keys=[requestor_id])

  # TODO Remove request_type on database cleanup
  request_type = deferred(db.Column(db.Enum(*VALID_TYPES), nullable=False),
                          'Request')
  # TODO Make status via Stateful Mixin
  status = deferred(db.Column(db.Enum(*VALID_STATES), nullable=False),
                    'Request')
  requested_on = deferred(db.Column(db.Date, nullable=False), 'Request')
  due_on = deferred(db.Column(db.Date, nullable=False), 'Request')
  # TODO Remove audit_id audit_object_id on database cleanup
  audit_id = db.Column(db.Integer, db.ForeignKey('audits.id'), nullable=True)
  audit_object_id = db.Column(db.Integer, db.ForeignKey('audit_objects.id'),
                              nullable=True)
  gdrive_upload_path = deferred(db.Column(db.String, nullable=True),
                                'Request')
  # TODO Remove test and notes columns on database cleanup
  test = deferred(db.Column(db.Text, nullable=True), 'Request')
  notes = deferred(db.Column(db.Text, nullable=True), 'Request')
  # TODO Remove responses on database cleanup
  responses = db.relationship('Response', backref='request',
                              cascade='all, delete-orphan')

  _publish_attrs = [
      'requestor',
      'request_type',
      'gdrive_upload_path',
      'requested_on',
      'due_on',
      'status',
      'audit',
      'test',
      'notes',
      'title',
      'description'
  ]
  _sanitize_html = [
      'gdrive_upload_path',
      'test',
      'notes',
      'description',
      'title'
  ]

  _aliases = {
      "request_audit": {
          "display_name": "Audit",
          "filter_by": "_filter_by_request_audit",
          "mandatory": True,
      },
      "due_on": "Due On",
      "notes": "Notes",
      "request_type": "Request Type",
      "requested_on": "Requested On",
      "status": "Status",
      "test": "Test",
      "related_assignees": {
          "display_name": "Assignee",
          "mandatory": True,
          "filter_by": "_filter_by_related_assignees",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
      "related_requesters": {
          "display_name": "Requester",
          "mandatory": True,
          "filter_by": "_filter_by_related_requesters",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
      "related_verifiers": {
          "display_name": "Verifier",
          "filter_by": "_filter_by_related_verifiers",
          "type": reflection.AttributeInfo.Type.MAPPING,
      },
  }

  def _display_name(self):
    if len(self.title) > 32:
      display_string = self.description[:32] + u'...'
    elif self.title:
      display_string = self.title
    elif len(self.description) > 32:
      display_string = self.description[:32] + u'...'
    else:
      display_string = self.description
    return u'Request with id {0} "{1}" for Audit "{2}"'.format(
        self.id,
        display_string,
        self.audit.display_name
    )

  @classmethod
  def eager_query(cls):
    query = super(Request, cls).eager_query()
    return query.options(
        orm.joinedload('audit'),
        orm.subqueryload('responses'))

  @classmethod
  def _get_relate_filter(cls, predicate, related_type):
    Rel = relationship.Relationship
    RelAttr = relationship.RelationshipAttr
    Person = person.Person
    return db.session.query(Rel).join(RelAttr).join(
        Person,
        or_(and_(
            Rel.source_id == Person.id,
            Rel.source_type == Person.__name__
        ), and_(
            Rel.destination_id == Person.id,
            Rel.destination_type == Person.__name__
        ))
    ).filter(and_(
        RelAttr.attr_value.contains(related_type),
        RelAttr.attr_name == "AssigneeType",
        or_(predicate(Person.name), predicate(Person.email))
    )).exists()

  @classmethod
  def _filter_by_related_assignees(cls, predicate):
    return cls._get_relate_filter(predicate, "Assignee")

  @classmethod
  def _filter_by_related_requesters(cls, predicate):
    return cls._get_relate_filter(predicate, "Requester")

  @classmethod
  def _filter_by_related_verifiers(cls, predicate):
    return cls._get_relate_filter(predicate, "Verifier")

  @classmethod
  def _filter_by_request_audit(cls, predicate):
    return cls.query.filter(
        (audit.Audit.id == cls.audit_id) &
        (predicate(audit.Audit.slug) | predicate(audit.Audit.title))
    ).exists()


def _date_has_changes(attr):
  """Date fields are always interpreted as changed because incoming data is
    of type datetime.datetime, while database field has type datetime.date.
    This function normalises this and performs the correct check.
  """
  added, deleted = attr.history.added[0], attr.history.deleted[0]
  if isinstance(added, datetime.datetime):
    added = added.date()
  return not added == deleted


@Resource.model_put.connect_via(Request)
def handle_request_put(sender, obj=None, src=None, service=None):
  all_attrs = set(Request._publish_attrs)
  non_tracked_attrs = {'status'}
  tracked_date_attrs = {'requested_on', 'due_on'}
  tracked_attrs = all_attrs - non_tracked_attrs - tracked_date_attrs
  has_changes = False

  if any(getattr(inspect(obj).attrs, attr).history.has_changes()
         for attr in tracked_attrs):
    has_changes = True

  if any(_date_has_changes(getattr(inspect(obj).attrs, attr))
         for attr in tracked_date_attrs):
    has_changes = True

  if has_changes and obj.status in {"Open", "Final", "Verified"}:
    obj.status = "In Progress"


@Resource.model_posted.connect_via(relationship.Relationship)
def handle_relationship_post(sender, obj=None, src=None, service=None):
  has_changes = False
  if "Request" in (obj.source.type, obj.destination.type):
    if obj.source.type == "Request":
      req = obj.source
    else:
      req = obj.destination

    if "Document" in (obj.source.type, obj.destination.type):
      # This captures the "Add URL" event
      has_changes = True

    if "Person" in (obj.source.type, obj.destination.type):
      # This captures assignable addition
      history = inspect(obj).attrs.relationship_attrs.history
      if history.has_changes() and req.status in {"Final", "Verified"}:
        has_changes = True

    if has_changes and req.status in {"Open", "Final", "Verified"}:
      req.status = "In Progress"
      db.session.add(req)


@Resource.model_posted.connect_via(ObjectDocument)
def handle_objectdocument_post(sender, obj=None, src=None, service=None):
  # This captures "Attach Evidence" event
  if obj.documentable.type == "Request":
    req = obj.documentable
    if req.status in {"Open", "Final", "Verified"}:
      req.status = "In Progress"
      db.session.add(req)
