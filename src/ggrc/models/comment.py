# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: andraz@reciprocitylabs.com
# Maintained By: andraz@reciprocitylabs.com

from ggrc import db
from ggrc.models.mixins import Base
from ggrc.models.mixins import Described
from ggrc.models.object_document import Documentable
from ggrc.models.relationship import Relatable


class Comment(Relatable, Described, Documentable, Base, db.Model):
  __tablename__ = "comments"

  assignee_type = db.Column(db.String)

  # REST properties
  _publish_attrs = [
    "assignee_type",
  ]

  _sanitize_html = [
    "description",
  ]
