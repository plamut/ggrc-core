# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Access Control List model"""

from ggrc import db
from ggrc.models import mixins


class AccessControlList(mixins.Base, db.Model):
  """Access Control List"""
  __tablename__ = 'access_control_list'

  person_id = db.Column(db.Integer, db.ForeignKey('people.id'), nullable=False)
  ac_role_id = db.Column(db.Integer, db.ForeignKey(
      'access_control_roles.id'), nullable=False)
  object_id = db.Column(db.Integer, nullable=False)
  object_type = db.Column(db.String, nullable=False)

  @property
  def object_attr(self):
    return '{0}_object'.format(self.object_type)

  @property
  def object(self):
    return getattr(self, self.object_attr)

  @object.setter
  def object(self, value):
    self.object_id = getattr(value, 'id', None)
    self.object_type = getattr(value, 'type', None)
    return setattr(self, self.object_attr, value)

  @staticmethod
  def _extra_table_args(_):
    return (
        db.UniqueConstraint(
            'person_id', 'ac_role_id', 'object_id', 'object_type'),
    )
