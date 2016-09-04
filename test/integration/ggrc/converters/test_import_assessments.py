# Copyright (C) 2016 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

# pylint: disable=maybe-no-member, invalid-name

"""Test request import and updates."""

from ggrc import db
from ggrc import models
from integration.ggrc import converters


class TestAssessmentImportExport(converters.TestCase):
  """Basic Assessment import tests with.

  This test suite should test new Assessment imports, exports, and updates.
  The main focus of these tests is checking error messages for invalid state
  transitions.
  """

  def setUp(self):
    """ Set up for Request test cases """
    converters.TestCase.setUp(self)
    self.client.get("/login")

  def test_import_assessments_with_templates(self):
    """Test importing of assessments with templates."""

    self.import_file("assessment_template_no_warnings.csv")
    response = self.import_file("assessment_with_templates.csv")
    self._check_response(response, {})

    assessment = models.Assessment.query.filter(
        models.Assessment.slug == "A 4").first()

    values = set(v.attribute_value for v in assessment.custom_attribute_values)
    self.assertIn("abc", values)
    self.assertIn("2015-07-15 00:00:00", values)

  def test_export_assessments_with_filters_and_conflicting_ca_names(self):
    """Test exporting assessments with conflicting custom attribute names."""
    self.import_file(u"assessment_template_no_warnings.csv")
    self.import_file(u"assessment_with_templates.csv")

    # also create an object level custom attribute with a name that clashes
    # with a name of a "regular" attribute
    assessment = models.Assessment.query.filter(
        models.Assessment.slug == u"A 2").first()
    cad = models.CustomAttributeDefinition(
        attribute_type=u"Text",
        title=u"title",
        definition_type=u"assessment",
        definition_id=assessment.id
    )
    db.session.add(cad)
    db.session.commit()

    data = [{
        "object_name": "Assessment",
        "fields": ["slug", "title", "description", "status"],
        "filters": {
            "expression": {
                "left": {
                    "left": "code",
                    "op": {"name": "~"},
                    "right": "A 2"
                },
                "op": {"name": "AND"},
                "right": {
                    "left": "title",
                    "op": {"name": "~"},
                    "right": "no template Assessment"
                }
            },
            "keys": ["code", "title", "status"],
            "order_by": {
                "keys": [],
                "order": "",
                "compare": None
            }
        }
    }]

    response = self.export_csv(data)
    self.assertIn(u"No template Assessment 2", response.data)
