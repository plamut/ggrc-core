# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Views for email notifications."""

from ggrc.notifications import common, unsubscribe
from ggrc.login import login_required


def init_notification_views(app):
  """Add url rules for all notification views.

  Args:
    app: current flask app.
  """
  app.add_url_rule(
      "/_notifications/send_daily_digest", "send_daily_digest_notifications",
      view_func=common.send_daily_digest_notifications)

  app.add_url_rule(
      "/_notifications/show_pending", "show_pending_notifications",
      view_func=login_required(common.show_pending_notifications))

  app.add_url_rule(
      "/_notifications/show_daily_digest", "show_daily_digest_notifications",
      view_func=login_required(common.show_daily_digest_notifications))

  app.add_url_rule(
      "/unsubscribe/<path:email>",
      "unsubscribe_from_notifications",
      view_func=login_required(unsubscribe.unsubscribe_from_notifications))
