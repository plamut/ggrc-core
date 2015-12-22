# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: dan@reciprocitylabs.com

"""Utilties to deal with introspecting gGRC models for publishing, creation,
and update from resource format representations, such as JSON."""

from sqlalchemy.sql.schema import UniqueConstraint

from ggrc.utils import get_mapping_rules
from ggrc.utils import title_from_camelcase


ATTRIBUTE_ORDER = (
    "slug",
    "audit",
    "request_audit",
    "control",
    "program",
    "task_group",
    "workflow",
    "title",
    "description",
    "notes",
    "test_plan",
    "owners",
    "request_type",
    "related_requesters",
    "related_assignees",
    "related_verifiers",
    "program_owner",
    "program_editor",
    "program_reader",
    "program_mapped",
    "workflow_owner",
    "workflow_member",
    "task_type",
    "requested_on",
    "due_on",
    "start_date",
    "end_date",
    "report_start_date",
    "report_end_date",
    "relative_start_date",
    "relative_end_date",
    "status",
    "assertions",
    "categories",
    "contact",
    "design",
    "directive",
    "fraud_related",
    "key_control",
    "kind",
    "link",
    "private",
    "means",
    "network_zone",
    "operationally",
    "principal_assessor",
    "secondary_assessor",
    "secondary_contact",
    "url",
    "reference_url",
    "verify_frequency",
    "name",
    "email",
    "is_enabled",
    "company",
    "user_role",
    "test",
)


class DontPropagate(object):

  """Attributes wrapped by ``DontPropagate`` instances should not be considered
  to be a part of an inherited list. For example, ``_update_attrs`` can be
  inherited from ``_publish_attrs`` if left unspecified. This class provides
  a mechanism to use that inheritance while excluding some elements from the
  resultant inherited list. For example, this:

  .. sourcecode::

    _publish_attrs = [
      'inherited_attr',
      DontPropagate('not_inherited_attr'),
      ]

  is equivalent to this:

  .. sourcecode::

    _publish_attrs = [
    'inherited_attr',
    'not_inherited_attr',
    ]
    _update_attrs = [
    'inherited_attr',
    ]
  """

  def __init__(self, attr_name):
    self.attr_name = attr_name


class PublishOnly(DontPropagate):

  """Alias of ``DontPropagate`` for use in a ``_publish_attrs`` specification.
  """
  pass


