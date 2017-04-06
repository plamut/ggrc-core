# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Test Access Control List"""

from ggrc import db
from ggrc.models import all_models
from integration.ggrc import TestCase
from integration.ggrc.models import factories
from integration.ggrc.api_helper import Api
from integration.ggrc.generator import ObjectGenerator


class TestAccessControlRBAC(TestCase):
  """TestAccessControlRBAC tests if users get correct permissions on objects
     from the access control table"""

  def setUp(self):
    super(TestAccessControlRBAC, self).setUp()
    self.api = Api()
    self.set_up_people()
    self.set_up_acl_object()

  def set_up_people(self):
    """Set up people with different roles needed by the tests"""
    self.people = {}
    object_generator = ObjectGenerator()

    for name in ["Creator", "Reader"]:
      _, user = object_generator.generate_person(
          data={"name": name}, user_role=name)
      self.people[name] = user

  def set_up_acl_object(self):
    """Set up a control with an access control role that grants RUD"""
    self.control = factories.ControlFactory()
    self.all_acr = factories.AccessControlRoleFactory(
        type="Control",
        read=True,
        update=True,
        delete=True
    )
    for name in ["Creator", "Reader"]:
      factories.AccessControlListFactory(
          object=self.control,
          ac_role_id=self.all_acr.id,
          person=self.people.get(name)
      )

  def test_acl_object_cru(self):
    """Test if readers/creators can CRUD an object with all permissions"""
    control_id = self.control.id
    # role_id = self.all_acr.id
    for name in ("Creator", "Reader"):
      person = self.people.get(name)
      db.session.add(person)
      self.api.set_user(person)
      response = self.api.get(all_models.Control, control_id)
      assert response.status_code == 200, \
          "{} cannot GET object from acl. Received {}".format(
              name, response.status)
      acl = response.json["control"]["access_control_list"]
      assert len(response.json["control"]["access_control_list"]) == 2, \
          "ACL in control does not include all people {}".format(acl)
