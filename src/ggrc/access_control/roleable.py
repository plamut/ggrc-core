# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Roleable model"""

from sqlalchemy import orm
from sqlalchemy.ext.declarative import declared_attr
from ggrc import db


class Roleable(object):
  """Roleable"""

  _include_links = _publish_attrs = [
      'access_control_list'
  ]

  @declared_attr
  def access_control_list(self):
    """access_control_list"""
    joinstr = 'and_(remote(AccessControlList.object_id) == {type}.id, '\
        'remote(AccessControlList.object_type) == "{type}")'
    joinstr = joinstr.format(type=self.__name__)
    return db.relationship(
        'AccessControlList',
        primaryjoin=joinstr,
        foreign_keys='AccessControlList.object_id',
        backref='{0}_access_control_list'.format(self.__name__),
        cascade='all, delete-orphan')

  @classmethod
  def eager_query(cls):
    """Eager Query"""
    query = super(Roleable, cls).eager_query()
    return cls.eager_inclusions(query, Roleable._include_links).options(
        orm.subqueryload('access_control_list'))

  def log_json(self):
    """Log custom attribute values."""
    # pylint: disable=not-an-iterable
    res = super(Roleable, self).log_json()
    res["access_control_list"] = [
        value.log_json() for value in self.access_control_list]
    return res
