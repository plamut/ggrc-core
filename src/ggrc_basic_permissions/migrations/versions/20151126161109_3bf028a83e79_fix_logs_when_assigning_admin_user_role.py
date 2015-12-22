# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: anze@reciprocitylabs.com
# Maintained By: anze@reciprocitylabs.com

"""Fix logs when assigning admin user role

Revision ID: 3bf028a83e79
Revises: 99925466d6e
Create Date: 2015-11-26 16:11:09.404029

"""

import json
from alembic import op
from sqlalchemy.sql import table, column
from sqlalchemy.sql.expression import and_
from sqlalchemy.sql.expression import outerjoin
from sqlalchemy.sql.expression import select
from ggrc.app import app

# revision identifiers, used by Alembic.
revision = '3bf028a83e79'
down_revision = '99925466d6e'

revisions_table = table(
    'revisions',
    column('id'),
    column('resource_id'),
    column('resource_type'),
    column('action'),
    column('content'),
)

user_role = table(
    'user_roles',
    column('id'),
    column('person_id'),
)

people_table = table(
    'people',
    column('id'),
    column('email'),
)

user_role_join = outerjoin(
    revisions_table, user_role,
    revisions_table.columns.resource_id == user_role.columns.id)


def upgrade():
  connection = op.get_bind()
  revisions = connection.execute(
      select([revisions_table, user_role]).select_from(user_role_join).where(
          and_(revisions_table.columns.resource_type == 'UserRole',
               revisions_table.columns.content.like('%"display_name": ""%'))
      )).fetchall()

  for (_id, resource_id, _, action, content,
       _, user_role_person_id) in revisions:
    person_id = None
    content = json.loads(content)
    if action == 'deleted':
      # Deleted revisions have the person_id in the content column
      person_id = content.get('person_id', None)
    elif action == 'created':
      if user_role_person_id:
        # If the user_role was not deleted we can use it's person_id
        person_id = user_role_person_id
      else:
        # If the user role was deleted we need to get the person_id from the
        # delete revision
        rev_result = connection.execute(revisions_table.select(
            revisions_table).where(and_(
                revisions_table.columns.action == 'deleted',
                revisions_table.columns.resource_type == 'UserRole',
                revisions_table.columns.resource_id == resource_id)
        )).fetchone()
        if rev_result:
          rev_content = json.loads(rev_result[4])
          person_id = rev_content.get('person_id', None)

    people_result = connection.execute(people_table.select().where(
        people_table.columns.id == person_id
    )).fetchone()
    if people_result:
      (_, email) = people_result
    else:
      # This is in case the person was deleted from the app and we now have
      # no way of getting the email address. This is highly unlikely,
      # since we don't allow deleting people from the frontend.
      app.logger.warning(
          "No person for revision {}, `unknown` will be used".format(_id)
      )
      email = 'unknown'
    content['display_name'] = '{} <-> gGRC Admin'.format(email)
    connection.execute(
        revisions_table.update().values(content=json.dumps(content)).where(
            revisions_table.columns.id == _id
        )
    )


def downgrade():
  pass
