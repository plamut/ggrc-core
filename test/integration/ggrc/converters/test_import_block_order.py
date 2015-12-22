# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc.models import Person
from integration.ggrc.converters import TestCase
from integration.ggrc.generator import ObjectGenerator


class TestBasicCsvImport(TestCase):

  def setUp(self):
    TestCase.setUp(self)
    self.generator = ObjectGenerator()
    self.client.get("/login")

  def test_people_import(self):
    filename = "people_basic_import.csv"
    self.import_file(filename)
    self.assertEqual(5, Person.query.count())

  def test_people_import_correct_order_dry_run(self):
    filename = "people_import_correct_order.csv"
    response = self.import_file(filename, dry_run=True)
    self.assertEqual(1, Person.query.count())
    self.assertEqual(response[1]["name"], "Org Group")
    self.assertEqual(set(), set(response[1]["row_warnings"]))
    self.assertEqual(set(), set(response[1]["row_errors"]))

  def test_people_import_wrong_order_dry_run(self):
    filename = "people_import_correct_order.csv"
    filename = "people_import_wrong_order.csv"
    response = self.import_file(filename, dry_run=True)
    self.assertEqual(1, Person.query.count())
    self.assertEqual(response[1]["name"], "Org Group")
    self.assertEqual(set(), set(response[1]["row_warnings"]))
    self.assertEqual(set(), set(response[1]["row_errors"]))

  def test_people_import_correct_order(self):
    filename = "people_import_correct_order.csv"
    response = self.import_file(filename)
    self.assertEqual(5, Person.query.count())
    self.assertEqual(response[1]["name"], "Org Group")
    self.assertEqual(set(), set(response[1]["row_warnings"]))
    self.assertEqual(set(), set(response[1]["row_errors"]))

  def test_people_import_wrong_order(self):
    filename = "people_import_correct_order.csv"
    filename = "people_import_wrong_order.csv"
    response = self.import_file(filename)
    self.assertEqual(5, Person.query.count())
    self.assertEqual(response[1]["name"], "Org Group")
    self.assertEqual(set(), set(response[1]["row_warnings"]))
    self.assertEqual(set(), set(response[1]["row_errors"]))
