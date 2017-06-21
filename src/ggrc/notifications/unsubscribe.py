# -*- coding: utf-8 -*-

# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""A module with functions related to unsubscribing from notifications."""

from cgi import escape as html_escape
from logging import getLogger

from flask import current_app

from ggrc import db
from ggrc.models import NotificationConfig
from ggrc.login import get_current_user
from sqlalchemy.exc import SQLAlchemyError  # the base SqlAlchemy exception


# pylint: disable=invalid-name
logger = getLogger(__name__)


def unsubscribe_from_notifications(email):
  """Unsubscribe the owner of the given email from daily notifications.

  For the action to succeed, the email owner must be logged in with that email,
  otherwise an authorization error is returned.

  Args:
    email (unicode): user's email address

  Returns:
    HTTP response indicating the outcome of the action requested.
  """

  current_user = get_current_user()
  if not current_user:
    # TODO: redirect to login page?
    return current_app.make_response((u"Not authorized", 401))

  if current_user.email != email:
    msg = u"User %s tried to unsubscribe a user other than self (%s)"
    logger.warning(msg, current_user.email, email)
    return current_app.make_response(
        (u"Cannot unsubscribe other people", 403))

  try:
    instance = db.session.query(
        NotificationConfig
    ).filter(
        (NotificationConfig.person_id == current_user.id) &
        (NotificationConfig.notif_type == "Email_Digest")
    ).first()

    if instance:
      instance.enable_flag = False
    else:
      instance = NotificationConfig(
          person_id=current_user.id,
          notif_type="Email_Digest",
          enable_flag=False,
          modified_by_id=current_user.id,
      )
      db.session.add(instance)

    db.session.commit()
  except SQLAlchemyError:
    return current_app.make_response(
        (u"Database error, unsubcribing failed", 500))

  email = html_escape(email)
  response = current_app.make_response(
      u"<b>unsubscribed:</b> {}".format(email))
  return response
