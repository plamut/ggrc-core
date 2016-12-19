# Copyright (C) 2016 Google Inc.
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>

"""Custom attribute value model"""

from collections import namedtuple

from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy import and_
from sqlalchemy import or_
from sqlalchemy import orm
from sqlalchemy.orm import foreign

from ggrc import db
from ggrc.models.computed_property import computed_property
from ggrc.models.mixins import Base
from ggrc.models.reflection import PublishOnly
from ggrc.models.revision import Revision
from ggrc import utils


class CustomAttributeValue(Base, db.Model):
  """Custom attribute value model"""

  __tablename__ = 'custom_attribute_values'

  _publish_attrs = [
      'custom_attribute_id',
      'attributable_id',
      'attributable_type',
      'attribute_value',
      PublishOnly('attribute_type'),
      'attribute_object',
      PublishOnly('preconditions_failed'),
  ]
  _fulltext_attrs = ["attribute_value"]

  _sanitize_html = [
      "attribute_value",
  ]

  custom_attribute_id = db.Column(
      db.Integer,
      db.ForeignKey('custom_attribute_definitions.id', ondelete="CASCADE")
  )
  attributable_id = db.Column(db.Integer)
  attributable_type = db.Column(db.String)
  attribute_value = db.Column(db.String)

  @computed_property
  def attribute_type(self):
    return self.custom_attribute.attribute_type

  # When the attibute is of a mapping type this will hold the id of the mapped
  # object while attribute_value will hold the type name.
  # For example an instance of attribute type Map:Person will have a person id
  # in attribute_object_id and string 'Person' in attribute_value.
  attribute_object_id = db.Column(db.Integer)

  # pylint: disable=protected-access
  # This is just a mapping for accessing local functions so protected access
  # warning is a false positive
  _validator_map = {
      "Date": lambda self: self._validate_date(),
      "Dropdown": lambda self: self._validate_dropdown(),
      "Map:Person": lambda self: self._validate_map_person(),
  }

  _custom_publish = {
      "attribute_value": lambda self: self._publish_attribute_value(),
  }
  _custom_update = {
      "attribute_value": lambda self, val: self._update_attribute_value(val),
  }

  # formats to represent Date-type values
  DATE_FORMAT_DB = "%Y-%m-%d"
  DATE_FORMAT_JSON = "%m/%d/%Y"

  @property
  def latest_revision(self):
    """Latest revision of CAV (used for comment precondition check)."""
    # TODO: make eager_query fetch only the first Revision
    return self._related_revisions[0]

  @declared_attr
  def _related_revisions(self):
    def join_function():
      """Function to join CAV to its latest revision."""
      resource_id = foreign(Revision.resource_id)
      resource_type = foreign(Revision.resource_type)
      return and_(resource_id == self.id,
                  resource_type == "CustomAttributeValue")

    return db.relationship(
        Revision,
        primaryjoin=join_function,
        viewonly=True,
        order_by=Revision.created_at.desc(),
    )

  @classmethod
  def eager_query(cls):
    query = super(CustomAttributeValue, cls).eager_query()
    query = query.options(
        orm.subqueryload('_related_revisions'),
        orm.joinedload('custom_attribute'),
    )
    return query

  @property
  def attributable_attr(self):
    return '{0}_custom_attributable'.format(self.attributable_type)

  @property
  def attributable(self):
    return getattr(self, self.attributable_attr)

  @attributable.setter
  def attributable(self, value):
    self.attributable_id = value.id if value is not None else None
    self.attributable_type = value.__class__.__name__ if value is not None \
        else None
    return setattr(self, self.attributable_attr, value)

  @property
  def attribute_object(self):
    """Fetch the object referred to by attribute_object_id.

    Use backrefs defined in CustomAttributeMapable.

    Returns:
        A model instance of type specified in attribute_value
    """
    return getattr(self, self._attribute_object_attr)

  @attribute_object.setter
  def attribute_object(self, value):
    """Set attribute_object_id via whole object.

    Args:
        value: model instance
    """
    if value is None:
      # We get here if "attribute_object" does not get resolved.
      # TODO: make sure None value can be set for removing CA attribute object
      # value
      return
    self.attribute_object_id = value.id
    return setattr(self, self._attribute_object_attr, value)

  @property
  def attribute_object_type(self):
    """Fetch the mapped object pointed to by attribute_object_id.

    Returns:
       A model of type referenced in attribute_value
    """
    attr_type = self.custom_attribute.attribute_type
    if not attr_type.startswith("Map:"):
      return None
    return self.attribute_object.__class__.__name__

  @property
  def _attribute_object_attr(self):
    """Compute the relationship property based on object type.

    Returns:
        Property name
    """
    attr_type = self.custom_attribute.attribute_type
    if not attr_type.startswith("Map:"):
      return None
    return 'attribute_{0}'.format(self.attribute_value)

  @classmethod
  def mk_filter_by_custom(cls, obj_class, custom_attribute_id):
    """Get filter for custom attributable object.

    This returns an exists filter for the given predicate, matching it to
    either a custom attribute value, or a value of the matched object.

    Args:
      obj_class: Class of the attributable object.
      custom_attribute_id: Id of the attribute definition.
    Returns:
      A function that will generate a filter for a given predicate.
    """
    from ggrc.models import all_models
    attr_def = all_models.CustomAttributeDefinition.query.filter_by(
        id=custom_attribute_id
    ).first()
    if attr_def and attr_def.attribute_type.startswith("Map:"):
      map_type = attr_def.attribute_type[4:]
      map_class = getattr(all_models, map_type, None)
      if map_class:
        fields = [getattr(map_class, name, None)
                  for name in ["email", "title", "slug"]]
        fields = [field for field in fields if field is not None]

        def filter_by_mapping(predicate):
          return cls.query.filter(
              (cls.custom_attribute_id == custom_attribute_id) &
              (cls.attributable_type == obj_class.__name__) &
              (cls.attributable_id == obj_class.id) &
              (map_class.query.filter(
                  (map_class.id == cls.attribute_object_id) &
                  or_(*[predicate(f) for f in fields])).exists())
          ).exists()
        return filter_by_mapping

    def filter_by_custom(predicate):
      return cls.query.filter(
          (cls.custom_attribute_id == custom_attribute_id) &
          (cls.attributable_type == obj_class.__name__) &
          (cls.attributable_id == obj_class.id) &
          predicate(cls.attribute_value)
      ).exists()
    return filter_by_custom

  def _clone(self, obj):
    """Clone a custom value to a new object."""
    data = {
        "custom_attribute_id": self.custom_attribute_id,
        "attributable_id": obj.id,
        "attributable_type": self.attributable_type,
        "attribute_value": self.attribute_value,
        "attribute_object_id": self.attribute_object_id
    }
    ca_value = CustomAttributeValue(**data)
    db.session.add(ca_value)
    db.session.flush()
    return ca_value

  @staticmethod
  def _extra_table_args(_):
    return (
        db.UniqueConstraint('attributable_id', 'custom_attribute_id'),
    )

  def _validate_map_person(self):
    """Validate and correct mapped person values

    Mapped person custom attribute is only valid if both attribute_value and
    attribute_object_id are set. To keep the custom attribute api consistent
    with other types, we allow setting the value to a string containing both
    in this way "attribute_value:attribute_object_id". This validator checks
    Both scenarios and changes the string value to proper values needed by
    this custom attribute.

    Note: this validator does not check if id is a proper person id.
    """
    if self.attribute_value and ":" in self.attribute_value:
      value, id_ = self.attribute_value.split(":")
      self.attribute_value = value
      self.attribute_object_id = id_

  def _validate_dropdown(self):
    """Validate dropdown opiton."""
    valid_options = set(self.custom_attribute.multi_choice_options.split(","))
    if self.attribute_value:
      self.attribute_value = self.attribute_value.strip()
      if self.attribute_value not in valid_options:
        raise ValueError("Invalid custom attribute dropdown option: {v}, "
                         "expected one of {l}"
                         .format(v=self.attribute_value, l=valid_options))

  def _validate_date(self):
    """Convert date format."""
    from ggrc.models.custom_attribute_definition import (
        CustomAttributeDefinition)
    if (self.custom_attribute.attribute_type ==
            CustomAttributeDefinition.ValidTypes.DATE):
      # convert the date formats for dates
      if self.attribute_value:
        self.attribute_value = utils.convert_date_format(
            self.attribute_value,
            CustomAttributeValue.DATE_FORMAT_JSON,
            CustomAttributeValue.DATE_FORMAT_DB,
        )

  def validate(self):
    """Validate custom attribute value."""
    # pylint: disable=protected-access
    attributable_type = self.attributable._inflector.table_singular
    if not self.custom_attribute:
      raise ValueError("Custom attribute definition not found: Can not "
                       "validate custom attribute value")
    if self.custom_attribute.definition_type != attributable_type:
      raise ValueError("Invalid custom attribute definition used.")
    validator = self._validator_map.get(self.custom_attribute.attribute_type)
    if validator:
      validator(self)

  @computed_property
  def is_empty(self):
    """Return True if the CAV is empty or holds a logically empty value."""
    # The CAV is considered empty when:
    # - the value is empty
    if not self.attribute_value:
      return True
    # - the type is Checkbox and the value is 0
    if (self.custom_attribute.attribute_type ==
            self.custom_attribute.ValidTypes.CHECKBOX and
            str(self.attribute_value) == "0"):
      return True
    # - the type is a mapping and the object value id is empty
    if (self.attribute_object_type is not None and
            not self.attribute_object_id):
      return True
    # Otherwise it the CAV is not empty
    return False

  @computed_property
  def preconditions_failed(self):
    """A list of requirements self introduces that are unsatisfied.

    Returns:
      [str] - a list of unsatisfied requirements; possible items are: "value" -
              missing mandatory value, "comment" - missing mandatory comment,
              "evidence" - missing mandatory evidence.

    """
    failed_preconditions = []
    if self.custom_attribute.mandatory and self.is_empty:
      failed_preconditions += ["value"]
    if (self.custom_attribute.attribute_type ==
            self.custom_attribute.ValidTypes.DROPDOWN):
      failed_preconditions += self._check_dropdown_requirements()
    return failed_preconditions or None

  def _check_dropdown_requirements(self):
    """Check mandatory comment and mandatory evidence for dropdown CAV."""
    failed_preconditions = []
    options_to_flags = self._multi_choice_options_to_flags(
        self.custom_attribute,
    )
    flags = options_to_flags.get(self.attribute_value)
    if flags:
      if flags.comment_required:
        failed_preconditions += self._check_mandatory_comment()
      if flags.evidence_required:
        failed_preconditions += self._check_mandatory_evidence()
    return failed_preconditions

  def _check_mandatory_comment(self):
    """Check presence of mandatory comment."""
    if hasattr(self.attributable, "comments"):
      comment_found = any(
          self.custom_attribute_id == (comment
                                       .custom_attribute_definition_id) and
          self.latest_revision.id == comment.revision_id
          for comment in self.attributable.comments
      )
    else:
      comment_found = False
    if not comment_found:
      return ["comment"]
    else:
      return []

  def _check_mandatory_evidence(self):
    """Check presence of mandatory evidence."""
    if hasattr(self.attributable, "object_documents"):
      # Note: this is a suboptimal implementation of mandatory evidence check;
      # it should be refactored once Evicence-CA mapping is introduced
      def evidence_required(cav):
        """Return True if an evidence is required for this `cav`."""
        flags = (self._multi_choice_options_to_flags(cav.custom_attribute)
                 .get(cav.attribute_value))
        return flags and flags.evidence_required
      evidence_found = (len(self.attributable.object_documents) >=
                        len([cav
                             for cav in self.attributable
                                            .custom_attribute_values
                             if evidence_required(cav)]))
    else:
      evidence_found = False
    if not evidence_found:
      return ["evidence"]
    else:
      return []

  @staticmethod
  def _multi_choice_options_to_flags(cad):
    """Parse mandatory comment and evidence flags from dropdown CA definition.

    Args:
      cad - a CA definition object

    Returns:
      {option_value: Flags} - a dict from dropdown options values to Flags
                              objects where Flags.comment_required and
                              Flags.evidence_required correspond to the values
                              from multi_choice_mandatory bitmasks
    """
    flags = namedtuple("Flags", ["comment_required", "evidence_required"])

    def make_flags(multi_choice_mandatory):
      flags_mask = int(multi_choice_mandatory)
      return flags(comment_required=flags_mask & (cad
                                                  .MultiChoiceMandatoryFlags
                                                  .COMMENT_REQUIRED),
                   evidence_required=flags_mask & (cad
                                                   .MultiChoiceMandatoryFlags
                                                   .EVIDENCE_REQUIRED))

    if not cad.multi_choice_options or not cad.multi_choice_mandatory:
      return {}
    else:
      return dict(zip(
          cad.multi_choice_options.split(","),
          (make_flags(mask)
           for mask in cad.multi_choice_mandatory.split(",")),
      ))

  def _publish_attribute_value(self):
    """Return value serialized for JSON.

    If self is a Date-type CAV, convert it to MM/DD/YYYY.
    """

    from ggrc.models import CustomAttributeDefinition

    result = self.attribute_value
    literal_date = CustomAttributeDefinition.ValidTypes.DATE

    self_is_date = self.custom_attribute.attribute_type == literal_date
    if self_is_date and self.attribute_value:
      try:
        result = utils.convert_date_format(self.attribute_value,
                                           self.DATE_FORMAT_DB,
                                           self.DATE_FORMAT_JSON)
      except ValueError:
        # invalid format or not a date, don't convert
        pass

    return result

  def _update_attribute_value(self, new_value):
    """Update value from received JSON.

    If self is a Date-type CAV, convert the received value to YYYY-MM-DD.
    """

    from ggrc.models import CustomAttributeDefinition

    literal_date = CustomAttributeDefinition.ValidTypes.DATE

    # pylint: disable=access-member-before-definition
    # pylint: disable=attribute-defined-outside-init
    # false positives on the next block; the author doesn't like that block too
    if self.custom_attribute is None:
      # self is newly created and is not yet flushed to the db
      # manually store self.custom_attribute because it is cached as None until
      # flush & expire
      self.custom_attribute = (db.session.query(CustomAttributeDefinition)
                               .filter_by(id=self.custom_attribute_id).one())

    self_is_date = self.custom_attribute.attribute_type == literal_date
    if self_is_date and new_value:
      try:
        new_value = utils.convert_date_format(new_value,
                                              self.DATE_FORMAT_JSON,
                                              self.DATE_FORMAT_DB)
      except ValueError:
        # invalid format or not a date, don't convert
        pass

    self.attribute_value = new_value
