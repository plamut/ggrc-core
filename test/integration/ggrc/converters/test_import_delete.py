# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc.converters import errors
from integration.ggrc import converters


class TestBasicCsvImport(converters.TestCase):

  def setUp(self):
    converters.TestCase.setUp(self)
    self.client.get("/login")

  def test_policy_basic_import(self):
    filename = "ca_setup_for_deletion.csv"
    self.import_file(filename)

    filename = "ca_deletion.csv"
    response_data_dry = self.import_file(filename, dry_run=True)
    response_data = self.import_file(filename)
    self.assertEqual(response_data_dry, response_data)

    expected_errors = set([
        errors.DELETE_CASCADE_ERROR.format(
            line=3, object_type="Control", slug="c1")
    ])

    self.assertEqual(set(response_data[0]["row_errors"]), expected_errors)
    self.assertEqual(response_data[0]["deleted"], 1)
    self.assertEqual(response_data[0]["ignored"], 1)
