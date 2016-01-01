# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

"""Delete background tasks

Revision ID: 5410607088f9
Revises: 1ef8f4f504ae
Create Date: 2015-12-16 13:20:37.341342

"""

# pylint: disable=C0103,E1101

from alembic import op

# revision identifiers, used by Alembic.
revision = '5410607088f9'
down_revision = '1ef8f4f504ae'


def upgrade():
  """Remove all entries from background_tasks"""
  op.execute("truncate background_tasks")


def downgrade():
  """Remove all entries from background_tasks"""
  op.execute("truncate background_tasks")
