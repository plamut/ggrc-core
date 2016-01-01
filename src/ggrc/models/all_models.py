# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: david@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

"""All gGRC model classes grouped together for convenience."""

# TODO: Implement with Authentication
# from .account import Account
from ggrc.models.access_group import AccessGroup
from ggrc.models.audit import Audit
from ggrc.models.audit_object import AuditObject
from ggrc.models.comment import Comment
from ggrc.models.categorization import Categorization
from ggrc.models.category import CategoryBase
from ggrc.models.context import Context
from ggrc.models.control import Control, ControlCategory, ControlAssertion
from ggrc.models.control_assessment import ControlAssessment
from ggrc.models.custom_attribute_definition import CustomAttributeDefinition
from ggrc.models.custom_attribute_value import CustomAttributeValue
from ggrc.models.data_asset import DataAsset
from ggrc.models.directive import Directive, Regulation, Policy, Contract, Standard
from ggrc.models.document import Document
from ggrc.models.facility import Facility
from ggrc.models.help import Help
from ggrc.models.market import Market
from ggrc.models.object_document import ObjectDocument
from ggrc.models.object_owner import ObjectOwner
from ggrc.models.object_person import ObjectPerson
from ggrc.models.object_type import ObjectType
from ggrc.models.objective import Objective
from ggrc.models.option import Option
from ggrc.models.org_group import OrgGroup
from ggrc.models.vendor import Vendor
from ggrc.models.person import Person
from ggrc.models.product import Product
from ggrc.models.program import Program
from ggrc.models.project import Project
from ggrc.models.relationship import Relationship
from ggrc.models.relationship import RelationshipAttr
from ggrc.models.request import Request
from ggrc.models.response import (
    Response, DocumentationResponse, InterviewResponse,
    PopulationSampleResponse
)
from ggrc.models.meeting import Meeting
from ggrc.models.background_task import BackgroundTask
from ggrc.models.notification import NotificationConfig, NotificationType, Notification
from ggrc.models.issue import Issue

from .section import Section
from .clause import Clause
from .system import SystemOrProcess, System, Process

from .revision import Revision
from .event import Event
all_models = [
    AccessGroup,
    Audit,
    AuditObject,
    Categorization,
    CategoryBase,
    ControlCategory,
    ControlAssertion,
    Context,
    Control,
    ControlAssessment,
    Comment,
    CustomAttributeDefinition,
    CustomAttributeValue,
    DataAsset,
    Directive,
    Contract,
    Policy,
    Regulation,
    Standard,
    Document,
    Facility,
    Help,
    Market,
    Meeting,
    Objective,
    ObjectDocument,
    ObjectOwner,
    ObjectPerson,
    ObjectType,
    Option,
    OrgGroup,
    Vendor,
    Person,
    Product,
    Program,
    Project,
    Relationship,
    RelationshipAttr,
    Request,
    Response,
    DocumentationResponse,
    InterviewResponse,
    PopulationSampleResponse,
    Section,
    Clause,
    SystemOrProcess,
    System,
    Process,
    Revision,
    Event,
    BackgroundTask,
    NotificationConfig,
    NotificationType,
    Notification,
    Issue
]

__all__ = [model.__name__ for model in all_models]


def register_model(model):
  import ggrc.models.all_models
  setattr(ggrc.models.all_models, model.__name__, model)
  model._inflector
  all_models.append(model)
  __all__.append(model.__name__)


def unregister_model(model):
  import ggrc.models.all_models
  import ggrc.models.inflector
  delattr(ggrc.models.all_models, model.__name__)
  ggrc.models.inflector.unregister_inflector(model._inflector)
  if model in all_models:
    all_models.remove(model)
  if model.__name__ in __all__:
    __all__.remove(model.__name__)
