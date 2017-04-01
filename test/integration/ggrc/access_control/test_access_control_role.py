# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Test Access Control Role"""

from ggrc.access_control.access_control_role import AccessControlRole
from integration.ggrc import TestCase
from integration.ggrc.api_helper import Api
from integration.ggrc.models.factories import random_str


class TestAccessControlRole(TestCase):
  """TestAccessControlRole"""

  def setUp(self):
    super(TestAccessControlRole, self).setUp()
    self.api = Api()

  def test_create_access_control_role(self):
    """Test Access Control Role creation"""
    name = random_str(prefix="Access Control Role - ")
    response = self.api.post(AccessControlRole, {
        "access_control_role": {
            "name": name,
            "objec_type": "Control",
            "context": None,
            "read": True
        },
    })
    assert response.status_code == 201, \
        "Failed to create a new access control role, response was {}".format(
            response.status)

    id_ = response.json['access_control_role']['id']
    role = AccessControlRole.query.filter(AccessControlRole.id == id_).first()
    assert role.read == 1, \
        "Read permission not correctly saved {}".format(role.read)
    assert role.update == 0, \
        "Update permission not correctly saved {}".format(role.update)
    assert role.delete == 0, \
        "Update permission not correctly saved {}".format(role.delete)
