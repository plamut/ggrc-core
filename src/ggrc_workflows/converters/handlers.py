# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

""" Module for all special column handlers for workflow objects """

import datetime

from ggrc import db
from ggrc import models
from ggrc.converters import errors
from ggrc.converters import get_importables
from ggrc.converters.handlers import handlers
from ggrc_basic_permissions import models as bp_models
from ggrc_workflows import models as wf_models


class FrequencyColumnHandler(handlers.ColumnHandler):

  """ Handler for workflow frequency column """

  frequency_map = {
      "one time": "one_time"
  }

  def parse_item(self):
    """ parse frequency value

    Returning None will set the default frequency to one_time.
    """
    if not self.raw_value:
      self.add_error(errors.MISSING_COLUMN, s="",
                     column_names=self.display_name)
      return None
    value = self.raw_value.lower()
    frequency = self.frequency_map.get(value, value)
    if frequency not in self.row_converter.object_class.VALID_FREQUENCIES:
      self.add_error(errors.WRONG_VALUE_ERROR, column_name=self.display_name)
    return frequency

  def get_value(self):
    reverse_map = {v: k for k, v in self.frequency_map.items()}
    value = getattr(self.row_converter.obj, self.key, self.value)
    return reverse_map.get(value, value)


class WorkflowColumnHandler(handlers.ParentColumnHandler):

  """ handler for workflow column in task groups """

  def __init__(self, row_converter, key, **options):
    """ init workflow handler """
    self.parent = wf_models.Workflow
    super(WorkflowColumnHandler, self).__init__(row_converter, key, **options)


class TaskGroupColumnHandler(handlers.ParentColumnHandler):

  """ handler for task group column in task group tasks """

  def __init__(self, row_converter, key, **options):
    """ init task group handler """
    self.parent = wf_models.TaskGroup
    super(TaskGroupColumnHandler, self).__init__(row_converter, key, **options)


class CycleTaskGroupColumnHandler(handlers.ParentColumnHandler):

  """ handler for task group column in task group tasks """

  def __init__(self, row_converter, key, **options):
    """ init task group handler """
    self.parent = wf_models.CycleTaskGroup
    super(CycleTaskGroupColumnHandler, self) \
        .__init__(row_converter, key, **options)


class TaskDateColumnHandler(handlers.ColumnHandler):

  """ handler for start and end columns in task group tasks """

  quarterly_names = {
      1: "Jan/Apr/Jul/Oct",
      2: "Feb/May/Aug/Nov",
      3: "Mar/Jun/Sep/Dec",
  }

  def parse_item(self):
    """ parse start and end columns fow workflow tasks
    """
    raw_parts = self.raw_value.lower().split(" ")
    try:
      if len(raw_parts) == 2:
        quarter_name, day = raw_parts
        for month, quarter in self.quarterly_names.items():
          if quarter.lower() == quarter_name:
            return [month, int(day)]
      raw_parts = self.raw_value.split("/")
      return map(int, raw_parts)
    except ValueError:
      self.add_error(errors.WRONG_VALUE_ERROR,
                     column_name=self.display_name)
      return

  def get_value(self):
    start = "start" in self.key
    obj = self.row_converter.obj
    freq = obj.task_group.workflow.frequency
    date = getattr(obj, "start_date" if start else "end_date", None)
    month = getattr(obj, "relative_start_month" if start
                    else "relative_end_month", None)
    day = getattr(obj, "relative_start_day" if start
                       else "relative_end_day", None)
    if freq == "one_time":
      if date is None:
        return ""
      return "{}/{}/{}".format(date.month, date.day, date.year)
    elif freq in ["weekly", "monthly"]:
      if day is None:
        return ""
      return str(day)
    elif freq == "quarterly":
      quarter = self.quarterly_names.get(month, None)
      if None in [day, quarter]:
        return ""
      return "{} {}".format(quarter, day)
    elif freq == "annually":
      if None in [day, month]:
        return ""
      return "{}/{}".format(month, day)
    else:
      return ""


