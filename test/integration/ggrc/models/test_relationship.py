# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Module for integration tests for Relationship."""

import json

from ggrc.models.all_models import Relationship, Revision
from integration.ggrc import TestCase
from integration.ggrc.api_helper import Api
from integration.ggrc.models import factories


def _object_revisions(obj):
  """Return all revisions for an object, sorted ascendingly by IDs."""
  query = Revision.query.filter(
      (Revision.resource_id == obj.id) &
      (Revision.resource_type == type(obj).__name__)
  ).order_by(Revision.id.asc())

  return query.all()


class TestRelationship(TestCase):
  """Integration test suite for Relationship."""
  # pylint: disable=invalid-name

  def setUp(self):
    """Create a Person, an Assessment, prepare a Relationship json."""
    super(TestRelationship, self).setUp()

    self.api = Api()
    self.client.get("/login")
    self.person = factories.PersonFactory()
    self.assessment = factories.AssessmentFactory()

  def _post_relationship(self, source_obj, dest_obj, attrs=None):
    """POST a Relationship with attr between source_obj and dest_obj."""
    if attrs is None:
      attrs = {}

    headers = {
        "Content-Type": "application/json",
        "X-requested-by": "GGRC",
    }
    relationship_json = [{"relationship": {
        "source": {"id": source_obj.id, "type": source_obj.type},
        "destination": {"id": dest_obj.id, "type": dest_obj.type},
        "context": {"id": None},
        "attrs": attrs,
    }}]
    return self.client.post("/api/relationships",
                            data=json.dumps(relationship_json),
                            headers=headers)

  def test_attrs_validation_ok(self):
    """Can create a Relationship with valid attrs."""
    response = self._post_relationship(
        self.person, self.assessment, {"AssigneeType": "Creator"})
    self.assert200(response)

  def test_attrs_validation_invalid_attr(self):
    """Can not create a Relationship with invalid attr name."""
    response = self._post_relationship(
        self.person, self.assessment, {"Invalid": "Data"})
    self.assert400(response)

  def test_attrs_validation_invalid_value(self):
    """Can not create a Relationship with invalid attr value."""
    response = self._post_relationship(
        self.person, self.assessment, {"AssigneeType": "Monkey"})
    self.assert400(response)

  def test_changing_object_documents_creates_object_revision(self):
    """Changing object documents should generate new object revision."""
    control = factories.ControlFactory()
    url = factories.ReferenceUrlFactory(link=u"www.foo.com")

    # attach an url to a control
    response = self._post_relationship(control, url)
    self.assert200(response)

    rel_data = response.json[0][-1]["relationship"]
    relationship = Relationship.query.get(rel_data["id"])

    # check if a revision was created and contains the attached url
    revisions = _object_revisions(control)
    self.assertGreater(len(revisions), 0)
    latest_version = revisions[-1].content

    url_list = latest_version.get("reference_url", [])
    link = url_list[0].get("link") if url_list else None
    self.assertEqual(link, u"www.foo.com")

    # now test whether a new revision is created when url is unmapped
    response = self.api.delete(relationship)
    self.assert200(response)

    revisions = _object_revisions(control)
    self.assertGreater(len(revisions), 0)
    latest_version = revisions[-1].content

    url_list = latest_version.get("reference_url", [])
    self.assertEqual(url_list, [])
