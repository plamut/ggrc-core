# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc import models
from integration.ggrc import converters


class TestRequestImport(converters.TestCase):

  def setUp(self):
    """ Set up for Request test cases """
    converters.TestCase.setUp(self)
    self.client.get("/login")

  def _test_request_users(self, request, users):
    """ Test that all users have correct roles on specified Request"""
    verificationErrors = ""
    for user_name, expected_types in users.items():
      try:
        user = models.Person.query.filter_by(name=user_name).first()
        rel = models.Relationship.find_related(request, user)
        if expected_types:
          self.assertNotEqual(
              rel,
              None,
              "User {} is not mapped to {}".format(user.email, request.slug)
          )
          self.assertIn("AssigneeType", rel.relationship_attrs)
          self.assertEqual(
              set(rel.relationship_attrs[
                  "AssigneeType"].attr_value.split(",")),
              expected_types
          )
        else:
          self.assertEqual(
              rel,
              None,
              "User {} is mapped to {}".format(user.email, request.slug)
          )
      except AssertionError as e:
        verificationErrors += "\n\nChecks for Users-Request mapping failed "\
            "for user '{}' with:\n{}".format(user_name, str(e))

    self.assertEqual(verificationErrors, "", verificationErrors)

  def test_request_full_no_warnings(self):
    """ Test full request import with no warnings

    CSV sheet:
      https://docs.google.com/spreadsheets/d/1Jg8jum2eQfvR3kZNVYbVKizWIGZXvfqv3yQpo2rIiD8/edit#gid=704933240&vpid=A7
    """
    filename = "request_full_no_warnings.csv"
    response = self.import_file(filename)

    messages = ("block_errors", "block_warnings", "row_errors", "row_warnings")

    for response_block in response:
      for message in messages:
        self.assertEqual(set(), set(response_block[message]))

    # Test first request line in the CSV file
    request_1 = models.Request.query.filter_by(slug="Request 1").first()
    users = {
        "user 1": {"Assignee"},
        "user 2": {"Assignee", "Requester"},
        "user 3": {"Requester", "Verifier"},
        "user 4": {"Verifier"},
        "user 5": {"Verifier"},
    }
    self._test_request_users(request_1, users)
    self.assertEqual(request_1.status, "Open")
    self.assertEqual(request_1.request_type, "documentation")

    # Test second request line in the CSV file
    request_2 = models.Request.query.filter_by(slug="Request 2").first()
    users = {
        "user 1": {"Assignee"},
        "user 2": {"Requester"},
        "user 3": {"Verifier"},
        "user 4": {},
        "user 5": {},
    }

    self._test_request_users(request_2, users)
    self.assertEqual(request_2.status, "In Progress")
    self.assertEqual(request_2.request_type, "interview")
