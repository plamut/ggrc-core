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
import datetime
from HTMLParser import HTMLParser
import sqlalchemy.exc as sqlaexceptions
import sqlalchemy.types as types
from sqlalchemy.sql import column
from sqlalchemy.sql import table


from ggrc import db
from ggrc.models import DocumentationResponse
from ggrc.models import InterviewResponse
from ggrc.models import Request


relationships_table = table(
    'relationships',
    column('id'),
    column('source_id'),
    column('source_type'),
    column('destination_id'),
    column('destination_type'),
    column('context_id'),
    column('modified_by_id'),
    column('updated_at'),
    column('created_at'),
)


comments_table = table(
    'comments',
    column('id'),
    column('description'),
    column('created_at'),
    column('modified_by_id'),
    column('updated_at'),
    column('context_id')
)


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


def _get_max_comment_id(connection):
  max_comment_id = connection.execute("SELECT max(id) FROM comments")\
    .fetchone().values()[0]
  if max_comment_id:
    return max_comment_id
  else:
    return 0


def _build_comment(iid,
                   description,
                   created_at,
                   modified_by,
                   updated_at,
                   context,
                   request_id):
  context_id = context.id if context else None
  return {
      "id": iid,
      "description": description,
      "created_at": created_at,
      "modified_by_id": modified_by.id,
      "updated_at": updated_at,
      "context_id": context_id,
      "request_id": request_id,
  }


def _build_request_comment_relationship(req_id,
                                        comm_id,
                                        context_id,
                                        modified_by_id):
  return {
      "source_type": "Request",
      "source_id": req_id,
      "destination_type": "Comment",
      "destination_id": comm_id,
      "context_id": context_id,
      "modified_by_id": modified_by_id,
      "updated_at": datetime.datetime.now(),
      "created_at": datetime.datetime.now()
  }


def _build_request_object_relationship(req, dest):
  relationship = {
      "source_type": "Request",
      "source_id": req.id,
      "destination_type": dest.type,
      "destination_id": dest.id,
      "context_id": req.context.id if req.context else None,
      "updated_at": datetime.datetime.now(),
      "created_at": datetime.datetime.now()
  }
  identifier = (
      'Request',
      relationship['source_id'],
      relationship['destination_type'],
      relationship['destination_id'],
  )
  return (identifier, relationship)


def migrate_documentation_responses(conn):
  documentation_responses = db.session.query(DocumentationResponse)
  comments = []
  comm_relationships = []
  request_object_relationships = {}

  comment_id = _get_max_comment_id(conn) + 1
  for i, dr in enumerate(documentation_responses):
    related = dr.related_sources + dr.related_destinations
    comments += [_build_comment(
        comment_id + i,
        dr.description,
        dr.created_at,
        dr.modified_by,
        dr.updated_at,
        dr.context,
        dr.request.id)]

    for rel in related:
      if not rel.source or not rel.destination:
        continue
      if rel.source.type == "DocumentationResponse":
        destination = rel.destination
      elif rel.destination.type == "DocumentationResponse":
        destination = rel.source
      else:
        continue

      relationship_id, built_relationship = _build_request_object_relationship(
          dr.request,
          destination
      )
      request_object_relationships[relationship_id] = built_relationship

  for comm in comments:
    comm_relationships += [
        _build_request_comment_relationship(comm["request_id"],
                                            comm["id"],
                                            comm["context_id"],
                                            comm["modified_by_id"])]

  op.bulk_insert(comments_table, comments)
  op.bulk_insert(relationships_table, comm_relationships)
  op.bulk_insert(relationships_table, request_object_relationships.values())


def migrate_interview_responses(conn):
  interview_responses = db.session.query(InterviewResponse)
  comments = []
  comm_relationships = []
  request_object_relationships = {}

  comment_id = _get_max_comment_id(conn) + 1
  for i, ir in enumerate(interview_responses):
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

    comments += [_build_comment(
        comment_id + i,
        desc,
        ir.created_at,
        ir.modified_by,
        ir.updated_at,
        ir.context,
        ir.request.id)]

    for rel in related:
      if not rel.source or not rel.destination:
        continue
      if rel.source.type == "InterviewResponse":
        destination = rel.destination
      elif rel.destination.type == "InterviewResponse":
        destination = rel.source
      else:
        continue

      relationship_id, built_relationship = _build_request_object_relationship(
          ir.request,
          destination
      )
      request_object_relationships[relationship_id] = built_relationship

  for comm in comments:
    comm_relationships += [
        _build_request_comment_relationship(comm["request_id"],
                                            comm["id"],
                                            comm["context_id"],
                                            comm["modified_by_id"])]

  op.bulk_insert(comments_table, comments)
  op.bulk_insert(relationships_table, comm_relationships)
  op.bulk_insert(relationships_table, request_object_relationships.values())


def upgrade():
  connection = op.get_bind()

  # 1. Move Audit Objects to Relationship table
  #   source_type = audit_objects.auditable_type
  #   source_id = audit_objects.auditable_id
  #   destination_type = "Request"
  #   destination_id = request.id
  op.execute("""
    INSERT IGNORE INTO relationships (
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

  # 5. Migrate documentation responses to comments
  migrate_documentation_responses(connection)

  # 6. Migrate interview responses to comments
  migrate_interview_responses(connection)


def downgrade():
  pass
