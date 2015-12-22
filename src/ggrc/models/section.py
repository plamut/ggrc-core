# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: vraj@reciprocitylabs.com

from ggrc import db
from ggrc.models.directive import Directive
from ggrc.models.mixins import CustomAttributable
from ggrc.models.mixins import Described
from ggrc.models.mixins import Hierarchical
from ggrc.models.mixins import Hyperlinked
from ggrc.models.mixins import Noted
from ggrc.models.mixins import Slugged
from ggrc.models.mixins import Stateful
from ggrc.models.mixins import Titled
from ggrc.models.mixins import WithContact
from ggrc.models.mixins import deferred
from ggrc.models.object_document import Documentable
from ggrc.models.object_owner import Ownable
from ggrc.models.object_person import Personable
from ggrc.models.reflection import AttributeInfo
from ggrc.models.relationship import Relatable
from ggrc.models.relationship import Relationship
from ggrc.models.track_object_state import HasObjectState
from ggrc.models.track_object_state import track_state_for_class


class Section(HasObjectState, Hierarchical, Noted, Described, Hyperlinked,
              WithContact, Titled, Slugged, Stateful, db.Model,
              CustomAttributable, Documentable, Personable,
              Ownable, Relatable):
  VALID_STATES = [
      'Draft',
      'Final',
      'Effective',
      'Ineffective',
      'Launched',
      'Not Launched',
      'In Scope',
      'Not in Scope',
      'Deprecated',
  ]
  __tablename__ = 'sections'
  _table_plural = 'sections'
  _title_uniqueness = True
  _aliases = {
      "url": "Section URL",
      "description": "Text of Section",
      "directive": {
          "display_name": "Policy / Regulation / Standard / Contract",
          "type": AttributeInfo.Type.MAPPING,
          "filter_by": "_filter_by_directive",
      }
  }

  na = deferred(db.Column(db.Boolean, default=False, nullable=False),
                'Section')
  notes = deferred(db.Column(db.Text), 'Section')

  _publish_attrs = [
      'na',
      'notes',
  ]
  _sanitize_html = ['notes']
  _include_links = []

  @classmethod
  def _filter_by_directive(cls, predicate):
    types = ["Policy", "Regulation", "Standard", "Contract"]
    dst = Relationship.query \
        .filter(
            (Relationship.source_id == cls.id) &
            (Relationship.source_type == cls.__name__) &
            (Relationship.destination_type.in_(types))) \
        .join(Directive, Directive.id == Relationship.destination_id) \
        .filter(predicate(Directive.slug) | predicate(Directive.title)) \
        .exists()
    src = Relationship.query \
        .filter(
            (Relationship.destination_id == cls.id) &
            (Relationship.destination_type == cls.__name__) &
            (Relationship.source_type.in_(types))) \
        .join(Directive, Directive.id == Relationship.source_id) \
        .filter(predicate(Directive.slug) | predicate(Directive.title)) \
        .exists()
    return dst | src


track_state_for_class(Section)
