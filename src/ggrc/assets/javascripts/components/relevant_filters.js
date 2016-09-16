/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $, GGRC) {
  GGRC.Components('relevantFilter', {
    tag: 'relevant-filter',
    template: can.view(GGRC.mustache_path + '/mapper/relevant_filter.mustache'),
    scope: {
      define: {
        disableCreate: {
          type: 'boolean',
          'default': false
        }
      },
      relevant_menu_item: '@',
      show_all: '@',
      addFilter: function () {
        var menu = this.attr('menu');

        if (this.attr('relevant_menu_item') === 'parent' &&
             Number(this.attr('panel_number')) !== 0 &&
             !this.attr('has_parent')) {
          menu.unshift({
            title_singular: 'Previous objects',
            model_singular: '__previous__'
          });
        }

        this.attr('relevant').push({
          value: false,
          filter: new can.Map(),
          menu: menu,
          model_name: menu[0].model_singular
        });
      },
      menu: function () {
        var type = this.attr('type');
        var mappings;
        var models;
        if (/true/i.test(this.attr('show_all'))) {
          // find all widget types and manually add Cycle since it's missing
          // convert names to CMS models and prune invalid (undefined)
          models = can.Map.keys(GGRC.tree_view.base_widgets_by_type);
          models = _.difference(_.unique(models),
                               ['CycleTaskEntry', 'CycleTaskGroupObject']);
          models = _.map(models, function (mapping) {
            return CMS.Models[mapping];
          });
          return _.sortBy(_.compact(models), 'model_singular');
        }

        if (type === 'AllObject') {
          type = GGRC.page_model.type;
        }
        mappings = GGRC.Mappings.get_canonical_mappings_for(type);
        return _.sortBy(_.compact(_.map(_.keys(mappings), function (mapping) {
          return CMS.Models[mapping];
        })), 'model_singular');
      }
    },
    events: {
      init: function () {
        this.setRelevant();
      },
      setRelevant: function () {
        this.scope.attr('relevant').replace([]);
        can.each(this.scope.attr('relevantTo') || [], function (item) {
          var model = CMS.Models[item.type].cache[item.id];
          this.scope.attr('relevant').push({
            value: true,
            filter: model,
            menu: this.scope.attr('menu'),
            model_name: model.constructor.shortName
          });
        }, this);
      },
      '.ui-autocomplete-input autocomplete:select': function (el, ev, data) {
        var index = el.data('index');
        var panel = this.scope.attr('relevant')[index];

        panel.attr('filter', data.item);
        panel.attr('value', true);
      },
      '.remove_filter click': function (el) {
        this.scope.attr('relevant').splice(el.data('index'), 1);
      },
      '{scope.relevant} change': function (list, item, which, type, val, old) {
        this.scope.attr('has_parent',
                        _.findWhere(this.scope.attr('relevant'),
                        {model_name: '__previous__'}));
        if (!/model_name/gi.test(which)) {
          return;
        }
        item.target.attr('filter', new can.Map());
        item.target.attr('value', false);
      }
    }
  });
})(window.can, window.can.$, window.GGRC);
