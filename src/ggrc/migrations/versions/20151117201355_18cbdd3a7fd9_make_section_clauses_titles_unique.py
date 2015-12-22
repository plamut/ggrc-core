# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: urban@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com

"""Make section and clause titles unique

Revision ID: 18cbdd3a7fd9
Revises: 27684e5f313a
Create Date: 2015-11-17 20:13:55.593299

"""

# revision identifiers, used by Alembic.
revision = '18cbdd3a7fd9'
down_revision = '3c1619ff36e8'

from alembic import op

from ggrc.models.clause import Clause
from ggrc.models.section import Section
from ggrc.migrations.utils import resolve_duplicates


def upgrade():
  resolve_duplicates(Section, 'title', " ")
  resolve_duplicates(Clause, 'title', " ")

  op.create_unique_constraint('uq_t_sections', 'sections', ['title'])
  op.create_unique_constraint('uq_t_clauses', 'clauses', ['title'])


def downgrade():
  op.drop_constraint('uq_t_sections', 'sections', 'unique')
  op.drop_constraint('uq_t_clauses', 'clauses', 'unique')
