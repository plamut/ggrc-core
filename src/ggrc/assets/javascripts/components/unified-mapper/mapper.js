/*!
 Copyright (C) 2017 Google Inc.
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 */

(function (can, $) {
  'use strict';

  var DEFAULT_OBJECT_MAP = {
    Assessment: 'Control',
    Objective: 'Control',
    Section: 'Objective',
    Regulation: 'Section',
    Product: 'System',
    Standard: 'Section',
    Contract: 'Clause'
  };

  var MapperModel = GGRC.Models.MapperModel = can.Map.extend({
    define: {
      typeGroups: {
        value: {
          entities: {
            name: 'People/Groups',
            items: []
          },
          business: {
            name: 'Assets/Business',
            items: []
          },
          governance: {
            name: 'Governance',
            items: []
          }
        }
      },
      types: {
        get: function () {
          return this.initTypes();
        }
      },
      parentInstance: {
        get: function () {
          return CMS.Models
            .get_instance(this.attr('object'), this.attr('join_object_id'));
        }
      },
      useSnapshots: {
        get: function () {
          return GGRC.Utils.Snapshots.isInScopeModel(this.attr('object')) ||
            // In case Assessment generation - use Snapshot Objects
            this.attr('assessmentGenerator');
        }
      }
    },
    type: 'Control', // We set default as Control
    contact: null,
    contactEmail: null,
    deferred: '@',
    deferred_to: '@',
    filter: '',
    statusFilter: '',
    object: '',
    model: {},
    bindings: {},
    is_loading: false,
    is_new: false,
    page_loading: false,
    is_saving: false,
    all_selected: false,
    assessmentTemplate: '',
    search_only: false,
    join_object_id: '',
    selected: [],
    entries: [],
    options: [],
    newEntries: [],
    relevant: [],
    submitCbs: $.Callbacks(),
    afterSearch: false,
    afterShown: function () {
      this.onSubmit();
    },
    allowedToCreate: function () {
      var isSearch = this.attr('search_only');
      // Don't allow to create new instances for "In Scope" Objects
      var isInScopeModel =
        GGRC.Utils.Snapshots.isInScopeModel(this.attr('object'));
      return !isSearch && !isInScopeModel;
    },
    showWarning: function () {
      // Never show warning for In Scope Objects
      if (GGRC.Utils.Snapshots.isInScopeModel(this.attr('object'))) {
        return false;
      }
      // In case we generate assessments or in search only mode this should be false no matter what objects should be mapped to assessments
      if (this.attr('assessmentGenerator') || this.attr('search_only')) {
        return false;
      }
      return GGRC.Utils.Snapshots.isSnapshotParent(this.attr('object')) ||
        GGRC.Utils.Snapshots.isSnapshotParent(this.attr('type'));
    },
    prepareCorrectTypeFormat: function (cmsModel) {
      return {
        category: cmsModel.category,
        name: cmsModel.title_plural,
        value: cmsModel.model_singular,
        singular: cmsModel.model_singular,
        plural: cmsModel.title_plural.toLowerCase().replace(/\s+/, '_'),
        table_plural: cmsModel.table_plural,
        title_singular: cmsModel.title_singular,
        isSelected: cmsModel.model_singular === this.attr('type')
      };
    },
    addFormattedType: function (modelName, groups) {
      var group;
      var type;
      var cmsModel;
      cmsModel = GGRC.Utils.getModelByType(modelName);
      if (!cmsModel || !cmsModel.title_singular ||
        cmsModel.title_singular === 'Reference') {
        return;
      }
      type = this.prepareCorrectTypeFormat(cmsModel);
      group = !groups[type.category] ?
        groups.governance :
        groups[type.category];

      group.items.push(type);
    },
    getModelNamesList: function (object) {
      var exclude = [];
      var include = [];
      var snapshots = GGRC.Utils.Snapshots;
      if (this.attr('search_only')) {
        include = ['TaskGroupTask', 'TaskGroup',
          'CycleTaskGroupObjectTask'];
      } else {
        exclude = snapshots.inScopeModels;
      }
      return GGRC.Mappings
        .getMappingList(object, include, exclude);
    },
    initTypes: function (objectType) {
      var object = objectType || this.attr('object');
      // Can.JS wrap all objects with can.Map by default
      var groups = this.attr('typeGroups').attr();
      var list = this.getModelNamesList(object);

      list.forEach(function (modelName) {
        return this.addFormattedType(modelName, groups);
      }.bind(this));
      return groups;
    },
    setContact: function (scope, el, ev) {
      this.attr('contact', ev.selectedItem);

      _.defer(function () {
        this.attr('contactEmail', ev.selectedItem.email);
      }.bind(this));
    },
    getBindingName: function (instance, plural) {
      return (instance && instance.has_binding(plural) ?
          '' :
          'related_') + plural;
    },
    modelFromType: function (type) {
      var types = _.reduce(_.values(
        this.attr('types')), function (memo, val) {
        if (val.items) {
          return memo.concat(val.items);
        }
        return memo;
      }, []);
      return _.findWhere(types, {value: type});
    },
    onSubmit: function () {
      this.attr('submitCbs').fire();
      this.attr('afterSearch', true);
    }
  });

  /**
   * A component implementing a modal for mapping objects to other objects,
   * taking the object type mapping constraints into account.
   */
  GGRC.Components('modalMapper', {
    tag: 'modal-mapper',
    template: can.view(GGRC.mustache_path + '/modals/mapper/base.mustache'),
    scope: function (attrs, parentScope, el) {
      var $el = $(el);
      var data = {};
      var id = Number($el.attr('join-object-id'));
      var object = $el.attr('object');
      var type = $el.attr('type');
      var isNew = parentScope.attr('is_new');
      var treeView = GGRC.tree_view.sub_tree_for[object];

      if ($el.attr('search-only')) {
        data.search_only = /true/i.test($el.attr('search-only'));
      }

      if (object) {
        data.object = object;
      }

      type = CMS.Models[type] && type;
      if (!data.search_only) {
        if (type) {
          data.type = type;
        } else {
          data.type = DEFAULT_OBJECT_MAP[object];
          if (!data.type) {
            data.type = treeView ? treeView.display_list[0] : 'Control';
          }
        }
      } else {
        data.type = 'Program';
      }

      if (isNew) {
        data.join_object_id = null;
      } else if (id || GGRC.page_instance()) {
        data.join_object_id = id || GGRC.page_instance().id;
      }

      return {
        isLoadingOrSaving: function () {
          return (this.attr('mapper.page_loading') ||
          this.attr('mapper.is_saving') ||
          this.attr('mapper.block_type_change'));
        },
        mapper: new MapperModel(can.extend(data, {
          relevantTo: parentScope.attr('relevantTo'),
          callback: parentScope.attr('callback'),
          useTemplates: parentScope.attr('useTemplates'),
          assessmentGenerator: parentScope.attr('assessmentGenerator'),
          is_new: parentScope.attr('is_new'),
          newEntries: parentScope.attr('newEntries')
        })),
        template: parentScope.attr('template'),
        draw_children: true,
        $opener: attrs['%root'].$trigger  // the button used to open the modal
      };
    },

    events: {
      '.create-control modal:success': function (el, ev, model) {
        this.scope.attr('mapper.newEntries').push(model);
        this.element.find('mapper-results').scope().showNewEntries();
      },
      '.create-control modal:added': function (el, ev, model) {
        this.scope.attr('mapper.newEntries').push(model);
      },
      '.create-control click': function () {
        // reset new entries
        this.scope.attr('mapper.newEntries', []);
      },
      '{window} modal:dismiss': function (el, ev, options) {
        var joinObjectId = this.scope.attr('mapper.join_object_id');

        // mapper sets uniqueId for modal-ajax.
        // we can check using unique id which modal-ajax is closing
        if (options.uniqueId &&
          joinObjectId === options.uniqueId &&
          this.scope.attr('mapper.newEntries').length > 0) {
          this.element.find('mapper-results').scope().showNewEntries();
        }
      },
      inserted: function () {
        var self = this;
        this.scope.attr('mapper.selected').replace([]);
        this.scope.attr('mapper.entries').replace([]);

        this.setModel();
        this.setBinding();

        setTimeout(function () {
          self.scope.attr('mapper').afterShown();
        });
      },
      '.add-button modal:success': function (el, ev, model) {
        // clear
        this.scope.attr('mapper.newEntries').replace([]);

        // push new instance
        this.scope.attr('mapper.newEntries').push(model);
      },
      closeModal: function () {
        this.scope.attr('mapper.is_saving', false);

        // TODO: Find proper way to dismiss the modal
        this.element.find('.modal-dismiss').trigger('click');
      },
      deferredSave: function () {
        var source = this.scope.attr('deferred_to').instance ||
          this.scope.attr('mapper.object');
        var data = {};

        data = {
          multi_map: true,
          arr: _.compact(_.map(
            this.scope.attr('mapper.selected'),
            function (desination) {
              var isAllowed = GGRC.Utils.allowed_to_map(source, desination);
              var instance =
                can.makeArray(this.scope.attr('mapper.entries'))
                  .map(function (entry) {
                    return entry.instance || entry;
                  })
                  .find(function (instance) {
                    return instance.id === desination.id &&
                      instance.type === desination.type;
                  });
              if (instance && isAllowed) {
                return instance;
              }
            }.bind(this)
          ))
        };

        this.scope.attr('deferred_to').controller.element.trigger(
          'defer:add', [data, {map_and_save: true}]);
        this.closeModal();
      },
      '.modal-footer .btn-map click': function (el, ev) {
        var callback = this.scope.attr('mapper.callback');
        var type = this.scope.attr('mapper.type');
        var object = this.scope.attr('mapper.object');
        var assessmentTemplate = this.scope.attr('mapper.assessmentTemplate');
        var instance = CMS.Models[object].findInCacheById(
          this.scope.attr('mapper.join_object_id'));
        var mapping;
        var Model;
        var data = {};
        var defer = [];
        var que = new RefreshQueue();

        ev.preventDefault();
        if (el.hasClass('disabled')) {
          return;
        }
        if (this.scope.attr('mapper.assessmentGenerator')) {
          this.scope.attr('mapper.is_saving', true);
          return callback(this.scope.attr('mapper.selected'), {
            type: type,
            target: object,
            instance: instance,
            assessmentTemplate: assessmentTemplate,
            context: this
          });
        }

        // TODO: Figure out nicer / proper way to handle deferred save
        if (this.scope.attr('deferred')) {
          return this.deferredSave();
        }
        this.scope.attr('mapper.is_saving', true);

        que.enqueue(instance).trigger().done(function (inst) {
          data.context = instance.context || null;
          this.scope.attr('mapper.selected').forEach(function (destination) {
            var modelInstance;
            var isMapped;
            var isAllowed;
            // Use simple Relationship Model to map Snapshot
            if (this.scope.attr('mapper.useSnapshots')) {
              modelInstance = new CMS.Models.Relationship({
                context: data.context,
                source: instance,
                destination: {
                  href: '/api/snapshots/' + destination.id,
                  type: 'Snapshot',
                  id: destination.id
                }
              });

              return defer.push(modelInstance.save());
            }

            isMapped = GGRC.Utils.is_mapped(instance, destination);
            isAllowed = GGRC.Utils.allowed_to_map(instance, destination);

            if (isMapped || !isAllowed) {
              return;
            }
            mapping = GGRC.Mappings.get_canonical_mapping(object, type);
            Model = CMS.Models[mapping.model_name];
            data[mapping.object_attr] = {
              href: instance.href,
              type: instance.type,
              id: instance.id
            };
            data[mapping.option_attr] = destination;
            modelInstance = new Model(data);
            defer.push(modelInstance.save());
          }.bind(this));

          $.when.apply($, defer)
            .done(this._handleSuccessfulMap.bind(this))
            .fail(function (response, message) {
              $('body').trigger('ajax:flash', {error: message});
            })
            .always(function () {
              this.scope.attr('mapper.is_saving', false);
              this.closeModal();
            }.bind(this));
        }.bind(this));
      },

      /**
       * A callback for when objects have been successfully mapped to another
       * object.
       *
       * @param {...CMS.Models.Relationship} relationship - one or more
       *   Relationship instances that were created
       */
      _handleSuccessfulMap: function () {
        var $container;

        // Inject the spinner only when using the "main" Map button, i.e. the
        // one not specific to any tree items.
        if (!this.scope.joinObjectId) {
          $container = this.scope.$opener.closest('section.content');
          GGRC.spinnerInjector.inject(
            $container, 'large', 'initial-spinner refreshing');
        }
      },

      setBinding: function () {
        var binding;
        var getBindingName;
        var selected;
        var tablePlural;

        if (this.scope.attr('mapper.search_only')) {
          return;
        }

        getBindingName = this.scope.attr('mapper').getBindingName;
        selected = this.scope.attr('mapper.parentInstance');

        if (!selected) {
          return;
        }

        tablePlural = getBindingName(
          selected, this.scope.attr('mapper.model.table_plural'));

        if (!selected.has_binding(tablePlural)) {
          return;
        }

        binding = selected.get_binding(tablePlural);
        binding.refresh_list().then(function (mappings) {
          can.each(mappings, function (mapping) {
            this.scope.attr('mapper.bindings')[mapping.instance.id] = mapping;
          }, this);
        }.bind(this));
      },
      setModel: function () {
        var type = this.scope.attr('mapper.type');

        this.scope.attr(
          'mapper.model', this.scope.mapper.modelFromType(type));
      },
      '{mapper} type': function () {
        var mapper = this.scope.attr('mapper');
        mapper.attr('filter', '');
        mapper.attr('afterSearch', false);
        // Edge case for Assessment Generation
        // and objects that are not in Snapshot scope
        if (!mapper.attr('assessmentGenerator')) {
          if (!GGRC.Utils.Snapshots.isInScopeModel(
            mapper.attr('object'))) {
            mapper.attr('relevant').replace([]);
          }
        }
        this.setModel();
        this.setBinding();

        setTimeout(mapper.onSubmit.bind(mapper));
      },
      '{mapper} assessmentTemplate': function (scope, ev, val, oldVal) {
        var type;
        if (_.isEmpty(val)) {
          return this.scope.attr('mapper.block_type_change', false);
        }

        val = val.split('-');
        type = val[1];
        this.scope.attr('mapper.block_type_change', true);
        this.scope.attr('mapper.type', type);
      },
      '#search-by-owner autocomplete:select': function (el, ev, data) {
        this.scope.attr('mapper.contact', data.item);
      },

      '#search-by-owner keyup': function (el, ev) {
        if (!el.val()) {
          this.scope.attr('mapper.contact', {});
        }
      },

      '#search keyup': function (el, ev) {
        if (ev.keyCode === 13) {
          this.scope.attr('mapper.filter', el.val());
          this.element.find('mapper-results').scope().setItems();
        }
      },

      allSelected: function () {
        var selected = this.scope.attr('mapper.selected');
        var entries = this.scope.attr('mapper.entries');

        if (!entries.length && !selected.length) {
          return;
        }
        this.scope.attr(
          'mapper.all_selected', selected.length === entries.length);
      },
      '{mapper.entries} length': 'allSelected',
      '{mapper.selected} length': 'allSelected'
    },

    helpers: {
      get_title: function (options) {
        var instance = this.attr('mapper.parentInstance');
        return (
          (instance && instance.title) ?
            instance.title :
            this.attr('mapper.object')
        );
      },
      get_object: function (options) {
        var type = CMS.Models[this.attr('mapper.type')];
        if (type && type.title_plural) {
          return type.title_plural;
        }
        return 'Objects';
      },
      loading_or_saving: function (options) {
        if (this.attr('mapper.page_loading') ||
          this.attr('mapper.is_saving') ||
          this.attr('mapper.block_type_change')) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });
})(window.can, window.can.$);
