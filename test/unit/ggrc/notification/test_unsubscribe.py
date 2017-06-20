# -*- coding: utf-8 -*-

# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Tests for functions in the ggrc.notifications.unsubscribe module."""

import unittest
from mock import patch

from ggrc.notifications.unsubscribe import unsubscribe_url


class TestUnsubscribeUrl(unittest.TestCase):
  """Test suite for the unsubscribe_url() function."""

  # pylint: disable=invalid-name

  def test_returning_url_for_byte_string_email(self):
    """Currect unsubscribe URL should be returned for byte string email."""
    with patch("ggrc.notifications.unsubscribe.get_url_root") as fake_url_root:
      fake_url_root.return_value = "http://wwww.foo.bar"
      result = unsubscribe_url("jöhn/doe@mail.com")  # mind the German umlaut

    expected = (
        "http://wwww.foo.bar/unsubscribe/"
        "j%C3%B6hn%2Fdoe%40mail.com"
    )
    self.assertEqual(result, expected)

  def test_returning_url_for_unicode_email(self):
    """Currect unsubscribe URL should be returned for unicode email."""
    with patch("ggrc.notifications.unsubscribe.get_url_root") as fake_url_root:
      fake_url_root.return_value = "http://wwww.foo.bar"
      result = unsubscribe_url(u"jöhn/doe@mail.com")  # mind the German umlaut

    expected = (
        "http://wwww.foo.bar/unsubscribe/"
        "j%C3%B6hn%2Fdoe%40mail.com"
    )
    self.assertEqual(result, expected)
