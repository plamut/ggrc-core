# -*- coding: utf-8 -*-

# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Tests for the daily digest unsubscribe API endpoint."""

from ggrc import db
from ggrc.models import NotificationConfig, Person
from ggrc.notifications.unsubscribe import unsubscribe_url

from integration.ggrc import TestCase
from integration.ggrc import generator
from integration.ggrc.api_helper import Api


class TestUnsubscribeFromNotifications(TestCase):
  """Tests unsubscribing from notifications."""
  # pylint: disable=invalid-name

  def setUp(self):
    super(TestUnsubscribeFromNotifications, self).setUp()
    self.api = Api()
    self.obj_generator = generator.ObjectGenerator()

    _, self.admin = self.obj_generator.generate_person(
        user_role="Administrator")

  def test_unsubscribing_not_publicly_allowed(self):
    """Anonymous users should not be allowed to unsubscribe anyone."""
    admin = Person.query.filter_by(id=self.admin.id).one()

    url = unsubscribe_url(admin.email)
    response = self.client.get(url)
    self.assertEqual(response.status_code, 401)  # HTTP Unauthorized
    # TODO: should this be a redirect instead?

  def test_does_not_allow_unsubscribing_other_users(self):
    """Unsubscribing users other than self should results in HTTP 403."""
    admin = Person.query.filter_by(id=self.admin.id).one()

    self.api.set_user(admin)
    url = unsubscribe_url("not-my-" + admin.email)
    response = self.client.get(url)

    self.assertEqual(response.status_code, 403)  # HTTP forbidden

  def test_unsubscribing_when_explicitly_subscribed(self):
    """Test that users can unsubscribe themselves.

    NOTE: Explicitly subscribed means that there exists a relevant notification
    config entry in database.
    """
    admin = Person.query.filter_by(id=self.admin.id).one()

    config = NotificationConfig(
        person_id=admin.id, notif_type="Email_Digest", enable_flag=True)
    db.session.add(config)
    db.session.commit()

    response = self.api.set_user(admin)

    url = unsubscribe_url(admin.email)
    response = self.client.get(url)
    self.assertEqual(response.status_code, 200)  # HTTP OK

    config = NotificationConfig.query.filter_by(
        person_id=admin.id, notif_type="Email_Digest").first()
    self.assertIsNotNone(config)
    self.assertFalse(config.enable_flag)

  def test_unsubscribing_when_subscribed_by_default(self):
    """Test that users can unsubscribe themselves when no DB entry.

    By default, users are subscribed to daily digest emails even if there is no
    notification config entry in database, but unsubscribing such users must
    work, too.
    """
    admin = Person.query.filter_by(id=self.admin.id).one()

    response = self.api.set_user(admin)

    url = unsubscribe_url(admin.email)
    response = self.client.get(url)
    self.assertEqual(response.status_code, 200)  # HTTP OK

    config = NotificationConfig.query.filter_by(
        person_id=admin.id, notif_type="Email_Digest").first()
    self.assertIsNotNone(config)
    self.assertFalse(config.enable_flag)

  def test_unsubscribing_when_already_unsubscribed(self):
    """Test that unsubscribing oneself when unsubscribed yields no error."""
    admin = Person.query.filter_by(id=self.admin.id).one()

    config = NotificationConfig(
        person_id=admin.id, notif_type="Email_Digest", enable_flag=False)
    db.session.add(config)
    db.session.commit()

    self.api.set_user(admin)

    url = unsubscribe_url(admin.email)
    response = self.client.get(url)
    self.assertEqual(response.status_code, 200)  # HTTP OK

    config = NotificationConfig.query.filter_by(
        person_id=admin.id, notif_type="Email_Digest").first()
    self.assertIsNotNone(config)
    self.assertFalse(config.enable_flag)