class AttributeInfo(object):

  """Gather model CRUD information by reflecting on model classes. Builds and
  caches a list of the publishing properties for a class by walking the
  class inheritance tree.
  """

  MAPPING_PREFIX = "__mapping__:"
  UNMAPPING_PREFIX = "__unmapping__:"
  CUSTOM_ATTR_PREFIX = "__custom__:"

  class Type(object):
    PROPERTY = "property"
    MAPPING = "mapping"
    SPECIAL_MAPPING = "special_mapping"
    CUSTOM = "custom"
    USER_ROLE = "user_role"


  def __init__(self, tgt_class):
    self._publish_attrs = AttributeInfo.gather_publish_attrs(tgt_class)
    self._stub_attrs = AttributeInfo.gather_stub_attrs(tgt_class)
    self._update_attrs = AttributeInfo.gather_update_attrs(tgt_class)
    self._create_attrs = AttributeInfo.gather_create_attrs(tgt_class)
    self._include_links = AttributeInfo.gather_include_links(tgt_class)
    self._aliases = AttributeInfo.gather_aliases(tgt_class)

  @classmethod
  def iter_bases_attrs(cls, tgt_class, src_attrs):
    src_attrs = src_attrs if type(src_attrs) is list else [src_attrs]
    for base in tgt_class.mro():
      for attr in src_attrs:
        if attr in tgt_class.__dict__:
          yield getattr(tgt_class, attr, None)

  @classmethod
  def gather_attr_dicts(cls, tgt_class, src_attr):
    """ Gather dictionaries from target class parets """
    result = {}
    for base_class in tgt_class.__bases__:
      base_result = cls.gather_attr_dicts(base_class, src_attr)
      result.update(base_result)
    attrs = getattr(tgt_class, src_attr, {})
    result.update(attrs)
    return result

  @classmethod
  def gather_attrs(cls, tgt_class, src_attrs, accumulator=None,
                   main_class=None):
    """Gathers the attrs to be included in a list for publishing, update, or
    some other purpose. Supports inheritance by iterating the list of
    ``src_attrs`` until a list is found.

    Inheritance of some attributes can be circumvented through use of the
    ``DontPropoagate`` decorator class.
    """
    if main_class is None:
      main_class = tgt_class
    src_attrs = src_attrs if type(src_attrs) is list else [src_attrs]
    accumulator = accumulator if accumulator is not None else set()
    ignore_dontpropagate = True
    for attr in src_attrs:
      attrs = None
      # Only get the attribute if it is defined on the target class, but
      # get it via `getattr`, to handle `@declared_attr`
      if attr in tgt_class.__dict__:
        attrs = getattr(tgt_class, attr, None)
        if callable(attrs):
          attrs = attrs(main_class)
      if attrs is not None:
        if not ignore_dontpropagate:
          attrs = [a for a in attrs if not isinstance(a, DontPropagate)]
        else:
          attrs = [a if not isinstance(a, DontPropagate) else a.attr_name for
                   a in attrs]
        accumulator.update(attrs)
        break
      else:
        ignore_dontpropagate = False
    for base in tgt_class.__bases__:
      cls.gather_attrs(base, src_attrs, accumulator, main_class=main_class)
    return accumulator

  @classmethod
  def gather_publish_attrs(cls, tgt_class):
    return cls.gather_attrs(tgt_class, '_publish_attrs')

  @classmethod
  def gather_aliases(cls, tgt_class):
    return cls.gather_attr_dicts(tgt_class, '_aliases')

  @classmethod
  def gather_stub_attrs(cls, tgt_class):
    return cls.gather_attrs(tgt_class, '_stub_attrs')

  @classmethod
  def gather_update_attrs(cls, tgt_class):
    attrs = cls.gather_attrs(tgt_class, ['_update_attrs', '_publish_attrs'])
    return attrs

  @classmethod
  def gather_create_attrs(cls, tgt_class):
    return cls.gather_attrs(tgt_class, [
        '_create_attrs', '_update_attrs', '_publish_attrs'])

  @classmethod
  def gather_include_links(cls, tgt_class):
    return cls.gather_attrs(tgt_class, ['_include_links'])

  @classmethod
  def get_mapping_definitions(cls, object_class):
    """ Get column definitions for allowed mappings for object_class """
    definitions = {}
    mapping_rules = get_mapping_rules()
    object_mapping_rules = mapping_rules.get(object_class.__name__, [])

    for mapping_class in object_mapping_rules:
      class_name = title_from_camelcase(mapping_class)
      mapping_name = "{}{}".format(cls.MAPPING_PREFIX, class_name)
      definitions[mapping_name.lower()] = {
          "display_name": "map:{}".format(class_name),
          "attr_name": mapping_class.lower(),
          "mandatory": False,
          "unique": False,
          "description": "",
          "type": cls.Type.MAPPING,
      }

      unmapping_name = "{}{}".format(cls.UNMAPPING_PREFIX, class_name)
      definitions[unmapping_name.lower()] = {
          "display_name": "unmap:{}".format(class_name),
          "attr_name": mapping_class.lower(),
          "mandatory": False,
          "unique": False,
          "description": "",
          "type": cls.Type.MAPPING,
      }

    return definitions

  @classmethod
  def get_custom_attr_definitions(cls, object_class):
    """ Get column definitions for custom attributes on object_class """
    definitions = {}
    if not hasattr(object_class, "get_custom_attribute_definitions"):
      return definitions
    custom_attributes = object_class.get_custom_attribute_definitions()
    for attr in custom_attributes:
      attr_name = "{}{}".format(cls.CUSTOM_ATTR_PREFIX, attr.id)
      definitions[attr_name] = {
          "display_name": attr.title,
          "attr_name": attr.title,
          "mandatory": attr.mandatory,
          "unique": False,
          "description": "",
          "type": cls.Type.CUSTOM,
      }
    return definitions

  @classmethod
  def get_unique_constraints(cls, object_class):
    """ Return a set of attribute names for single unique columns """
    constraints = object_class.__table__.constraints
    unique = filter(lambda x: isinstance(x, UniqueConstraint), constraints)
    # we only handle single column unique constraints
    unique_columns = [u.columns.keys() for u in unique if len(u.columns) == 1]
    return set(sum(unique_columns, []))

  @classmethod
  def get_object_attr_definitions(cls, object_class):
    """ get all column definitions for object_class

    This function joins custm attribute definitions, mapping definitions and
    the extra delete column.
    """
    definitions = {}

    aliases = AttributeInfo.gather_aliases(object_class)
    filtered_aliases = [(k, v) for k, v in aliases.items() if v is not None]

    # push the extra delete column at the end to override any custom behavior
    if hasattr(object_class, "slug") or hasattr(object_class, "email"):
      filtered_aliases.append(("delete", {
        "display_name": "Delete",
        "import_only": True,
        "description": "",
      }))

    unique_columns = cls.get_unique_constraints(object_class)

    for key, value in filtered_aliases:
      column = object_class.__table__.columns.get(key)
      definition = {
          "display_name": value,
          "attr_name": key,
          "mandatory": False if column is None else not column.nullable,
          "unique": key in unique_columns,
          "description": "",
          "type": cls.Type.PROPERTY,
          "handler_key": key,
      }
      if type(value) is dict:
        definition.update(value)
      definitions[key] = definition

    definitions.update(cls.get_custom_attr_definitions(object_class))
    definitions.update(cls.get_mapping_definitions(object_class))

    return definitions

  @classmethod
  def get_attr_definitions_array(cls, object_class):
    """ get all column definitions containing only json serializable data """
    definitions = cls.get_object_attr_definitions(object_class)
    order = cls.get_column_order(definitions.keys())
    result = []
    for key in order:
      item = definitions[key]
      item["key"] = key
      result.append(item)
    return result

  @classmethod
  def get_column_order(cls, attr_list):
    """ Sort attribute list

    Attribute list should be sorted with 3 rules:
      - attributes in ATTRIBUTE_ORDER variable must be fist and in the same
        order as defined in that variable.
      - Custom Attributes are sorted alphabetically after default attributes
      - mapping attributes are sorted alphabetically and placed last
    """
    attr_set = set(attr_list)
    default_attrs = [v for v in ATTRIBUTE_ORDER if v in attr_set]
    default_set = set(default_attrs)
    other_attrs = [v for v in attr_list if v not in default_set]
    custom_attrs = [v for v in other_attrs if not v.lower().startswith("map:")]
    mapping_attrs = [v for v in other_attrs if v.lower().startswith("map:")]
    custom_attrs.sort(key=lambda x: x.lower())
    mapping_attrs.sort(key=lambda x: x.lower())
    return default_attrs + custom_attrs + mapping_attrs


class SanitizeHtmlInfo(AttributeInfo):

  def __init__(self, tgt_class):
    self._sanitize_html = SanitizeHtmlInfo.gather_attrs(
        tgt_class, '_sanitize_html')
