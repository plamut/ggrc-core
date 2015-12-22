# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

from ggrc.converters.handlers.handlers import UserColumnHandler

COLUMN_HANDLERS = {
    "ra_counsel": UserColumnHandler,
    "ra_manager": UserColumnHandler,
}
