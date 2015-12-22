# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from flask import json
from os.path import abspath
from os.path import dirname
from os.path import join

from integration import ggrc


THIS_ABS_PATH = abspath(dirname(__file__))


class TestCase(ggrc.TestCase):

  CSV_DIR = join(THIS_ABS_PATH, "test_csvs/")

  def _import_file(self, filename, dry_run=False):
    data = {"file": (open(join(self.CSV_DIR, filename)), filename)}
    headers = {
        "X-test-only": "true" if dry_run else "false",
        "X-requested-by": "gGRC",
    }
    response = self.client.post("/_service/import_csv",
                                data=data, headers=headers)
    self.assert200(response)
    return json.loads(response.data)

  def import_file(self, filename, dry_run=False):
    if dry_run:
      return self._import_file(filename, dry_run=True)
    else:
      response_dry = self._import_file(filename, dry_run=True)
      response = self._import_file(filename)
      self.assertEqual(response_dry, response)
      return response

  def export_csv(self, data):
    headers = {
        'Content-Type': 'application/json',
        "X-requested-by": "gGRC",
        "X-export-view": "blocks",
    }
    return self.client.post("/_service/export_csv", data=json.dumps(data),
                            headers=headers)
