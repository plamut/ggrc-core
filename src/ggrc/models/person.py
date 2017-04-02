# Copyright (C) 2017 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

import re
from sqlalchemy.orm import validates

from ggrc import db
from ggrc import settings
from ggrc.fulltext.mixin import Indexed
from ggrc.models.computed_property import computed_property
from ggrc.models.context import HasOwnContext
from ggrc.models.exceptions import ValidationError
from ggrc.models.deferred import deferred
from ggrc.models.mixins import Base, CustomAttributable
from ggrc.models.custom_attribute_definition import CustomAttributeMapable
from ggrc.models.reflection import PublishOnly
from ggrc.models.relationship import Relatable
from ggrc.models.utils import validate_option


class Person(CustomAttributable, CustomAttributeMapable, HasOwnContext,
             Relatable, Base, Indexed, db.Model):

  __tablename__ = 'people'

  email = deferred(db.Column(db.String, nullable=False), 'Person')
  name = deferred(db.Column(db.String), 'Person')
  language_id = deferred(db.Column(db.Integer), 'Person')
  company = deferred(db.Column(db.String), 'Person')

  object_people = db.relationship(
      'ObjectPerson', backref='person', cascade='all, delete-orphan')
  object_owners = db.relationship(
      'ObjectOwner', backref='person', cascade='all, delete-orphan')
  access_control_list = db.relationship(
      'AccessControlList', backref='person', cascade='all, delete-orphan')
  language = db.relationship(
      'Option',
      primaryjoin='and_(foreign(Person.language_id) == Option.id, '
      'Option.role == "person_language")',
      uselist=False,
  )

  @staticmethod
  def _extra_table_args(cls):
    return (
        db.Index('ix_people_name_email', 'name', 'email'),
        db.Index('uq_people_email', 'email', unique=True),
    )

  _fulltext_attrs = [
      'company',
      'email',
      'name',
  ]
  _publish_attrs = [
      'company',
      'email',
      'language',
      'name',
      PublishOnly('object_people'),
      PublishOnly('system_wide_role'),
  ]
  _sanitize_html = [
      'company',
      'name',
  ]
  _include_links = []
  _aliases = {
      "name": "Name",
      "email": {
          "display_name": "Email",
          "unique": True,
      },
      "company": "Company",
      "user_role": {
          "display_name": "Role",
          "type": "user_role",
          "filter_by": "_filter_by_user_role",
      },
  }

  @classmethod
  def _filter_by_user_role(cls, predicate):
    from ggrc_basic_permissions.models import Role, UserRole
    return UserRole.query.join(Role).filter(
        (UserRole.person_id == cls.id) &
        (UserRole.context_id == None) &  # noqa
        predicate(Role.name)
    ).exists()

  # Methods required by Flask-Login
    # pylint: disable=no-self-use
  def is_authenticated(self):
    return self.system_wide_role != 'No Access'

  @property
  def user_name(self):
    return self.email.split("@")[0]

  def is_active(self):
    # pylint: disable=no-self-use
    return True  # self.active

  def is_anonymous(self):
    # pylint: disable=no-self-use
    return False

  def get_id(self):
    return unicode(self.id)  # noqa

  @validates('language')
  def validate_person_options(self, key, option):
    return validate_option(self.__class__.__name__, key, option,
                           'person_language')

  @validates('email')
  def validate_email(self, key, email):
    if not Person.is_valid_email(email):
      message = "Must provide a valid email address"
      raise ValidationError(message)
    return email

  @staticmethod
  def is_valid_email(val):
    # Borrowed from Django
    # literal form, ipv4 address (SMTP 4.1.3)
    email_re = re.compile(
        '^[-!#$%&\'*+\\.\/0-9=?A-Z^_`{|}~]+@([-0-9A-Z]+\.)+([0-9A-Z]){2,4}$',
        re.IGNORECASE)
    return email_re.match(val) if val else False

  @classmethod
  def eager_query(cls):
    from sqlalchemy import orm

    # query = super(Person, cls).eager_query()
    # Completely overriding eager_query to avoid eager loading of the
    # modified_by relationship
    return super(Person, cls).eager_query().options(
        orm.joinedload('language'),
        orm.subqueryload('object_people'),
    )

  def _display_name(self):
    return self.email

  @computed_property
  def system_wide_role(self):
    """For choosing the role string to show to the user; of all the roles in
    the system-wide context, it shows the highest ranked one (if there are
    multiple) or "No Access" if there are none.
    """
    # FIXME: This method should be in `ggrc_basic_permissions`, since it
    #   depends on `Role` and `UserRole` objects

    if self.email in getattr(settings, "BOOTSTRAP_ADMIN_USERS", []):
      return u"Superuser"

    role_hierarchy = {
        u'Administrator': 0,
        u'Editor': 1,
        u'Reader': 2,
        u'Creator': 3,
    }
    unique_roles = set([
        user_role.role.name
        for user_role in self.user_roles
        if user_role.role.name in role_hierarchy
    ])
    if len(unique_roles) == 0:
      return u"No Access"
    else:
      # -1 as default to make items not in this list appear on top
      # and thus shown to the user
      sorted_roles = sorted(unique_roles,
                            key=lambda x: role_hierarchy.get(x, -1))
      return sorted_roles[0]
