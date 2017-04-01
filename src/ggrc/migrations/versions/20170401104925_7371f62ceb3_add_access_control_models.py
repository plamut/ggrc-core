# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""
Add access control models

Create Date: 2017-04-01 10:49:25.339677
"""
# disable Invalid constant name pylint warning for mandatory Alembic variables.
# pylint: disable=invalid-name

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = '7371f62ceb3'
down_revision = '2127ea770285'


def upgrade():
  """Upgrade database schema and/or data, creating a new revision."""
  op.create_table(
      'access_control_roles',
      sa.Column('id', sa.Integer(), nullable=False),
      sa.Column('name', sa.String(length=250), nullable=False),
      sa.Column('object_type', sa.String(length=250), nullable=True),
      sa.Column('tooltip', sa.String(length=250), nullable=True),
      sa.Column('read', sa.Boolean(), nullable=False, server_default="0"),
      sa.Column('update', sa.Boolean(), nullable=False, server_default="0"),
      sa.Column('delete', sa.Boolean(), nullable=False, server_default="0"),
      sa.Column('map', sa.Boolean(), nullable=False, server_default="0"),
      sa.Column('view_object_page', sa.Boolean(),
                nullable=False, server_default="0"),
      sa.Column('my_work', sa.Boolean(), nullable=False, server_default="0"),
      sa.Column('created_at', sa.DateTime(), nullable=False),
      sa.Column('modified_by_id', sa.Integer(), nullable=True),
      sa.Column('updated_at', sa.DateTime(), nullable=False),
      sa.Column('context_id', sa.Integer(), nullable=True),
      sa.ForeignKeyConstraint(['context_id'], ['contexts.id'], ),
      sa.PrimaryKeyConstraint('id'),
      sa.UniqueConstraint('name', 'object_type')
  )
  op.create_index(
      'fk_access_control_roles_contexts',
      'access_control_roles',
      ['context_id'],
      unique=False)
  op.create_index(
      'ix_access_control_roles_updated_at',
      'access_control_roles',
      ['updated_at'],
      unique=False)
  op.create_table(
      'access_control_list',
      sa.Column('id', sa.Integer(), nullable=False),
      sa.Column('person_id', sa.Integer(), nullable=False),
      sa.Column('ac_role_id', sa.Integer(), nullable=False),
      sa.Column('object_id', sa.Integer(), nullable=False),
      sa.Column('object_type', sa.String(length=250), nullable=False),
      sa.Column('created_at', sa.DateTime(), nullable=False),
      sa.Column('modified_by_id', sa.Integer(), nullable=True),
      sa.Column('updated_at', sa.DateTime(), nullable=False),
      sa.Column('context_id', sa.Integer(), nullable=True),
      sa.ForeignKeyConstraint(['ac_role_id'], ['access_control_roles.id'], ),
      sa.ForeignKeyConstraint(['context_id'], ['contexts.id'], ),
      sa.ForeignKeyConstraint(['person_id'], ['people.id'], ),
      sa.PrimaryKeyConstraint('id'),
      sa.UniqueConstraint(
          'person_id', 'ac_role_id', 'object_id', 'object_type')
  )
  op.create_index(
      'fk_access_control_list_contexts',
      'access_control_list',
      ['context_id'],
      unique=False)
  op.create_index(
      'ix_access_control_list_updated_at',
      'access_control_list',
      ['updated_at'],
      unique=False)


def downgrade():
  """Downgrade database schema and/or data back to the previous revision."""
  op.drop_table('access_control_list')
  op.drop_table('access_control_roles')
