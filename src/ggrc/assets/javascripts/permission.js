/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (can) {
  var ADMIN_PERMISSION;
  var _CONDITIONS_MAP = {
    contains: function (instance, args) {
      var value = Permission._resolve_permission_variable(args.value);
      var list_value = instance[args.list_property];
      var i;
      for (i = 0; i < list_value.length; i++) {
        if (list_value[i].id === value.id) {
          return true;
        }
      }
      return false;
    }, is: function (instance, args) {
      var value = Permission._resolve_permission_variable(args.value);
      var property_value = instance[args.property_name];
      if (property_value instanceof can.Stub) {
        property_value = property_value.reify();
      }
      return value === property_value;
    }, 'in': function (instance, args) {
      var value = Permission._resolve_permission_variable(args.value);
      var property_value = instance[args.property_name];
      if (property_value instanceof can.Stub) {
        property_value = property_value.reify();
      }
      return value.indexOf(property_value) >= 0;
    }
  };
  var permissions_compute = can.compute(GGRC.permissions);

  can.Construct('Permission', {

    _admin_permission_for_context: function (context_id) {
      return new Permission(
      ADMIN_PERMISSION.action, ADMIN_PERMISSION.resource_type, context_id);
    }, _all_resource_permission: function (permission) {
      return new Permission(
      permission.action, ADMIN_PERMISSION.resource_type, permission.context_id);
    }, _permission_match: function (permissions, permission) {
      var resource_types = permissions[permission.action] || {};
      var resource_type = resource_types[permission.resource_type] || {};
      var contexts = resource_type.contexts || [];

      return (contexts.indexOf(permission.context_id) > -1);
    }, _is_allowed: function (permissions, permission) {
      if (!permissions) {
        return false; // ?
      }
      if (this._permission_match(permissions,
          new Permission(permission.action, permission.resource_type, null))) {
        return true;
      }
      if (this._permission_match(permissions, permission)) {
        return true;
      }
      if (this._permission_match(permissions,
            this._all_resource_permission(permission))) {
        return true;
      }
      if (this._permission_match(permissions, ADMIN_PERMISSION)) {
        return true;
      }
      if (this._permission_match(permissions,
            this._admin_permission_for_context(permission.context_id))) {
        return true;
      }
      // Check for System Admin permission
      if (this._permission_match(permissions,
            this._admin_permission_for_context(0))) {
        return true;
      }
      return false;
    }, _resolve_permission_variable: function (value) {
      if ($.type(value) === 'string') {
        if (value[0] === '$') {
          if (value === '$current_user') {
            return CMS.Models.get_instance(GGRC.current_user);
          }
          throw new Error('unknown permission variable: ' + value);
        }
      }
      return value;
    }, _is_allowed_for: function (permissions, instance, action) {
      var action_obj;
      var instance_type;
      var type_obj;
      var conditions_by_context;
      var resources;
      var context;
      var conditions;
      var i;
      var condition;
      // Check for admin permission
      if (this._permission_match(permissions,
          this._admin_permission_for_context(0))) {
        return true;
      }

      action_obj = permissions[action] || {};
      instance_type = instance.constructor ?
      instance.constructor.shortName : instance.type;
      type_obj = action_obj[instance_type] || {};
      conditions_by_context = type_obj.conditions || {};
      resources = type_obj.resources || [];
      context = instance.context || {id: null};
      conditions = conditions_by_context[context.id] || [];

      if (~resources.indexOf(instance.id)) {
        return true;
      }
      if (this._is_allowed(permissions,
          new Permission(action, instance_type, null))) {
        return true;
      }
      if (!this._is_allowed(permissions,
          new Permission(action, instance_type, context.id))) {
        return false;
      }
      // Check any conditions applied per instance
      if (conditions.length === 0) {
        return true;
      }
      for (i = 0; i < conditions.length; i++) {
        condition = conditions[i];
        if (_CONDITIONS_MAP[condition.condition](instance, condition.terms)) {
          return true;
        }
      }
      return false;
    }, is_allowed: function (action, resource_type, context_id) {
      return this._is_allowed(
          permissions_compute(), new this(action, resource_type, context_id));
    }, is_allowed_for: function (action, resource) {
      return this._is_allowed_for(permissions_compute(), resource, action);
    }, is_allowed_any: function (action, resource_type) {
      var allowed = this.is_allowed(action, resource_type);
      var perms = permissions_compute();

      if (!allowed) {
        allowed = _.exists(perms, action, resource_type, 'contexts', 'length');
      }
      return !!allowed;
    }, page_context_id: function () {
      var page_instance = GGRC.page_instance();
      return (page_instance && page_instance.context &&
        page_instance.context.id) || null;
    }, refresh: function () {
      return $.ajax({
        url: '/permissions', type: 'get', dataType: 'json'
      }).then(function (perm) {
        permissions_compute(perm);
        GGRC.permissions = perm;
      });
    }
  }, {
  // prototype
    setup: function (action, resource_type, context_id) {
      this.action = action;
      this.resource_type = resource_type;
      this.context_id = context_id;
      return this;
    }
  });

  ADMIN_PERMISSION = new Permission('__GGRC_ADMIN__', '__GGRC_ALL__', 0);
})(this.can);
