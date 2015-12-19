# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: dan@reciprocitylabs.com

SHELL := /bin/bash

PREFIX := $(shell pwd)

DEV_PREFIX ?= $(PREFIX)
DEV_PREFIX := $(shell cd $(DEV_PREFIX); pwd)

# APPENGINE_ZIP_NAME and APPENGINE_ZIP_HREF are independent but should be
# updated together to ensure update is forced during `vagrant provision`
APPENGINE_ZIP_HREF=https://commondatastorage.googleapis.com/appengine-sdks/deprecated/193/google_appengine_1.9.3.zip
# For App Engine SDK V.1.8.X, use this location:
# APPENGINE_ZIP_HREF=http://googleappengine.googlecode.com/files/$(APPENGINE_ZIP_NAME)
APPENGINE_ZIP_NAME=google_appengine_1.9.3.zip
APPENGINE_ZIP_PATH=$(DEV_PREFIX)/opt/$(APPENGINE_ZIP_NAME)
APPENGINE_SDK_PATH=$(DEV_PREFIX)/opt/google_appengine
APPENGINE_SQLITE_PATCH_PATH=$(PREFIX)/extras/google_appengine__enable_sqlite3.diff
APPENGINE_NOAUTH_PATCH_PATH=$(PREFIX)/extras/google_appengine__force_noauth_local_webserver.diff

APPENGINE_PACKAGES_ZIP=$(PREFIX)/src/packages.zip
APPENGINE_PACKAGES_TEMP_ZIP=$(DEV_PREFIX)/opt/packages.zip
APPENGINE_PACKAGES_DIR=$(DEV_PREFIX)/opt/gae_packages

APPENGINE_ENV_DIR=$(DEV_PREFIX)/opt/gae_virtualenv
APPENGINE_REQUIREMENTS_TXT=$(PREFIX)/src/requirements.txt

FLASH_PATH=$(PREFIX)/src/ggrc/static/flash
BOWER_PATH=$(PREFIX)/bower_components

$(APPENGINE_SDK_PATH) : $(APPENGINE_ZIP_PATH)
	@echo $( dirname $(APPENGINE_ZIP_PATH) )
	cd `dirname $(APPENGINE_SDK_PATH)`; \
		unzip -o $(APPENGINE_ZIP_PATH)
	touch $(APPENGINE_SDK_PATH)
	cd $(APPENGINE_SDK_PATH); \
		patch -p1 < $(APPENGINE_SQLITE_PATCH_PATH); \
		patch -p1 < $(APPENGINE_NOAUTH_PATCH_PATH)

appengine_sdk : $(APPENGINE_SDK_PATH)

clean_appengine_sdk :
	rm -rf -- "$(APPENGINE_SDK_PATH)"
	rm -f "$(APPENGINE_ZIP_PATH)"

$(APPENGINE_ZIP_PATH) :
	mkdir -p `dirname $(APPENGINE_ZIP_PATH)`
	wget "$(APPENGINE_ZIP_HREF)" -O "$(APPENGINE_ZIP_PATH).tmp"
	mv "$(APPENGINE_ZIP_PATH).tmp" "$(APPENGINE_ZIP_PATH)"

clean_appengine_packages :
	rm -f -- "$(APPENGINE_PACKAGES_ZIP)"
	rm -f -- "$(APPENGINE_PACKAGES_TEMP_ZIP)"
	rm -rf -- "$(APPENGINE_PACKAGES_DIR)"
	rm -rf -- "$(APPENGINE_ENV_DIR)"

$(APPENGINE_ENV_DIR) :
	mkdir -p `dirname $(APPENGINE_ENV_DIR)`
	virtualenv "$(APPENGINE_ENV_DIR)"
	source "$(APPENGINE_ENV_DIR)/bin/activate"; \
		pip --version | grep -E "1.5" \
			&& pip install -U pip==1.4.1 --no-use-wheel \
			|| pip install -U pip==1.4.1;

appengine_virtualenv : $(APPENGINE_ENV_DIR)

$(APPENGINE_PACKAGES_DIR) : $(APPENGINE_ENV_DIR)
	mkdir -p $(APPENGINE_PACKAGES_DIR)
	source "$(APPENGINE_ENV_DIR)/bin/activate"; \
		pip install --no-deps -r "$(APPENGINE_REQUIREMENTS_TXT)" --target "$(APPENGINE_PACKAGES_DIR)"
	cd "$(APPENGINE_PACKAGES_DIR)/webassets"; \
		patch -p3 < "${PREFIX}/extras/webassets__fix_builtin_filter_loading.diff"

appengine_packages : $(APPENGINE_PACKAGES_DIR)