class TaskStartColumnHandler(TaskDateColumnHandler):

  """ handler for start column in task group tasks """

  def set_obj_attr(self):
    """ set all possible start date attributes """
    freq = self.row_converter.obj.task_group.workflow.frequency
    if freq == "one_time":
      if len(self.value) != 3:
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      month, day, year = self.value
      try:
        self.row_converter.obj.start_date = datetime.date(year, month, day)
      except ValueError:
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
    elif freq in ["weekly", "monthly"]:
      if len(self.value) != 1 or \
         (freq == "weekly" and not (1 <= self.value[0] <= 5)) or \
         (freq == "monthly" and not (1 <= self.value[0] <= 31)):
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      self.row_converter.obj.relative_start_day = self.value[0]
    elif freq in ["quarterly", "annually"]:
      if len(self.value) != 2 or \
         (freq == "quarterly" and not (1 <= self.value[0] <= 3)) or \
         (freq == "annually" and not (1 <= self.value[0] <= 12)) or \
         not (1 <= self.value[1] <= 31):
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      self.row_converter.obj.relative_start_day = self.value[1]
      self.row_converter.obj.relative_start_month = self.value[0]
    else:
      self.add_error(errors.WRONG_VALUE_ERROR,
                     column_name=self.display_name)
      return


class TaskEndColumnHandler(TaskDateColumnHandler):

  """ handler for end column in task group tasks """

  def set_obj_attr(self):
    """ set all possible end date attributes """
    freq = self.row_converter.obj.task_group.workflow.frequency
    if freq == "one_time":
      if len(self.value) != 3:
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      month, day, year = self.value
      try:
        self.row_converter.obj.end_date = datetime.date(year, month, day)
      except ValueError:
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
    elif freq in ["weekly", "monthly"]:
      if len(self.value) != 1 or \
         (freq == "weekly" and not (1 <= self.value[0] <= 5)) or \
         (freq == "monthly" and not (1 <= self.value[0] <= 31)):
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      self.row_converter.obj.relative_end_day = self.value[0]
    elif freq in ["quarterly", "annually"]:
      if len(self.value) != 2 or \
         (freq == "quarterly" and not (1 <= self.value[0] <= 3)) or \
         (freq == "annually" and not (1 <= self.value[0] <= 12)) or \
         not (1 <= self.value[1] <= 31):
        self.add_error(errors.WRONG_VALUE_ERROR,
                       column_name=self.display_name)
        return
      self.row_converter.obj.relative_end_day = self.value[1]
      self.row_converter.obj.relative_end_month = self.value[0]
    else:
      self.add_error(errors.WRONG_VALUE_ERROR,
                     column_name=self.display_name)
      return


class TaskTypeColumnHandler(handlers.ColumnHandler):

  """ handler for task type column in task group tasks """

  type_map = {
      "rich text": "text",
      "dropdown": "menu",
      "drop down": "menu",
      "checkboxes": "checkbox",
      "checkbox": "checkbox",
  }

  def parse_item(self):
    """ parse task type column value """
    if self.raw_value == "":
      self.add_warning(errors.MISSING_VALUE_ERROR,
                       column_name=self.display_name)
      return None
    value = self.type_map.get(self.raw_value.lower())
    if value is None:
      if self.raw_value.lower() in self.type_map.values():
        value = self.raw_value.lower()
    if value is None:
      self.add_warning(errors.WRONG_REQUIRED_VALUE,
                       value=self.raw_value,
                       column_name=self.display_name)
      value = self.row_converter.obj.default_task_type()
    return value


