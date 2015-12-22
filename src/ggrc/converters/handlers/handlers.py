# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from dateutil.parser import parse
from flask import current_app
from sqlalchemy import and_
from sqlalchemy import or_
import re
import traceback

from ggrc import db
from ggrc.automapper import AutomapperGenerator
from ggrc.converters import errors
from ggrc.converters import get_importables
from ggrc.login import get_current_user
from ggrc.models import Audit
from ggrc.models import CategoryBase
from ggrc.models import Contract
from ggrc.models import ControlAssessment
from ggrc.models import ObjectPerson
from ggrc.models import Option
from ggrc.models import Person
from ggrc.models import Policy
from ggrc.models import Program
from ggrc.models import Regulation
from ggrc.models import Relationship
from ggrc.models import Request
from ggrc.models import Response
from ggrc.models import Standard
from ggrc.models import all_models
from ggrc.models import response
from ggrc.models.reflection import AttributeInfo
from ggrc.models.relationship_helper import RelationshipHelper
from ggrc.rbac import permissions


MAPPING_PREFIX = "__mapping__:"
CUSTOM_ATTR_PREFIX = "__custom__:"


class ColumnHandler(object):

  def __init__(self, row_converter, key, **options):
    self.row_converter = row_converter
    self.key = key
    self.value = None
    self.raw_value = options.get("raw_value", "").strip()
    self.validator = options.get("validator")
    self.mandatory = options.get("mandatory", False)
    self.default = options.get("default")
    self.description = options.get("description", "")
    self.display_name = options.get("display_name", "")
    self.dry_run = row_converter.block_converter.converter.dry_run
    self.new_objects = self.row_converter.block_converter.converter.new_objects
    self.unique = options.get("unique", False)
    self.set_value()

  def check_unique_consistency(self):
    """Returns true if no object exists with the same unique field."""
    if not self.unique:
      return
    if not self.value:
      return
    if not self.row_converter.obj:
      return
    nr_duplicates = self.row_converter.object_class.query.filter(and_(
        getattr(self.row_converter.object_class, self.key) == self.value,
        self.row_converter.object_class.id != self.row_converter.obj.id
    )).count()
    if nr_duplicates > 0:
      self.add_error(errors.DUPLICATE_VALUE,
                     column_name=self.key,
                     value=self.value)
      self.row_converter.set_ignore()

  def set_value(self):
    self.value = self.parse_item()

  def get_value(self):
    return getattr(self.row_converter.obj, self.key, self.value)

  def add_error(self, template, **kwargs):
    self.row_converter.add_error(template, **kwargs)

  def add_warning(self, template, **kwargs):
    self.row_converter.add_warning(template, **kwargs)

  def parse_item(self):
    return self.raw_value

  def set_obj_attr(self):
    if not self.value:
      return
    try:
      setattr(self.row_converter.obj, self.key, self.value)
    except:
      self.row_converter.add_error(errors.UNKNOWN_ERROR)
      trace = traceback.format_exc()
      error = "Import failed with:\nsetattr({}, {}, {})\n{}".format(
          self.row_converter.obj, self.key, self.value, trace)
      current_app.logger.error(error)

  def get_default(self):
    if callable(self.default):
      return self.default()
    return self.default

  def insert_object(self):
    """ For inserting fields such as custom attributes and mappings """
    pass


