#!/usr/bin/env bash

APPENGINE_INSTANCE=grc-dev
SETTINGS_MODULE="app_engine log ggrc_basic_permissions.settings.development ggrc_risks.settings.development ggrc_risk_assessments.settings.development ggrc_workflows.settings.development ggrc_gdrive_integration.settings.development"
#DATABASE_URI='mysql+gaerdbms:///grc_dev_20150708?instance=reciprocitynow.com:grc-dan:instance1&charset=utf8'
DATABASE_URI='mysql+mysqldb://root@/grc_dev_20150708?unix_socket=/cloudsql/reciprocitynow.com:grc-dan:instance1&charset=utf8'
GAPI_KEY='AIzaSyD1UnsMJ1lMYim_E4sTpnE5rjLoagAXDGQ'
SECRET_KEY='secret-for-grc-dev112-0j725yf2bd65srmh3t4smr3d57f6g78h3f83hinugbvmxpup92'
GAPI_CLIENT_ID='888784193791.apps.googleusercontent.com'
GAPI_CLIENT_SECRET='gUlbvjbaMhbLFwfi15gXzN9N'
GAPI_ADMIN_GROUP='ggrc-dev@reciprocitylabs.com'
BOOTSTRAP_ADMIN_USERS='hsainion@google.com kostya@reciprocitylabs.com ken@reciprocitylabs.com predrag@reciprocitylabs.com anze@reciprocitylabs.com miha@reciprocitylabs.com roman@reciprocitylabs.com urban@reciprocitylabs.com andraz@reciprocitylabs.com ivan@reciprocitylabs.com asakhare@google.com prasannav@google.com ensmotko@gmail.com'
RISK_ASSESSMENT_URL='https://ggrc-risk-dev.googleplex.com'
APPENGINE_EMAIL="notifications@reciprocitylabs.com"
INSTANCE_CLASS='B4_1G'
MAX_INSTANCES='4'
CUSTOM_URL_ROOT='https://grc-dev.appspot.com/'
ABOUT_TEXT='about grc-dev'
ABOUT_URL='https://grc-dev.appspot.com/dashboard'
EXTERNAL_HELP_URL='https://support.google.com/ggrc#topic=6370247'
GOOGLE_ANALYTICS_ID='123'
MIGRATOR='Default Migrator <migrator@example.com>'
