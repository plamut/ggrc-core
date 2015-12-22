# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: dan@reciprocitylabs.com

import os

DEBUG = False
TESTING = False
PRODUCTION = False
GOOGLE_INTERNAL = False

# Flask-SQLAlchemy fix to be less than `wait_time` in /etc/mysql/my.cnf
SQLALCHEMY_POOL_RECYCLE = 120

# Settings in app.py
AUTOBUILD_ASSETS = False
ENABLE_JASMINE = False
DEBUG_ASSETS = False
FULLTEXT_INDEXER = None
USER_PERMISSIONS_PROVIDER = None
EXTENSIONS = []
exports = []

# Deployment-specific variables
COMPANY = "Company, Inc."
COMPANY_LOGO = "/static/images/ggrc-logo.png"
COMPANY_LOGO_TEXT = "Company GRC"
COPYRIGHT = u"Confidential. Copyright \u00A9"  # \u00A9 is the (c) symbol

# Construct build number
BUILD_NUMBER = ""
try:
  import build_number
  BUILD_NUMBER = " ({0})".format(build_number.BUILD_NUMBER[:7])
except (ImportError):
  pass

VERSION = "0.9.6-Plum Jelly" + BUILD_NUMBER

# Google Analytics variables
GOOGLE_ANALYTICS_ID = os.environ.get('GGRC_GOOGLE_ANALYTICS_ID', '')
GOOGLE_ANALYTICS_DOMAIN = os.environ.get('GGRC_GOOGLE_ANALYTICS_DOMAIN', '')

# Initialize from environment if present
SQLALCHEMY_DATABASE_URI = os.environ.get('GGRC_DATABASE_URI', '')
SECRET_KEY = os.environ.get('GGRC_SECRET_KEY', 'Replace-with-something-secret')

MEMCACHE_MECHANISM = True

# AppEngine Email
APPENGINE_EMAIL = os.environ.get('APPENGINE_EMAIL', '')

CALENDAR_MECHANISM = False

MAX_INSTANCES = os.environ.get('MAX_INSTANCES', '3')

exports = ['VERSION', 'MAX_INSTANCES']

# Users with authorized domains will automatically get Creator role.
# After parsing, AUTHORIZED_DOMAINS must be set of strings.
AUTHORIZED_DOMAINS = {
  d.strip() for d in os.environ.get('AUTHORIZED_DOMAINS', "").split(",")}
