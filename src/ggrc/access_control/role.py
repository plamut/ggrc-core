# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Access Control Role model"""

from ggrc import db
from ggrc.models import mixins
from ggrc.fulltext.mixin import Indexed


class AccessControlRole(Indexed, mixins.Base, db.Model):
  """Access Control Role"""
  __tablename__ = 'access_control_roles'

  name = db.Column(db.String, nullable=False)
  object_type = db.Column(db.String)
  tooltip = db.Column(db.String)

  read = db.Column(db.Boolean, nullable=False, default=False)
  update = db.Column(db.Boolean, nullable=False, default=False)
  delete = db.Column(db.Boolean, nullable=False, default=False)
  map = db.Column(db.Boolean, nullable=False, default=False)
  view_object_page = db.Column(db.Boolean, nullable=False, default=False)
  my_work = db.Column(db.Boolean, nullable=False, default=False)

  @staticmethod
  def _extra_table_args(_):
    return (
        db.UniqueConstraint('name', 'object_type'),
    )

  @classmethod
  def eager_query(cls):
    return super(AccessControlRole, cls).eager_query()

  _publish_attrs = [
      "name",
      "object_type",
      "tooltip",
      "read",
      "update",
      "delete"
  ]
