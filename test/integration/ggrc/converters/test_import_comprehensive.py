# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc import db
from ggrc.models import AccessGroup
from ggrc.models import Program
from ggrc.converters import errors
from ggrc_basic_permissions import Role
from ggrc_basic_permissions import UserRole
from integration.ggrc.converters import TestCase
from integration.ggrc.generator import ObjectGenerator


class TestComprehensiveSheets(TestCase):

  """
  test sheet from:
    https://docs.google.com/spreadsheets/d/1Jg8jum2eQfvR3kZNVYbVKizWIGZXvfqv3yQpo2rIiD8/edit#gid=0

  """

  def setUp(self):
    TestCase.setUp(self)
    self.generator = ObjectGenerator()
    self.client.get("/login")
    pass

  def tearDown(self):
    pass

  def test_comprehensive_sheet1_with_custom_attributes(self):
    self.create_custom_attributes()
    self.create_people()
    filename = "comprehensive_sheet1.csv"
    response = self.import_file(filename)
    indexed = {r["name"]: r for r in response}

    expected = {
        "Control": {
            "created": 14,
            "ignored": 2,
            "row_errors": 2,
            "row_warnings": 3,
            "rows": 16,
        },
        "Objective": {
            "created": 8,
            "ignored": 7,
            "row_errors": 5,
            "row_warnings": 4,
            "rows": 15,
        },
        "Program": {
            "created": 13,
            "ignored": 3,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Issue": {
            "created": 10,
            "ignored": 4,
            "row_errors": 4,
            "row_warnings": 4,
            "rows": 14,
        },
        "Policy": {
            "created": 13,
            "ignored": 3,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Regulation": {
            "created": 13,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 3,
            "rows": 15,
        },
        "Standard": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 5,
            "rows": 16,
        },
        "Contract": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "System": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Clause": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Process": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Data Asset": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Product": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Project": {
            "created": 8,
            "ignored": 0,
            "row_errors": 0,
            "row_warnings": 0,
            "rows": 8,
        },
        "Facility": {
            "created": 14,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 4,
            "rows": 16,
        },
        "Market": {
            "created": 13,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 3,
            "rows": 15,
        },
        "Org Group": {
            "created": 13,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 3,
            "rows": 15,
        },
        "Vendor": {
            "created": 13,
            "ignored": 2,
            "row_errors": 3,
            "row_warnings": 3,
            "rows": 15,
        },
        "Person": {
            "created": 9,
            "ignored": 1,
            "row_errors": 1,
            "row_warnings": 0,
            "rows": 10,
        }
    }

    # general numbers check
    for name, data in expected.items():
      current = indexed[name]
      self.assertEqual(current["rows"], data["rows"], name)
      self.assertEqual(current["ignored"], data["ignored"], name)
      self.assertEqual(current["created"], data["created"], name)
      self.assertEqual(len(current["row_errors"]), data["row_errors"], name)
      self.assertEqual(
          len(current["row_warnings"]), data["row_warnings"], name)

    prog = Program.query.filter_by(slug="prog-8").first()
    self.assertEqual(prog.title, "program 8")
    self.assertEqual(prog.status, "Draft")
    self.assertEqual(prog.description, "test")

    custom_vals = [v.attribute_value for v in prog.custom_attribute_values]
    expected_custom_vals = ['0', 'a', '2015-12-12 00:00:00', 'test1']
    self.assertEqual(set(custom_vals), set(expected_custom_vals))

  def test_full_good_import_no_warnings(self):
    filename = "full_good_import_no_warnings.csv"
    messages = ("block_errors", "block_warnings", "row_errors", "row_warnings")

    response = self.import_file(filename, dry_run=True)
    for block in response:
      for message in messages:
        self.assertEqual(set(), set(block[message]))

    response = self.import_file(filename)

    for message in messages:  # response[0] = Person block
      self.assertEqual(set(response[0][message]), set())
    ggrc_admin = db.session.query(Role.id).filter(Role.name == "gGRC Admin")
    reader = db.session.query(Role.id).filter(Role.name == "Reader")
    creator = db.session.query(Role.id).filter(Role.name == "Creator")
    ggrc_admins = UserRole.query.filter(UserRole.role_id == ggrc_admin).all()
    readers = UserRole.query.filter(UserRole.role_id == reader).all()
    creators = UserRole.query.filter(UserRole.role_id == creator).all()
    access_groups = db.session.query(AccessGroup).all()
    self.assertEqual(len(ggrc_admins), 12)
    self.assertEqual(len(readers), 5)
    self.assertEqual(len(creators), 6)
    self.assertEqual(len(access_groups), 10)

    for block in response:
      for message in messages:
        self.assertEqual(set(), set(block[message]))

  def test_errors_and_warnings(self):
    """
    This test should test for all possible warnings and errors but it is still
    incomplete.
    """
    filename = "import_with_all_warnings_and_errors.csv"

    dry_response = self.import_file(filename, dry_run=True)

    response = self.import_file(filename)

    block_messages = [
        {  # warnings and error of the first imported block
            "block_errors": set([
                errors.DUPLICATE_COLUMN.format(
                    line=1, duplicates="Notes, Test Plan"),
            ])
        }
    ]
    self.assertEqual(dry_response, response)

    messages = ("block_errors", "block_warnings", "row_errors", "row_warnings")

    for message_block, response_block in zip(block_messages, response):
      for message in messages:
        self.assertEqual(
            message_block.get(message, set()),
            set(response_block[message])
        )

  def create_custom_attributes(self):
    gen = self.generator.generate_custom_attribute
    gen("control", title="my custom text", mandatory=True)
    gen("program", title="my_text", mandatory=True)
    gen("program", title="my_date", attribute_type="Date")
    gen("program", title="my_checkbox", attribute_type="Checkbox")
    gen("program", title="my_dropdown", attribute_type="Dropdown",
        options="a,b,c,d")
    # gen("program", title="my_description", attribute_type="Rich Text")

  def create_people(self):
    emails = [
        "user1@ggrc.com",
        "miha@policy.com",
        "someone.else@ggrc.com",
        "another@user.com",
    ]
    for email in emails:
      self.generator.generate_person({
          "name": email.split("@")[0].title(),
          "email": email,
      }, "gGRC Admin")