$(APPENGINE_PACKAGES_TEMP_ZIP) : $(APPENGINE_PACKAGES_DIR)
	cd "$(APPENGINE_PACKAGES_DIR)"; \
		find . -name "*.pyc" -delete; \
		find . -name "*.egg-info" | xargs rm -rf; \
		zip -9rv "$(APPENGINE_PACKAGES_TEMP_ZIP)" .; \
		touch "$(APPENGINE_PACKAGES_TEMP_ZIP)"

$(APPENGINE_PACKAGES_ZIP) : $(APPENGINE_PACKAGES_TEMP_ZIP)
	cp "$(APPENGINE_PACKAGES_TEMP_ZIP)" "$(APPENGINE_PACKAGES_ZIP)"

appengine_packages_zip : $(APPENGINE_PACKAGES_ZIP)

appengine : appengine_sdk appengine_packages appengine_packages_zip

clean_appengine : clean_appengine_sdk clean_appengine_packages


## Local environment

$(DEV_PREFIX)/opt/dev_virtualenv :
	virtualenv $(DEV_PREFIX)/opt/dev_virtualenv

dev_virtualenv : $(DEV_PREFIX)/opt/dev_virtualenv

dev_virtualenv_packages : dev_virtualenv src/dev-requirements.txt src/requirements.txt
	source "$(PREFIX)/bin/init_env"; \
		pip --version | grep -E "1.5" \
			&& pip install -U pip==1.4.1 --no-use-wheel \
			|| pip install -U pip==1.4.1; \
		pip install --no-deps -r src/requirements.txt; \
		pip install -r src/dev-requirements.txt

git_submodules :
	git submodule update --init

linked_packages : dev_virtualenv_packages
	mkdir -p $(DEV_PREFIX)/opt/linked_packages
	source bin/init_env; \
		setup_linked_packages.py $(DEV_PREFIX)/opt/linked_packages

setup_dev : dev_virtualenv_packages linked_packages


## Deployment!

src/ggrc/assets/stylesheets/dashboard.css : src/ggrc/assets/stylesheets/*.scss
	bin/build_compass

src/ggrc/static/assets.manifest : src/ggrc/assets/stylesheets/dashboard.css src/ggrc/assets
	source "bin/init_env"; \
		GGRC_SETTINGS_MODULE="$(SETTINGS_MODULE)" bin/build_assets

src/app.yaml : src/app.yaml.dist
	bin/build_app_yaml src/app.yaml.dist src/app.yaml \
		APPENGINE_INSTANCE="$(APPENGINE_INSTANCE)" \
		SETTINGS_MODULE="$(SETTINGS_MODULE)" \
		DATABASE_URI="$(DATABASE_URI)" \
		SECRET_KEY="$(SECRET_KEY)" \
		GOOGLE_ANALYTICS_ID="${GOOGLE_ANALYTICS_ID}" \
		GOOGLE_ANALYTICS_DOMAIN="${GOOGLE_ANALYTICS_DOMAIN}" \
		GAPI_KEY="$(GAPI_KEY)" \
		GAPI_CLIENT_ID="$(GAPI_CLIENT_ID)" \
		GAPI_CLIENT_SECRET="$(GAPI_CLIENT_SECRET)" \
		GAPI_ADMIN_GROUP="$(GAPI_ADMIN_GROUP)" \
		BOOTSTRAP_ADMIN_USERS="$(BOOTSTRAP_ADMIN_USERS)" \
		RISK_ASSESSMENT_URL="$(RISK_ASSESSMENT_URL)"\
		APPENGINE_EMAIL="$(APPENGINE_EMAIL)" \
		CUSTOM_URL_ROOT="$(CUSTOM_URL_ROOT)" \
		INSTANCE_CLASS="$(INSTANCE_CLASS)" \
		MAX_INSTANCES="$(MAX_INSTANCES)" \
		AUTHORIZED_DOMAINS="$(AUTHORIZED_DOMAINS)"

bower_components : bower.json
	mkdir -p $(BOWER_PATH)
	mkdir -p $(FLASH_PATH)
	/vagrant/node_modules/bower/bin/bower install
	cp $(BOWER_PATH)/zeroclipboard/dist/ZeroClipboard.swf $(FLASH_PATH)/ZeroClipboard.swf

clean_bower_components :
	rm -rf $(BOWER_PATH) $(FLASH_PATH)

deploy : appengine_packages_zip bower_components src/ggrc/static/assets.manifest src/app.yaml

clean_deploy :
	rm -f src/ggrc/assets/stylesheets/dashboard.css
	rm -f src/ggrc/static/dashboard-*.* src/ggrc/static/assets.manifest
	rm -f src/app.yaml

clean : clean_deploy clean_bower_components
