/*!
    Copyright (C) 2014 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: anze@reciprocitylabs.com
    Maintained By: anze@reciprocitylabs.com
*/

(function (can) {
  can.Model.Cacheable('CMS.Models.NotificationConfig', {
    root_object: 'notification_config',
    root_collection: 'notification_configs',
    category: 'person',
    findAll: 'GET /api/notification_config',
    findOne: 'GET /api/notification_config/{id}',
    create: 'POST /api/notification_config',
    update: 'PUT /api/notification_config/{id}',
    destroy: 'DELETE /api/notification_config/{id}',
    active: 'POST /api/set_active_notifications',
    findActive: function () {
      if (GGRC.current_user === null || GGRC.current_user === undefined) {
        return $.when([]);
      }
      return this.findAll({person_id: GGRC.current_user.id});
    },
    setActive: function (active) {
      var existing_types;
      var all_types;
      var valid_types;

      if (!GGRC.current_user) {
        console.warn('User object is not set.');
        return $.when();
      }

      valid_types = $.map($('input[name=notifications]'), function (input) {
        return input.value;
      });

      return this.findActive().then(function (configs) {
        existing_types = $.map(configs, function (config) {
          return config.notif_type;
        });
        all_types = $.map(valid_types, function (type) {
          var index = existing_types.indexOf(type);
          if (index === -1) {
            // Create a new notificationConfig if it doesn't exist yet
            return new CMS.Models.NotificationConfig({
              person_id: GGRC.current_user.id,
              notif_type: type,
              enable_flag: null,
              context: {id: null}
            });
          }
          return configs[index];
        });
        return $.when.apply($, $.map(all_types, function (config) {
          var enabled = active.indexOf(config.notif_type) !== -1;
          if (config.attr('enable_flag') === enabled) {
            // There was no change to this config object
            return undefined;
          }
          if (!config.id) {
            // This is a new object so no need for refresh()
            config.attr('enable_flag', enabled);
            return config.save();
          }
          return config.refresh().then(function (refreshed_config) {
            refreshed_config.attr('enable_flag', enabled);
            return refreshed_config.save();
          });
        }));
      });
    }
  }, {});
})(window.can);
