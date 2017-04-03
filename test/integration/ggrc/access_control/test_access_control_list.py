# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Test Access Control List"""

from ggrc.models import all_models
from integration.ggrc import TestCase
from integration.ggrc.models import factories
from integration.ggrc.models.factories import random_str
from integration.ggrc.api_helper import Api


def _acl_json(role_id, person_id):
  """Helper function for setting acl json"""
  return {
      "ac_role_id": role_id,
      "person": {
          "type": "Person",
          "id": person_id
      }
  }


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
    self.second_acr = factories.AccessControlRoleFactory(
        object_type="Control",
        read=True
    )
    self.acl = factories.AccessControlListFactory(
        object=self.control,
        ac_role_id=self.acr.id,
        person=self.person
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

  def test_post_object_roles(self):
    """Test if roles are stored correctly when POSTed with the object"""
    id_, person_id = self.acr.id, self.person.id
    title = random_str(prefix="Control - ")
    response = self.api.post(all_models.Control, {
        "control": {
            "title": title,
            "type": "Control",
            "context": None,
            "access_control_list": [
                _acl_json(id_, person_id)
            ]
        },
    })
    assert response.status_code == 201, \
        "Control with acl not created successfully {}".format(response.status)

    acl = response.json["control"]["access_control_list"]
    assert len(acl) == 1, \
        "Access control list did not get saved {}".format(acl)

    assert acl[0]["id"] > 0, \
        "Acces control list did not set an id"

    assert acl[0]["ac_role_id"] == id_, \
        "Access control list does not include the saved role id"

    assert acl[0]["person"]["id"] == person_id, \
        "Access control list does not include person id"

  def test_put_object_roles(self):
    """Test if PUTing object roles saves them correctly"""
    id_2, person_id = self.second_acr.id, self.person.id

    response = self.api.get(all_models.Control, self.control.id)
    assert response.status_code == 200, \
        "Failed to fetch created control {}".format(response.status)
    control = response.json['control']
    control['access_control_list'].append(_acl_json(id_2, person_id))
    response = self.api.put(self.control, {"control": control})
    assert response.status_code == 200, \
        "PUTing control failed {}".format(response.status)
    acl = response.json['control']['access_control_list']
    assert len(acl) == 2, \
        "Access control list not correctly updated {}".format(acl)

  def test_put_removing_roles(self):
    """Test if PUTing an empty list removes object roles correct"""
    response = self.api.get(all_models.Control, self.control.id)
    assert response.status_code == 200, \
        "Failed to fetch created control {}".format(response.status)
    control = response.json['control']
    control['access_control_list'] = []
    response = self.api.put(self.control, {"control": control})
    assert response.status_code == 200, \
        "PUTing control failed {}".format(response.status)
    acl = response.json['control']['access_control_list']
    assert len(acl) == 0, \
        "Access control list not empty {}".format(acl)
