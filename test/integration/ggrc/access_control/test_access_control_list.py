# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Test Access Control List"""

from ggrc.models import all_models
from integration.ggrc import TestCase
from integration.ggrc.models import factories
from integration.ggrc.api_helper import Api


class TestAccessControlList(TestCase):
  """TestAccessControlList"""

  def setUp(self):
    super(TestAccessControlList, self).setUp()
    self.api = Api()
    self.person = factories.PersonFactory()
    self.control = factories.ControlFactory()
    self.acr = factories.AccessControlRoleFactory(
        object_type="Control",
        read=True
    )
    self.acl = factories.AccessControlListFactory(
        object=self.control,
        ac_role_id=self.acr.id,
        person_id=self.person.id
    )

  def test_object_roles(self):
    """Test if roles are fetched with the object"""
    id_, person_id = self.acr.id, self.person.id
    response = self.api.get(all_models.Control, self.control.id)
    assert response.status_code == 200, \
        "Failed to fetch created control {}".format(response.status)

    assert "access_control_list" in response.json["control"], \
        "Access Control List not a property in {}".format(
            response.json["control"].keys())

    ac_list = response.json["control"]["access_control_list"]
    assert len(ac_list) == 1, "{}".format(len(ac_list))

    assert ac_list[0]["ac_role_id"] == id_, \
        "ac_role_id not properly set {}".format(ac_list[0].get("ac_role_id"))
    assert ac_list[0]["person"]["id"] == person_id, \
        "Person stub not properly set {}".format(ac_list[0]["person"])
