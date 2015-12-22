# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

import random
from integration.ggrc import TestCase
from freezegun import freeze_time
from datetime import date, datetime
from mock import patch

import os
from ggrc import db, notification
from ggrc.models import Notification, Person
from ggrc_workflows.views import send_todays_digest_notifications
from ggrc_workflows.models import Cycle, CycleTaskGroupObjectTask
from integration.ggrc_workflows.generator import WorkflowsGenerator
from integration.ggrc.api_helper import Api
from integration.ggrc.generator import ObjectGenerator


if os.environ.get('TRAVIS', False):
  random.seed(1)  # so we can reproduce the tests if needed


class TestOneTimeWfEndDateChange(TestCase):

  """ This class contains simple one time workflow tests that are not
  in the gsheet test grid
  """

  def setUp(self):
    TestCase.setUp(self)
    self.api = Api()
    self.wf_generator = WorkflowsGenerator()
    self.object_generator = ObjectGenerator()
    Notification.query.delete()

    self.random_objects = self.object_generator.generate_random_objects(2)
    _, self.user = self.object_generator.generate_person(user_role="gGRC Admin")
    self.create_test_cases()

    def init_decorator(init):
      def new_init(self, *args, **kwargs):
        init(self, *args, **kwargs)
        if hasattr(self, "created_at"):
          self.created_at = datetime.now()
      return new_init

    Notification.__init__ = init_decorator(Notification.__init__)

  @patch("ggrc.notification.email.send_email")
  def test_no_date_change(self, mock_mail):
    def get_person(person_id):
      return db.session.query(Person).filter(Person.id == person_id).one()

    with freeze_time("2015-04-10 03:21:34"):
      _, wf = self.wf_generator.generate_workflow(self.one_time_workflow_1)

      _, cycle = self.wf_generator.generate_cycle(wf)
      self.wf_generator.activate_workflow(wf)

    with freeze_time("2015-04-11 03:21:34"):
      user = get_person(self.user.id)
      _, notif_data = notification.get_todays_notifications()
      self.assertIn("cycle_started", notif_data[user.email])

    with freeze_time("2015-05-02 03:21:34"):
      _, notif_data = notification.get_todays_notifications()
      self.assertIn(user.email, notif_data)
      self.assertIn("cycle_started", notif_data[user.email])
      self.assertNotIn("due_in", notif_data[user.email])
      self.assertNotIn("due_today", notif_data[user.email])

    with freeze_time("2015-05-02 03:21:34"):
      send_todays_digest_notifications()
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

      # one email to owner and one to assigne
      self.assertEqual(mock_mail.call_count, 2)

    with freeze_time("2015-05-04 03:21:34"):  # one day befor due date
      _, notif_data = notification.get_todays_notifications()
      user = get_person(self.user.id)
      self.assertIn("due_in", notif_data[user.email])
      self.assertEqual(len(notif_data[user.email]["due_in"]),
                       len(self.random_objects))

    with freeze_time("2015-05-04 03:21:34"):  # one day befor due date
      send_todays_digest_notifications()
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

      # one email to owner and one to assigne
      self.assertEqual(mock_mail.call_count, 3)

    with freeze_time("2015-05-05 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertIn("due_today", notif_data[user.email])
      self.assertEqual(len(notif_data[user.email]["due_today"]),
                       len(self.random_objects))

  @patch("ggrc.notification.email.send_email")
  def test_move_end_date_to_future(self, mock_mail):
    """
    test moving the end date to the future, befor due_in and due_today
    notifications have been sent
    """
    def get_person(person_id):
      return db.session.query(Person).filter(Person.id == person_id).one()

    with freeze_time("2015-04-10 03:21:34"):
      _, wf = self.wf_generator.generate_workflow(self.one_time_workflow_1)

      _, cycle = self.wf_generator.generate_cycle(wf)
      self.wf_generator.activate_workflow(wf)

    with freeze_time("2015-04-11 03:21:34"):
      user = get_person(self.user.id)
      _, notif_data = notification.get_todays_notifications()
      self.assertIn("cycle_started", notif_data[user.email])

    with freeze_time("2015-05-02 03:21:34"):
      _, notif_data = notification.get_todays_notifications()
      self.assertIn(user.email, notif_data)
      self.assertIn("cycle_started", notif_data[user.email])
      self.assertNotIn("due_in", notif_data[user.email])
      self.assertNotIn("due_today", notif_data[user.email])

    with freeze_time("2015-05-02 03:21:34"):
      send_todays_digest_notifications()
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

      # one email to owner and one to assigne
      self.assertEqual(mock_mail.call_count, 2)

    with freeze_time("2015-05-03 03:21:34"):
      cycle = Cycle.query.get(cycle.id)
      task1 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[0].id)
      task2 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[1].id)

      self.wf_generator.modify_object(
        task1, data = {"end_date": date(2015, 5, 15)})
      self.wf_generator.modify_object(
        task2, data = {"end_date": date(2015, 5, 15)})

    with freeze_time("2015-05-04 03:21:34"):  # one day befor due date
      _, notif_data = notification.get_todays_notifications()
      user = get_person(self.user.id)
      self.assertEqual(notif_data, {})

    with freeze_time("2015-05-05 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

    with freeze_time("2015-05-14 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertIn(user.email, notif_data)
      self.assertIn("due_in", notif_data[user.email])
      self.assertEqual(len(notif_data[user.email]["due_in"]),
                       len(self.random_objects))

    with freeze_time("2015-05-15 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertIn(user.email, notif_data)

      # yesterdays mail has not been sent
      self.assertIn("due_in", notif_data[user.email])

      self.assertIn("due_today", notif_data[user.email])
      self.assertEqual(len(notif_data[user.email]["due_today"]),
                       len(self.random_objects))

  @patch("ggrc.notification.email.send_email")
  def test_move_end_date_to_past(self, mock_mail):
    def get_person(person_id):
      return db.session.query(Person).filter(Person.id == person_id).one()

    with freeze_time("2015-04-10 03:21:34"):
      _, wf = self.wf_generator.generate_workflow(self.one_time_workflow_1)

      _, cycle = self.wf_generator.generate_cycle(wf)
      self.wf_generator.activate_workflow(wf)

    with freeze_time("2015-05-02 03:21:34"):
      send_todays_digest_notifications()
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

      # one email to owner and one to assigne
      self.assertEqual(mock_mail.call_count, 2)

    with freeze_time("2015-05-03 03:21:34"):
      cycle = Cycle.query.get(cycle.id)
      task1 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[0].id)
      task2 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[1].id)

      self.wf_generator.modify_object(
        task1, data = {"end_date": date(2015, 5, 1)})
      self.wf_generator.modify_object(
        task2, data = {"end_date": date(2015, 5, 1)})

    with freeze_time("2015-05-03 03:21:34"):  # one day befor due date
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

    with freeze_time("2015-05-04 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

    with freeze_time("2015-05-05 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

  @patch("ggrc.notification.email.send_email")
  def test_move_end_date_to_today(self, mock_mail):
    def get_person(person_id):
      return db.session.query(Person).filter(Person.id == person_id).one()

    with freeze_time("2015-04-10 03:21:34"):
      _, wf = self.wf_generator.generate_workflow(self.one_time_workflow_1)

      _, cycle = self.wf_generator.generate_cycle(wf)
      self.wf_generator.activate_workflow(wf)

    with freeze_time("2015-05-02 03:21:34"):
      send_todays_digest_notifications()
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

      # one email to owner and one to assigne
      self.assertEqual(mock_mail.call_count, 2)

    with freeze_time("2015-05-03 03:21:34"):
      cycle = Cycle.query.get(cycle.id)
      task1 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[0].id)
      task2 = CycleTaskGroupObjectTask.query.get(
        cycle.cycle_task_group_object_tasks[1].id)

      self.wf_generator.modify_object(
        task1, data = {"end_date": date(2015, 5, 3)})
      self.wf_generator.modify_object(
        task2, data = {"end_date": date(2015, 5, 4)})

    with freeze_time("2015-05-03 03:21:34"):  # one day befor due date
      user = get_person(self.user.id)
      _, notif_data = notification.get_todays_notifications()

      self.assertNotEquals(notif_data, {})
      self.assertIn(user.email, notif_data)
      self.assertIn("due_today", notif_data[user.email])
      self.assertIn("due_in", notif_data[user.email])
      self.assertEqual(len(notif_data[user.email]["due_today"]), 1)

      send_todays_digest_notifications()

    with freeze_time("2015-05-04 03:21:34"):  # due date
      user = get_person(self.user.id)
      _, notif_data = notification.get_todays_notifications()
      self.assertIn(user.email, notif_data)
      self.assertIn("due_today", notif_data[user.email])
      self.assertNotIn("due_in", notif_data[user.email])
      send_todays_digest_notifications()

    with freeze_time("2015-05-05 03:21:34"):  # due date
      _, notif_data = notification.get_todays_notifications()
      self.assertEqual(notif_data, {})

  def create_test_cases(self):
    def person_dict(person_id):
      return {
          "href": "/api/people/%d" % person_id,
          "id": person_id,
          "type": "Person"
      }

    self.one_time_workflow_1 = {
        "title": "one time test workflow",
        "notify_on_change": True,
        "description": "some test workflow",
        "owners": [person_dict(self.user.id)],
        "task_groups": [{
            "title": "one time task group",
            "contact": person_dict(self.user.id),
            "task_group_tasks": [{
                "title": "task 1",
                "description": "some task",
                "contact": person_dict(self.user.id),
                "start_date": date(2015, 5, 1),  # friday
                "end_date": date(2015, 5, 5),
            }],
            "task_group_objects": self.random_objects
        }]
    }
