# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

WRONG_FILE_TYPE = (u"Line {line}: Wrong file type. Only .csv files are"
                   " supported. Please upload a .csv file.")

MISSING_COLUMN = (u"Line {line}: Missing mandatory column{s} {column_names},"
                  " when adding object.")

MISSING_CUSTOM_ATTRIBUTE_COLUMN = (u"Line {line}: Missing custom column"
                                   " {column_name}, when adding object.")

WRONG_OBJECT_TYPE = u"Line {line}: Unknown object type '{object_name}'"

UNKNOWN_COLUMN = (u"Line {line}: Attribute '{column_name}' does not"
                  " exist. Column will be ignored.")

DELETE_UNKNOWN_OBJECT = (u"Line {line}: Object '{slug}' does not exist, so it"
                         " can't be deleted.")

DUPLICATE_COLUMN = (u"Line {line}: Duplicate columns found {duplicates}."
                   " Object block will be ignored.")

DUPLICATE_VALUE = (u"Line {line}: {column_name} '{value}' already exists."
                   "Record will be ignored.")

DUPLICATE_VALUE_IN_CSV = (u"Lines {line_list} have same {column_name}"
                          " '{value}'. Line{s} {ignore_lines} will be"
                          " ignored.")

MAP_UNMAP_CONFLICT = (u"Line {line}: Object '{slug}' scheduled for mapping and"
                      " unmapping at the same time. Mapping rule update will"
                      " be ignored.")

UNKNOWN_OBJECT = (u"Line {line}: {object_type} '{slug}' doesn't exist, so it"
                  " can't be mapped/unmapped.")

WHITESPACE_WARNING = (u"Line {line}: Field {column_name} contains multiple"
                      "spaces together, that will be merged into one.")

UNKNOWN_USER_WARNING = (u"Line {line}: Specified user '{email}' does not exist."
                        " That user will be ignored.")

UNKNOWN_USER_ERROR = (u"Specified user '{email}' does not exist. That user will"
                      " be ignored.")

OWNER_MISSING = (u"Line {line}: Owner field does not contain a valid owner."
                 " You will be assigned as object owner.")

WRONG_MULTI_VALUE = (u"Line {line}: {column_name} contains invalid line. The"
                     " value '{value}' will be ignored.")

WRONG_VALUE = (u"Line {line}: {column_name} contains invalid data. The value"
               " will be ignored.")

WRONG_VALUE_ERROR = (u"Line {line}: {column_name} contains invalid data. The"
                     " line will be ignored.")

WRONG_REQUIRED_VALUE = (u"Line {line}: Required field {column_name} contains"
                        " invalid data '{value}'. The default value will be"
                        " used.")

MISSING_VALUE_ERROR = (u"Line {line}: Field {column_name} is required. The line"
                       " will be ignored.")

PERMISSION_ERROR = (u"Line {line}: You don't have permission to update/delete"
                    " this record.")

MAPPING_PERMISSION_ERROR = (u"Line {line}: You don't have permission to update"
                            " mappings for {object_type}: {slug}.")

DELETE_NEW_OBJECT_ERROR = (u"Line {line}: Tried to create and delete the same"
                           " object {object_type}: {slug} in one import.")

DELETE_CASCADE_ERROR = (u"Line {line}: Cannot delete object {object_type}:"
                        " {slug} without deleting other objects")

UNKNOWN_ERROR = "Line {line}: Import failed due to unknown error."
