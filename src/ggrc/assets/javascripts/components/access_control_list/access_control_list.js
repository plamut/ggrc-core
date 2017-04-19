/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, _, GGRC, Permission) {
  'use strict';

  /**
   * A component that renders a list of access permissions granted on the given
   * instance of a roleable model.
   *
   * Permissions are goruped by their access control role type and can be
   * edited by users.
   */
  GGRC.Components('accessControlList', {
    tag: 'access-control-list',
    template: can.view(
      GGRC.mustache_path +
      '/components/access_control_list/access_control_list.mustache'
    ),

    viewModel: {
      instance: null,

      define: {
        // whether or not the instance is a new object that is yet to be
        // created on the backent
        isNewInstance: {
          type: 'boolean',
          value: false
        },

        // whether or not to automatically save instance on person role changes
        autosave: {
          type: 'boolean',
          value: false
        },

        // the extra CSS class(es) to apply to the main container element
        topWrapperClass: {
          type: 'string',
          value: 'span12'
        },

        // the extra CSS class(es) to apply to each role list block
        roleBlockClass: {
          type: 'string',
          value: 'row-fluid'
        }
      },

      /**
       * Enter the "grant role" mode for a particular role.
       *
       * It effectively displays the UI widget for granting a person that role.
       *
       * @param {Number} roleId - the role ID for which to enable the "grant
       *   role" mode
       */
      grantRoleMode: function (roleId) {
        this.attr('grantingRoleId', roleId);
      },

      /**
       * Grant role to user on the model instance.
       *
       * If the user already has this role assigned on the model instance,
       * nothing happens.
       *
       * @param {CMS.Models.Person} person - the user to grant a role to
       * @param {Number} roleId - ID if the role to grant
       */
      grantRole: function (person, roleId) {
        var inst = this.instance;

        var roleEntry = _.find(
          inst.attr('access_control_list'),
          {person: {id: person.id}, ac_role_id: roleId}
        );

        if (roleEntry) {
          console.warn(
            'User ', person.id, 'already has role', roleId, 'assigned');
          return;
        }

        if (!inst.access_control_list) {
          inst.attr('access_control_list', []);
        }

        roleEntry = {person: person, ac_role_id: roleId};
        inst.attr('access_control_list').push(roleEntry);

        if (!this.autosave) {
          this.attr('grantingRoleId', 0);
          this._rebuildRolesInfo();
          return;
        }

        inst.save()
          .done(function () {
            GGRC.Errors.notifier('success', 'User role added.');
            this._rebuildRolesInfo();
          }.bind(this))
          .fail(function () {
            GGRC.Errors.notifier('error', 'Adding user role failed.');
          })
          .always(function () {
            this.attr('grantingRoleId', 0);
          }.bind(this));
      },

      /**
       * Revoke role from user on the model instance.
       *
       * If the user already does not have this role assigned on the model
       * instance, nothing happens.
       *
       * @param {CMS.Models.Person} person - the user to grant a role to
       * @param {Number} roleId - ID if the role to grant
       */
      revokeRole: function (person, roleId) {
        var inst = this.instance;

        var idx = _.findIndex(
          inst.attr('access_control_list'),
          {person: {id: person.id}, ac_role_id: roleId}
        );

        if (idx < 0) {
          console.warn('Role ', roleId, 'not found for user', person.id);
          return;
        }

        inst.access_control_list.splice(idx, 1);

        if (!this.autosave) {
          this._rebuildRolesInfo();
          return;
        }

        inst.save()
          .done(function () {
            GGRC.Errors.notifier('success', 'User role removed.');
            this._rebuildRolesInfo();
          }.bind(this))
          .fail(function () {
            GGRC.Errors.notifier('error', 'Removing user role failed.');
          });
      },

      /**
       * Update the role info object used by the template to display the roles
       * and the users which have them granted.
       */
      _rebuildRolesInfo: function () {
        var roleAssignments;
        var roles;
        var rolesInfo;
        var instance = this.instance;

        if (!instance) {
          this.attr('rolesInfo', []);
          return;
        }

        roleAssignments = _.groupBy(instance.access_control_list, 'ac_role_id');

        roles = _.filter(GGRC.access_control_roles, {
          object_type: instance.class.model_singular
        });
        rolesInfo = _.map(roles, function (role) {
          return {role: role, roleAssignments: roleAssignments[role.id]};
        });

        this.attr('rolesInfo', rolesInfo);
      }
    },

    events: {
      /**
       * The component entry point.
       *
       * @param {jQuery} $element - the DOM element that triggered
       *   creating the component instance
       * @param {Object} options - the component instantiation options
       */
      init: function ($element, options) {
        var canEdit;
        var contextId;
        var vm = this.viewModel;
        var instance = vm.instance;

        if (!instance) {
          console.error('accessControlList component: instance not given.');
          return;
        }

        contextId = instance.context ? instance.context.id : null;
        canEdit = vm.isNewInstance ||
                  Permission.is_allowed('update', instance, contextId);

        vm.attr('canEdit', canEdit);
        vm.attr('grantingRoleId', 0);
        vm.attr('_rolesInfoFixed', false);
        vm._rebuildRolesInfo();
      },

      '{viewModel.instance.access_control_list} change':
      function (context, ev, index, how, newVal, oldVal) {
        if (how === 'set') {
          // we are not interested in collection items' changes, all we care
          // about is ading and removing role assignments
          return;
        }

        this.viewModel._rebuildRolesInfo();
      },

      // FIXME: For some reson the rolesInfo object might get corrupted and
      // needs to be manually checked for consistency and fixed if needed. Not
      // an elegant approach, but it works.
      '{viewModel.rolesInfo} change': function () {
        var vm = this.viewModel;
        var fixNeeded = false;

        if (vm.attr('_rolesInfoFixed')) {
          // It seems that once the roleInfo object is fixed, the issue does
          // not occur anymore, thus fixing the object only once suffices.
          return;
        }

        vm.attr('rolesInfo').forEach(function (item) {
          var roleId = item.role.id;

          if (!item.roleAssignments) {
            return;
          }

          item.roleAssignments.forEach(function (entry) {
            if (entry.ac_role_id !== roleId) {
              fixNeeded = true;
            }
          });
        });

        if (fixNeeded) {
          vm.attr('_rolesInfoFixed', true);
          console.warn('accessControlList: Need TO fix rolesInfo');
          vm._rebuildRolesInfo();
        }
      }
    }
  });
})(window.can, window._, window.GGRC, window.Permission);
