# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: urban@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com

"""Make Request First-class object

Revision ID: 27684e5f313a
Revises: 3c8f204ba7a9
Create Date: 2015-10-16 17:48:06.875436

"""

# revision identifiers, used by Alembic.
revision = '27684e5f313a'
down_revision = '1bad7fe16295'

from alembic import op
import bleach
from HTMLParser import HTMLParser
import sqlalchemy.exc as sqlaexceptions
import sqlalchemy.types as types


from ggrc import db
from ggrc.models import Comment
from ggrc.models import DocumentationResponse
from ggrc.models import InterviewResponse
from ggrc.models import Relationship
from ggrc.models import Request


def cleaner(value, bleach_tags=[], bleach_attrs={}):
  if value is None:
    return value

  parser = HTMLParser()
  lastvalue = value
  value = parser.unescape(value)
  while value != lastvalue:
    lastvalue = value
    value = parser.unescape(value)

  ret = parser.unescape(
      bleach.clean(value, bleach_tags, bleach_attrs, strip=True)
  )
  return ret


def upgrade():
  # 1. Move Audit Objects to Relationship table
  #   source_type = audit_objects.auditable_type
  #   source_id = audit_objects.auditable_id
  #   destination_type = "Request"
  #   destination_id = request.id
  op.execute("""
    INSERT INTO relationships (
      modified_by_id,
      created_at,
      updated_at,
      source_id,
      source_type,
      destination_id,
      destination_type,
      context_id) SELECT
        AO.modified_by_id,
        NOW(),
        NOW(),
        AO.auditable_id,
        AO.auditable_type,
        R.id,
        "Request",
        AO.context_id
      FROM requests AS R, audit_objects AS AO WHERE AO.id = R.audit_object_id;
    """)

  # 2. Change status values
  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Draft","Requested","Responded","Amended Request","Updated Response","Accepted","Unstarted","In Progress","Finished","Verified") NOT NULL;""")
  op.execute("""UPDATE requests SET status="Unstarted" WHERE status="Draft";""")
  op.execute("""UPDATE requests SET status="In Progress" WHERE status="Requested";""")
  op.execute("""UPDATE requests SET status="Finished" WHERE status="Responded";""")
  op.execute("""UPDATE requests SET status="In Progress" WHERE status="Amended Request";""")
  op.execute("""UPDATE requests SET status="Finished" WHERE status="Updated Response";""")
  op.execute("""UPDATE requests SET status="Verified" WHERE status="Accepted";""")

  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Unstarted","In Progress","Finished","Verified") NOT NULL;""")

  # Drop foreign key relationship on assignee_id
  try:
    op.drop_constraint("requests_ibfk_1", "requests", type_="foreignkey")
  except sqlaexceptions.OperationalError as oe:
    # Ignores error in case constraint no longer exists
    error_code, _ = oe.orig.args  # error_code, message
    if error_code != 1025:
      raise oe

  # Drop index on assignee_id
  try:
    op.drop_index("assignee_id", "requests")
  except sqlaexceptions.OperationalError as oe:
    # Ignores error in case index no longer exists
    error_code, _ = oe.orig.args  # error_code, message
    if error_code != 1091:
      raise oe

  # Make assignee_id nullable
  op.alter_column("requests", "assignee_id",
                  existing_nullable=False, nullable=True, type_=types.Integer)

  # 4. Make pretty title
  requests = db.session.query(Request)
  for request in requests:
    cleaned_desc = cleaner(request.description)
    request.title = cleaned_desc[:60]
    db.session.add(request)
  db.session.commit()

  # Remove unneeded attributes
  # sql = "BEGIN;"
  # # 3. Drop FK audit_objects_id from Request
  # sql += """
  # ALTER TABLE requests DROP FOREIGN KEY requests_audit_objects_ibfk;
  # DROP INDEX requests_audit_objects_ibfk ON requests;
  # ALTER TABLE requests DROP COLUMN audit_object_id;
  # """
  # # 4. Drop audit_id from Request
  # sql += """
  # ALTER TABLE requests DROP FOREIGN KEY requests_ibfk_2;
  # ALTER TABLE requests DROP COLUMN audit_id;
  # """
  # sql += "COMMIT;"
  # op.execute(sql)

  # TODO: drop requests table from audits

  # TODO: 5. Link all objects that are mapped to Audit to requests

  # TODO: Drop relationship audit_objects from Audits????

  # 5. Migrate responses to comments
  documentation_responses = db.session.query(DocumentationResponse)
  for dr in documentation_responses:
    related = dr.related_sources + dr.related_destinations
    comment = Comment(
        description=dr.description,
        created_at=dr.created_at,
        modified_by=dr.modified_by,
        updated_at=dr.updated_at,
        context=dr.context)

    request_comment_rel = Relationship(
        source=dr.request,
        destination=comment)

    for rel in related:
      if not rel.source or not rel.destination:
        continue
      if rel.source.type == "DocumentationResponse":
        destination = rel.destination
      elif rel.destination.type == "DocumentationResponse":
        destination = rel.source
      else:
        continue
      related_objects_to_request = Relationship(
          source=dr.request,
          destination=destination
      )
      db.session.add(related_objects_to_request)
    db.session.add(comment)
    db.session.add(request_comment_rel)
  db.session.commit()

  interview_responses = db.session.query(InterviewResponse)
  for ir in interview_responses:
    related = ir.related_sources + ir.related_destinations

    desc = ir.description
    if ir.meetings:
      desc += "<br /><br /><b>Meetings</b><hr />"

      for m in ir.meetings:
        desc += "<a href=\"{url}\">Meeting</a> requested on {date}<br />". \
            format(url=m.title,
                   date=m.created_at.strftime("%m/%d/%Y at %H:%M"))

    if ir.people:
      desc += "<br /><br /><b>Attendees</b><hr />"
      for p in ir.people:
        desc += "- {} ({})<br />".format(p.name, p.email)

    comment = Comment(
        description=desc,
        created_at=ir.created_at,
        modified_by=ir.modified_by,
        updated_at=ir.updated_at,
        context=ir.context)

    request_comment_rel = Relationship(
        source=ir.request,
        destination=comment)

    for rel in related:
      if not rel.source or not rel.destination:
        continue
      if rel.source.type == "InterviewResponse":
        destination = rel.destination
      elif rel.destination.type == "InterviewResponse":
        destination = rel.source
      else:
        continue
      related_objects_to_request = Relationship(
          source=ir.request,
          destination=destination)
      db.session.add(related_objects_to_request)
    db.session.add(comment)
    db.session.add(request_comment_rel)
  db.session.commit()


def downgrade():
  pass
