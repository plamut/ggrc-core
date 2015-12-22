# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: david@reciprocitylabs.com
# Maintained By: david@reciprocitylabs.com

from ggrc import db
from ggrc.models.mixins import Base
from ggrc.models.mixins import Described
from ggrc.models.mixins import Identifiable
from ggrc.models.mixins import Mapping
from ggrc.models.mixins import deferred
from sqlalchemy import or_, and_
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import validates
from sqlalchemy.orm.collections import attribute_mapped_collection
from werkzeug.exceptions import BadRequest
import functools


class Relationship(Mapping, db.Model):
  __tablename__ = 'relationships'
  source_id = db.Column(db.Integer, nullable=False)
  source_type = db.Column(db.String, nullable=False)
  destination_id = db.Column(db.Integer, nullable=False)
  destination_type = db.Column(db.String, nullable=False)
  relationship_type_id = db.Column(db.String)
  # FIXME: Should this be a strict constraint?  If so, a migration is needed.
  # relationship_type_id = db.Column(
  #    db.Integer, db.ForeignKey('relationship_types.id'))
  relationship_type = db.relationship(
      'RelationshipType',
      primaryjoin='foreign(RelationshipType.relationship_type) =='
      ' Relationship.relationship_type_id',
      uselist=False
  )
  automapping_id = db.Column(
      db.Integer,
      db.ForeignKey('relationships.id', ondelete='SET NULL'),
      nullable=True,
  )
  automapping = db.relationship(
      lambda: Relationship,
      remote_side=lambda: Relationship.id
  )
  relationship_attrs = db.relationship(
      lambda: RelationshipAttr,
      collection_class=attribute_mapped_collection("attr_name"),
      lazy='joined',  # eager loading
      cascade='all, delete-orphan'
  )
  attrs = association_proxy(
      "relationship_attrs", "attr_value",
      creator=lambda k, v: RelationshipAttr(attr_name=k, attr_value=v)
  )

  @property
  def source_attr(self):
    return '{0}_source'.format(self.source_type)

  @property
  def source(self):
    return getattr(self, self.source_attr)

  @source.setter
  def source(self, value):
    self.source_id = value.id if value is not None else None
    self.source_type = value.__class__.__name__ if value is not None else None
    return setattr(self, self.source_attr, value)

  @property
  def destination_attr(self):
    return '{0}_destination'.format(self.destination_type)

  @property
  def destination(self):
    return getattr(self, self.destination_attr)

  @destination.setter
  def destination(self, value):
    self.destination_id = value.id if value is not None else None
    self.destination_type = value.__class__.__name__ if value is not None \
        else None
    return setattr(self, self.destination_attr, value)

  @validates('relationship_attrs')
  def _validate_attr(self, key, attr):
    """
      Only white-listed attributes can be stored, so users don't use this
      for storing arbitrary data.
    """
    RelationshipAttr.validate_attr(self.source, self.destination,
                                   self.attrs, attr)
    return attr

  @classmethod
  def find_related(cls, object1, object2):
    return cls.get_related_query(object1, object2).first()

  @classmethod
  def get_related_query(cls, object1, object2):
    def predicate(src, dst):
      return and_(
          Relationship.source_type == src.type,
          or_(Relationship.source_id == src.id, src.id == None),  # noqa
          Relationship.destination_type == dst.type,
          or_(Relationship.destination_id == dst.id, dst.id == None),  # noqa
      )
    return Relationship.query.filter(
        or_(predicate(object1, object2), predicate(object2, object1))
    )

  @classmethod
  def update_attributes(cls, object1, object2, new_attrs):
    r = cls.find_related(object1, object2)
    for attr_name, attr_value in new_attrs.iteritems():
      attr = RelationshipAttr(attr_name=attr_name, attr_value=attr_value)
      attr = RelationshipAttr.validate_attr(r.source, r.destination,
                                            r.attrs, attr)
      r.attrs[attr.attr_name] = attr.attr_value
    return r

  @staticmethod
  def _extra_table_args(cls):
    return (
        db.UniqueConstraint(
            'source_id', 'source_type', 'destination_id', 'destination_type'),
        db.Index(
            'ix_relationships_source',
            'source_type', 'source_id'),
        db.Index(
            'ix_relationships_destination',
            'destination_type', 'destination_id'),
    )

  _publish_attrs = [
      'source',
      'destination',
      'relationship_type_id',
      'attrs',
  ]
  attrs.publish_raw = True

  def _display_name(self):
    return "{}:{} <-> {}:{}".format(self.source_type, self.source_id,
                                    self.destination_type, self.destination_id)


