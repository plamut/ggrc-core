/*!
    Copyright (C) 2014 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/
;(function(cam, $, GGRC) {

GGRC.Controllers.Modals("GGRC.Controllers.QuickForm", {
  defaults : {
    model: null,
    instance: null
  }
}, {
  init: function () { // TODO: accepts $element, options
    if(this.options.instance && !this.options.model) {
      this.options.model = this.options.instance.constructor;
    }
    this.options.$content = this.element;
    if (this.element.data("force-refresh")) {
      this.options.instance.refresh();
    }
  },
  "{document} custom_event": function (el, ev) {
    console.log('handling custom_event');  // this works... like  this listen for change!
  },

  // TODO: docstring... and tests
  // explain what paraemtrs represent,
  // TODO_: test how it affects other quick
  // ev - event object describing the change event
  // the name of  the attribute whose value has changed
  // how - how the value was changed, e.g. ("set", "add" etc.)
  // newVal - new value of the changed attribute,
  // oldVal - previou attrbute value, before the change
  "{instance} change": function (instance, ev, attr, how, newVal, oldVal) {
    console.log('{instance} change', attr);
    // if (attr === 'custom_attribute_values') {
    //   debugger;
    // } else if (attr === 'task_group_objects') {
    //   debugger;
    // }
    if (attr.indexOf('custom_attribute_values') > -1) {
      debugger;
    }
  },

  "input, textarea, select change": function (el, ev) {
    if (el.data("toggle") === "datepicker") {
      var val = el.datepicker("getDate"),
          prop = el.attr("name"),
          old_value = this.options.instance.attr(prop);

          if (moment(val).isSame(old_value)) {
            return;
          }
          $.when(this.options.instance.refresh()).then(function () {
            this.options.instance.attr(prop, val);
            this.options.instance.save();
          }.bind(this));
      return;
    }
    if (!el.is("[data-lookup]")) {
      this.set_value_from_element(el);
      setTimeout(function () {
        this.options.instance.save();
      }.bind(this), 100);
    }
  },
  autocomplete_select: function (el, event, ui) {
    var prop = el.attr("name").split(".").slice(0, -1).join(".");
    if (this._super.apply(this, arguments) !== false) {
      setTimeout(function () {
        this.options.instance.save().then(function () {
          var obj = this.options.instance.attr(prop);
          if (obj.attr) {
            obj.attr("saved", true);
          }
        }.bind(this));
      }.bind(this), 100);
    } else {
      return false;
    }
  },
  "input, select, textarea click": function (el, ev) {
    if (el.data("toggle") === "datepicker") {
      return;
    }
    this._super && this._super.apply(this, arguments);
    ev.stopPropagation();
  },
  ".dropdown-menu > li click": function (el, ev) {
    ev.stopPropagation();
    var that = this;
    this.set_value({ name: el.data('name'), value: el.data('value') });
    setTimeout(function() {
      that.options.instance.save();
      $(el).closest(".open").removeClass("open");
    }, 100);
  }

  , "button[data-name][data-value]:not(.disabled), a.undoable[data-toggle*=modal] click": function(el, ev) {

    var that = this
      , name = el.data('name')
      , old_value = {};


    if(el.data('openclose')){
      var action = el.data('openclose'),
          main = el.closest('.item-main'),
          openclose = main.find('.openclose'),
          isOpened = openclose.hasClass('active');

      // We can't use main.openclose(action) here because content may not be loaded yet
      if(action === 'trigger'){
        openclose.trigger('click');
      }
      else if(action === 'close' && isOpened){
        openclose.trigger('click');
      }
      else if(action === 'open' && !isOpened){
        openclose.trigger('click');
      }
    }

    old_value[el.data("name")] = this.options.instance.attr(el.data("name"));
    if(el.data("also-undo")) {
      can.each(el.data("also-undo").split(","), function(attrname) {
        attrname = attrname.trim();
        old_value[attrname] = that.options.instance.attr(attrname);
      });
    }

    // Check if the undo button was clicked:
    this.options.instance.attr('_undo') || that.options.instance.attr('_undo', []);

    if(el.is("[data-toggle*=modal")) {
      setTimeout(function() {
        $(".modal:visible").one("modal:success", function() {
          that.options.instance.attr('_undo').unshift(old_value);
        });
      }, 100);
    } else {
      ev.stopPropagation();
      that.options.instance.attr('_undo').unshift(old_value);

    that.options.instance.attr('_disabled', 'disabled');
    that.options.instance.refresh().then(function(instance){
      that.set_value({ name: el.data('name'), value: el.data('value') });
      return instance.save();
    }).then(function(){
      that.options.instance.attr('_disabled', '');
    });
  }
  }


  , "a.undo click" : function(el, ev){
    ev.stopPropagation();
    var that = this
      , name = el.data('name')
      , old_value = this.options.instance.attr(name) || "";

    new_value = that.options.instance.attr('_undo').shift();
    that.options.instance.attr('_disabled', 'disabled');
    that.options.instance.refresh().then(function(instance){
      can.each(new_value, function(value, name) {
        that.set_value({ name: name, value: value });
      });
      return instance.save();
    }).then(function(){
      that.options.instance.attr('_disabled', '');
    });
  }

});

/*
  Below this line we're defining a few can.Components, which are in this file
  because they work similarly to the quick form controller (in fact, you should
  expect the quick form controller to be refactored into a component in the
  future) but they share no code with the quick form controller.

  the first component is quick add.  It is meant to have one or more form elements
  and a data-toggle="submit" link which will create a new join object between
  the parent instance and some selected option instance (likely picked through an
  autocomplete dropdown).

  Technically you can choose your instance however you want, as long as you find
  some way of getting its value into the component scope.  Extending this component
  with other methods to do that is fine.  You can also just pass it in when
  instantiating the component.
*/
can.Component.extend({
  tag: "ggrc-quick-add",
  // <content> in a component template will be replaced with whatever is contained
  //  within the component tag.  Since the views for the original uses of these components
  //  were already created with content, we just used <content> instead of making
  //  new view template files.
  template: "<content/>",
  scope: {
    parent_instance: null,
    source_mapping: null,
    deferred: "@",
    join_model: "@",
    model: null,
    delay: "@",
    quick_create: "@",
    verify_event: "@",
    modal_description: "@",
    modal_title: "@",
    modal_button: "@",
    attributes: {},
    create_url: function() {
      var value = this.element.find("input[type='text']").val();
      return new CMS.Models.Document({
        link: value,
        title: value,
        context: this.scope.parent_instance.context || new CMS.Models.Context({id : null}),
      });
    },
  },
  events: {
    init: function() {
      this.scope.attr("controller", this);
    },
    // The inserted event fires when the component content is added to the DOM.
    //  At this time, live bound rendering should be resolved, which is not the
    //  case during init.
    inserted: function (el) {
      this.element.find("input:not([data-mapping], [data-lookup])").each(function(i, el) {
        this.scope.attributes.attr($(el).attr("name"), $(el).val());
      }.bind(this));
    },
    "a[data-toggle=submit]:not(.disabled) click": function (el, ev) {
      var scope = this.scope,
          join_model_class,
          join_object,
          quick_create,
          created_dfd,
          verify_dfd = $.Deferred();

      if (scope.attr("verify_event")) {
        GGRC.Controllers.Modals.confirm({
          modal_description: scope.attr("modal_description"),
          modal_confirm: scope.attr("modal_button"),
          modal_title: scope.attr("modal_title"),
          button_view : GGRC.mustache_path + "/quick_form/confirm_buttons.mustache",
        }, verify_dfd.resolve);
      } else {
        verify_dfd.resolve();
      }

      verify_dfd.done(function () {
        if (this.scope.quick_create && this.scope.quick_create !== "@") {
          quick_create = this.scope[this.scope.quick_create].bind(this);
          if (quick_create) {
            created_dfd = quick_create();
            if (!this.scope.deferred) {
              created_dfd = created_dfd.save().then(function(data){
                this.scope.attr("instance", data);
              }.bind(this));
            }
          }
        }
        if (!created_dfd) {
          created_dfd = $.Deferred().resolve();
        }

        if (this.scope.deferred) {
          this.scope.parent_instance.mark_for_addition("related_objects_as_source", created_dfd);
          el.trigger("modal:success", created_dfd);
          return;
        }

        created_dfd.then(function() {
          if (this.scope.join_model && this.scope.join_model !== "@") {
            join_model_class = CMS.Models[this.scope.join_model] || CMS.ModelHelpers[this.scope.join_model];
            join_object = {};
            if (this.scope.join_model === "Relationship") {
              join_object["source"] = this.scope.parent_instance;
              join_object["destination"] = this.scope.instance;
            } else {
              join_object[this.scope.instance.constructor.table_singular] = this.scope.instance;
            }
            join_object = new join_model_class($.extend(
              join_object,
              {
                context: this.scope.parent_instance.context
                            || new CMS.Models.Context({id : null}),
              },
              this.scope.attributes.serialize()
            ));
          } else {
            join_object = GGRC.Mappings.make_join_object(
              this.scope.parent_instance,
              this.scope.instance || this.scope.attributes.instance,
              $.extend({
                context : this.scope.parent_instance.context
                          || new CMS.Models.Context({id : null})
                        },
                        this.scope.attributes.serialize())
            );
          }
          this.bindXHRToButton(
            join_object.save().done(function() {
              el.trigger("modal:success", join_object);
            }),
            el
            );
        }.bind(this));
      }.bind(this));
    },
    // this works like autocomplete_select on all modal forms and
    //  descendant class objects.
    autocomplete_select: function(el, event, ui) {
      var that = this;
      setTimeout(function() {
        that.scope.attr(el.attr("name"), ui.item);
      });
    },
    "input[null-if-empty] change" : function(el) {
      if (!el.val()) {
        this.scope.attributes.attr(el.attr("name"), null);
      }
    },
    "input:not([data-mapping], [data-lookup]) change" : function(el) {
      this.scope.attributes.attr(el.attr("name"), el.val());
    },
    ".ui-autocomplete-input modal:success" : function(el, ev, data, options) {
      var that = this,
        multi_map = data.multi_map,
        join_model_class,
        join_object;

      if(multi_map){
        var length = data.arr.length,
            my_data;

        if (length == 1){
          my_data = data.arr[0];

          GGRC.Mappings.make_join_object(
            this.scope.parent_instance,
            my_data,
            $.extend({
              context : this.scope.parent_instance.context
                      || new CMS.Models.Context({id : null})
                      },
                      this.scope.attributes.serialize())
          ).save().done(function() {
            that.element.find("a[data-toggle=submit]").trigger("modal:success");
          });
        }

        else{
          for(var i = 0; i < length-1; i++){
            my_data = data.arr[i];

            GGRC.Mappings.make_join_object(
              this.scope.parent_instance,
              my_data,
              $.extend({
                context : this.scope.parent_instance.context
                        || new CMS.Models.Context({id : null})
                        },
                        this.scope.attributes.serialize())
            ).save().done(function(){});
          }
          my_data = data.arr[length-1];
          GGRC.Mappings.make_join_object(
            this.scope.parent_instance,
            my_data,
            $.extend({
              context : this.scope.parent_instance.context
                      || new CMS.Models.Context({id : null})
                      },
                      this.scope.attributes.serialize())
          ).save().done(function() {
            that.element.find("a[data-toggle=submit]").trigger("modal:success");
          });
        }
        //end multi-map
      } else {

        if (this.scope.join_model && this.scope.join_model !== "@") {
          join_model_class = CMS.Models[this.scope.join_model] || CMS.ModelHelpers[this.scope.join_model];
          join_object = new join_model_class(this.scope.attributes.serialize());
        } else {
          join_object = GGRC.Mappings.make_join_object(
            this.scope.parent_instance,
            data,
            $.extend({
              context : this.scope.parent_instance.context
                        || new CMS.Models.Context({id : null})
                      },
                      this.scope.attributes.serialize())
          );
        }
        join_object.save().done(function() {
           that.element.find("a[data-toggle=submit]").trigger("modal:success");
        });
      }
    }
  },
  helpers: {
    // Mapping-based autocomplete selectors use this helper to
    //  attach the mapping autocomplete ui widget.  These elements should
    //  be decorated with data-mapping attributes.
    mapping_autocomplete : function(options) {
      return function(el) {
        var $el = $(el);
        $el.ggrc_mapping_autocomplete({
          controller : options.contexts.attr("controller"),
          model : $el.data("model"),
          mapping : false
        });
      };
    }
  },
});

