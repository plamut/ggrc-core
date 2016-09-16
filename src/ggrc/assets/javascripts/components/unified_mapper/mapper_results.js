/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  'use strict';

  GGRC.Components('mapperResults', {
    tag: 'mapper-results',
    template: can.view(
      GGRC.mustache_path +
      '/components/unified_mapper/mapper_results.mustache'
    ),
    scope: {
      'items-per-page': '@',
      page: 0,
      page_loading: false,
      select_state: false,
      loading_or_saving: function () {
        return this.attr('page_loading') || this.attr('mapper.is_saving');
      },
      isRelevantToCurrent: function () {
        var relevant = this.attr('mapper.relevant');
        var instance = GGRC.page_instance();
        if (relevant.length !== 1) {
          return false;
        }
        relevant = relevant[0].filter;
        return relevant.id === instance.id &&
               relevant.type === instance.type;
      },
      unselectAll: function (scope, el, ev) {
        ev.preventDefault();

        this.attr('mapper.all_selected', false);
        this.attr('select_state', false);
        scope.attr('selected').replace([]);
        this.attr('selected', []);
      },
      selectAll: function (scope, el, ev) {
        var entries;
        var que;

        ev.preventDefault();

        if (el.hasClass('disabled')) {
          return;
        }

        que = new RefreshQueue();
        entries = this.attr('entries');

        this.attr('select_state', true);
        this.attr('mapper.all_selected', true);
        this.attr('is_loading', true);

        que.enqueue(_.pluck(entries, 'instance'))
          .trigger()
          .then(function (models) {
            this.attr('is_loading', false);
            this.attr('selected', _.map(models, function (model) {
              return {
                id: model.id,
                type: model.type,
                href: model.href
              };
            }));
          }.bind(this));
      }
    },
    events: {
      inserted: function () {
        this.scope.attr('entries', []);
        this.scope.attr('options', []);
        this.element.find('.results-wrap').cms_controllers_infinite_scroll();
      },
      '.modalSearchButton click': 'getResults',
      '{scope.entries} add': function (list, ev, added) {
        var instance;
        var option;

        // TODO: I'm assuming we are adding only one item manually
        if (!added[0].append) {
          return;
        }

        instance = added[0].instance;
        option = this.getItem(instance);

        option.appended = true;
        this.scope.attr('options').unshift(option);
        this.scope.attr('selected').push({
          id: instance.id,
          type: instance.type,
          href: instance.href
        });
        if (this.scope.attr('page') === 0) {
          // if the added item is the first one rendered, update the page
          // counter manually not to confuse drawPage method
          this.scope.attr('page', 1);
        }
      },
      '.results-wrap scrollNext': 'drawPage',
      getItem: function (model) {
        var selected;
        var mapper;
        var binding;
        var bindings;
        if (!model.type) {
          return undefined;
        }

        if (this.scope.attr('mapper.search_only')) {
          return {
            instance: model,
            selected_object: false,
            binding: {},
            mappings: []
          };
        }

        selected = this.scope.attr('mapper.parentInstance');
        mapper = this.scope.mapper.modelFromType(model.type);
        bindings = this.scope.attr('mapper.bindings');

        if (bindings[model.id]) {
          return _.extend(bindings[model.id], {
            selected_object: selected
          });
        }
        if (selected.has_binding(mapper.plural.toLowerCase())) {
          binding = selected.get_binding(mapper.plural.toLowerCase());
        }
        return {
          instance: model,
          selected_object: selected,
          binding: binding,
          mappings: []
        };
      },
      drawPage: function () {
        var page = this.scope.attr('page');
        var nextPage = page + 1;
        var perPage = Number(this.scope.attr('items-per-page'));
        var pageItems = this.scope.attr('entries').slice(
          page * perPage,
          nextPage * perPage
        );
        var options = this.scope.attr('options');
        var que = new RefreshQueue();

        if (this.scope.attr('mapper.page_loading') || !pageItems.length) {
          return undefined;
        }

        this.scope.attr('mapper.page_loading', true);

        return que.enqueue(
            _.pluck(pageItems, 'instance')
          ).trigger().then(
            function (models) {
              this.scope.attr('mapper.page_loading', false);
              this.scope.attr('page', nextPage);
              options.push.apply(
                options,
                can.map(models, this.getItem.bind(this))
              );
            }.bind(this)
          );
      },
      searchFor: function (data) {
        var joinModel;

        data.options = data.options || {};

        joinModel = GGRC.Mappings.join_model_name_for(
          this.scope.attr('mapper.object'), data.model_name);
        if (joinModel !== 'TaskGroupObject' && data.model_name === 'Program') {
          data.options.permission_parms = {
            __permission_model: joinModel
          };
        }

        if (!_.includes(['ObjectPerson', 'WorkflowPerson'], joinModel) &&
            !this.options.scope.attr('mapper.search_only')) {
          data.options.__permission_type =
            data.options.__permission_type || 'update';
        }
        data.model_name = _.isString(data.model_name) ?
          [data.model_name] :
          data.model_name;

        return GGRC.Models.Search.search_for_types(
          data.term || '', data.model_name, data.options);
      },

      getResults: function () {
        var contact = this.scope.attr('contact');
        var contactEmail = this.scope.attr('mapper.contactEmail');
        var filters;
        var list;
        var modelName = this.scope.attr('type');
        var params = {};
        var relevantList = this.scope.attr('mapper.relevant');
        var binding;
        var instance;
        var term = this.scope.attr('term');

        if (this.scope.attr('mapper.page_loading') ||
            this.scope.attr('mapper.is_saving')) {
          return;
        }
        this.scope.attr('page', 0);
        this.scope.attr('entries', []);
        this.scope.attr('selected', []);
        this.scope.attr('options', []);
        this.scope.attr('select_state', false);
        this.scope.attr('mapper.all_selected', false);

        if (this.scope.attr('mapper.assessmentGenerator') &&
            this.scope.isRelevantToCurrent() &&
            (!term || !contact)) {
          instance = GGRC.page_instance();
          binding = this.scope.mapper.getBindingName(
            instance,
            this.scope.attr('mapper.model.table_plural')
          );
          if (instance.has_binding(binding)) {
            this.scope.attr('mapper.page_loading', false);
            this.scope.attr('entries', instance.get_mapping(binding));
            this.drawPage();
            return undefined;
          }
        }

        filters = _.compact(_.map(relevantList, function (relevant) {
          if (!relevant.value || !relevant.filter) {
            return undefined;
          }
          return relevant.filter.type + ':' + relevant.filter.id;
        }));

        if (modelName === 'AllObject') {
          modelName = this.scope.attr('types.all_objects.models');
        }
        if (contact && contactEmail) {
          params.contact_id = contact.id;
        }

        // Filter by scope
        if (this.scope.attr('mapper.is_snapshotable')) {
          // We can also display it in UI as disabled filter
          filters.push({
            type: this.scope.attr('mapper.snapshot_scope_type'),
            id: this.scope.attr('mapper.snapshot_scope_id')
          });
        }

        if (!_.isEmpty(filters)) {
          params.relevant_objects = filters.join(',');
        }

        this.scope.attr('mapper.page_loading', true);

        list = new GGRC.ListLoaders.SearchListLoader(function (binding) {
          return this.searchFor({
            term: term,
            model_name: modelName,
            options: params
          }).then(function (mappings) {
            return mappings.entries;
          });
        }.bind(this)).attach({});

        list.refresh_stubs().then(function (options) {
          this.scope.attr('mapper.page_loading', false);
          this.scope.attr('entries', options);
          this.drawPage();
        }.bind(this));
      }
    },
    helpers: {
      inProgress: function (options) {
        if (this.attr('mapper.page_loading') || this.attr('mapper.is_saving')) {
          return options.fn();
        }
        return options.inverse();
      },
      allSelected: function (options) {
        if (this.attr('mapper.page_loading') ||
            this.attr('mapper.is_saving') ||
            this.attr('mapper.all_selected')) {
          return options.fn();
        }
        return options.inverse();
      }
    }
  });
})(window.can, window.can.$);
