# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com


from ggrc import db
from ggrc.models.mixins import CustomAttributable
from ggrc.models.mixins import deferred
from ggrc.models.mixins import Described
from ggrc.models.mixins import Hierarchical
from ggrc.models.mixins import Hyperlinked
from ggrc.models.mixins import Noted
from ggrc.models.mixins import Slugged
from ggrc.models.mixins import Stateful
from ggrc.models.mixins import Timeboxed
from ggrc.models.mixins import Titled
from ggrc.models.mixins import WithContact
from ggrc.models.object_document import Documentable
from ggrc.models.object_owner import Ownable
from ggrc.models.object_person import Personable
from ggrc.models.relationship import Relatable
from ggrc.models.track_object_state import HasObjectState
from ggrc.models.track_object_state import track_state_for_class


class Clause(HasObjectState, Hierarchical, Noted, Described, Hyperlinked,
             WithContact, Titled, Slugged, Stateful,
             db.Model, CustomAttributable, Documentable,
             Personable, Ownable, Timeboxed, Relatable):

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
  __tablename__ = 'clauses'
  _table_plural = 'clauses'
  _title_uniqueness = True
  _aliases = {
      "url": "Clause URL",
      "description": "Text of Clause",
      "directive": None,
  }

  na = deferred(db.Column(db.Boolean, default=False, nullable=False),
                'Clause')
  notes = deferred(db.Column(db.Text), 'Clause')

  _publish_attrs = [
      'na',
      'notes',
  ]
  _sanitize_html = ['notes']
  _include_links = []

track_state_for_class(Clause)
