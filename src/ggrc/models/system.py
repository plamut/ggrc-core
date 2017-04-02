# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

from sqlalchemy.orm import validates

from ggrc import db
from ggrc.access_control.roleable import Roleable
from ggrc.fulltext.mixin import Indexed
from ggrc.models.deferred import deferred
from ggrc.models.mixins import BusinessObject, Timeboxed, CustomAttributable
from ggrc.models.object_owner import Ownable
from ggrc.models.object_person import Personable
from ggrc.models.relationship import Relatable
from ggrc.models.utils import validate_option
from ggrc.models import track_object_state


class SystemOrProcess(Roleable, track_object_state.HasObjectState, Timeboxed,
                      BusinessObject, db.Model):
  # Override model_inflector
  _table_plural = 'systems_or_processes'
  __tablename__ = 'systems'

  infrastructure = deferred(db.Column(db.Boolean), 'SystemOrProcess')
  is_biz_process = db.Column(db.Boolean, default=False)
  version = deferred(db.Column(db.String), 'SystemOrProcess')
  network_zone_id = deferred(db.Column(db.Integer), 'SystemOrProcess')
  network_zone = db.relationship(
      'Option',
      primaryjoin='and_(foreign(SystemOrProcess.network_zone_id) == Option.id,'
      ' Option.role == "network_zone")',
      uselist=False,
  )

  __mapper_args__ = {
      'polymorphic_on': is_biz_process
  }

  # REST properties
  _publish_attrs = [
      'infrastructure',
      'is_biz_process',
      'version',
      'network_zone',
  ]
  _fulltext_attrs = [
      'infrastructure',
      'version',
      'network_zone',
  ]
  _update_attrs = [
      'infrastructure',
      'version',
      'network_zone',
  ]
  _sanitize_html = ['version']
  _aliases = {
      "network_zone": {
          "display_name": "Network Zone",
      },
  }

  @validates('network_zone')
  def validate_system_options(self, key, option):
    return validate_option(
        self.__class__.__name__, key, option, 'network_zone')

  @classmethod
  def eager_query(cls):
    from sqlalchemy import orm

    query = super(SystemOrProcess, cls).eager_query()
    return query.options(
        orm.joinedload('network_zone'))

  @staticmethod
  def _extra_table_args(cls):
    return (
        db.Index('ix_{}_is_biz_process'.format(cls.__tablename__),
                 'is_biz_process'),
    )


class System(CustomAttributable, Personable,
             Relatable, Ownable, SystemOrProcess, Indexed):
  __mapper_args__ = {
      'polymorphic_identity': False
  }
  _table_plural = 'systems'

  _aliases = {"url": "System URL"}

  @validates('is_biz_process')
  def validates_is_biz_process(self, key, value):
    return False


class Process(CustomAttributable, Personable,
              Relatable, Ownable, SystemOrProcess, Indexed):
  __mapper_args__ = {
      'polymorphic_identity': True
  }
  _table_plural = 'processes'

  _aliases = {"url": "Process URL"}

  @validates('is_biz_process')
  def validates_is_biz_process(self, key, value):
    return True