class DeleteColumnHandler(ColumnHandler):

  # this is a white list of objects that can be deleted in a cascade
  # e.g. deleting a Market can delete the associated ObjectOwner object too
  DELETE_WHITELIST = {"Relationship", "ObjectOwner", "ObjectPerson"}
  ALLOWED_VALUES = {"", "no", "false", "true", "yes", "force"}
  TRUE_VALUES = {"true", "yes", "force"}

  def get_value(self):
    return ""

  def parse_item(self):
    if self.raw_value.lower() not in self.ALLOWED_VALUES:
      self.add_error(errors.WRONG_VALUE_ERROR, column_name=self.display_name)
      return False
    is_delete = self.raw_value.lower() in self.TRUE_VALUES
    self._allow_cascade = self.raw_value.lower() == "force"
    self.row_converter.is_delete = is_delete
    return is_delete

  def set_obj_attr(self):
    if not self.value:
      return
    obj = self.row_converter.obj
    if self.row_converter.is_new:
      self.add_error(errors.DELETE_NEW_OBJECT_ERROR,
                     object_type=obj.type,
                     slug=obj.slug)
      return
    if self.row_converter.ignore:
      return
    tr = db.session.begin_nested()
    try:
      tr.session.delete(obj)
      deleted = len([o for o in tr.session.deleted
                     if o.type not in self.DELETE_WHITELIST])
      if deleted > 1 and not self._allow_cascade:
        self.add_error(errors.DELETE_CASCADE_ERROR,
                       object_type=obj.type, slug=obj.slug)
    finally:
      if self.dry_run or self.row_converter.ignore:
        tr.rollback()
      else:
        indexer = self.row_converter.block_converter.converter.indexer
        if indexer is not None:
          for o in tr.session.deleted:
            indexer.delete_record(o.id, o.__class__.__name__, commit=False)
        tr.commit()


