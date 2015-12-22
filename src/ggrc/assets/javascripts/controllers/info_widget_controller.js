/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function(can, $) {

can.Control("GGRC.Controllers.InfoWidget", {
  defaults : {
    model : null,
    instance : null,
    widget_view : GGRC.mustache_path + "/base_objects/info.mustache"
  },
  init : function() {
    var that = this;
    $(function() {
      if (GGRC.page_object) {
        $.extend(that.defaults, {
          model : GGRC.infer_object_type(GGRC.page_object)
          , instance : GGRC.page_instance()
        });
      }
    });
  }
}, {
  init : function() {
    var that = this;
    this.init_menu();

    if (this.element.data('widget-view')) {
      this.options.widget_view = GGRC.mustache_path + this.element.data('widget-view');
    }

    this.options.context = new can.Observe({
        model : this.options.model,
        instance : this.options.instance,
        start_menu : this.options.start_menu,
        object_menu : this.options.object_menu,
        //show_audit: false;
        error_msg : '',
        error : true
      });
    can.view(this.get_widget_view(this.element), this.options.context, function(frag) {
      that.element.html(frag);
    });
  },

  get_widget_view: function(el) {
    var widget_view = $(el)
          .closest('[data-widget-view]').attr('data-widget-view');
    if (widget_view && widget_view.length > 0)
      return GGRC.mustache_path + widget_view;
    else
      return this.options.widget_view;
  },

  generate_menu_items: function(item_names, display_prefix) {
    return _.filter(_.map(item_names, function(item_name){
      display_prefix = display_prefix || "";
      if (item_name in CMS.Models){
        return {
          model_name: CMS.Models[item_name].model_singular,
          model_lowercase: CMS.Models[item_name].table_singular,
          model_plural: CMS.Models[item_name].table_plural,
          display_name: display_prefix + CMS.Models[item_name].title_singular
        };
      }
    }));
  },

  init_menu: function() {
    if(!this.options.start_menu) {
      names = [
        'Program',
        'Audit',
        'Workflow',
      ];
      this.options.start_menu = this.generate_menu_items(names, "Start new ");
    }
    if(!this.options.object_menu) {
      names = [
        'AccessGroup',
        'Clause',
        'Contract',
        'Control',
        'ControlAssessment',
        'DataAsset',
        'Facility',
        'Issue',
        'Market',
        'Objective',
        'OrgGroup',
        'Person',
        'Policy',
        'Process',
        'Product',
        'Project',
        'Regulation',
        'Request',
        'Risk',
        'Section',
        'Standard',
        'System',
        'Threat',
        'Vendor',
      ];
      this.options.object_menu = this.generate_menu_items(names);
    }
  }
});

})(this.can, this.can.$);
