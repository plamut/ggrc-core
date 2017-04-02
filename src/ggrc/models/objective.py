# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

from ggrc import db
from ggrc.access_control.roleable import Roleable
from ggrc.fulltext.mixin import Indexed
from .mixins import BusinessObject, CustomAttributable
from .object_owner import Ownable
from .object_person import Personable
from .audit_object import Auditable
from .track_object_state import HasObjectState
from .relationship import Relatable


class Objective(Roleable, HasObjectState, CustomAttributable, Auditable,
                Relatable, Personable, Ownable, BusinessObject, Indexed,
                db.Model):
  __tablename__ = 'objectives'
  _publish_attrs = []
  _include_links = []
  _aliases = {"url": "Objective URL"}
