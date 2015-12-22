# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: urban@reciprocitylabs.com

from datetime import date

from os.path import abspath
from os.path import dirname
from os.path import join

from integration.ggrc.converters import TestCase

from ggrc import db
from ggrc_workflows.models.task_group import TaskGroup
from ggrc_workflows.models.task_group_object import TaskGroupObject
from ggrc_workflows.models.task_group_task import TaskGroupTask
from ggrc_workflows.models.workflow import Workflow

THIS_ABS_PATH = abspath(dirname(__file__))


class TestWorkflowObjectsImport(TestCase):

  """
    Test imports for basic workflow objects
  """

  def setUp(self):
    TestCase.setUp(self)
    self.client.get("/login")
    self.CSV_DIR = join(THIS_ABS_PATH, "test_csvs/")

  def test_full_good_import_no_warnings(self):
    filename = "workflow_small_sheet.csv"
    response = self.import_file(filename)

    messages = ("block_errors", "block_warnings", "row_errors", "row_warnings")

    for block in response:
      for message in messages:
        self.assertEqual(set(), set(block[message]))

    self.assertEqual(1, Workflow.query.count())
    self.assertEqual(1, TaskGroup.query.count())
    self.assertEqual(4, TaskGroupTask.query.count())
    self.assertEqual(2, TaskGroupObject.query.count())

    task2 = TaskGroupTask.query.filter_by(slug="t-2").first()
    task3 = TaskGroupTask.query.filter_by(slug="t-3").first()
    task4 = TaskGroupTask.query.filter_by(slug="t-4").first()
    self.assertEqual(task2.start_date, date(2015, 7, 10))
    self.assertEqual(task2.end_date, date(2016, 12, 30))
    self.assertIn("ch2", task3.response_options)
    self.assertIn("option 1", task4.response_options)

  def test_import_task_date_format(self):
    """Test import of tasks for workflows with various frequencies"""
    filename = "workflow_big_sheet.csv"
    response = self.import_file(filename)
    objects = {"Workflow", "Task Group", "Task Group Task"}
    messages = ["block_errors", "block_warnings", "row_errors", "row_warnings",
                "ignored"]
    # Assert that there were no import errors
    for obj in response:
      if obj['name'] in objects:
        self.assertEqual([[], [], [], [], 0], [obj[msg] for msg in messages])

    # Assert that CSV import got imported correctly
    getters = {
        "one_time": lambda task: (task.start_date, task.end_date),
        "weekly": lambda task: (task.relative_start_day,
                                task.relative_end_day),
        "monthly": lambda task: (task.relative_start_day,
                                 task.relative_end_day),
        "quarterly": lambda task: ((task.relative_start_month,
                                    task.relative_start_day),
                                   (task.relative_end_month,
                                    task.relative_end_day)),
        "annually": lambda task: ((task.relative_start_month,
                                   task.relative_start_day),
                                  (task.relative_end_month,
                                   task.relative_end_day))
    }

    tasks = [
        ["task-1", "one_time", (date(2015, 7, 1), date(2015, 7, 15))],
        ["task-2", "weekly", (2, 5)],
        ["task-3", "monthly", (1, 22)],
        ["task-4", "quarterly", ((1, 5), (2, 15))],
        ["task-10", "quarterly", ((3, 5), (1, 1))],
        ["task-11", "quarterly", ((3, 5), (1, 1))],
        ["task-5", "annually", ((5, 7), (7, 15))],
    ]

    for t in tasks:
      slug, freq, result = t
      task = db.session.query(TaskGroupTask).filter(
          TaskGroupTask.slug == slug).one()
      getter = getters[freq]
      self.assertEqual(task.task_group.workflow.frequency, freq)
      self.assertEqual(
          getter(task), result,
          "Failed importing data for task with slug = '{}'".format(slug))