class StatusColumnHandler(ColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.key = key
    self.valid_states = row_converter.object_class.VALID_STATES
    self.state_mappings = {str(s).lower(): s for s in self.valid_states}
    super(StatusColumnHandler, self).__init__(row_converter, key, **options)

  def parse_item(self):
    value = self.raw_value.lower()
    status = self.state_mappings.get(value)
    if status is None:
      if self.mandatory:
        if len(self.valid_states) > 0:
          self.add_warning(errors.WRONG_REQUIRED_VALUE,
                           value=value[:20],
                           column_name=self.display_name)
          status = self.valid_states[0]
        else:
          self.add_error(errors.MISSING_VALUE_ERROR,
                         column_name=self.display_name)
          return
      elif value != "":
        self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
    return status


class UserColumnHandler(ColumnHandler):

  """ Handler for primary and secondary contacts """

  def get_users_list(self):
    users = set()
    email_lines = self.raw_value.splitlines()
    owner_emails = filter(unicode.strip, email_lines)  # noqa
    for raw_line in owner_emails:
      email = raw_line.strip().lower()
      person = self.get_person(email)
      if person:
        users.add(person)
      else:
        self.add_warning(errors.UNKNOWN_USER_WARNING, email=email)
    return list(users)

  def get_person(self, email):
    new_objects = self.row_converter.block_converter.converter.new_objects
    if email not in new_objects[Person]:
      new_objects[Person][email] = Person.query.filter_by(email=email).first()
    return new_objects[Person].get(email)

  def parse_item(self):
    email = self.raw_value.lower()
    person = self.get_person(email)
    if not person:
      if email != "":
        self.add_warning(errors.UNKNOWN_USER_WARNING, email=email)
      elif self.mandatory:
        self.add_error(errors.MISSING_VALUE_ERROR,
                       column_name=self.display_name)
    return person

  def get_value(self):
    person = getattr(self.row_converter.obj, self.key)
    if person:
      return person.email
    return self.value


class OwnerColumnHandler(UserColumnHandler):

  def parse_item(self):
    owners = set()
    email_lines = self.raw_value.splitlines()
    owner_emails = filter(unicode.strip, email_lines)  # noqa
    for raw_line in owner_emails:
      email = raw_line.strip().lower()
      person = self.get_person(email)
      if person:
        owners.add(person)
      else:
        self.add_warning(errors.UNKNOWN_USER_WARNING, email=email)

    if not owners:
      self.add_warning(errors.OWNER_MISSING)
      owners.add(get_current_user())

    return list(owners)

  def set_obj_attr(self):
    try:
      for person in self.row_converter.obj.owners:
        if person not in self.value:
          self.row_converter.obj.owners.remove(person)
      for person in self.value:
        if person not in self.row_converter.obj.owners:
          self.row_converter.obj.owners.append(person)
    except:
      self.row_converter.add_error(errors.UNKNOWN_ERROR)
      trace = traceback.format_exc()
      error = "Import failed with:\nsetattr({}, {}, {})\n{}".format(
          self.row_converter.obj, self.key, self.value, trace)
      current_app.logger.error(error)

  def get_value(self):
    emails = [owner.email for owner in self.row_converter.obj.owners]
    return "\n".join(emails)


class SlugColumnHandler(ColumnHandler):

  def parse_item(self):
    if self.raw_value:
      return self.raw_value
    return ""


class DateColumnHandler(ColumnHandler):

  def parse_item(self):
    try:
      return parse(self.raw_value)
    except:
      self.add_error(
          u"Unknown date format, use YYYY-MM-DD or MM/DD/YYYY format")

  def get_value(self):
    date = getattr(self.row_converter.obj, self.key)
    if date:
      return date.strftime("%m/%d/%Y")
    return ""


class EmailColumnHandler(ColumnHandler):

  def parse_item(self):
    """ emails are case insensitive """
    return self.raw_value.lower()


class TextColumnHandler(ColumnHandler):

  """ Single line text field handler """

  def parse_item(self):
    """ Remove multiple spaces and new lines from text """
    if not self.raw_value:
      return ""

    return self.clean_whitespaces(self.raw_value)

  def clean_whitespaces(self, value):
    clean_value = re.sub(r'\s+', " ", value)
    if clean_value != value:
      self.add_warning(errors.WHITESPACE_WARNING,
                       column_name=self.display_name)
    return value


class RequiredTextColumnHandler(TextColumnHandler):

  def parse_item(self):
    value = self.raw_value or ""
    clean_value = self.clean_whitespaces(value)
    if not clean_value:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return clean_value


class TextareaColumnHandler(ColumnHandler):

  """ Multi line text field handler """

  def parse_item(self):
    """ Remove multiple spaces and new lines from text """
    if not self.raw_value:
      return ""

    return re.sub(r'\s+', " ", self.raw_value).strip()


class MappingColumnHandler(ColumnHandler):

  """ Handler for mapped objects """

  def __init__(self, row_converter, key, **options):
    self.key = key
    importable = get_importables()
    self.attr_name = options.get("attr_name", "")
    self.mapping_object = importable.get(self.attr_name)
    self.new_slugs = row_converter.block_converter.converter.new_objects[
        self.mapping_object]
    self.unmap = self.key.startswith(AttributeInfo.UNMAPPING_PREFIX)
    super(MappingColumnHandler, self).__init__(row_converter, key, **options)

  def parse_item(self):
    """ Remove multiple spaces and new lines from text """
    class_ = self.mapping_object
    lines = set(self.raw_value.splitlines())
    slugs = filter(unicode.strip, lines)  # noqa
    objects = []
    for slug in slugs:
      obj = class_.query.filter(class_.slug == slug).first()
      if obj:
        if permissions.is_allowed_update_for(obj):
          objects.append(obj)
        else:
          self.add_warning(
              errors.MAPPING_PERMISSION_ERROR,
              object_type=class_._inflector.human_singular.title(),
              slug=slug,
          )
      elif not (slug in self.new_slugs and self.dry_run):
        self.add_warning(errors.UNKNOWN_OBJECT,
                         object_type=class_._inflector.human_singular.title(),
                         slug=slug)
    return objects

  def set_obj_attr(self):
    self.value = self.parse_item()

  def insert_object(self):
    """ Create a new mapping object """
    if self.dry_run or not self.value:
      return
    current_obj = self.row_converter.obj
    relationships = []
    for obj in self.value:
      mapping = Relationship.find_related(current_obj, obj)
      if not self.unmap and not mapping:
        mapping = Relationship(source=current_obj, destination=obj)
        relationships.append(mapping)
        db.session.add(mapping)
      elif self.unmap and mapping:
        db.session.delete(mapping)
    db.session.flush()
    for relation in relationships:
      AutomapperGenerator(relation, False).generate_automappings()
    self.dry_run = True

  def get_value(self):
    if self.unmap:
      return ""
    related_slugs = []
    related_ids = RelationshipHelper.get_ids_related_to(
        self.mapping_object.__name__,
        self.row_converter.object_class.__name__,
        [self.row_converter.obj.id])
    if related_ids:
      related_objects = self.mapping_object.query.filter(
          self.mapping_object.id.in_(related_ids))
      related_slugs = (getattr(o, "slug", getattr(o, "email", None))
                       for o in related_objects)
      related_slugs = [slug for slug in related_slugs if slug is not None]
    return "\n".join(related_slugs)

  def set_value(self):
    pass


class ConclusionColumnHandler(ColumnHandler):

  """ Handler for design and operationally columns in ControlAssesments """

  def parse_item(self):
    conclusion_map = {i.lower(): i for i in
                      ControlAssessment.VALID_CONCLUSIONS}
    return conclusion_map.get(self.raw_value.lower(), "")


class OptionColumnHandler(ColumnHandler):

  def parse_item(self):
    prefixed_key = "{}_{}".format(
        self.row_converter.object_class._inflector.table_singular, self.key)
    item = Option.query.filter(
        and_(Option.title == self.raw_value.strip(),
             or_(Option.role == self.key,
                 Option.role == prefixed_key))).first()
    return item

  def get_value(self):
    option = getattr(self.row_converter.obj, self.key, None)
    if option is None:
      return ""
    if callable(option.title):
      return option.title()
    return option.title


class CheckboxColumnHandler(ColumnHandler):

  def parse_item(self):
    """ mandatory checkboxes will get evelauted to false on empty value """
    if self.raw_value == "":
      return False
    value = self.raw_value.lower() in ("yes", "true")
    if self.raw_value == "--":
      value = None
    if self.raw_value.lower() not in ("yes", "true", "no", "false", "--"):
      self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
    return value

  def get_value(self):
    val = getattr(self.row_converter.obj, self.key, False)
    if val is None:
      return "--"
    return "true" if val else "false"

  def set_obj_attr(self):
    """ handle set object for boolean values

    This is the only handler that will allow setting a None value"""
    try:
      setattr(self.row_converter.obj, self.key, self.value)
    except:
      self.row_converter.add_error(errors.UNKNOWN_ERROR)
      trace = traceback.format_exc()
      error = "Import failed with:\nsetattr({}, {}, {})\n{}".format(
          self.row_converter.obj, self.key, self.value, trace)
      current_app.logger.error(error)


class ParentColumnHandler(ColumnHandler):

  """ handler for directly mapped columns """

  parent = None

  def __init__(self, row_converter, key, **options):
    super(ParentColumnHandler, self).__init__(row_converter, key, **options)

  def parse_item(self):
    """ get parent object """
    # pylint: disable=protected-access
    if self.raw_value == "":
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
      return None
    slug = self.raw_value
    obj = self.new_objects.get(self.parent, {}).get(slug)
    if obj is None:
      obj = self.parent.query.filter(self.parent.slug == slug).first()
    if obj is None:
      self.add_error(errors.UNKNOWN_OBJECT,
                     object_type=self.parent._inflector.human_singular.title(),
                     slug=slug)
      return None
    context_id = None
    if hasattr(obj, "context_id") and \
       hasattr(self.row_converter.obj, "context_id"):
      context_id = obj.context_id
      if context_id is not None:
        name = self.row_converter.obj.__class__.__name__
        if not permissions.is_allowed_create(name, None, context_id) \
           and not permissions.has_conditions('create', name):
          self.add_error(errors.MAPPING_PERMISSION_ERROR,
                         object_type=obj.type, slug=slug)
          return None
    return obj

  def set_obj_attr(self):
    super(ParentColumnHandler, self).set_obj_attr()
    # inherit context
    obj = self.row_converter.obj
    parent = getattr(obj, self.key, None)
    if parent is not None and \
       hasattr(obj, "context_id") and \
       hasattr(parent, "context_id") and \
       parent.context_id is not None:
      obj.context_id = parent.context_id

  def get_value(self):
    value = getattr(self.row_converter.obj, self.key, self.value)
    if not value:
      return None
    return value.slug


class ProgramColumnHandler(ParentColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.parent = Program
    super(ProgramColumnHandler, self).__init__(row_converter, key, **options)


class SectionDirectiveColumnHandler(MappingColumnHandler):

  def get_directive_from_slug(self, directive_class, slug):
    if slug in self.new_objects[directive_class]:
      return self.new_objects[directive_class][slug]
    return directive_class.query.filter_by(slug=slug).first()

  def parse_item(self):
    """ get a directive from slug """
    allowed_directives = [Policy, Regulation, Standard, Contract]
    if self.raw_value == "":
      return None
    slug = self.raw_value
    for directive_class in allowed_directives:
      directive = self.get_directive_from_slug(directive_class, slug)
      if directive is not None:
        return [directive]
    self.add_error(errors.UNKNOWN_OBJECT, object_type="Program", slug=slug)
    return None

  def get_value(self):
    # Legacy field. With the new mapping system it is not possible to determine
    # which was the primary directive that has been mapped
    return ""


class ControlColumnHandler(MappingColumnHandler):

  def insert_object(self):
    if len(self.value) != 1:
      self.add_error(errors.WRONG_VALUE_ERROR, column_name="Control")
      return
    self.row_converter.obj.control = self.value[0]
    MappingColumnHandler.insert_object(self)


class AuditColumnHandler(MappingColumnHandler):

  def __init__(self, row_converter, key, **options):
    key = "{}audit".format(MAPPING_PREFIX)
    super(AuditColumnHandler, self).__init__(row_converter, key, **options)


class RequestAuditColumnHandler(ParentColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.parent = Audit
    super(RequestAuditColumnHandler, self) \
        .__init__(row_converter, "audit", **options)


class ObjectPersonColumnHandler(UserColumnHandler):

  """
  ObjectPerson handler for all specific columns such as "owner" or any other
  role. This handler will remove all people not listed in the value and will
  add people that are missing.
  """

  def parse_item(self):
    return self.get_users_list()

  def set_obj_attr(self):
    pass

  def get_value(self):
    object_person = db.session.query(ObjectPerson.person_id).filter_by(
        personable_id=self.row_converter.obj.id,
        personable_type=self.row_converter.obj.__class__.__name__)
    users = Person.query.filter(Person.id.in_(object_person))
    emails = [user.email for user in users]
    return "\n".join(emails)

  def remove_current_people(self):
    ObjectPerson.query.filter_by(
        personable_id=self.row_converter.obj.id,
        personable_type=self.row_converter.obj.__class__.__name__).delete()

  def insert_object(self):
    if self.dry_run or not self.value:
      return
    self.remove_current_people()
    for person in self.value:
      object_person = ObjectPerson(
          personable=self.row_converter.obj,
          person=person,
          context=self.row_converter.obj.context
      )
      db.session.add(object_person)
    self.dry_run = True


class PersonMappingColumnHandler(ObjectPersonColumnHandler):

  """
  This handler will only add people listed in self.value if they are not yet
  connected to the current object.
  """

  def remove_current_people(self):
    obj = self.row_converter.obj
    self.value = [person for person in self.value
                  if not ObjectPerson.query.filter_by(
                      personable_id=obj.id,
                      personable_type=obj.__class__.__name__,
                      person=person).count()
                  ]


class PersonUnmappingColumnHandler(ObjectPersonColumnHandler):

  """
  This handler will only remove people listed in self.value if they are already
  connected to the current object.
  """

  def insert_object(self):
    if self.dry_run or not self.value:
      return
    for person in self.value:
      ObjectPerson.query.filter_by(
          personable_id=self.row_converter.obj.id,
          personable_type=self.row_converter.obj.__class__.__name__,
          person=person
      ).delete()
    self.dry_run = True


class CategoryColumnHandler(ColumnHandler):

  def parse_item(self):
    names = [v.strip() for v in self.raw_value.split("\n")]
    names = [name for name in names if name != ""]
    if not names:
      return None
    categories = CategoryBase.query.filter(and_(
        CategoryBase.name.in_(names),
        CategoryBase.type == self.category_base_type
    )).all()
    category_names = set([c.name.strip() for c in categories])
    for name in names:
      if name not in category_names:
        self.add_warning(errors.WRONG_MULTI_VALUE,
                         column_name=self.display_name,
                         value=name)
    return categories

  def set_obj_attr(self):
    if self.value is None:
      return
    setattr(self.row_converter.obj, self.key, self.value)

  def get_value(self):
    categories = getattr(self.row_converter.obj, self.key, self.value)
    categorie_names = [c.name for c in categories]
    return "\n".join(categorie_names)


class ControlCategoryColumnHandler(CategoryColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.category_base_type = "ControlCategory"
    super(self.__class__, self).__init__(row_converter, key, **options)


class ControlAssertionColumnHandler(CategoryColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.category_base_type = "ControlAssertion"
    super(self.__class__, self).__init__(row_converter, key, **options)


class RequestColumnHandler(ParentColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.parent = Request
    super(RequestColumnHandler, self).__init__(row_converter, key, **options)


class ResponseTypeColumnHandler(ColumnHandler):

  def parse_item(self):
    value = self.raw_value.lower().strip()
    if value not in Response.VALID_TYPES:
      self.add_error(errors.WRONG_MULTI_VALUE,
                     column_name=self.display_name,
                     value=value)
    return value


class ResponseMappedObjectsColumnHandler(ColumnHandler):

  res_types = {v.__mapper_args__.get("polymorphic_identity", None): v.__name__
               for v in response.__dict__.values()
               if isinstance(v, type) and issubclass(v, response.Response)}

  def __init__(self, row_converter, key, **options):
    self.mappable = get_importables()
    self.new_slugs = row_converter.block_converter.converter.new_objects
    super(ResponseMappedObjectsColumnHandler, self) \
        .__init__(row_converter, key, **options)

  def parse_item(self):
    lines = [line.split(":", 1) for line in self.raw_value.splitlines()]
    objects = []
    for line in lines:
      if len(line) != 2:
        self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
        continue
      object_class, slug = line
      slug = slug.strip()
      class_ = self.mappable.get(object_class.strip().lower())
      if class_ is None:
        self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
        continue
      new_object_slugs = self.new_slugs[class_]
      obj = class_.query.filter(class_.slug == slug).first()
      if obj:
        objects.append(obj)
      elif not (slug in new_object_slugs and self.dry_run):
        self.add_warning(errors.UNKNOWN_OBJECT,
                         object_type=class_._inflector.human_singular.title(),
                         slug=slug)
    return objects

  def _mapped_objects(self):
    obj = self.row_converter.obj
    rels = Relationship.query.filter(
        ((Relationship.source_type == obj.type) &
         Relationship.source_id == obj.id) |
        ((Relationship.destination_type == obj.type) &
         Relationship.destination_id == obj.id)).all()
    return [r.source if r.source != obj else r.destination for r in rels]

  def get_value(self):
    lines = ["{}: {}".format(o._inflector.title_singular.title(), o.slug)
             for o in self._mapped_objects()]
    return "\n".join(lines)

  def insert_object(self):
    if self.dry_run or not self.value:
      return
    obj = self.row_converter.obj
    obj_type = self.res_types[obj.response_type]
    existing = set((o.type, o.id) for o in self._mapped_objects())
    desired = set((o.type, o.id) for o in self.value)
    to_delete = existing - desired
    if len(to_delete) > 0:
      Relationship.query.filter(
          or_(*[(((Relationship.source_type == obj_type) &
                  (Relationship.source_id == obj.id) &
                  (Relationship.destination_type == o_type) &
                  (Relationship.destination_id == o_id)) |
                 ((Relationship.destination_type == obj_type) &
                  (Relationship.destination_id == obj.id) &
                  (Relationship.source_type == o_type) &
                  (Relationship.source_id == o_id)))
                for o_type, o_id in to_delete])
      ).delete()

    new_relationships = []
    for relevant_type, relevant_id in desired - existing:
      rel = Relationship(
          source_type=obj_type,
          source_id=obj.id,
          destination_type=relevant_type,
          destination_id=relevant_id
      )
      new_relationships.append(rel)
      db.session.add(rel)
    db.session.flush()
    for rel in new_relationships:
      AutomapperGenerator(rel, False).generate_automappings()
    self.dry_run = True

  def set_obj_attr(self):
    pass


class DocumentsColumnHandler(ColumnHandler):

  def get_value(self):
    lines = ["{} {}".format(d.title, d.link)
             for d in self.row_converter.obj.documents]
    return "\n".join(lines)

  def parse_item(self):
    lines = [line.rsplit(" ", 1) for line in self.raw_value.splitlines()]
    documents = []
    for line in lines:
      if len(line) != 2:
        self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
        continue
      title, link = line
      documents.append(
          all_models.Document(title=title.strip(), link=link.strip()))
    return documents

  def set_obj_attr(self):
    pass

  def insert_object(self):
    if self.dry_run or not self.value:
      return
    self.row_converter.obj.documents = self.value
    self.dry_run = True