/*
  This component is for quickly updating the properties of an object through form fields.
  It works similar to GGRC.Controllers.QuickForm but has an extra feature: if the instance
  we're working with is a join object, and the option type is changed, it will work around
  the lack of support in proxy mappers for join objects being changed like that, and
  destroy the join object while creating a new one.

  Field updates trigger updates to the model automatically, even on the server.  This differs
  from the quick-add component above, in that it is not waiting for a submit trigger.
*/
can.Component.extend({
  tag: "ggrc-quick-update",
  template: "<content/>",
  scope: {
    instance: null,
    source_mapping: null,
    model: null,
    attributes: {}
  },
  events: {
    init: function() {
      this.scope.attr("controller", this);
      this.scope.attr("model", this.scope.model || this.scope.instance.constructor);
      if(!this.scope.instance._transient) {
        //only refresh if there's not currently an edit modal spawned.
        this.scope.instance.refresh();
      }
    },
    //currently we don't support proxy object updates in mappings, so for now a change
    //  to a connected object (assuming we are operating on a proxy object) will trigger
    //  a deletion of the proxy object and creation of a new one.
    autocomplete_select : function(el, event, ui) {
      var that = this;
      setTimeout(function() {
        var serial = that.scope.instance.serialize();
        delete serial[el.attr("name")];
        delete serial[el.attr("name") + "_id"];
        delete serial[el.attr("name") + "_type"];
        delete serial.id;
        delete serial.href;
        delete serial.selfLink;
        delete serial.created_at;
        delete serial.updated_at;
        delete serial.provisional_id;
        serial[el.attr("name")] = ui.item.stub();
        that.scope.instance.destroy().then(function() {
          new that.scope.model(serial).save();
        });
      });
    },
    // null-if-empty attributes are a pattern carried over from GGRC.Controllers.Modals
    //  Useful for connected objects.
    "input[null-if-empty] change" : function(el) {
      if (!el.val()) {
        this.scope.instance.attr(el.attr("name"), null);
      }
    },
    // data-mapping is the element decoration that triggers an autocomplete based on a
    //  mapping to a parent instance.  The mapping_autocomplete helper defined below is
    //  generally for these.
    "input:not([data-mapping]), select change" : function(el) {
      var isCheckbox = el.is("[type=checkbox][multiple]");
      if (isCheckbox) {
        if(!this.scope.instance[el.attr("name")]) {
          this.scope.instance.attr(el.attr("name"), new can.List());
        }
        this.scope.instance
        .attr(el.attr("name"))
        .replace(
          can.map(
            this.element.find("input[name='" + el.attr("name") + "']:checked"),
            function(el) {
              return $(el).val();
            }
          )
        );
        this.element.find("input:checkbox").prop("disabled", true);
      } else {
        this.scope.instance.attr(el.attr("name"), el.val());
      }
      this.scope.instance.save().then(function () {
        if (isCheckbox) {
          this.element.find("input:checkbox").prop("disabled", false);
        }
      }.bind(this));
    },
  },
  helpers: {
    mapping_autocomplete : function(options) {
      return function(el) {
        $(el).ggrc_mapping_autocomplete({ controller : options.contexts.attr("controller") });
      };
    }
  },
});

})(this.can, this.can.$, this.GGRC);
