/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/
(function ($, GGRC, moment, Permission) {
  GGRC.Utils = {
    firstWorkingDay: function (date) {
      date = moment(date);
      // 6 is Saturday 0 is Sunday
      while (_.contains([0, 6], date.day())) {
        date.add(1, 'day');
      }
      return date.toDate();
    },
    getPickerElement: function (picker) {
      return _.find(_.values(picker), function (val) {
        if (val instanceof Node) {
          return /picker\-dialog/.test(val.className);
        }
        return false;
      });
    },
    download: function (filename, text) {
      var element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' +
        encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    export_request: function (request) {
      return $.ajax({
        type: 'POST',
        dataType: 'text',
        headers: $.extend({
          'Content-Type': 'application/json',
          'X-export-view': 'blocks',
          'X-requested-by': 'gGRC'
        }, request.headers || {}),
        url: '/_service/export_csv',
        data: JSON.stringify(request.data || {})
      });
    },
    is_mapped: function (target, destination) {
      var table_plural = CMS.Models[destination.type].table_plural;
      var bindings = target.get_binding(
        (target.has_binding(table_plural) ? '' : 'related_') + table_plural);

      if (bindings && bindings.list && bindings.list.length) {
        return _.find(bindings.list, function (item) {
          return item.instance.id === destination.id;
        });
      }
      if (target.objects && target.objects.length) {
        return _.find(target.objects, function (item) {
          return item.id === destination.id && item.type === destination.type;
        });
      }
    },

  /**
   * Determine if `source` is allowed to be mapped to `target`.
   *
   * By symmetry, this method can be also used to check whether `source` can
   * be unmapped from `target`.
   *
   * @param {Object} source - the source object the mapping
   * @param {Object} target - the target object of the mapping
   * @param {Object} options - the options objects, similar to the one that is
   *   passed as an argument to Mustache helpers
   *
   * @return {Boolean} - true if mapping is allowed, false otherwise
   */
    allowed_to_map: function (source, target, options) {
      var can_map = false;
      var types;
      var target_type;
      var source_type;
      var target_context;
      var source_context;
      var create_contexts;
      var canonical;
      var has_widget;
      var canonical_mapping;

      if (target instanceof can.Model) {
        target_type = target.constructor.shortName;
      } else {
        target_type = target.type || target;
      }
      source_type = source.constructor.shortName || source;

      // special case check: mapping an Audit to a Program (and vice versa) is
      // not allowed
      types = [source_type.toLowerCase(), target_type.toLowerCase()].sort();
      if (_.isEqual(types, ['audit', 'program'])) {
        return false;
      }

      canonical = GGRC.Mappings.get_canonical_mapping_name(
        source_type, target_type);
      canonical_mapping = GGRC.Mappings.get_canonical_mapping(
        source_type, target_type);

      if (canonical && canonical.indexOf('_') === 0) {
        canonical = null;
      }

      has_widget = _.contains(
        GGRC.tree_view.base_widgets_by_type[source_type] || [],
        target_type);

      if (_.exists(options, 'hash.join') && (!canonical || !has_widget) ||
          (canonical && !canonical_mapping.model_name)) {
        return false;
      }
      target_context = _.exists(target, 'context.id');
      source_context = _.exists(source, 'context.id');
      create_contexts = _.exists(
        GGRC, 'permissions.create.Relationship.contexts');

      can_map = Permission.is_allowed_for('update', source) ||
        source_type === 'Person' ||
        _.contains(create_contexts, source_context);

      if (target instanceof can.Model) {
        can_map = can_map &&
          (Permission.is_allowed_for('update', target) ||
           target_type === 'Person' ||
           _.contains(create_contexts, target_context));
      }
      return can_map;
    }
  };
})(jQuery, window.GGRC = window.GGRC || {}, window.moment, window.Permission);
