/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

//= require can.jquery-all
//= require controllers/filterable_controller

CMS.Controllers.Filterable("CMS.Controllers.DashboardWidgets", {
  defaults : {
    model : null
    , widget_id : ""
    , widget_name : ""
    , widget_icon : ""
    , widget_view : "/static/mustache/dashboard/object_widget.mustache"
    , widget_guard : null
    , widget_initial_content : ''
    , show_filter : false
    , object_category : null //e.g. "governance"
    , content_selector : ".content"
    //, minimum_widget_height : 100
    , content_controller : null
    , content_controller_options : {}
    , content_controller_selector : null
  }
}, {

  init : function() {
    if(!this.options.model && GGRC.page_model) {
      this.options.model = GGRC.infer_object_type(GGRC.page_object);
    }

    if(!this.options.widget_icon && this.options.model) {
      this.options.widget_icon = this.options.model.table_singular;
    }
    if(this.options.widget_icon && !/^grcicon/.test(this.options.widget_icon)) {
      this.options.widget_icon = "grcicon-" + this.options.widget_icon + "-color";
    }

    if(!this.options.object_category && this.options.model) {
      this.options.object_category = this.options.model.category;
    }

    this.options.widget_count = new can.Observe();

    this.element
          .addClass("widget")
          .addClass(this.options.object_category)
          .attr("id", this.options.widget_id + "_widget")
      //  This is used only by ResizeWidgets controller
          .trigger("section_created");
  }

  , prepare: function() {
      if (this._prepare_deferred)
        return this._prepare_deferred;

      this._prepare_deferred = $.when(
        can.view(this.options.widget_view, $.when(this.options))
        , CMS.Models.DisplayPrefs.findAll()
      ).then(this.proxy("draw_widget"));

      return this._prepare_deferred;
    }

  , draw_widget : function(frag, prefs) {

    this.element.html(frag[0]);
    this.element.trigger("widgets_updated", this.element);

    var content = this.element
      , controller_content = null;
    if(prefs.length < 1) {
      prefs.push(new CMS.Models.DisplayPrefs());
      prefs[0].save();
    }

    if(prefs[0].getCollapsed(window.getPageToken(), this.element.attr("id"))) {

      this.element
      .find(".widget-showhide > a")
      .showhide("hide");

      content.add(this.element).css("height", "");
      if(content.is(".ui-resizable")) {
        content.resizable("destroy");
      }
    } else {
      content.trigger("min_size");
    }

    if(this.options.content_controller) {
      controller_content = this.element.find(this.options.content_selector);
      if (this.options.content_controller_selector)
        controller_content =
          controller_content.find(this.options.content_controller_selector);

      if (this.options.content_controller_options.init) {
        this.options.content_controller_options.init();
      }

      this.options.content_controller_options.show_header = true;
      this.content_controller = new this.options.content_controller(
          controller_content
        , this.options.content_controller_options
      );

      if (this.content_controller.prepare) {
        return this.content_controller.prepare();
      }
      else {
        return new $.Deferred().resolve();
      }
    }
  }

  , display: function() {
      var that = this
       , tracker_stop = GGRC.Tracker.start(
          "DashboardWidget", "display", this.options.model.shortName)
       ;

      if (this._display_deferred)
        return this._display_deferred;

      this._display_deferred = this.prepare().then(function() {
        if (that.content_controller && that.content_controller.display) {
          return that.content_controller.display();
        }
        else {
          return new $.Deferred().resolve();
        }
      }).done(tracker_stop);

      return this._display_deferred;
    },

  /*, ".remove-widget click" : function() {
    var parent = this.element.parent();
    this.element.remove();
    parent.trigger("sortremove");
  }

  , ".widgetsearch keydown" : function(el, ev) {
    if(ev.which === 13) {
      this.filter(el.val());
      this.element.trigger('kill-all-popovers');
    }
    ev.stopPropagation();
    ev.originalEvent && ev.originalEvent.stopPropagation();
  }*/
  "updateCount": function (el, ev, count, updateCount) {
    this.options.widget_count.attr("count", "" + count);
  }

  , display_path: function(path) {
      var that = this;
      return this.display().then(function() {
        if (that.content_controller && that.content_controller.display_path)
          return that.content_controller.display_path(path);
      });
    }
});
