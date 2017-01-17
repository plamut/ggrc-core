/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */
(function (can, $) {
  'use strict';

  GGRC.Components('SnapshotScopeUpdater', {
    tag: 'snapshot-scope-update',
    template: '<content/>',
    scope: {
      instance: null,
      upsertIt: function (scope, el, ev) {
        GGRC.Controllers.Modals.confirm({
          instance: scope.instance,
          modal_title: 'Update to latest version',
          modal_description:
            'Do you want to update all objects of this Audit' +
            ' to the latest version?',
          modal_confirm: 'Update',
          button_view: GGRC.Controllers.Modals.BUTTON_VIEW_OK_CLOSE,
          skip_refresh: true
        }, function () {
          var instance = this.instance;

          var notificationSettings = {
            progress: 'Updating objects to the latest version in progress.'
          };
          $('body').trigger('ajax:flash', notificationSettings);

          instance.refresh().then(function () {
            var data = {
              operation: 'upsert'
            };
            instance.attr('snapshots', data);
            return instance.save();
          }).then(function () {
            GGRC.Utils.Browser.refreshPage(true);
          });
        }.bind(this));
      }
    }
  });
})(window.can, window.can.$);