class WorkflowPersonColumnHandler(handlers.UserColumnHandler):

  def parse_item(self):
    return self.get_users_list()

  def set_obj_attr(self):
    pass

  def get_value(self):
    workflow_person = db.session.query(wf_models.WorkflowPerson.person_id)\
        .filter_by(workflow_id=self.row_converter.obj.id,)
    workflow_roles = db.session.query(bp_models.UserRole.person_id)\
        .filter_by(context_id=self.row_converter.obj.context_id)
    users = models.Person.query.filter(
        models.Person.id.in_(workflow_person) &
        models.Person.id.notin_(workflow_roles)
    )
    emails = [user.email for user in users]
    return "\n".join(emails)

  def remove_current_people(self):
    wf_models.WorkflowPerson.query.filter_by(
        workflow_id=self.row_converter.obj.id).delete()

  def insert_object(self):
    if self.dry_run or not self.value:
      return
    self.remove_current_people()
    for owner in self.value:
      workflow_person = wf_models.WorkflowPerson(
          workflow=self.row_converter.obj,
          person=owner,
          context=self.row_converter.obj.context
      )
      db.session.add(workflow_person)
    self.dry_run = True


class ObjectsColumnHandler(handlers.ColumnHandler):

  def __init__(self, row_converter, key, **options):
    self.mappable = get_importables()
    self.new_slugs = row_converter.block_converter.converter.new_objects
    super(ObjectsColumnHandler, self).__init__(row_converter, key, **options)

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

  def set_obj_attr(self):
    self.value = self.parse_item()

  def get_value(self):
    task_group_objects = wf_models.TaskGroupObject.query.filter_by(
        task_group_id=self.row_converter.obj.id).all()
    lines = ["{}: {}".format(t.object._inflector.title_singular.title(),
                             t.object.slug)
             for t in task_group_objects if t.object is not None]
    return "\n".join(lines)

  def insert_object(self):
    obj = self.row_converter.obj
    existing = set((t.object_type, t.object_id)
                   for t in obj.task_group_objects)
    for object_ in self.value:
      if (object_.type, object_.id) in existing:
        continue
      tgo = wf_models.TaskGroupObject(
          task_group=obj,
          object=object_,
          context=obj.context,
      )
      db.session.add(tgo)
    db.session.flush()

  def set_value(self):
    pass


class ExportOnlyColumnHandler(handlers.ColumnHandler):

  def parse_item(self):
    pass

  def set_obj_attr(self):
    pass

  def get_value(self):
    return ""

  def insert_object(self):
    pass

  def set_value(self):
    pass


class CycleObjectColumnHandler(ExportOnlyColumnHandler):

  def get_value(self):
    obj = self.row_converter.obj.cycle_task_group_object
    if not obj or not obj.object:
      return ""
    return "{}: {}".format(obj.object._inflector.human_singular.title(),
                           obj.object.slug)


class CycleWorkflowColumnHandler(ExportOnlyColumnHandler):

  def get_value(self):
    return self.row_converter.obj.workflow.slug


class CycleColumnHandler(ExportOnlyColumnHandler):

  def get_value(self):
    return self.row_converter.obj.cycle.slug


class TaskDescriptionColumnHandler(handlers.TextareaColumnHandler):

  def set_obj_attr(self):
    """ Set task attribute based on task type """
    if not self.value:
      return
    if self.row_converter.obj.task_type == "text":
      self.row_converter.obj.description = self.value
    else:
      options = [v.strip() for v in self.value.split(",")]
      self.row_converter.obj.response_options = options

  def get_value(self):
    if self.row_converter.obj.task_type == "text":
      return self.row_converter.obj.description
    else:
      return ", ".join(self.row_converter.obj.response_options)


COLUMN_HANDLERS = {
    "cycle": CycleColumnHandler,
    "cycle_object": CycleObjectColumnHandler,
    "cycle_task_group": CycleTaskGroupColumnHandler,
    "cycle_workflow": CycleWorkflowColumnHandler,
    "frequency": FrequencyColumnHandler,
    "notify_on_change": handlers.CheckboxColumnHandler,
    "relative_end_date": TaskEndColumnHandler,
    "relative_start_date": TaskStartColumnHandler,
    "task_description": TaskDescriptionColumnHandler,
    "task_group": TaskGroupColumnHandler,
    "task_group_objects": ObjectsColumnHandler,
    "task_type": TaskTypeColumnHandler,
    "workflow": WorkflowColumnHandler,
    "workflow_mapped": WorkflowPersonColumnHandler,
}
