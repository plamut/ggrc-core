/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  can.Control('CMS.Controllers.Dashboard', {
    defaults: {
      widget_descriptors: null
    }

  }, {
    init: function (el, options) {
      CMS.Models.DisplayPrefs.getSingleton().then(function (prefs) {
        this.display_prefs = prefs;

        this.init_tree_view_settings();
        this.init_page_title();
        this.init_page_help();
        this.init_page_header();
        this.init_widget_descriptors();
        if (!this.inner_nav_controller) {
          this.init_inner_nav();
        }
        this.update_inner_nav();

        // Before initializing widgets, hide the container to not show
        // loading state of multiple widgets before reducing to one.
        this.hide_widget_area();
        this.init_default_widgets();
        this.init_widget_area();
        this.init_info_pin();
      }.bind(this));
    },

    init_tree_view_settings: function () {
      var valid_models;
      var saved_child_tree_display_list;
      if (!GGRC.page_object) { // Admin dashboard
        return;
      }

      valid_models = can.Map.keys(GGRC.tree_view.base_widgets_by_type);
    // only change the display list
      can.each(valid_models, function (m_name) {
        saved_child_tree_display_list = this.display_prefs.getChildTreeDisplayList(m_name);
        if (saved_child_tree_display_list !== null) {
          GGRC.tree_view.sub_tree_for.attr(m_name + '.display_list',
            saved_child_tree_display_list);
        }
      }.bind(this));
    },

    init_page_title: function () {
      var page_title = null;
      if (typeof (this.options.page_title) === 'function') {
        page_title = this.options.page_title(this);
      } else if (this.options.page_title) {
        page_title = this.options.page_title;
      }
      if (page_title) {
        $('head > title').text(page_title);
      }
    },

    init_page_help: function () {
      var page_help = null;
      if (typeof (this.options.page_help) === 'function') {
        page_help = this.options.page_help(this);
      } else if (this.options.page_help) {
        page_help = this.options.page_help;
      }
      if (page_help) {
        this.element.find('#page-help').attr('data-help-slug', page_help);
      }
    },

    init_page_header: function () {
      var that = this;
      if (this.options.header_view) {
        can.view(this.options.header_view, this.options, function (frag) {
          that.element.find('#page-header').html(frag);
        });
      }
    },

    init_widget_area: function () {
      if (!this.inner_nav_controller) {
        //  If there is no inner-nav, then ensure widgets are shown
        //  FIXME: This is a workaround because widgets and widget-areas are
        //    hidden, assuming InnerNav controller will show() them
        this.get_active_widget_containers()
          .show()
          .find('.widget').show()
          .find('> section.content').show();
      }
    },

    init_inner_nav: function () {
      var $internav = this.element.find('.internav');
      if ($internav.length) {
        this.inner_nav_controller = new CMS.Controllers.InnerNav(
          this.element.find('.internav'), {
            dashboard_controller: this
          });
      }
    },

    init_info_pin: function () {
      this.info_pin = new CMS.Controllers.InfoPin(this.element.find('.pin-content'));
    },

    '.nav-logout click': function (el, ev) {
      can.Model.LocalStorage.clearAll();
    },

    init_widget_descriptors: function () {
      this.options.widget_descriptors = this.options.widget_descriptors || {};
    },

    init_default_widgets: function () {
      can.each(this.options.default_widgets, function (name) {
        this.add_dashboard_widget_from_descriptor(this.options.widget_descriptors[name]);
      }.bind(this));
    },

    hide_widget_area: function () {
      this.get_active_widget_containers().addClass('hidden');
    },
    show_widget_area: function () {
      this.get_active_widget_containers().removeClass('hidden');
    },
    ' widgets_updated': 'update_inner_nav',
    ' updateCount': function (el, ev, count, updateCount) {
      if (_.isBoolean(updateCount) && !updateCount) {
        return;
      }
      this.inner_nav_controller.update_widget_count($(ev.target), count, updateCount);
    },
    update_inner_nav: function (el, ev, data) {
      if (this.inner_nav_controller) {
        if (data) {
          this.inner_nav_controller.update_widget(data.widget || data, data.index);
        } else {
          this.inner_nav_controller.update_widget_list(
            this.get_active_widget_elements());
        }
        this.inner_nav_controller.sortWidgets();
      }
    },

    get_active_widget_containers: function () {
      return this.element.find('.widget-area');
    },

    get_active_widget_elements: function () {
      return this.element.find("section.widget[id]:not([id=''])").toArray();
    },

    add_widget_from_descriptor: function () {
      var descriptor = {};
      var that = this;
      var $element;
      var control;
      var $container;
      var $last_widget;

      // Construct the final descriptor from one or more arguments
      can.each(arguments, function (name_or_descriptor) {
        if (typeof (name_or_descriptor) === 'string') {
          name_or_descriptor =
            that.options.widget_descriptors[name_or_descriptor];
        }
        $.extend(descriptor, name_or_descriptor || {});
      });

      // Create widget in container?
      // return this.options.widget_container[0].add_widget(descriptor);

      if ($('#' + descriptor.controller_options.widget_id + '_widget').length > 0) {
        return;
      }

      // FIXME: This should be in some Widget superclass
      if (descriptor.controller_options.widget_guard &&
          !descriptor.controller_options.widget_guard()) {
        return;
      }

      $element = $("<section class='widget'>");
      control = new descriptor.controller($element, descriptor.controller_options);

      // FIXME: This should be elsewhere -- currently required so TreeView can
      //   initialize ObjectNav with counts
      control.prepare();

      // FIXME: Abstraction violation: Sortable/DashboardWidget/ResizableWidget
      //   controllers should maybe handle this?
      $container = this.get_active_widget_containers().eq(0);
      $last_widget = $container.find('section.widget').last();

      if ($last_widget.length > 0) {
        $last_widget.after($element);
      } else {
        $container.append($element);
      }

      $element
        .trigger('sortreceive')
        .trigger('section_created')
        .trigger('widgets_updated', $element);

      return control;
    },

    add_dashboard_widget_from_descriptor: function (descriptor) {
      return this.add_widget_from_descriptor({
        controller: CMS.Controllers.DashboardWidgets,
        controller_options: $.extend(descriptor, {dashboard_controller: this})
      });
    },

    add_dashboard_widget_from_name: function (name) {
      var descriptor = this.options.widget_descriptors[name];
      if (!descriptor) {
        console.debug('Unknown descriptor: ', name);
      } else {
        return this.add_dashboard_widget_from_descriptor(descriptor);
      }
    }

  });

  CMS.Controllers.Dashboard('CMS.Controllers.PageObject', {}, {
    init: function () {
      this.options.model = this.options.instance.constructor;
      this._super();
    },

    init_page_title: function () {
      // Reset title when page object is modified
      var that = this;
      var that_super = this._super;

      this.options.instance.bind('change', function () {
        that_super.apply(that);
      });
      this._super();
    },

    init_widget_descriptors: function () {
      this.options.widget_descriptors = this.options.widget_descriptors || {};
    }
  });

  can.Control('CMS.Controllers.InnerNav', {
    defaults: {
      internav_view: '/static/mustache/dashboard/internav_list.mustache',
      pin_view: '.pin-content',
      widget_list: null,
      spinners: {},
      contexts: null,
      instance: null
    }
  }, {
    init: function (options) {
      CMS.Models.DisplayPrefs.getSingleton().then(function (prefs) {
        this.display_prefs = prefs;
        if (!this.options.widget_list) {
          this.options.widget_list = new can.Observe.List([]);
        }

        this.options.instance = GGRC.page_instance();
        if (!(this.options.contexts instanceof can.Observe)) {
          this.options.contexts = new can.Observe(this.options.contexts);
        }

        // FIXME: Initialize from `*_widget` hash when hash has no `#!`
        can.bind.call(window, 'hashchange', function () {
          this.route(window.location.hash);
        }.bind(this));
        can.view(this.options.internav_view, this.options, function (frag) {
          var fn = function () {
            this.element.append(frag);
            this.route(window.location.hash);
            delete this.delayed_display;
          }.bind(this);

          this.delayed_display = {
            fn: fn,
            timeout: setTimeout(fn, 50)
          };
        }.bind(this));

        this.on();
      }.bind(this));
    },

    route: function (path) {
      if (path.substr(0, 2) === '#!') {
        path = path.substr(2);
      } else if (path.substr(0, 1) === '#') {
        path = path.substr(1);
      }

      window.location.hash = path;

      this.display_path(path.length ? path : 'Summary_widget');
    },

    display_path: function (path) {
      var step = path.split('/')[0];
      var rest = path.substr(step.length + 1);
      var widget_list = this.options.widget_list;

      // Find and make active the widget specified by `step`
      var widget = this.find_widget_by_target('#' + step);
      // If widget was not found and it's not info - try to select info
      if (!widget && step !== 'info') {
        return this.display_path('info_widget');
      }
      if (!widget && widget_list.length) {
        // Target was not found, but we can select the first widget in the list
        widget = widget_list[0];
      }
      if (widget) {
        this.set_active_widget(widget);
        return this.display_widget_path(rest);
      }
      return new $.Deferred().resolve();
    },

    display_widget_path: function (path) {
      var active_widget_selector = this.options.contexts.active_widget.selector;
      var $active_widget = $(active_widget_selector);
      var widget_controller = $active_widget.control();

      if (widget_controller && widget_controller.display_path) {
        return widget_controller.display_path(path);
      }
      return new $.Deferred().resolve();
    },

    set_active_widget: function (widget) {
      if (typeof widget === 'string') {
        widget = this.widget_by_selector(widget);
      }

      if (widget !== this.options.contexts.attr('active_widget')) {
        widget.attr('force_show', true);
        this.update_add_more_link();
        this.options.contexts.attr('active_widget', widget);
        this.show_active_widget();
      }
    },

    show_active_widget: function (selector) {
      var panel = selector ||
        this.options.contexts.attr('active_widget').selector;
      var widget = $(panel);
      var dashboardCtr = this.options.dashboard_controller;
      var infopinCtr = dashboardCtr.info_pin.element.control();

      if (infopinCtr) {
        infopinCtr.hideInstance();
      }

      if (widget.length) {
        dashboardCtr.show_widget_area();
        widget.siblings().addClass('hidden').trigger('widget_hidden');
        widget.removeClass('hidden').trigger('widget_shown');
        $('[href$="' + panel + '"]')
        .closest('li').addClass('active')
        .siblings().removeClass('active');
      }
    },

    find_widget_by_target: function (target) {
      var i;
      var widget;
      for (i = 0; i < this.options.widget_list.length; i++) {
        widget = this.options.widget_list[i];
        if (widget.selector === target) {
          return widget;
        }
      }
    },

    widget_by_selector: function (selector) {
      return $.map(this.options.widget_list, function (widget) {
        return widget.selector === selector ? widget : undefined;
      })[0] || undefined;
    },

    /**
     * Sort widgets in place by their `order` attribute in ascending order.
     *
     * The widgets with non-existing / non-numeric `order` value are placed
     * at the end of the list.
     */
    sortWidgets: function () {
      function sortByOrderAttr(widget, widget2) {
        var order = _.isNumber(widget.order) ?
                                widget.order : Number.MAX_SAFE_INTEGER;
        var order2 = _.isNumber(widget2.order) ?
                                 widget2.order : Number.MAX_SAFE_INTEGER;
        return order - order2;
      }
      this.options.widget_list.sort(sortByOrderAttr);
    },

    update_widget_list: function (widget_elements) {
      var widget_list = this.options.widget_list.slice(0);
      var that = this;

      can.each(widget_elements, function (widget_element, index) {
        widget_list.splice(
          can.inArray(
            that.update_widget(widget_element, index)
            , widget_list)
          , 1);
      });

      can.each(widget_list, function (widget) {
        that.options.widget_list.splice(can.inArray(widget, that.options.widget_list), 1);
      });
    },

    update_widget: function (widget_element, index) {
      var $widget = $(widget_element);
      var widget = this.widget_by_selector('#' + $widget.attr('id'));
      var $header = $widget.find('.header h2');
      var icon = $header.find('i').attr('class');
      var menuItem = $header.text().trim();
      var match = menuItem ? menuItem.match(/\s*(\S.*?)\s*(?:\((?:(\d+)|\.*)(\/\d+)?\))?$/) : {};
      var title = match[1];
      var count = match[2] || undefined;
      var existing_index;
      var widget_options;
      var widget_name;

      if (this.delayed_display) {
        clearTimeout(this.delayed_display.timeout);
        this.delayed_display.timeout = setTimeout(this.delayed_display.fn, 50);
      }

    // If the metadata is unrendered, find it via options
      if (!title) {
        widget_options = $widget.control('dashboard_widgets').options;
        widget_name = widget_options.widget_name;
        icon = icon || widget_options.widget_icon;
      // Strips html
        title = $('<div>').html(typeof widget_name === 'function' ? widget_name() : (String(widget_name))).text();
      }
      title = title.replace(/^(Mapped|Linked|My)\s+/, '');

      // Only create the observable once, this gets updated elsewhere
      if (!widget) {
        widget = new can.Observe({
          selector: '#' + $widget.attr('id'),
          count: count,
          has_count: count != null
        });
      }
      existing_index = this.options.widget_list.indexOf(widget);

      widget.attr({
        internav_icon: icon,
        internav_display: title,
        spinner: this.options.spinners['#' + $widget.attr('id')],
        model: widget_options && widget_options.model,
        order: (widget_options || widget).order
      });

      index = this.options.widget_list.length;

      if (existing_index !== index) {
        if (existing_index > -1) {
          if (index >= this.options.widget_list.length) {
            this.options.widget_list.splice(existing_index, 1);
            this.options.widget_list.push(widget);
          } else {
            this.options.widget_list.splice(existing_index, 1, this.options.widget_list[index]);
            this.options.widget_list.splice(index, 1, widget);
          }
        } else {
          this.options.widget_list.push(widget);
        }
      }

      return widget;
    },

    update_widget_count: function ($el, count) {
      var widget_id = $el.closest('.widget').attr('id');
      var widget = this.widget_by_selector('#' + widget_id);

      if (widget) {
        widget.attr({
          count: count,
          has_count: true
        });
      }
      this.update_add_more_link();
    },

    update_add_more_link: function () {
      var has_hidden_widgets = false;
      var $hidden_widgets = $('.hidden-widgets-list:not(.top-space)');
      var instance = this.options.instance || {};
      var model = instance.constructor;
      var show_all_tabs = false;

      if (model.obj_nav_options) {
        show_all_tabs = model.obj_nav_options.show_all_tabs;
      }

      // Update has hidden widget attr
      $.map(this.options.widget_list, function (widget) {
        if (widget.has_count && widget.count === 0 &&
            !widget.force_show && !show_all_tabs) {
          has_hidden_widgets = true;
        }
      });
      if (has_hidden_widgets) {
        $hidden_widgets.show();
      } else {
        $hidden_widgets.hide();
      }
      this.show_hide_titles();
    },
    '{window} resize': function (el, ev) {
      this.show_hide_titles();
    },
    show_hide_titles: _.debounce(function () {
      var $el = this.element;
      var widgets = this.options.widget_list;
      var widths;

      // first expand all
      widgets.forEach(function (widget) {
        widget.attr('show_title', true);
      });

      // see if too wide
      widths = _.map($el.children(':visible'),
                         function (el) {
                           return $(el).width();
                         }).reduce(function (m, w) {
                           return m + w;
                         }, 0);

      // adjust
      if (widths > $el.width()) {
        widgets.forEach(function (widget) {
          widget.attr('show_title', false);
        });
      }
    }, 100),
    '.closed click': function (el, ev) {
      var $link = el.closest('a');
      var widget = this.widget_by_selector('#' + $link.attr('href')
                                                      .split('#')[1]);
      var widgets = this.options.widget_list;

      widget.attr('force_show', false);
      this.route(widgets[0].selector); // Switch to the first widget
      return false; // Prevent the url change back to the widget we are hiding
    },

    // top nav dropdown position
    '.dropdown-toggle click': function (el, ev) {
      var $dropdown = el.closest('.hidden-widgets-list').find('.dropdown-menu');
      var $menu_item = $dropdown.find('.inner-nav-item').find('a');
      var offset = el.offset();
      var left_pos = offset.left;
      var win = $(window);
      var win_width = win.width();

      if (win_width - left_pos < 322) {
        $dropdown.addClass('right-pos');
      } else {
        $dropdown.removeClass('right-pos');
      }
      if ($menu_item.length === 1) {
        $dropdown.addClass('one-item');
      } else {
        $dropdown.removeClass('one-item');
      }
    }
  });
})(this.can, this.can.$);
