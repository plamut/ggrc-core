
"""Add final state to request status and rename Unstarted to Open

Revision ID: 297131e22e28
Revises: 18cbdd3a7fd9
Create Date: 2015-12-03 15:31:39.979333

"""

# revision identifiers, used by Alembic.
revision = '297131e22e28'
down_revision = '504f541411a5'

from alembic import op


def upgrade():
  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Unstarted","In Progress","Finished","Verified","Open","Final") NOT NULL;""")
  op.execute("""UPDATE requests SET status="Open" WHERE status="Unstarted";""")
  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Open","In Progress","Finished","Verified","Final") NOT NULL;""")


def downgrade():
  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Open","In Progress","Finished","Verified","Final","Unstarted") NOT NULL;""")
  op.execute("""UPDATE requests SET status="Unstarted" WHERE status="Open";""")
  op.execute("""UPDATE requests SET status="Finished" WHERE status="Final";""")
  op.execute("""ALTER TABLE requests CHANGE status status ENUM("Unstarted","In Progress","Finished","Verified") NOT NULL;""")
