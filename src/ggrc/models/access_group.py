# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

from ggrc import db
from ggrc.access_control.roleable import Roleable
from ggrc.models.mixins import BusinessObject, Timeboxed, CustomAttributable
from ggrc.models.object_owner import Ownable
from ggrc.models.object_person import Personable
from ggrc.models.relationship import Relatable
from ggrc.models.track_object_state import HasObjectState
from ggrc.fulltext.mixin import Indexed


class AccessGroup(Roleable, HasObjectState,
                  CustomAttributable, Personable, Relatable,
                  Timeboxed, Ownable, BusinessObject, Indexed, db.Model):
    __tablename__ = 'access_groups'

    _aliases = {"url": "Access Group URL"}
