# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: andraz@reciprocitylabs.com
# Maintained By: andraz@reciprocitylabs.com

"""Remove relationship_types

Revision ID: 1ef8f4f504ae
Revises: 3c8f204ba7a9
Create Date: 2015-10-15 12:43:37.846021

"""

# revision identifiers, used by Alembic.
revision = '1ef8f4f504ae'
down_revision = '297131e22e28'

from alembic import op
import sqlalchemy as sa


def upgrade():
  op.drop_column('relationships', 'relationship_type_id')
  op.drop_table('relationship_types')


def downgrade():
  op.create_table(
      'relationship_types',
      sa.Column('id', sa.INTEGER),
      sa.Column('modified_by_id', sa.INTEGER),
      sa.Column('created_at', sa.DATETIME),
      sa.Column('updated_at', sa.DATETIME),
      sa.Column('description', sa.TEXT),
      sa.Column('relationship_type', sa.VARCHAR(length=250)),
      sa.Column('forward_phrase', sa.VARCHAR(length=250)),
      sa.Column('backward_phrase', sa.VARCHAR(length=250)),
      sa.Column('symmetric', sa.BOOLEAN, nullable=False),
      sa.Column('context_id', sa.INTEGER),
      sa.ForeignKeyConstraint(['context_id'], [u'contexts.id'],
                              name=u'fk_relationship_types_contexts'),
      sa.PrimaryKeyConstraint('id')
  )
  op.add_column(
      'relationships',
      sa.Column('relationship_type_id', sa.String(length=250), nullable=True)
  )
