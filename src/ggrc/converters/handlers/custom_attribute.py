# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from dateutil.parser import parse

from ggrc import db
from ggrc.converters import errors
from ggrc.converters.handlers import handlers
from ggrc import models

_types = models.CustomAttributeDefinition.ValidTypes


class CustomAttributeColumHandler(handlers.TextColumnHandler):

  _type_handlers = {
      _types.TEXT: lambda self: self.get_text_value(),
      _types.DATE: lambda self: self.get_date_value(),
      _types.DROPDOWN: lambda self: self.get_dropdown_value(),
      _types.CHECKBOX: lambda self: self.get_checkbox_value(),
      _types.RICH_TEXT: lambda self: self.get_rich_text_value(),
  }

  def parse_item(self):
    self.definition = self.get_ca_definition()
    value = models.CustomAttributeValue(custom_attribute_id=self.definition.id)
    value_handler = self._type_handlers[self.definition.attribute_type]
    value.attribute_value = value_handler(self)
    if value.attribute_value is None:
      return None
    return value

  def get_value(self):
    for value in self.row_converter.obj.custom_attribute_values:
      if value.custom_attribute_id == self.definition.id:
        return value.attribute_value
    return None

  def set_obj_attr(self):
    if self.value:
      self.row_converter.obj.custom_attribute_values.append(self.value)

  def insert_object(self):
    if self.dry_run or self.value is None:
      return
    self.value.attributable_type = self.row_converter.obj.__class__.__name__
    self.value.attributable_id = self.row_converter.obj.id
    db.session.add(self.value)
    self.dry_run = True

  def get_ca_definition(self):
    for definition in self.row_converter.object_class\
            .get_custom_attribute_definitions():
      if definition.title == self.display_name:
        return definition
    return None

  def get_date_value(self):
    if not self.mandatory and self.raw_value == "":
      return None  # ignore empty fields
    value = None
    try:
      value = parse(self.raw_value)
    except:
      self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
    if self.mandatory and value is None:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return value

  def get_checkbox_value(self):
    if not self.mandatory and self.raw_value == "":
      return None  # ignore empty fields
    value = self.raw_value.lower() in ("yes", "true")
    if self.raw_value.lower() not in ("yes", "true", "no", "false"):
      self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
      value = None
    if self.mandatory and value is None:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return value

  def get_dropdown_value(self):
    choices_list = self.definition.multi_choice_options.split(",")
    valid_choices = map(unicode.strip, choices_list)  # noqa
    choice_map = {choice.lower(): choice for choice in valid_choices}
    value = choice_map.get(self.raw_value.lower())
    if value is None and self.raw_value != "":
      self.add_warning(errors.WRONG_VALUE, column_name=self.display_name)
    if self.mandatory and value is None:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return value

  def get_text_value(self):
    if not self.mandatory and self.raw_value == "":
      return None  # ignore empty fields
    value = self.clean_whitespaces(self.raw_value)
    if self.mandatory and not value:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return value

  def get_rich_text_value(self):
    if not self.mandatory and self.raw_value == "":
      return None  # ignore empty fields
    if self.mandatory and not self.raw_value:
      self.add_error(errors.MISSING_VALUE_ERROR, column_name=self.display_name)
    return self.raw_value
