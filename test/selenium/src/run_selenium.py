#!/usr/bin/env python2.7
# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: miha@reciprocitylabs.com
# Maintained By: miha@reciprocitylabs.com

import sys
import os
import commands
import logging
import pytest

from lib import constants
from lib import file_ops
from lib import log
from lib import virtual_env
from lib import environment

PROJECT_ROOT_PATH = os.path.dirname(os.path.abspath(__file__)) + "/../"

logger = logging.getLogger("selenium.webdriver.remote.remote_connection")


if __name__ == "__main__":
    file_ops.create_directory(environment.LOG_PATH)
    file_ops.delete_directory_contents(environment.LOG_PATH)

    log.set_default_file_handler(
        logger,
        PROJECT_ROOT_PATH + constants.path.LOGS_DIR +
        constants.path.TEST_RUNNER
    )

    logger.setLevel(environment.LOGGING_LEVEL)

    pytest.main()
