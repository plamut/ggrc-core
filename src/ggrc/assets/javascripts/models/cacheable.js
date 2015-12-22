/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

//= require can.jquery-all

(function(can) {

var makeFindRelated = function(thistype, othertype) {
  return function(params) {
    if(!params[thistype + "_type"]) {
      params[thistype + "_type"] = this.shortName;
    }
    return CMS.Models.Relationship.findAll(params).then(function(relationships) {
      var dfds = [], things = new can.Model.List();
      can.each(relationships, function(rel,idx) {
        var dfd;
        if(rel[othertype].selfLink) {
          things.push(rel[othertype]);
        } else {
          dfd = rel[othertype].refresh().then(function(dest) {
            things.splice(idx, 1, dest);
          });
          dfds.push(dfd);
          things.push(dfd);
        }
      });
      return $.when.apply($, dfds).then(function(){ return things; });
    });
  };
};

function dateConverter(d, oldValue, fn, key) {
  var conversion = "YYYY-MM-DD\\THH:mm:ss\\Z";
  var ret;
  if(typeof d === "object" && d) {
    d = d.getTime();
  }
  if(typeof d === "number") {
    d /= 1000;
    conversion = "X";
  }
  if(typeof d === "string" && ~d.indexOf("/")) {
    conversion = "MM/DD/YYYY";
  }
  d = d ? d.toString() : null;
  ret = moment(d, conversion);
  if(!ret.unix()) {
    // invalid date computed. Result of unix() is NaN.
    return undefined;
  }

  if (typeof d === "string" && ret
      //  Don't correct timezone for dates
      && !/^\d+-\d+-\d+$/.test(d) && !/^\d+\/\d+\/\d+$/.test(d)
      //  Don't correct timezone if `moment.js` has already done it
      && !/[-+]\d\d:?\d\d/.test(d)) {
    ret.subtract(new Date().getTimezoneOffset(), "minute");
  }

  if(oldValue && oldValue.getTime && ret && ret.toDate().getTime() === oldValue.getTime()) {
    return oldValue;  // avoid changing to new Date object if the value is the same.
  }
  return ret ? ret.toDate() : undefined;
}

function makeDateUnpacker(keys) {
  return function(d, oldValue, fn, attr) {
    return can.reduce(keys, function(curr, key) {
      return curr || (d[key] && dateConverter(d[key], oldValue, fn, attr));
    }, null) || d;
  };
}

function makeDateSerializer(type, key) {
  var conversion = type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD\\THH:mm:ss\\Z";
  return function(d) {
    if(d == null) {
      return "";
    }
    if(typeof d !== "number") {
      d = d.getTime();
    }
    var retstr = moment((d / 1000).toString(), "X");
    if(type !== "date") {
      retstr = retstr.utc();
    }
    retstr = retstr.format(conversion);
    var retval;
    if(key) {
      retval = {};
      retval[key] = retstr;
    } else {
      retval = retstr;
    }
    return retval;
  };
}


can.Model("can.Model.Cacheable", {

  root_object : "",
  filter_keys: ["assignee", "company", "contact", "description",
                "email", "end_date", "kind", "name", "notes",
                "owners", "reference_url", "slug", "status",
                "start_date", "test", "title", "updated_at", "created_at",
                "due_on"
  ],
  filter_mappings: {
    //'search term', 'actual value in the object'
    "owner": "owners",
    "workflow": "workflows",
    "due date": "end_date",
    "end date": "end_date",
    "stop date": "end_date",
    "effective date": "start_date",
    "start date": "start_date",
    "created date": "created_at",
    "updated date": "updated_at",
    "modified date": "updated_at",
    "code": "slug",
    "state": "status"
  }
  , attr_list : [
    {attr_title: 'Title', attr_name: 'title'},
    {attr_title: 'Owner', attr_name: 'owner', attr_sort_field: 'contact.name|email'},
    {attr_title: 'Code', attr_name: 'slug'},
    {attr_title: 'State', attr_name: 'status'},
    {attr_title: 'Primary Contact', attr_name: 'contact', attr_sort_field: 'contact.name|email'},
    {attr_title: 'Secondary Contact', attr_name: 'secondary_contact', attr_sort_field: 'secondary_contact.name|email'},
    {attr_title: 'Last Updated', attr_name: 'updated_at'}
  ]
  , root_collection : ""
  , model_singular : ""
  , model_plural : ""
  , table_singular : ""
  , table_plural : ""
  , title_singular : ""
  , title_plural : ""
  , findOne : "GET {href}"
  , makeDestroy: function(destroy) {
    return function(id, instance) {
      return destroy(id).then(function(result) {
        if ("background_task" in result) {
          return CMS.Models.BackgroundTask.findOne(
            {id: result.background_task.id}
          ).then(function(task) {
            if (!task) {
              return;
            }
            return task.poll();
          }).then(function() {
            return instance;
          });
        } else {
          return instance;
        }
      });
    };
  }
  , makeFindAll: function(finder) {
      return function(params, success, error) {
        var deferred = $.Deferred()
          , sourceDeferred = finder.call(this, params)
          , self = this
          , tracker_stop = GGRC.Tracker.start("modelize", self.shortName)
          ;

        deferred.then(success, error);
        sourceDeferred.then(function(sourceData) {
          var obsList = new self.List([])
            , index = 0
            ;

          if(sourceData[self.root_collection + "_collection"]) {
            sourceData = sourceData[self.root_collection + "_collection"];
          }
          if(sourceData[self.root_collection]) {
            sourceData = sourceData[self.root_collection];
          }

          if (!sourceData.splice) {
            sourceData = [sourceData];
          }

          function modelizeMS(ms) {
            var item
              , start
              , instances = []
              ;
            start = Date.now();
            while(sourceData.length > index && (Date.now() - start) < ms) {
              can.Observe.startBatch();
              item = sourceData[index];
              index = index + 1;
              instances.push.apply(instances, self.models([item]));
              can.Observe.stopBatch();
            }
            can.Observe.startBatch();
            obsList.push.apply(obsList, instances);
            can.Observe.stopBatch();
          }

          // Trigger a setTimeout loop to modelize remaining objects
          (function() {
            modelizeMS(100);
            if (sourceData.length > index) {
              setTimeout(arguments.callee, 5);
            }
            else {
              deferred.resolve(obsList);
            }
          })();
        }, function() {
          deferred.reject.apply(deferred, arguments);
        });

        return deferred.done(tracker_stop);
      };
    }
  , setup : function(construct, name, statics, prototypes) {
    var overrideFindAll = false;

    if(this.fullName === "can.Model.Cacheable") {
      this.findAll = function() {
        throw "No default findAll() exists for subclasses of Cacheable";
      };
      this.findPage = function() {
        throw "No default findPage() exists for subclasses of Cacheable";
      };
    }
    else if((!statics || !statics.findAll) && this.findAll === can.Model.Cacheable.findAll) {
      if(this.root_collection) {
        this.findAll = "GET /api/" + this.root_collection;
      } else {
        overrideFindAll = true;
      }
    }
    if(this.root_collection) {
      this.model_plural = statics.model_plural || this.root_collection.replace(/(?:^|_)([a-z])/g, function(s, l) { return l.toUpperCase(); } );
      this.title_plural = statics.title_plural || this.root_collection.replace(/(^|_)([a-z])/g, function(s, u, l) { return (u ? " " : "") + l.toUpperCase(); } );
      this.table_plural = statics.table_plural || this.root_collection;
    }
    if(this.root_object) {
      this.model_singular = statics.model_singular || this.root_object.replace(/(?:^|_)([a-z])/g, function(s, l) { return l.toUpperCase(); } );
      this.title_singular = statics.title_singular || this.root_object.replace(/(^|_)([a-z])/g, function(s, u, l) { return (u ? " " : "") + l.toUpperCase(); } );
      this.table_singular = statics.table_singular || this.root_object;
    }

    if (!can.isFunction(this.findAll)) {
      this.findPage = this.makeFindPage(this.findAll);
    }

    // Prevent event "bleeding" from other members of the Cacheable tree.
    // This fix causes breakages in places where we're expecting model class
    //  events not to be isolated (like in the LHN controller).
    //  I've submitted a fix to CanJS for this but it remains to be seen
    //  whether it gets in and when.  --BM 3/4/14
    //this.__bindEvents = {};

    var that = this;
    if(statics.mixins) {
      can.each(statics.mixins, function(mixin) {
        var _mixin = mixin;
        if(typeof _mixin === "string") {
          _mixin = can.getObject(_mixin, CMS.Models.Mixins);
        }
        if(_mixin) {
          _mixin.add_to(that);
        } else {
          throw "Error: Cannot find mixin " + mixin + " for class " + that.fullName;
        }
      });
      delete this.mixins;
    }

    var ret = this._super.apply(this, arguments);
    if(overrideFindAll)
      this.findAll = can.Model.Cacheable.findAll;

    //set up default attribute converters/serializers for all classes
    can.extend(this.attributes, {
      created_at : "datetime"
      , updated_at : "datetime"
    });

    return ret;
  }
  , init : function() {
    var id_key = this.id;
    this.bind("created", function(ev, new_obj) {
      var cache = can.getObject("cache", new_obj.constructor, true);
      if(new_obj[id_key] || new_obj[id_key] === 0) {
        cache[new_obj[id_key]] = new_obj;
        if(cache[undefined] === new_obj)
          delete cache[undefined];
      }
    });
    this.bind("destroyed", function(ev, old_obj) {
      delete can.getObject("cache", old_obj.constructor, true)[old_obj[id_key]];
    });

    // FIXME:  This gets set up in a chain of multiple calls to the function defined
    //  below when the update endpoint isn't set in the model's static config.
    //  This leads to conflicts not actually rejecting because on the second go-round
    //  the local and remote objects look the same.  --BM 2015-02-06
    var _update = this.update;
    this.update = function(id, params) {
      var that = this,
        ret = _update
        .call(this, id, this.process_args(params))
        .then(
          $.proxy(this, "resolve_deferred_bindings")
          , function(xhr, status, e) {
            var dfd, obj, attrs, base_attrs,
            orig_dfd = this;
            if(xhr.status === 409) {
              obj = that.findInCacheById(id);
              attrs = obj.attr();
              base_attrs = obj._backupStore;
              return obj.refresh().then(function(obj) {
                var conflict = false,
                    remote_attrs = obj.attr();
                if (can.Object.same(remote_attrs, attrs)) {
                  //current state is same as server state -- do nothing.
                  return obj;
                } else if(can.Object.same(remote_attrs, base_attrs)) {
                  //base state matches server state -- no incorrect expectations -- save.
                  return obj.attr(attrs).save();
                } else {
                  //check what properties changed -- we can merge if the same prop wasn't changed on both
                  can.each(base_attrs, function(val, key) {
                    if (!can.Object.same(attrs[key], remote_attrs[key])) {
                      if(can.Object.same(val, remote_attrs[key])) {
                        obj.attr(key, attrs[key]);
                      } else if (!can.Object.same(val, attrs[key])) {
                        conflict = true;
                      }
                    }
                  });
                  if(conflict) {
                    $(document.body).trigger("ajax:flash", {
                      warning: "There was a conflict while saving. Your changes have not yet been saved. please check any fields you were editing and try saving again"
                    });
                    return orig_dfd;
                  } else {
                    return obj.save();
                  }
                }
              });
            } else {
              return xhr;
            }
          }
        );
      delete ret.hasFailCallback;
      return ret;
    };

    var _create = this.create;
    this.create = function(params) {
      var ret = _create
        .call(this, this.process_args(params))
        .then($.proxy(this, "resolve_deferred_bindings"));
      delete ret.hasFailCallback;
      return ret;
    };

    // Register this type as a custom attributable type if it is one.
    if(this.is_custom_attributable) {
      if(!GGRC.custom_attributable_types) {
        GGRC.custom_attributable_types = [];
      }
      GGRC.custom_attributable_types.push($.extend({}, this));
    }
  }
  , resolve_deferred_bindings : function(obj) {
    var _pjs, refresh_dfds = [], dfds = [];
    if(obj._pending_joins) {
      _pjs = obj._pending_joins.slice(0); //refresh of bindings later will muck up the pending joins on the object
      can.each(can.unique(can.map(_pjs, function(pj) { return pj.through; })), function(binding) {
        refresh_dfds.push(obj.get_binding(binding).refresh_stubs());
      });

      return $.when.apply($, refresh_dfds)
      .then(function() {
        can.each(obj._pending_joins, function(pj) {
          var inst
          , binding = obj.get_binding(pj.through)
          , model = CMS.Models[binding.loader.model_name] || GGRC.Models[binding.loader.model_name];
          if(pj.how === "add") {
            //Don't re-add -- if the object is already mapped (could be direct or through a proxy)
            // move on to the next one
            if(~can.inArray(pj.what, can.map(binding.list, function(bo) { return bo.instance; }))
               || (binding.loader.option_attr
                  && ~can.inArray(
                    pj.what
                    , can.map(
                      binding.list
                      , function(join_obj) { return join_obj.instance[binding.loader.option_attr]; }
                    )
                  )
            )) {
              return;
            }
            inst = pj.what instanceof model
              ? pj.what
              : new model({
                  context : obj.context
                });
            dfds.push(
              $.when(pj.what !== inst && pj.what.isNew() ? pj.what.save() : null)
               .then(function() {
                if(binding.loader.object_attr) {
                  inst.attr(binding.loader.object_attr, obj.stub());
                }
                if(binding.loader.option_attr) {
                  inst.attr(binding.loader.option_attr, pj.what.stub());
                }
                if(pj.extra) {
                  inst.attr(pj.extra);
                }
                return inst.save();
              })
            );
          } else if(pj.how === "remove") {
            can.map(binding.list, function(bound_obj) {
              if(bound_obj.instance === pj.what || bound_obj.instance[binding.loader.option_attr] === pj.what) {
                can.each(bound_obj.get_mappings(), function(mapping) {
                  dfds.push(mapping.refresh().then(function() { mapping.destroy(); }));
                });
              }
            });
          }
        });

        obj.attr('_pending_joins', []);
        return $.when.apply($, dfds).then(function() {
          return obj.refresh();
        });
      });
    } else {
      return obj;
    }
  }

  , findInCacheById : function(id) {
    return can.getObject("cache", this, true)[id];
  }

  , newInstance : function(args) {
    var cache = can.getObject("cache", this, true);
    if(args && args[this.id] && cache[args[this.id]]) {
      //cache[args.id].attr(args, false); //CanJS has bugs in recursive merging
                                          // (merging -- adding properties from an object without removing existing ones
                                          //  -- doesn't work in nested objects).  So we're just going to not merge properties.
      return cache[args[this.id]];
    } else {
      return this._super.apply(this, arguments);
    }
  }
  , process_args : function(args, names) {
    var pargs = {};
    var obj = pargs;
    if(this.root_object && !(this.root_object in args)) {
      obj = pargs[this.root_object] = {};
    }
    var src = args.serialize ? args.serialize() : args;
    var go_names = (!names || names.not) ? Object.keys(src) : names;
    for(var i = 0 ; i < (go_names.length || 0) ; i++) {
      obj[go_names[i]] = src[go_names[i]];
    }
    if(names && names.not) {
      var not_names = names.not;
      for(i = 0 ; i < (not_names.length || 0) ; i++) {
        delete obj[not_names[i]];
      }
    }
    return pargs;
  }
  , findRelated : makeFindRelated("source", "destination")
  , findRelatedSource : makeFindRelated("destination", "source")
  , models : function(params) {
    if(params[this.root_collection + "_collection"]) {
      params = params[this.root_collection + "_collection"];
    }
    if(params[this.root_collection]) {
      params = params[this.root_collection];
    }
    if (!params || params.length == 0)
      return new this.List();
    var ms = this._super(params);
    if(params instanceof can.Observe) {
      params.replace(ms);
      return params;
    } else {
      return ms;
    }
  }
  , object_from_resource : function(params) {
      var obj_name = this.root_object;
      if(!params) {
        return params;
      }
      if(typeof obj_name !== "undefined" && params[obj_name]) {
          for(var i in params[obj_name]) {
            if(params[obj_name].hasOwnProperty(i)) {
              params.attr
              ? params.attr(i, params[obj_name][i])
              : (params[i] = params[obj_name][i]);
            }
          }
          if(params.removeAttr) {
            params.removeAttr(obj_name);
          } else {
            delete params[obj_name];
          }
      }
      return params;
    }

  , stubs : function(params) {
      return new can.List(can.map(this.models(params), function(instance) {
        if (!instance)
          return instance;
        else
          return instance.stub();
      }));
    }

  , stub : function(params) {
      if (!params)
        return params;
      else
        return this.model(params).stub();
    }

  , model : function(params) {
    var m, that = this;
    params = this.object_from_resource(params);
    if (!params)
      return params;
    m = this.findInCacheById(params[this.id])
        || (params.provisional_id && can.getObject("provisional_cache", can.Model.Cacheable, true)[params.provisional_id]);
    if(m) {
      if(m.provisional_id && params.id) {
        delete can.Model.Cacheable.provisional_cache[m.provisional_id];
        m.removeAttr("provisional_id");
        m.constructor.cache[params.id] = m;
        m.attr("id", params.id);
      }
      m.attr(params);
    } else {
      m = this._super(params);
    }
    return m;
  }

  , convert : {
    "date" : dateConverter
    , "datetime" : dateConverter
    , "packaged_datetime" : makeDateUnpacker(["dateTime", "date"])
  }
  , serialize : {
    "datetime" : makeDateSerializer("datetime")
    , "date" : makeDateSerializer("date")
    , "packaged_datetime" : makeDateSerializer("datetime", "dateTime")
  }
  , tree_view_options : {
    display_attr_names : ['title', 'owner', 'status'],
    mandatory_attr_names : ['title']
  }
  , obj_nav_options: {}
  , list_view_options : {}
  , getRootModelName: function() {
    return this.root_model || this.shortName;
  }

  , makeFindPage: function(findAllSpec) {
      /* Create a findPage function that will return a paging object that will
       * provide access to the model items provided in a single page as well
       * as paging capability to retrieve the named pages provided in the
       * resposne.
       *
       * findPage returns an object with two properties:
       * {this.options.model.root_collection}_collection and paging. The models
       * property will be an array of all model instances in the page retrieved
       * for the collection. The paging property will be an object that can be
       * used to retrieve other named pages from the collection.  The names of
       * pages include first, prev, next, last. Named page properties will
       * either be functions or the null value in the case where there is no
       * link available in the collection under that name.  Paging functions
       * have the same type of return value as the findPage function.
       *
       * This method assumes that findAllSpec is a string like
       * "GET /api/programs". If this assumption is invalid, this function
       * WILL NOT work correctly.
       */
      var parts, method, collection_url;
      if(typeof findAllSpec === "string") {
        parts = findAllSpec.split(" ");
        method = parts.length == 2 ? parts[0] : "GET";
        collection_url = parts.length == 2 ? parts[1] : parts[0];
      } else if(typeof findAllSpec === "object") {
        method = findAllSpec.type || "GET";
        collection_url = findAllSpec.url;
      } else {
        return; // TODO make a pager if findAllSpec is a function.
      }
      var base_params = {
        type: method
        , dataType: "json"
      };

      var findPageFunc = function(url, data){
        return can.ajax(can.extend({
          url: url
          , data: data
        }, base_params)).then(function(response_data) {
            var collection = response_data[that.root_collection+"_collection"];
            var ret  = {
              paging: make_paginator(collection.paging)
            };
            ret[that.root_collection+"_collection"] = that.models(collection[that.root_collection]);
            return ret;
          });
      };

      var that = this;
      var make_paginator = function(paging) {
        var get_page = function(page_name) {
          if (paging[page_name]) {
            return function() { return findPageFunc(paging[page_name]); };
          } else {
            return null;
          }
        };

        return {
            count: paging.count
          , total: paging.total
          , first: get_page("first")
          , prev: get_page("prev")
          , next: get_page("next")
          , last: get_page("last")
          , has_next: function() { return this.next != null; }
          , has_prev: function() { return this.prev != null; }
        };
      };

      return function(params) {
        params = params || {};
        if (!params.__page) {
          params.__page = 1;
        }
        if (!params.__page_size) {
          params.__page_size = 50;
        }
        return findPageFunc(collection_url, params);
      };
    }

  , get_mapper: function(name) {
      var mappers, mapper;
      mappers = GGRC.Mappings.get_mappings_for(this.shortName);
      if (mappers) {
        mapper = mappers[name];
        return mapper;
      }
    }

  // This this is the parsing part of the easy accessor for deep properties.
  // Use the result of this with instance.get_deep_property
  // owners.0.name -> this.owners[0].reify().name
  // owners.0.name|email ->
  // firstnonempty this.owners[0].reify().name this.owners[0].reify().email
  //
  // owners.GET_ALL.name ->
  // [this.owners[0].reify().name, this.owners[1].reify().name...]
  , parse_deep_property_descriptor: function(deep_property_string) {
      return Object.freeze(_.map(deep_property_string.split("."), function (part) {
        if (part === "GET_ALL") {
          return part;
        }
        return Object.freeze(part.split("|"));
      }));
  }
}, {
  init : function() {
    var cache = can.getObject("cache", this.constructor, true)
      , id_key = this.constructor.id
      , that = this
      ;

    if (this[id_key] || this[id_key] === 0)
      cache[this[id_key]] = this;
    this.attr("class", this.constructor);
    this.notifier = new PersistentNotifier({ name : this.constructor.model_singular });

    // Listen for `stub_destroyed` change events and nullify or remove the
    // corresponding property or list item.
    this.bind("change", function(ev, path, how, newVal, oldVal) {
      var m, n;
      m = path.match(/(.*?)\.stub_destroyed$/);
      if (m) {
        n = m[1].match(/^([^.]+)\.(\d+)$/);
        if (n) {
          that.attr(n[1]).splice(parseInt(n[2], 10), 1);
        }
        else {
          n = m[1].match(/^([^.]+)$/);
          if (n)
            that.removeAttr(n[1]);
        }
      }
    });
  }
  , load_custom_attribute_definitions: function custom_attribute_definitions() {
    var definitions;
    if (this.attr('custom_attribute_definitions')) {
      return;
    }
    definitions = can.map(GGRC.custom_attr_defs, function(def) {
      if (def.definition_type && def.definition_type === this.constructor.table_singular) {
        return def;
      }
    }.bind(this));
    this.attr('custom_attribute_definitions', definitions);
  }
  , setup_custom_attributes: function setup_custom_attributes() {
    var self = this, key;

    // Remove existing custom_attribute validations,
    // some of them might have changed
    for (key in this.class.validations) {
      if (key.indexOf('custom_attributes.') === 0) {
        delete this.class.validations[key];
      }
    }
    can.each(this.custom_attribute_definitions, function(definition) {
      if (definition.mandatory) {
        if (definition.attribute_type === 'Checkbox') {

          self.class.validate('custom_attributes.' + definition.id, function(val){
            return !val;
          });
        } else {
          self.class.validateNonBlank('custom_attributes.' + definition.id);
        }
      }
    });
    if (!this.custom_attributes) {
      this.attr('custom_attributes', new can.Map());
      can.each(this.custom_attribute_values, function(value) {
        value = value.reify();
        self.custom_attributes.attr(value.custom_attribute_id, value.attribute_value);
      });
    }
  }
  , computed_errors : can.compute(function() {
      var errors = this.errors();
      if(this.attr("_suppress_errors")) {
        return null;
      } else {
        return errors;
      }
    })
  , computed_unsuppressed_errors : can.compute(function() {
    return this.errors();
  }),
  get_list_counter: function (name) {
    var binding = this.get_binding(name);
    if (!binding) {
      return $.Deferred().reject();
    }
    return binding.refresh_count();
  }

  , get_list_loader: function(name) {
      var binding = this.get_binding(name);
      return binding.refresh_list();
    }

  , get_mapping: function(name) {
      var binding = this.get_binding(name);
      if (binding) {
        binding.refresh_list();
        return binding.list;
      }
      return [];
    }

  // This retrieves the potential orphan stats for a given instance
  // Example: "This may also delete 3 Sections, 2 Controls, and 4 object mappings."
  , get_orphaned_count : function(){

    if (!this.get_binding('orphaned_objects')) {
      return new $.Deferred().reject();
    }
    return this.get_list_loader('orphaned_objects').then(function(list) {
      var objects = [], mappings = []
        , counts = {}
        , result = []
        , parts = 0;

      function is_join(mapping) {
        if (mapping.mappings.length > 0) {
          for (var i = 0, child; child = mapping.mappings[i]; i++) {
            if (child = is_join(child)) {
              return child;
            }
          }
        }
        return mapping.instance && mapping.instance instanceof can.Model.Join && mapping.instance;
      }
      can.each(list, function(mapping) {
        var inst;
        if (inst = is_join(mapping))
          mappings.push(inst);
        else
          objects.push(mapping.instance);
      });

      // Generate the summary
      if(objects.length || mappings.length){
        result.push('This may also delete');
      }
      if (objects.length) {
        can.each(objects, function(instance) {
          var title = instance.constructor.title_singular;
          counts[title] = counts[title] || {
              model: instance.constructor
            , count: 0
            };
          counts[title].count++;
        });
        can.each(counts, function(count, i) {
          parts++;
          result.push(count.count + ' ' + (count.count === 1 ? count.model.title_singular : count.model.title_plural) + ',')
        });
      }
      if (mappings.length) {
        parts++;
        result.push(mappings.length + ' object mapping' + (mappings.length !== 1 ? 's' : ''));
      }

      // Clean up commas, add an "and" if appropriate
      parts >= 1 && parts <= 2 && (result[result.length - 1] = result[result.length - 1].replace(',',''));
      parts === 2 && (result[result.length - 2] = result[result.length - 2].replace(',',''));
      parts >= 2 && result.splice(result.length - 1, 0, 'and');
      return result.join(' ') + (objects.length || mappings.length ? '.' : '');
    });
  }

  , _get_binding_attr: function(mapper) {
      if (typeof(mapper) === "string")
        return "_" + mapper + "_binding";
    }

  // checks if binding exists without throwing debug statements
  // modeled after what get_binding is doing
  , has_binding: function (mapper) {
    var binding,
        mapping,
        binding_attr = this._get_binding_attr(mapper);

    if (binding_attr) {
      binding = this[binding_attr];
    }

    if (!binding) {
      if (typeof(mapper) === "string") {
        mapping = this.constructor.get_mapper(mapper);
        if (!mapping) {
          return false;
        }
      }else if (!(mapper instanceof GGRC.ListLoaders.BaseListLoader)) {
        return false;
      }
    }

    return true;
  }

  , get_binding: function(mapper) {
      var mappings
        , mapping
        , binding
        , binding_attr = this._get_binding_attr(mapper)
        ;

      if (binding_attr) {
        binding = this[binding_attr];
      }

      if (!binding) {
        if (typeof(mapper) === "string") {
          // Lookup and attach named mapper
          mapping = this.constructor.get_mapper(mapper);
          if (!mapping)
            console.debug("No such mapper:  " + this.constructor.shortName + "." + mapper);
          else
            binding = mapping.attach(this);
        } else if (mapper instanceof GGRC.ListLoaders.BaseListLoader) {
          // Loader directly provided, so just attach
          binding = mapper.attach(this);
        } else {
          console.debug("Invalid mapper specified:", mapper);
        }
        if (binding && binding_attr) {
          this[binding_attr] = binding;
          binding.name = this.constructor.shortName + "." + mapper;
        }
      }
      return binding;
    }

  , addElementToChildList : function(attrName, new_element) {
    this[attrName].push(new_element);
    this._triggerChange(attrName, "set", this[attrName], this[attrName].slice(0, this[attrName].length - 1));
  }
  , removeElementFromChildList : function(attrName, old_element, all_instances) {
    for(var i = this[attrName].length - 1 ; i >= 0; i--) {
      if(this[attrName][i]===old_element) {
        this[attrName].splice(i, 1);
        if(!all_instances) break;
      }
    }
    this._triggerChange(attrName, "set", this[attrName], this[attrName].slice(0, this[attrName].length - 1));
  },
  refresh: function (params) {
    var dfd,
        href = this.selfLink || this.href,
        that = this;

    if (!href) {
      return (new can.Deferred()).reject();
    }
    if (!this._pending_refresh) {
      this._pending_refresh = {
        dfd: $.Deferred(),
        fn: _.throttle(function () {
          var dfd = that._pending_refresh.dfd;
          can.ajax({
            url: href,
            params: params,
            type: "get",
            dataType : "json"
          })
          .then(function (resources) {
            delete that._pending_refresh;
            return resources;
          })
          .then($.proxy(that.constructor, "model"))
          .done(function (response) {
            response.backup();
            dfd.resolve.apply(dfd, arguments);
          })
          .fail(function () {
            dfd.reject.apply(dfd, arguments);
          });
        }, 1000, {trailing: false})
      };
    }
    dfd = this._pending_refresh.dfd
    this._pending_refresh.fn();
    return dfd;
  }
  , serialize : function() {
    var that = this, serial = {};
    if(arguments.length) {
      return this._super.apply(this, arguments);
    }
    this.each(function(val, name) {
      var fun_name;
      if(that.constructor.attributes && that.constructor.attributes[name]) {
        fun_name = that.constructor.attributes[name];
        fun_name = fun_name.substr(fun_name.lastIndexOf(".") + 1);
        if (fun_name === "stubs" || fun_name === "get_stubs"
            ||fun_name === "models" || fun_name === "get_instances") {
          // val can be null in some cases
          val && (serial[name] = val.stubs().serialize());
        } else if (fun_name === "stub" || fun_name === "get_stub"
                   || fun_name === "model" || fun_name === "get_instance") {
          serial[name] = (val ? val.stub().serialize() : null);
        } else {
          serial[name] = that._super(name);
        }
      } else if(val && typeof val.save === "function") {
        serial[name] = val.stub().serialize();
      } else if(typeof val === "object" && val != null && val.length != null) {
        serial[name] = can.map(val, function(v) {
          return (v && typeof v.save === "function") ? v.stub().serialize() : (v.serialize ? v.serialize() : v);
        });
      } else if(typeof val !== 'function') {
        if(that[name] && that[name].isComputed) {
          serial[name] = val && val.serialize ? val.serialize() : val;
        } else {
          serial[name] = that[name] && that[name].serialize ? that[name].serialize() : that._super(name);
        }
      }
    });
    return serial;
  }
  , display_name : function() {
    return this.title || this.name;
  }
  , autocomplete_label : function() {
    return this.title;
  },
  get_permalink: function () {
    var dfd = $.Deferred(),
        constructor = this.constructor;
    if (!constructor.permalink_options) {
      return dfd.resolve(this.viewLink);
    }
    $.when(this.refresh_all.apply(this, constructor.permalink_options.base.split(":"))).then(function (base) {
      return dfd.resolve(_.template(constructor.permalink_options.url)({base: base, instance: this}));
    }.bind(this));
    return dfd.promise();
  }

  /**
   Set up a deferred join object deletion when this object is updated.
  */
  , mark_for_deletion : function(join_attr, obj) {
    obj = obj.reify ? obj.reify() : obj;
    if(!this._pending_joins) {
      this.attr('_pending_joins', []);
    }
    for(var i = this._pending_joins.length; i--;) {
      if(this._pending_joins[i].what === obj) {
        this._pending_joins.splice(i, 1);
      }
    }
    this._pending_joins.push({how : "remove", what : obj, through : join_attr });
  }
  /**
   Set up a deferred join object creation when this object is updated.
  */
  , mark_for_addition : function(join_attr, obj, extra_attrs) {
    obj = obj.reify ? obj.reify() : obj;
    if(!this._pending_joins) {
      this.attr('_pending_joins', []);
    }
    for(var i = this._pending_joins.length; i--;) {
      if(this._pending_joins[i].what === obj) {
        this._pending_joins.splice(i, 1);
      }
    }
    this._pending_joins.push({how : "add", what : obj, through : join_attr, extra: extra_attrs });
  }

  , delay_resolving_save_until : function(dfd) {
    return this.notifier.queue(dfd);
  }
  , _save: function () {
    var that = this,
        _super = Array.prototype.pop.call(arguments),
        isNew = this.isNew(),
        xhr,
        dfd = this._dfd,
        pre_save_notifier = new PersistentNotifier({ name : this.constructor.model_singular + " (pre-save)" })
        ;

    this.before_save && this.before_save(pre_save_notifier);
    if (isNew) {
      this.attr("provisional_id", "provisional_" + Math.floor(Math.random() * 10000000));
      can.getObject("provisional_cache", can.Model.Cacheable, true)[this.provisional_id] = this;
      this.before_create && this.before_create(pre_save_notifier);
    } else {
      this.before_update && this.before_update(pre_save_notifier);
    }

    pre_save_notifier.on_empty(function() {
      xhr = _super.apply(that, arguments)
      .then(function (result) {
        if (isNew) {
          that.after_create && that.after_create();
        } else {
          that.after_update && that.after_update();
        }
        that.after_save && that.after_save();
        return result;
      }, function (xhr, status, message) {
        that.save_error && that.save_error(xhr.responseText);
        return new $.Deferred().reject(xhr, status, message);
      })
      .fail(function (response) {
        that.notifier.on_empty(function () {
          dfd.reject(that, response.responseText);
        });
      })
      .done(function () {
        that.notifier.on_empty(function () {
          dfd.resolve(that);
        });
      });

      GGRC.delay_leaving_page_until(xhr);
      GGRC.delay_leaving_page_until(dfd);
    });
    return dfd;
  }
  , save: function() {
    Array.prototype.push.call(arguments, this._super);
    this._dfd = new $.Deferred();
    GGRC.SaveQueue.enqueue(this, arguments);
    return this._dfd;
  },
  refresh_all: function() {
    var props = Array.prototype.slice.call(arguments, 0);

    return RefreshQueue.refresh_all(this, props);
  },
  refresh_all_force: function() {
    var props = Array.prototype.slice.call(arguments, 0);

    return RefreshQueue.refresh_all(this, props, true);
  },
  get_filter_vals: function (keys, mappings) {
    keys = keys || this.class.filter_keys;
    mappings = mappings || this.class.filter_mappings;

    var values = {},
        custom_attrs = {},
        custom_attr_ids = {},
        long_title = this.type.toLowerCase() + " title";

    if (!this.custom_attribute_definitions) {
      this.load_custom_attribute_definitions();
    }
    this.custom_attribute_definitions.each(function (definition) {
      custom_attr_ids[definition.id] = definition.title.toLowerCase();
    });
    if (!this.custom_attributes) {
      this.setup_custom_attributes();
    }
    can.each(this.custom_attribute_values, function (custom_attr) {
      custom_attr = custom_attr.reify();
      custom_attrs[custom_attr_ids[custom_attr.custom_attribute_id]] =
        custom_attr.attribute_value;
    });

    if (!mappings[long_title]){
      mappings[long_title] = "title";
    }
    keys = _.union(keys, long_title, _.keys(mappings), _.keys(custom_attrs));
    $.each(keys, function(index, key) {
      var attr_key = mappings[key] || key,
          val = this[attr_key] || custom_attrs[attr_key];

      if (val !== undefined && val !== null){
        if (key == 'owner' || key == 'owners'){
          values[key] = [];
          val.forEach(function(owner_stub){
            var owner = owner_stub.reify();
            values[key].push({
              name: owner.name,
              email: owner.email
            });
          });
        } else {
          if ($.type(val) === 'date') {
            val = val.toISOString().substring(0, 10);
          }
          if ($.type(val) === 'string'){
            values[key] = val;
          }
        }
      }
    }.bind(this));

    return values;
  },

  hash_fragment: function () {
    var type = can.spaceCamelCase(this.type || "")
            .toLowerCase()
            .replace(/ /g, '_');

    return [type,
            this.id].join('/');
  },

  // Returns a deep property as specified in the descriptor built
  // by Cacheable.parse_deep_property_descriptor
  get_deep_property: function(property_descriptor) {
    var i, j, part, field, found, tmp,
        val = this;
    for (i = 0; i < property_descriptor.length; i++) {
      part = property_descriptor[i];
      if (val.instance) {
        val = val.instance;
      }
      found = false;
      if (part === "GET_ALL") {
        return _.map(val, function(element) {
          return element.get_deep_property(property_descriptor.slice(i+1));
        });
      } else {
        for (j = 0; j < part.length; j++) {
          field = part[j];
          tmp = val[field];
          if (tmp !== undefined && tmp !== null) {
            val = tmp;
            if (typeof val.reify === "function") {
              val = val.reify();
            }
            found = true;
            break;
          }
        }
        if (!found) {
          return null;
        }
      }
    }
    return val;
  },

});

_old_attr = can.Observe.prototype.attr;
can.Observe.prototype.attr = function(key, val) {
  if (key instanceof can.Observe) {
    if (arguments[0] === this) {
      return this;
    } else {
      return _old_attr.apply(this, [key.serialize()]);
    }
  } else {
    return _old_attr.apply(this, arguments);
  }
}

can.Observe.prototype.stub = function() {
  if (!(this instanceof can.Model || this instanceof can.Stub))
    console.debug(".stub() called on non-stub, non-instance object", this);

  var type, id, stub;

  if (this instanceof can.Stub)
    return this;

  if (this instanceof can.Model)
    type = this.constructor.shortName;
  else
    type = this.type;

  if (this.constructor.id)
    id = this[this.constructor.id];
  else
    id = this.id;

  if (!id && id !== 0)
    return null;

  return can.Stub.get_or_create({
    id: id,
    href: this.selfLink || this.href,
    type: type
  });
};

can.Observe("can.Stub", {
  get_or_create: function(obj) {
    var id = obj.id
      , type = obj.type
      ;

    CMS.Models.stub_cache = CMS.Models.stub_cache || {};
    CMS.Models.stub_cache[type] = CMS.Models.stub_cache[type] || {};
    if (!CMS.Models.stub_cache[type][id]) {
      stub = new can.Stub(obj);
      CMS.Models.stub_cache[type][id] = stub;
    }
    return CMS.Models.stub_cache[type][id];
  }
}, {
  init: function() {
    var that = this;
    this._super.apply(this, arguments);
    this._instance().bind("destroyed", function(ev) {
      // Trigger propagating `change` event to convey `stub-destroyed` message
      can.trigger(that, "change", ["stub_destroyed", "stub_destroyed", that, null]);
      delete CMS.Models.stub_cache[that.type][that.id];
    });
  },

  _model: function() {
    return CMS.Models[this.type] || GGRC.Models[this.type];
  },

  _instance: function() {
    if (!this.__instance)
      this.__instance = this._model().model(this);
    return this.__instance;
  }
});

can.Observe.List.prototype.stubs = function() {
  return new can.Observe.List(can.map(this, function(obj) {
    return obj.stub();
  }));
}

can.Observe.prototype.reify = function() {
  var type, model;

  if (this instanceof can.Model) {
    return this;
  }
  if (!(this instanceof can.Stub)) {
    console.debug("`reify()` called on non-stub, non-instance object", this);
  }

  type = this.type;
  model = CMS.Models[type] || GGRC.Models[type];

  if (!model) {
    console.debug("`reify()` called with unrecognized type", this);
  }
  return model.model(this);
};

can.Observe.List.prototype.reify = function() {
  return new can.Observe.List(can.map(this, function(obj) {
    return obj.reify();
  }));
}

})(window.can);
