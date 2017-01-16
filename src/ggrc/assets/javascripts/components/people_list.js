/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can) {
  GGRC.Components('peopleList', {
    tag: 'people-list',
    template: can.view(GGRC.mustache_path +
      '/base_templates/people_list.mustache'),
    scope: {
      editable: '@',
      deferred: '@',
      validate: '@',
      disableTitle: '@',
      /*
       * Checks whether there are any conflicts between assignable roles.
       *
       * If `conflicts` is specified on an object with assignable mixin,
       * bind to the role's mapping and on any change to it check if any
       * user is holding roles that are in violation of the rules.
       *
       * @prop {Array of Arrays} conflicts - Array of an array containing
       *  conflicting roles that no single user should hold at the same time.
       * @prop {Array of objects} assignable_list - A list of available roles
       *  with mappins to those roles.
       */
      _checkConflict: function () {
        var conflicts = this.instance.class.conflicts;
        var assignableList = this.instance.class.assignable_list;
        var bindings = {};

        if (_.isUndefined(conflicts)) {
          return;
        }

        function checkConflicts() {
          // Verify that there is not intersections between role bindings and
          // show warning if it exists.
          _.each(conflicts, function (conflictRoles) {
            var rolePeople = _.map(conflictRoles, function (role) {
              return _.map(bindings[role].list, function (person) {
                return person.instance.id;
              });
            });
            var hasConflicts = !_.isEmpty(
                _.intersection.apply(null, rolePeople));
            this.instance.attr('roleConflicts', hasConflicts);
          }.bind(this));
        }

        // Set up listening to change event on role bindings.
        _.each(conflicts, function (conflictRoles) {
          _.each(conflictRoles, function (role) {
            var roleMapping = _.find(
              assignableList, _.matchesProperty('type', role)).mapping;
            var roleBinding = this.instance.get_binding(roleMapping);
            bindings[role] = roleBinding;
            roleBinding.list.bind('change', checkConflicts.bind(this));
          }.bind(this));
        }.bind(this));
      }
    },
    events: {
      inserted: function () {
        this.scope._checkConflict();
      }
    }
  });

  GGRC.Components('peopleGroup', {
    tag: 'people-group',
    template: can.view(GGRC.mustache_path +
      '/base_templates/people_group.mustache'),
    scope: {
      limit: '@',
      mapping: null,
      required: '@',
      type: null,
      heading: null,
      toggle_add: false,
      mapped_people: [],
      results: [],
      list_pending: [],
      list_mapped: [],
      fetchingData: false,  // fetching data currently in progress or not
      computed_mapping: false,
      forbiddenForUnmap: [],
      /**
        * Get pending joins for current instance
        *
        * @return {Array} - the list of current pending joins
        */
      get_pending: function () {
        if (!this.attr('deferred')) {
          return [];
        }
        return this.attr('instance._pending_joins');
      },
      /**
        * Get people mapped to this instance
        *
        * @return {Promise} - a promise that returns the list of current mapped people
        */
      get_mapped_deferred: function () {
        // We call get_mapping only once because canjs events can get caught in a loop
        // computed_mapping needs to be in scope so its separated from other people lists
        if (!this.computed_mapping) {
          return this.attr('instance')
            .get_mapping_deferred(this.attr('mapping'))
            .then(function (data) {
              this.attr('list_mapped', data);
              this.computed_mapping = true;
              return data;
            }.bind(this));
        }
        return $.when(this.attr('list_mapped'));
      },
      /**
        * Get the first (or only) pending join for a person
        *
        * @param {CMS.Models.Person} person - the person whose join to get
        *
        * @return {Object} - the pending join for the person if available
        *                    or undefined
        */
      get_pending_operation: function (person) {
        return _.find(this.get_pending(), function (join) {
          return join.what === person;
        });
      },
      /**
        * Change pending joins list to add a role to a person
        *
        * If there is a pending 'add' or 'update', extends roles list in it.
        * If there is a pending 'remove', cancels it and creates a new 'update'
        * with the role.
        * If there is no pending join and the person already has roles assigned,
        * creates a new 'update' with extended roles list.
        * If there is no pending join and the person has no roles assigned yet,
        * creates a new 'add' with the role.
        *
        * @param {CMS.Models.Person} person - the person who gets the new role
        * @param {String} role - the role that is added
        */
      deferred_add_role: function (person, role) {
        var pendingOperation = this.get_pending_operation(person);
        if (!pendingOperation) {
          // no pending join for this person
          this.get_roles(person, this.instance).then(function (result) {
            var roles = result.roles;

            if (roles.length) {
              // the person already has roles assigned, create 'update'
              this.add_or_replace_operation(
                person,
                {
                  how: 'update',
                  roles: _.union(roles, [role])
                }
              );
            } else {
              // the person was not yet assigned, create 'add'
              this.add_or_replace_operation(
                person,
                {
                  how: 'add',
                  roles: [role]
                }
              );
            }
          }.bind(this));
        } else if (pendingOperation.how === 'remove') {
          // 'remove' pending for this person, cancel it and create 'update'
          // with single role
          this.add_or_replace_operation(
            person,
            {
              how: 'update',
              roles: [role]
            }
          );
        } else if (pendingOperation.how === 'add' ||
                   pendingOperation.how === 'update') {
          // 'add' or 'update' pending, extend the roles list with the role
          this.add_or_replace_operation(
            person,
            {
              how: pendingOperation.how,
              roles: _.union(this.parse_roles_list(pendingOperation), [role])
            }
          );
        }
      },
      /**
        * Change pending joins list to remove a role from a person
        *
        * If there is a pending 'add' or 'update', cancels this role addition.
        * If there is a pending 'remove', does nothing.
        * If there is no pending join and the person has several roles assigned,
        * creates a new 'update' with all stored roles except the role.
        * If there is no pending join and the person has a single role assigned,
        * creates a new 'remove'.
        *
        * @param {CMS.Model.Person} person - the person who loses the role
        * @param {String} role - the role that is removed
        */
      deferred_remove_role: function (person, role) {
        var pendingOperation = this.get_pending_operation(person);
        var roles;

        if (!pendingOperation) {
          // no pending join for this person
          this.get_roles(person, this.instance).then(function (result) {
            var roles = result.roles;

            roles = _.without(roles, role);
            if (roles.length) {
              // there are still roles remaining, create 'update'
              this.add_or_replace_operation(
                person,
                {
                  how: 'update',
                  roles: roles
                }
              );
            } else {
              // there are no roles remaining, create 'remove'
              this.add_or_replace_operation(
                person,
                {
                  how: 'remove'
                }
              );
            }
          }.bind(this));
        } else if (pendingOperation.how === 'remove') {
          // no action required
          return;
        } else if (pendingOperation.how === 'add' ||
                   pendingOperation.how === 'update') {
          // 'add' or 'update' pending, cancel the role addition
          roles = this.parse_roles_list(pendingOperation);
          roles = _.without(roles, role);
          if (roles.length) {
            // update the roles list in the pending join
            this.add_or_replace_operation(
              person,
              {
                how: pendingOperation.how,
                roles: roles
              }
            );
          } else if (pendingOperation.how === 'add') {
            // cancel the pending 'add'
            this.add_or_replace_operation(
              person,
              null
            );
          } else if (pendingOperation.how === 'update') {
            // replace the 'update' with 'remove'
            this.add_or_replace_operation(
              person,
              {
                how: 'remove'
              }
            );
          }
        }
      },
      /**
        * Add a new pending join, remove all pending joins for same person
        *
        * @param {CMS.Model.Person} person - the person to be joined
        * @param {Object} operation - a description of the new pending join;
        * if operation is false-value, all pending joins would be removed,
        * but none will be added.
        * @param {String} operation.how - the type of the operation
        * ('add', 'remove' or 'update')
        * @param {String} operation.roles - the list of added/updated roles
        */
      add_or_replace_operation: function (person, operation) {
        var roles;
        if (!operation) {
          // just remove all pending joins for person
          this.instance.remove_duplicate_pending_joins(person);
        } else {
          // convert roles list to a string
          if (_.isArray(operation.roles)) {
            roles = operation.roles.join(',');
          }
          if (operation.how === 'add') {
            this.instance.mark_for_addition(
              'related_objects_as_destination',
              person,
              {
                attrs: {
                  AssigneeType: roles
                },
                context: this.instance.context
              }
            );
          } else if (operation.how === 'update') {
            this.instance.mark_for_update(
              'related_objects_as_destination',
              person,
              {
                attrs: {
                  AssigneeType: roles
                }
              }
            );
          } else if (operation.how === 'remove') {
            this.instance.mark_for_deletion(
              'related_objects_as_destination',
              person
            );
          }
        }
      },
      /**
        * Get roles list from a pending join and split it into a list.
        *
        * Returns [] if no roles list exists.
        *
        * @param {Object} operation - a pending join object
        *
        * @return {Array} - an array of roles
        */
      parse_roles_list: function (operation) {
        var roles = _.exists(operation, 'extra.attrs.AssigneeType');
        return roles ? roles.split(',') : [];
      },
      /**
        * Remove a role assignment from a person
        *
        * Called with a role removal button
        *
        * @param {Object} parentScope - current page context
        * @param {jQuery.Object} el - clicked element
        * @param {Object} ev - click event handler
        */
      remove_role: function (parentScope, el, ev) {
        var person = CMS.Models.Person.findInCacheById(el.data('person'));
        var instance = this.instance;
        var roleToRemove = can.capitalize(this.attr('type'));
        var deferred = this.attr('deferred');

        // Turn off popover for the removed person
        $(el).closest('li').find('.person-tooltip-trigger')
          .removeClass('person-tooltip-trigger');

        if (deferred) {
          this.deferred_remove_role(person, roleToRemove);
        } else {
          this.get_roles(person, instance).then(function (result) {
            var roles = result.roles;
            var relationship = result.relationship;

            roles = _.without(roles, roleToRemove);

            if (roles.length) {
              relationship.attrs.attr('AssigneeType', roles.join(','));
              relationship.save();
            } else {
              relationship.destroy();
            }
          });
        }
      },
      /**
        * Get saved roles list for a person
        *
        * @param {CMS.Models.Person} person - the person whose roles to get
        * @param {Object} instance - the object to which the person is assigned
        *
        * @return {jQuery.Deferred} - a promise with the role list
        */
      get_roles: function (person, instance) {
        var rolesDfd = $.Deferred();

        CMS.Models.Relationship
          .getRelationshipBetweenInstances(person, instance, instance.isNew())
          .done(function (relationships) {
            var found = false;
            _.map(relationships, function (relationship) {
              if (!found && _.exists(relationship, 'attrs.AssigneeType')) {
                found = true;
                relationship.refresh().then(function (relationship) {
                  var roles = relationship.attrs.AssigneeType.split(',');
                  var result = {roles: roles,
                    relationship: relationship};
                  rolesDfd.resolve(result);
                });
              }
            });
            if (!found) {
              rolesDfd.resolve({roles: []});
            }
          })
          .fail(function (e) {
            rolesDfd.resolve({roles: []});
          });

        return rolesDfd;
      }
    },
    events: {
      init: function () {
        // NOTE: If the logic below is executed was inserted() instead, the
        // view might initially not update itself correctly (i.e. the
        // fetchingData flag) due to race conditions.
        this.scope.attr('fetchingData', true);

        this.scope.get_mapped_deferred().done(function (data) {
          this.scope.attr('list_pending', this.scope.get_pending());
          this.scope.attr('list_mapped', data);
          this.updateMappedResult(data);
          if (!this.scope.attr('required')) {
            return;
          }
          this.scope.attr('mapped_people', data);
          if (this.scope.instance.isNew() && this.scope.validate) {
            this.validate();
          }
        }.bind(this))
        .always(function () {
          this.scope.attr('fetchingData', false);
        }.bind(this));
      },
      validate: function () {
        if (!(this.scope.required && this.scope.validate)) {
          return;
        }
        this.scope.attr('instance').attr('validate_' +
          this.scope.attr('type'), !!this.scope.results.length);
      },
      updateResult: function () {
        this.scope.get_mapped_deferred().then(function (data) {
          this.updateMappedResult(data);
        }.bind(this));
      },
      updateMappedResult: function (data) {
        var type = can.capitalize(this.scope.type);
        var mapped = _.map(data, function (item) {
          return item.instance;
        });
        var pending = _.filter(this.scope.get_pending(), function (item) {
          return item.what.type === 'Person';
        });
        var added = _.filter(pending, function (item) {
          // any person who has `type` in their `add` or `update` roles list
          var roles = this.scope.parse_roles_list(item);
          return (item.how === 'add' || item.how === 'update') &&
            _.includes(roles, type);
        }.bind(this));
        var removed = _.filter(pending, function (item) {
          // any person who was mapped and has `remove` join or has no `type`
          // in their `update` roles list
          var roles = this.scope.parse_roles_list(item);
          var personMapped = _.find(mapped, function (map) {
            return map.id === item.what.id;
          });
          return personMapped &&
            (item.how === 'remove' ||
             item.how === 'update' && !_.includes(roles, type));
        }.bind(this));

        function getInstances(arr) {
          return _.map(arr, function (item) {
            return item.what;
          });
        }
        this.scope.instance.attr('_disabled', 'disabled');
        added = getInstances(added);
        removed = getInstances(removed);
        this.scope.attr('results').replace(
          _.union(_.filter(mapped, function (item) {
            return !_.findWhere(removed, {id: item.id});
          }
        ), added));
        this.scope.instance.attr('_disabled', '');
      },
      '{scope.list_mapped} change': 'updateResult',
      '{scope.list_pending} change': 'updateResult',
      '{scope.results} change': 'validate',
      '{scope.instance} modal:dismiss': function () {
        this.scope.attr('instance').removeAttr(
          'validate_' + this.scope.attr('type'));
      },
      '.person-selector input autocomplete:select': function (el, ev, ui) {
        var person = ui.item;
        var role = can.capitalize(this.scope.type);
        var instance = this.scope.attr('instance');
        var deferred = this.scope.attr('deferred');
        var relationship;

        if (deferred) {
          this.scope.deferred_add_role(person, role);
        } else {
          // create or modify a relationship without caching
          relationship = CMS.Models.Relationship.get_relationship(person,
                                                                  instance);
          if (!relationship) {
            relationship = CMS.Models.Relationship.createAssignee({
              role: role,
              source: person,
              destination: instance,
              context: instance.context
            });
            relationship = $.Deferred().resolve(relationship);
            this.scope.attr('forbiddenForUnmap').push(person);
            this.scope.attr('isNew', true);
          } else {
            relationship = relationship.refresh();
          }

          relationship.then(function (relationship) {
            var type = relationship.attr('attrs.AssigneeType');
            relationship.attr('attrs.AssigneeType',
              role + (type ? ',' + type : ''));
            return relationship.save();
          })
            .then(function (rel) {
              var props = ['related_sources', 'related_destinations'];
              var dfds = [];

              if (this.scope.attr('isNew')) {
                [instance, person].forEach(function (model) {
                  var dfd = $.Deferred();
                  props.forEach(function (prop) {
                    function checkRelationship(related, id) {
                      return _.findWhere(related, {id: id});
                    }
                    model[prop].on('change', function cb() {
                      if (checkRelationship(this, rel.id)) {
                        person[prop].unbind('change', cb);
                        dfd.resolve();
                      }
                    });
                  });
                  dfds.push(dfd);
                });
              }
              return $.when.apply($, dfds);
            }.bind(this))
            .then(function () {
              if (this.scope.attr('isNew')) {
                _.remove(this.scope.attr('forbiddenForUnmap'), function (item) {
                  return item.id === person.id;
                });
                this.scope.attr('isNew', false);
              }
              instance.refresh();
            }.bind(this));
        }
      },
      'modal:success': function () {
        // prevent navigating to a new object page when a new user is created
        return false;
      }
    },
    helpers: {
      has_permissions: function (options) {
        var isAllowed;
        if (this.attr('deferred')) {
          return options.fn(options.context);
        }
        isAllowed = Permission.is_allowed_for('update', this.attr('instance'));
        return options[isAllowed ? 'fn' : 'inverse'](options.context);
      },
      can_unmap: function (options) {
        var results = this.attr('results');
        var required = this.attr('required');
        var hiddens = this.attr('forbiddenForUnmap');
        var isNew = this.attr('isNew');

        if (isNew && _.findWhere(hiddens, {id: options.context.id})) {
          return options.inverse(options.context);
        }

        if (required) {
          if (results.length > 1) {
            return options.fn(options.context);
          }
          return options.inverse(options.context);
        }
        return options.fn(options.context);
      },
      show_add: function (options) {
        if (this.attr('editable') === 'true') {
          return options.fn(options.context);
        }
        return options.inverse(options.context);
      },
      if_has_role: function (roles, role, options) {
        roles = Mustache.resolve(roles) || '';
        role = Mustache.resolve(role) || '';
        roles = _.filter(roles.toLowerCase().split(','));
        role = role.toLowerCase();
        return options[
          _.includes(roles, role) ? 'fn' : 'inverse'](options.contexts);
      }
    }
  });
})(window.can);
