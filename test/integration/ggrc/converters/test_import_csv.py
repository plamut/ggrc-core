# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc import models
from ggrc.converters import errors
from integration.ggrc import converters
from integration.ggrc import generator


class TestBasicCsvImport(converters.TestCase):

  def setUp(self):
    converters.TestCase.setUp(self)
    self.generator = generator.ObjectGenerator()
    self.client.get("/login")

  def tearDown(self):
    pass

  def generate_people(self, people):
    for person in people:
      self.generator.generate_person({
          "name": person,
          "email": "{}@reciprocitylabs.com".format(person),
      }, "gGRC Admin")

  def test_policy_basic_import(self):
    filename = "policy_basic_import.csv"
    self.import_file(filename)
    self.assertEqual(models.Policy.query.count(), 3)

  def test_policy_import_working_with_warnings_dry_run(self):
    filename = "policy_import_working_with_warnings.csv"

    response_json = self.import_file(filename, dry_run=True)

    expected_warnings = set([
        errors.UNKNOWN_USER_WARNING.format(line=3, email="miha@policy.com"),
        errors.UNKNOWN_OBJECT.format(
            line=3, object_type="Program", slug="P753"),
        errors.OWNER_MISSING.format(line=4),
        errors.UNKNOWN_USER_WARNING.format(line=6, email="not@a.user"),
        errors.OWNER_MISSING.format(line=6),
    ])
    response_warnings = response_json[0]["row_warnings"]
    self.assertEqual(expected_warnings, set(response_warnings))
    response_errors = response_json[0]["row_errors"]
    self.assertEqual(set(), set(response_errors))
    self.assertEqual(4, response_json[0]["created"])
    policies = models.Policy.query.all()
    self.assertEqual(len(policies), 0)

  def test_policy_import_working_with_warnings(self):
    def test_owners(policy):
      self.assertNotEqual([], policy.owners)
      self.assertEqual("user@example.com", policy.owners[0].email)
    filename = "policy_import_working_with_warnings.csv"
    self.import_file(filename)

    policies = models.Policy.query.all()
    self.assertEqual(len(policies), 4)
    for policy in policies:
      test_owners(policy)

  def test_policy_same_titles(self):
    def test_owners(policy):
      self.assertNotEqual([], policy.owners)
      self.assertEqual("user@example.com", policy.owners[0].email)

    filename = "policy_same_titles.csv"
    response_json = self.import_file(filename)

    self.assertEqual(3, response_json[0]["created"])
    self.assertEqual(6, response_json[0]["ignored"])
    self.assertEqual(0, response_json[0]["updated"])
    self.assertEqual(9, response_json[0]["rows"])

    expected_errors = set([
        errors.DUPLICATE_VALUE_IN_CSV.format(
            line_list="3, 4, 6, 10, 11", column_name="Title",
            value="A title", s="s", ignore_lines="4, 6, 10, 11"),
        errors.DUPLICATE_VALUE_IN_CSV.format(
            line_list="5, 7", column_name="Title", value="A different title",
            s="", ignore_lines="7"),
        errors.DUPLICATE_VALUE_IN_CSV.format(
            line_list="8, 9, 10, 11", column_name="Code", value="code",
            s="s", ignore_lines="9, 10, 11"),
    ])
    response_errors = response_json[0]["row_errors"]
    self.assertEqual(expected_errors, set(response_errors))

    policies = models.Policy.query.all()
    self.assertEqual(len(policies), 3)
    for policy in policies:
      test_owners(policy)

  def test_intermappings(self):
    self.generate_people(["miha", "predrag", "vladan", "ivan"])

    filename = "intermappings.csv"
    response_json = self.import_file(filename)

    self.assertEqual(4, response_json[0]["created"])  # Facility
    self.assertEqual(4, response_json[1]["created"])  # Objective

    response_warnings = response_json[0]["row_warnings"]
    self.assertEqual(set(), set(response_warnings))
    self.assertEqual(13, models.Relationship.query.count())

    obj2 = models.Objective.query.filter_by(slug="O2").first()
    obj3 = models.Objective.query.filter_by(slug="O3").first()
    self.assertNotEqual(None, models.Relationship.find_related(obj2, obj2))
    self.assertEqual(None, models.Relationship.find_related(obj3, obj3))

  def test_policy_unique_title(self):
    filename = "policy_sample1.csv"
    response_json = self.import_file(filename)

    self.assertEqual(response_json[0]["row_errors"], [])

    filename = "policy_sample2.csv"
    response_json = self.import_file(filename)

    self.assertEqual(response_json[0]["row_errors"], [
        "Line 3: title 'will this work' already exists.Record will be ignored."
    ])

  def test_control_assessments_import_update(self):
    messages = ("block_errors", "block_warnings", "row_errors", "row_warnings")

    filename = "pci_program.csv"
    response = self.import_file(filename)

    for response_block in response:
      for message in messages:
        self.assertEqual(set(), set(response_block[message]))

    ca = models.ControlAssessment.query.filter_by(slug="CA.PCI 1.1").first()
    au = models.Audit.query.filter_by(slug="AUDIT-Consolidated").first()
    self.assertEqual(len(ca.owners), 1)
    self.assertEqual(ca.owners[0].email, "danny@reciprocitylabs.com")
    self.assertEqual(ca.contact.email, "danny@reciprocitylabs.com")
    self.assertEqual(ca.design, "Effective")
    self.assertEqual(ca.operationally, "Effective")
    self.assertIsNone(models.Relationship.find_related(ca, au))

    filename = "pci_program_update.csv"
    response = self.import_file(filename)

    for response_block in response:
      for message in messages:
        self.assertEqual(set(), set(response_block[message]))

    ca = models.ControlAssessment.query.filter_by(slug="CA.PCI 1.1").first()
    au = models.Audit.query.filter_by(slug="AUDIT-Consolidated").first()
    self.assertEqual(ca.owners[0].email, "miha@reciprocitylabs.com")
    self.assertEqual(ca.contact.email, "albert@reciprocitylabs.com")
    self.assertEqual(ca.design, "Needs improvement")
    self.assertEqual(ca.operationally, "Ineffective")
    self.assertIsNotNone(models.Relationship.find_related(ca, au))

  def test_person_imports(self):
    filename = "people_test.csv"
    response = self.import_file(filename)
    self.assertIn("Line 8: Field Email is required. The line will be ignored.",
                  response[0]["row_errors"])
    self.assertEqual(0, models.Person.query.filter_by(email=None).count())
