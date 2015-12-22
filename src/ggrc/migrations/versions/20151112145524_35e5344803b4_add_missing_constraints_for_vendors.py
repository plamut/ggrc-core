# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: anze@reciprocitylabs.com
# Maintained By: anze@reciprocitylabs.com

"""Add missing constraints for vendors

Revision ID: 35e5344803b4
Revises: 27684e5f313a
Create Date: 2015-11-12 14:55:24.420680
"""

from alembic import op
from ggrc.migrations.utils import resolve_duplicates
from ggrc.models import Vendor

# revision identifiers, used by Alembic.
revision = '35e5344803b4'
down_revision = '27684e5f313a'


def upgrade():
  resolve_duplicates(Vendor, "slug")
  op.create_unique_constraint('uq_slug_vendors', 'vendors', ['slug'])


def downgrade():
  op.drop_constraint('uq_slug_vendors', 'vendors', 'unique')
