# Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

"""
Add comment notification type

Create Date: 2016-03-21 01:13:53.293580
"""
# disable Invalid constant name pylint warning for mandatory Alembic variables.
# pylint: disable=invalid-name

import sqlalchemy as sa
from sqlalchemy.sql import column
from sqlalchemy.sql import table
from alembic import op


# revision identifiers, used by Alembic.
revision = '3914dbf78dc1'
down_revision = '50c374901d42'


NOTIFICATION_TYPES = table(
    'notification_types',
    column('id', sa.Integer),
    column('name', sa.String),
    column('description', sa.Text),
    column('template', sa.String),
    column('instant', sa.Boolean),
    column('advance_notice', sa.Integer),
    column('advance_notice_end', sa.Integer),
    column('created_at', sa.DateTime),
    column('modified_by_id', sa.Integer),
    column('updated_at', sa.DateTime),
    column('context_id', sa.Integer),
)

NOTIFICATIONS = [{
    "name": "comment_created",
    "description": "Notify selected users that a comment has been created",
    "template": "comment_created",
    "advance_notice": 0,
    "instant": False,
}]


def upgrade():
  """Add notification type entries for requests and assessments."""
  op.bulk_insert(NOTIFICATION_TYPES, NOTIFICATIONS)


def downgrade():
  """Remove notification type entries for requests and assessments."""
  notification_names = tuple(notif["name"] for notif in NOTIFICATIONS)
  op.execute(
      """
      DELETE n
      FROM notifications AS n
      LEFT JOIN notification_types AS nt
        ON n.notification_type_id = nt.id
      WHERE nt.name IN ({})
      """.format(", ".join(notification_names))
  )
  op.execute(
      NOTIFICATION_TYPES.delete().where(
          NOTIFICATION_TYPES.c.name.in_(notification_names)
      )
  )