class RelationshipType(Described, Base, db.Model):
  __tablename__ = 'relationship_types'
  relationship_type = deferred(db.Column(db.String), 'RelationshipType')
  forward_phrase = deferred(db.Column(db.String), 'RelationshipType')
  backward_phrase = deferred(db.Column(db.String), 'RelationshipType')
  symmetric = deferred(
      db.Column(db.Boolean, nullable=False), 'RelationshipType')

  _publish_attrs = [
      'forward_phrase',
      'backward_phrase',
      'symmetric',
  ]


class Relatable(object):

  @declared_attr
  def related_sources(cls):
    joinstr = 'and_(remote(Relationship.destination_id) == {type}.id, '\
        'remote(Relationship.destination_type) == "{type}")'
    joinstr = joinstr.format(type=cls.__name__)
    return db.relationship(
        'Relationship',
        primaryjoin=joinstr,
        foreign_keys='Relationship.destination_id',
        backref='{0}_destination'.format(cls.__name__),
        cascade='all, delete-orphan')

  @declared_attr
  def related_destinations(cls):
    joinstr = 'and_(remote(Relationship.source_id) == {type}.id, '\
        'remote(Relationship.source_type) == "{type}")'
    joinstr = joinstr.format(type=cls.__name__)
    return db.relationship(
        'Relationship',
        primaryjoin=joinstr,
        foreign_keys='Relationship.source_id',
        backref='{0}_source'.format(cls.__name__),
        cascade='all, delete-orphan')

  _publish_attrs = [
      'related_sources',
      'related_destinations'
  ]

  _include_links = []

  @classmethod
  def eager_query(cls):
    from sqlalchemy import orm

    query = super(Relatable, cls).eager_query()
    return cls.eager_inclusions(query, Relatable._include_links).options(
        orm.subqueryload('related_sources'),
        orm.subqueryload('related_destinations'))


class RelationshipAttr(Identifiable, db.Model):
  """
    Extended attributes for relationships. Used to store relations meta-data
    so the Relationship table can be used in place of join-tables that carry
    extra information
  """

  __tablename__ = 'relationship_attrs'
  relationship_id = db.Column(
      db.Integer,
      db.ForeignKey('relationships.id'),
      primary_key=True
  )
  attr_name = db.Column(db.String, nullable=False)
  attr_value = db.Column(db.String, nullable=False)

  _validators = {}

  @classmethod
  def validate_attr(cls, source, destination, attrs, attr):
    """
      Checks both source and destination type (with mixins) for
      defined validators _validate_relationship_attr
    """
    attr_name = attr.attr_name
    attr_value = attr.attr_value
    validators = cls._get_validators(source) + cls._get_validators(destination)
    for validator in validators:
      validated_value = validator(source, destination, attrs,
                                  attr_name, attr_value)
      if validated_value is not None:
        attr.attr_value = validated_value
        return attr
    raise BadRequest("Invalid attribute {}: {}".format(attr_name, attr_value))

  @classmethod
  def _get_validators(cls, obj):
    target_class = type(obj)
    if target_class not in cls._validators:
      cls._validators[target_class] = cls._gather_validators(target_class)
    return cls._validators[target_class]

  @staticmethod
  def _gather_validators(target_class):
    queue = set([target_class])
    done = set()
    validators = set()
    while queue:
      cls = queue.pop()
      for b in cls.__bases__:
        if b not in done:
          queue.add(b)
      validator = getattr(cls, "_validate_relationship_attr", None)
      if validator is not None:
        validators.add(validator)
    return [functools.partial(v, target_class) for v in validators]
