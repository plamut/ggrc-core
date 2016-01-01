/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (GGRC, can) {

  /*  GGRC.ListLoaders
   *
   *  - Generates and manages lists of related objects, pairing each instance
   *      with the one or more "mappings" -- join tables, direct relationships,
   *      etc -- which cause it to be present in the list.
   *
   *  Terminology:
   *    - "mappings" -- a list of "result" objects defining the path between
   *        the root object and the paired instance; can also be the boolean
   *        literal "true", to denote the "root" instance
   *    - "result" -- the (instance, mappings) pairs
   *    - "binding" -- the pairing between a list of results and the "root"
   *        instance for that list
   *        e.g., for each item in binding.list, if you follow the chain of
   *          mappings, you will eventually find
   *            ``{ instance: binding.instance, mappings: true }``
   */

  /*  GGRC.ListLoaders.MappingResult
   *
   *  - `instance`: The resulting item itself
   *  - `mappings`: Essentially, the reason(s) the instance appears in the
   *      list.  This may be an instance of can.Model or a pair containing
   *      (binding, result) in the case of a chained ListLoader.
   *
   *  For FilteredListLoader, the mappings are (`result`, `binding`), where
   *    `binding` is the binding in which the result appears, and thus,
   *    `binding.loader` contains information about the filter.
   *    `binding.instance`, then, is the instance on which the original,
   *    unfiltered list is specified.
   *  For CrossListLoader, the mappings are (`result`, `binding`), where
   *    `binding` is the "remote binding" which
   */
  can.Construct('GGRC.ListLoaders.MappingResult', {
  }, {
    init: function (instance, mappings, binding) {
      if (!mappings) {
          // Assume item was passed in as an object
          mappings = instance.mappings;
          binding = instance.binding;
          instance = instance.instance;
        }

      this.instance = instance;
      this.mappings = this._make_mappings(mappings);
      this.binding = binding;
    }

    //  `_make_mappings`
    //  - Ensures that every instance in `mappings` is an instance of
    //    `MappingResult`.
    , _make_mappings: function (mappings) {
        var i, mapping
          ;

        if (!mappings)
          mappings = [];

        for (i = 0; i < mappings.length; i++) {
          mapping = mappings[i];
          if (!(mapping instanceof GGRC.ListLoaders.MappingResult))
            mapping = new GGRC.ListLoaders.MappingResult(mapping);
          mappings[i] = mapping;
        }

        return mappings;
      }

    //  `observe_trigger`, `watch_observe_trigger`, `trigger_observe_trigger`
    //  - These exist solely to support dynamic updating of `*_compute`.
    //    Basically, these fake dependencies for those computes so each is
    //    updated any time a mapping is inserted or removed beyond a
    //    "virtual" level, which would otherwise obscure changes in the
    //    "first-level mappings" which both `bindings_compute` and
    //    `mappings_compute` depend on.
    , observe_trigger: function () {
        if (!this._observe_trigger)
          this._observe_trigger = new can.Observe({change_count: 1});
        return this._observe_trigger;
      }, watch_observe_trigger: function () {
        this.observe_trigger().attr('change_count');
        can.each(this.mappings, function (mapping) {
          if (mapping.watch_observe_trigger)
            mapping.watch_observe_trigger();
        });
      }, trigger_observe_trigger: function () {
        var observe_trigger = this.observe_trigger();
        observe_trigger.attr('change_count', observe_trigger.change_count + 1);
      }

    //  `insert_mapping` and `remove_mapping`
    //  - These exist solely to trigger an `observe_trigger` change event
    , insert_mapping: function (mapping) {
        this.mappings.push(mapping);
        // Trigger change event
        this.trigger_observe_trigger();
      }, remove_mapping: function (mapping) {
        var ret;
        mapping_index = this.mappings.indexOf(mapping);
        if (mapping_index > -1) {
          ret = this.mappings.splice(mapping_index, 1);
          //  Trigger change event
          this.trigger_observe_trigger();
          return ret;
        }
      }

    //  `get_bindings`, `bindings_compute`, `get_bindings_compute`
    //  - Returns a list of the `ListBinding` instances which are the source
    //    of "first-level mappings".
    , get_bindings: function () {
        var self = this, bindings = []
          ;

        this.walk_instances(function (instance, result, depth) {
          if (depth === 1)
            bindings.push(result.binding);
        });
        return bindings;
      }, bindings_compute: function () {
        if (!this._bindings_compute)
          this._bindings_compute = this.get_bindings_compute();
        return this._bindings_compute;
      }, get_bindings_compute: function () {
        var self = this;

        return can.compute(function () {
          // Unnecessarily access observe_trigger to be able to trigger change
          self.watch_observe_trigger();
          return self.get_bindings();
        });
      }

    //  `get_mappings`, `mappings_compute`, and `get_mappings_compute`
    //  - Returns a list of first-level mapping instances, even if they're
    //    several levels down due to virtual mappers like Multi or Cross
    //  - "First-level mappings" are the objects whose existence causes the
    //    `binding.instance` to be in the current `binding.list`.  (E.g.,
    //    if any of the "first-level mappings" exist, the instance will
    //    appear in the list.
    , get_mappings: function () {
        var self = this, mappings = []
          ;

        this.walk_instances(function (instance, result, depth) {
          if (depth === 1) {
            if (instance === true)
              mappings.push(self.instance);
            else
              mappings.push(instance);
          }
        });
        return mappings;
      }, mappings_compute: function () {
        if (!this._mappings_compute)
          this._mappings_compute = this.get_mappings_compute();
        return this._mappings_compute;
      }, get_mappings_compute: function () {
        var self = this;

        return can.compute(function () {
          // Unnecessarily access _observe_trigger to be able to trigger change
          self.watch_observe_trigger();
          return self.get_mappings();
        });
      }

    //  `walk_instances`
    //  - `binding.mappings` can have several "virtual" levels due to mappers
    //    like `Multi`, `Cross`, and `Filter` -- e.g., mappers which just
    //    aggregate or filter results of other mappers.  `walk_instances`
    //    iterates over these "virtual" levels to emit instances only once
    //    per time they appear in a traversal path of `binding.mappings`.
    , walk_instances: function (fn, last_instance, depth) {
        var i;
        if (depth === null)
          depth = 0;
        if (this.instance !== last_instance) {
          fn(this.instance, this, depth);
          depth++;
        }
        for (i = 0; i < this.mappings.length; i++) {
          this.mappings[i].walk_instances(fn, this.instance, depth);
        }
      }
  });

  /*  GGRC.ListLoaders.ListBinding
   */
  can.Construct('GGRC.ListLoaders.ListBinding', {
  }, {
    init: function (instance, loader) {
      this.instance = instance;
      this.loader = loader;

      this.list = new can.Observe.List();
    }, refresh_stubs: function () {
        return this.loader.refresh_stubs(this);
      }, refresh_instances: function () {
        return this.loader.refresh_instances(this);
      }

    //  `refresh_count`
    //  - Returns a `can.compute`, which in turn returns the length of
    //    `this.list`
    //  - Attempts to do the minimal work (e.g., loading only stubs, not full
    //    instances) to return an accurate length
    , refresh_count: function () {
        var self = this;
        return this.refresh_stubs().then(function () {
          return can.compute(function () {
            return self.list.attr('length');
          });
        });
      }

    //  `refresh_list`
    //  - Returns a list which will *only* ever contain fully loaded / reified
    //    instances
    , refresh_list: function () {
        var loader = new GGRC.ListLoaders.ReifyingListLoader(this), binding = loader.attach(this.instance), self = this
          ;

        binding.name = this.name + '_instances';
        //  FIXME: `refresh_instances` should not need to be called twice, but
        //  it fixes pre-mature resolution of mapping deferreds in some cases
        return binding.refresh_instances(this).then(function () {
          return self.refresh_instances();
        });
      }, refresh_instance: function () {
        var refresh_queue = new RefreshQueue();
        refresh_queue.enqueue(this.instance);
        return refresh_queue.trigger();
      }
  });

  can.Construct('GGRC.ListLoaders.BaseListLoader', {
    binding_factory: function (instance, loader) {
      return new GGRC.ListLoaders.ListBinding(instance, loader);
    }
  }, {
    init: function () {
    }, attach: function (instance) {
        var binding = this.constructor.binding_factory(instance, this);
        this.init_listeners(binding);
        return binding;
      }, make_result: function (instance, mappings, binding) {
        return new GGRC.ListLoaders.MappingResult(instance, mappings, binding);
      }, find_result_by_instance: function (result, list) {
        var i, found_result = null;

        for (i = 0; !found_result && i < list.length; i++) {
          old_result = list[i];
          if (old_result.instance.id === result.instance.id &&
              old_result.instance.constructor.shortName ===
                  result.instance.constructor.shortName) {
            found_result = old_result;
          }
        }

        return found_result;
      }, is_duplicate_result: function (old_result, new_result) {
        var o = old_result, n = new_result
          ;

        if (o.instance === n.instance) {// && o.binding  === n.binding) {
          if (o.mappings === n.mappings) {
            return true;
          }
          o = o.mappings;
          n = n.mappings;
          if (o && n && o.length === 1 && n.length === 1) {
            o = o[0];
            n = n[0];
            if (o.binding === n.binding) {
              if (o.instance === n.instance &&
                  (o.mappings.length > 0 || n.mappings.length > 0)) {
                o = o.mappings;
                n = n.mappings;
                if (o && n && o.length === 1 && n.length === 1) {
                  o = o[0];
                  n = n[0];
                }
              }

              if (o.binding === n.binding &&
                  o.instance === true &&
                  n.instance === true &&
                  o.mappings && o.mappings.length === 0 &&
                  n.mappings && n.mappings.length === 0) {
                return true;
              }
            }
          }
        }

        return false;
      }, insert_results: function (binding, results) {
        var self = this, all_binding_results = [], new_instance_results = [], instances_to_refresh = []
          ;

        can.each(results, function (new_result) {
          var found_result = null;

          found_result = self.find_result_by_instance(new_result, binding.list);

          if (!found_result && binding.pending_list) {
            found_result = self.find_result_by_instance(new_result, binding.pending_list);
          }

          if (!found_result) {
            found_result = self.find_result_by_instance(new_result, new_instance_results);
          }

          if (found_result) {
            if (self.is_duplicate_result(found_result, new_result)) {
              return;
            }

            mapping_attr = found_result.mappings;
            // Since we're adding the result as its own mapping, use
            // new_result as the mapping instead of new_result.mappings?

            can.each(new_result.mappings, function (mapping) {
              // TODO: Examine when this will be false -- is it a sign of
              //   duplicate work?
              if (mapping_attr.indexOf && mapping_attr.indexOf(mapping) === -1) {
                found_result.insert_mapping(mapping);
                instances_to_refresh.push(new_result.instance);
              }
            });

            all_binding_results.push(found_result);
          } else {
            //  FIXME: Loaders should be passing in newly instantiated results,
            //    so this line should be:
            //      found_result = new_result;
            //    but it's not a big deal
            found_result = self.make_result(new_result.instance, new_result.mappings, binding);
            new_instance_results.push(found_result);
            instances_to_refresh.push(new_result.instance);
            // FIXME: Also queue mappings to refresh?

            all_binding_results.push(found_result);
          }
        });

        if (new_instance_results.length > 0) {
          binding.list.push.apply(binding.list, new_instance_results);

          //  TODO: Examine whether deferring this list insertion avoids
          //    causing client-side freezes
          /*if (!binding.pending_list)
            binding.pending_list = [];
          binding.pending_list.push.apply(binding.pending_list, new_instance_results);

          if (!binding.pending_timeout) {
            binding.pending_deferred = new $.Deferred();
            binding.pending_timeout = setTimeout(function() {
              binding.list.push.apply(binding.list, binding.pending_list);
              delete binding.pending_list;
              delete binding.pending_timeout;
              binding.pending_deferred.resolve();
              delete binding.pending_deferred;
            }, 100);
          }*/
        }

        return all_binding_results;
      }, remove_instance: function (binding, instance, mappings) {
        var self = this, mapping_index, instance_index_to_remove = -1, indexes_to_remove = []
          ;

        if (!(can.isArray(mappings) || mappings instanceof can.Observe.List))
          mappings = [mappings];

        can.each(binding.list, function (data, instance_index) {
          var mapping_attr = binding.list[instance_index].mappings;

          if (data.instance.id === instance.id &&
              data.instance.constructor.shortName === instance.constructor.shortName) {
            if (mapping_attr.length === 0) {
              indexes_to_remove.push(instance_index);
            } else {
              can.each(mappings, function (mapping) {
                var was_removed = data.remove_mapping(mapping);
                if (was_removed) {
                  if (mapping_attr.length === 0)
                    indexes_to_remove.push(instance_index);
                }
              });
            }
          }
        });
        can.each(indexes_to_remove.sort(), function (index_to_remove, count) {
          binding.list.splice(index_to_remove - count, 1);
        });
      }, refresh_stubs: function (binding) {
        if (!binding._refresh_stubs_deferred) {
          binding._refresh_stubs_deferred = $.when(this._refresh_stubs(binding));
        }
        return binding._refresh_stubs_deferred
          .then(function () { return binding.list; });
      }, refresh_instances: function (binding) {
        if (!binding._refresh_instances_deferred) {
          binding._refresh_instances_deferred =
            $.when(this._refresh_instances(binding));
        }
        return binding._refresh_instances_deferred
          .then(
            function () { return binding.list; },
            function () {
              setTimeout(function () {
                delete binding._refresh_instances_deferred;
              }, 10);
              return this;
            });
      }, _refresh_instances: function (binding) {
        return this.refresh_stubs(binding)
          .then(function () {
            var refresh_queue = new RefreshQueue();
            can.each(binding.list, function (result) {
              refresh_queue.enqueue(result.instance);
            });
            return refresh_queue.trigger();
          });
      }
  });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.StubFilteredListLoader', {
  }, {
    init: function (source, filter_fn) {
      this._super();

      this.source = source;
      this.filter_fn = filter_fn;
    }, init_listeners: function (binding) {
        var self = this;

        if (typeof this.source === 'string') {
          binding.source_binding = binding.instance.get_binding(this.source);
        } else {
          binding.source_binding = this.source;
        }
        binding.source_binding.list.bind('add', function (ev, results) {
          if (binding._refresh_stubs_deferred && binding._refresh_stubs_deferred.state() !== 'pending') {
            var matching_results = can.map(can.makeArray(results), function (result) {
              if (self.filter_fn(result)) {
                return self.make_result(result.instance, [result], binding);
              }
            });
            self.insert_results(binding, matching_results);
          }
        });

        binding.source_binding.list.bind('remove', function (ev, results) {
          can.each(results, function (result) {
            self.remove_instance(binding, result.instance, result);
          });
        });
      }, _refresh_stubs: function (binding) {
        return binding.source_binding.refresh_stubs()
          .then(function (results) {
            var matching_results = can.map(can.makeArray(results), function (result) {
              if (this.filter_fn(result)) {
                    return this.make_result(result.instance, [result], binding);
                  }
            }.bind(this));
            this.insert_results(binding, matching_results);
          }.bind(this));
      }
  });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.CrossListLoader', {
  }, {
    init: function (local_mapping, remote_mapping) {
      this._super();

      this.local_mapping = local_mapping;
      this.remote_mapping = remote_mapping;
    }, init_listeners: function (binding) {
        var self = this;

        if (!binding.bound_insert_from_source_binding) {
          binding.bound_insert_from_source_binding =
            this.proxy('insert_from_source_binding', binding);
          binding.bound_remove_from_source_binding =
            this.proxy('remove_from_source_binding', binding);
        }

        binding.source_binding = binding.instance.get_binding(this.local_mapping);

        binding.source_binding.list.bind(
            'add', binding.bound_insert_from_source_binding);
        binding.source_binding.list.bind(
            'remove', binding.bound_remove_from_source_binding);
      }, insert_from_source_binding: function (binding, ev, local_results, index) {
        var self = this;
        can.each(local_results, function (local_result) {
          // FIXME: This is identical to code in _refresh_stubs
          var remote_binding = self.insert_local_result(binding, local_result);
          remote_binding.refresh_instance().then(function () {
            remote_binding.refresh_stubs();
          });
        });
      }, remove_from_source_binding: function (binding, ev, local_results, index) {
        var self = this;
        can.each(local_results, function (local_result) {
          self.remove_local_result(binding, local_result);
        });
      }, insert_local_result: function (binding, local_result) {
        var self = this, remote_binding, i, found = false, local_results
          ;

        if (!binding.remote_bindings)
          binding.remote_bindings = [];

        for (i = 0; i < binding.remote_bindings.length; i++) {
          if (binding.remote_bindings[i].instance === local_result.instance)
            return binding.remote_bindings[i];
        }

        remote_binding =
          local_result.instance.get_binding(self.remote_mapping);
        remote_binding.bound_insert_from_remote_binding =
          this.proxy('insert_from_remote_binding', binding, remote_binding);
        remote_binding.bound_remove_from_remote_binding =
          this.proxy('remove_from_remote_binding', binding, remote_binding);

        binding.remote_bindings.push(remote_binding);

        remote_binding.list.bind(
          'add', remote_binding.bound_insert_from_remote_binding);
        remote_binding.list.bind(
          'remove', remote_binding.bound_remove_from_remote_binding);

        local_results = can.map(remote_binding.list, function (result) {
          return self.make_result(result.instance, [result], binding);
        });
        self.insert_results(binding, local_results);

        return remote_binding;
      }, remove_local_result: function (binding, local_result) {
        var self = this, remote_binding, i, found = false, remote_binding_index
          ;

        if (!binding.remote_bindings)
          binding.remote_bindings = [];

        for (i = 0; i < binding.remote_bindings.length; i++) {
          if (binding.remote_bindings[i].instance === local_result.instance)
            remote_binding = binding.remote_bindings[i];
        }

        if (!remote_binding) {
          console.debug('Removed binding not found:', local_result, binding);
          return;
        }

        remote_binding.list.unbind(
            'add', remote_binding.bound_insert_from_remote_binding);
        remote_binding.list.unbind(
            'remove', remote_binding.bound_remove_from_remote_binding);

        can.each(remote_binding.list, function (result) {
          self.remove_instance(binding, result.instance, result);
        });

        remote_binding_index = binding.remote_bindings.indexOf(remote_binding);
        binding.remote_bindings.splice(remote_binding_index, 1);
      }, insert_from_remote_binding: function (binding, remote_binding, ev, results, index) {
        var self = this, new_results = can.map(results, function (result) {
            return self.make_result(result.instance, [result], binding);
          }), inserted_results = this.insert_results(binding, new_results)
            ;
      }, remove_from_remote_binding: function (binding, remote_binding, ev, results, index) {
        var self = this;
        can.each(results, function (result) {
          self.remove_instance(binding, result.instance, result);
        });
      }, _refresh_stubs: function (binding) {
        var self = this
          ;

        return binding.source_binding.refresh_stubs().then(function (local_results) {
          var deferreds = [];

          can.each(local_results, function (local_result) {
            var remote_binding = self.insert_local_result(binding, local_result), deferred = remote_binding.refresh_instance().then(function () {
                return remote_binding.refresh_stubs();
              })
              ;

            deferreds.push(deferred);
          });

          return $.when.apply($, deferreds);
        })
        .then(function () { return binding.list; });
      }
  });

  GGRC.ListLoaders.StubFilteredListLoader('GGRC.ListLoaders.TypeFilteredListLoader', {
  }, {
    init: function (source, model_names) {
      var filter_fn = function (result) {
          var i, model_name;
          for (i = 0; i < model_names.length; i++) {
            model_name = model_names[i];
            if (typeof model_name !== 'string')
              model_name = model_name.shortName;
            if (result.instance.constructor &&
                result.instance.constructor.shortName === model_name)
              return true;
          }
          return false;
        };

      this._super(source, filter_fn);
    }
  });

  GGRC.ListLoaders.StubFilteredListLoader('GGRC.ListLoaders.AttrFilteredListLoader', {
  }, {
      init: function (source, prop, value, type) {
        var filter_fn = function (binding) {
          // TODO: We should filter by type as well
          if (!binding.mappings) {
            return;
          }
          return _.any(binding.mappings, function (mapping) {
            instance = mapping.instance;
            if (instance instanceof CMS.Models.Relationship) {
              if (_.exists(instance, 'attrs') &&
                  instance.attrs[prop] &&
                  (!value || _.contains(instance.attrs[prop].split(","), value))) {
                return true;
              }
            }
            return filter_fn(mapping);
          });
        };
        this.prop_name = prop;
        this.keyword = value;
        this.object_type = type;
        this._super(source, filter_fn);
      },
      init_listeners: function (binding) {
        this._super(binding);
        function itemFromList(list, id) {
          return _.first(can.makeArray(list).filter(function (item) {
            return item.instance.id === id;
          }));
        }

        CMS.Models.Relationship.bind('updated', function (ev, model) {
          if (!(model instanceof CMS.Models.Relationship)) {
            return;
          }
          var value = can.getObject('attrs.' + this.prop_name, model),
            needle, active, activeInList, contains;

          if (model.source.type === this.object_type) {
            needle = model.source;
          } else if (model.destination.type === this.object_type) {
            needle = model.destination;
          }
          if (!needle || !value) {
            return;
          }
          active = itemFromList(binding.source_binding.list, needle.id);
          activeInList = itemFromList(binding.list, needle.id);

          if (!active) {
            return;
          }
          contains = _.contains(value.split(','), this.keyword);
          if (!contains && activeInList) {
            binding.list.splice(
                _.map(binding.list, function (e) {
                  return e.instance.id;
                }).indexOf(active.instance.id),
                1
            );
          }
          if (contains && !activeInList) {
            this.insert_results(binding, [active]);
          }
        }.bind(this));
      }
    });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.FirstElementLoader', {
  }, {

    init_listeners: function (binding) {
      var self = this;

      binding.source_binding = binding.instance.get_binding(this.source);

      binding.source_binding.list.bind('add', function (ev, results) {
          var matching_results = results[0];
          if (self.list.length < 1)
            self.insert_results(binding, [matching_results]);
        });

      binding.source_binding.list.bind('remove', function (ev, results) {
          can.each(results, function (result) {
            self.remove_instance(binding, result.instance, result);
          });
          if (self.list.length < 1)
            self.insert_results(binding, [binding.source_binding.list[0]]);
        });
    }, _refresh_stubs: function (binding) {
        var self = this
          ;

        return binding.source_binding.refresh_stubs()
          .then(function (results) {
            var matching_results = results[0];
            self.insert_results(binding, matching_results);
          });
      }
  });

  /*
    CustomFilteredListLoader allows any sort of filter to be applied on instances
    to create a new set of filtered items.  This depends on refresh_instances from
    the source list loader and a filter function applied to each MappingResult.

    The signature of the filter function is (MappingResult) -> truthy | falsy | Deferred

    if the filter function returns a Deferred, inclusion of the instance in the new
    ListBinding will be contingent on the Deferred resolving to a truthy value.

    Rejected Deferreds are treated as false.
  */
  GGRC.ListLoaders.StubFilteredListLoader('GGRC.ListLoaders.CustomFilteredListLoader', {
  }, {
    process_result: function (binding, result, new_result, include) {
      var self = this;
      if (include) {
          if (typeof include.then === 'function') {
            //return nothing yet. push in later if it is needed.
            include.then(function (real_include) {
              if (real_include) {
                self.insert_results(binding, [new_result]);
              } else {
                self.remove_instance(binding, result.instance, result);
              }
            }, function () {
              //remove instance (if it exists) if the deferred rejects
              self.remove_instance(binding, result.instance, result);
            });
          } else {
            self.insert_results(binding, [new_result]);
          }
        } else {
          self.remove_instance(binding, result.instance, result);
        }

    },

    init_listeners: function (binding) {
      var self = this;

      if (typeof this.source === 'string') {
          binding.source_binding = binding.instance.get_binding(this.source);
        } else {
          binding.source_binding = this.source;
        }

      binding.source_binding.list.bind('add', function (ev, results) {
          binding.refresh_instances().done(function () {
            new RefreshQueue().enqueue(
              can.map(results, function (res) { return res.instance; })
            ).trigger().done(function () {
              can.map(can.makeArray(results), function (result) {
                var new_result = self.make_result(result.instance, [result], binding);
                new_result.compute = can.compute(function () {
                  return self.filter_fn(result);
                });
                new_result.compute.bind('change', $.proxy(self, 'process_result', binding, result, new_result));
                self.process_result(binding, result, new_result, new_result.compute());
              });
            });
          });
        });

      binding.source_binding.list.bind('remove', function (ev, results) {
          can.each(results, function (result) {
            self.remove_instance(binding, result.instance, result);
          });
        });
    },

    _refresh_stubs: function (binding) {
      var self = this
          ;

      return binding.source_binding.refresh_instances()
          .then(function (results) {
            new RefreshQueue().enqueue(
              can.map(results, function (res) { return res.instance; })
            ).trigger().done(function () {
              can.map(can.makeArray(results), function (result) {
                var new_result = self.make_result(result.instance, [result], binding);
                new_result.compute = can.compute(function () {
                  return self.filter_fn(result);
                });
                new_result.compute.bind('change', $.proxy(self, 'process_result', binding, result, new_result));
                self.process_result(binding, result, new_result, new_result.compute());
              });
            });
          });
    }
  });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.MultiListLoader', {
  }, {
    init: function (sources) {
      this._super();

      this.sources = sources || [];
    }, init_listeners: function (binding) {
        var self = this;

        if (!binding.source_bindings)
          binding.source_bindings = [];

        can.each(this.sources, function (source) {
          var source_binding = null;
          source_binding = binding.instance.get_binding(source);
          if (source) {
            binding.source_bindings.push(source_binding);
            self.init_source_listeners(binding, source_binding);
          }
        });
      }, insert_from_source_binding: function (binding, results, index) {
        var self = this, new_results
          ;

        new_results = can.map(results, function (result) {
          return self.make_result(result.instance, [result], binding);
        });
        self.insert_results(binding, new_results);
      }, init_source_listeners: function (binding, source_binding) {
        var self = this;

        self.insert_from_source_binding(binding, source_binding.list);

        source_binding.list.bind('add', function (ev, results) {
          self.insert_from_source_binding(binding, results);
        });

        source_binding.list.bind('remove', function (ev, results) {
          can.each(results, function (result) {
            self.remove_instance(binding, result.instance, result);
          });
        });
      }, _refresh_stubs: function (binding) {
        var deferreds = [];

        can.each(binding.source_bindings, function (source_binding) {
          deferreds.push(source_binding.refresh_stubs());
        });

        return $.when.apply($, deferreds);
      }
  });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.IntersectingListLoader', {
  }, {
    init: function (sources) {
      this._super();

      this.sources = sources || [];
    }, init_listeners: function (binding) {
        var self = this;

        if (!binding.source_bindings)
          binding.source_bindings = [];

        can.each(this.sources, function (source) {
          var source_binding = null;
          /// Here is a deviation from the norm, since we want to
          ///  allow source bindings from possibly several disparate
          ///  instances.  Pass them in as already created objects
          ///  and we won't try to find them on the binding instance.
          if (typeof source === 'string') {
            source_binding = binding.instance.get_binding(source);
          } else {
            source_binding = source;
          }
          if (source) {
            binding.source_bindings.push(source_binding);
          }
        });
        self.init_source_listeners(binding, binding.source_bindings);
      }, insert_from_source_binding: function (binding, results, index) {
        var self = this, new_results, lists = can.map(
            binding.source_bindings,
            function (source) {
              return [can.map(
                source.list,
                function (result) {
                  return result.instance;
                })];
            })
        ;

        new_results = can.map(results, function (result) {
          // only the results that have membership in all lists will be added.
          if (can.reduce(lists, function (found, list) {
            return found && !!~can.inArray(result.instance, list);
          }, true)) {
            return self.make_result(result.instance, [result], binding);
          }
        });
        self.insert_results(binding, new_results);
      }, init_source_listeners: function (binding, source_bindings) {
        var self = this;

        can.each(source_bindings, function (source_binding) {

          self.insert_from_source_binding(binding, source_binding.list);

          source_binding.list.bind('add', function (ev, results) {
            self.insert_from_source_binding(binding, results);
          });

          source_binding.list.bind('remove', function (ev, results) {
            can.each(results, function (result) {
              self.remove_instance(binding, result.instance, result);
            });
          });
        });
      }, _refresh_stubs: function (binding) {
        var deferreds = [];

        can.each(binding.source_bindings, function (source_binding) {
          deferreds.push(source_binding.refresh_stubs());
        });

        return $.when.apply($, deferreds);
      }
  });

  /*  ProxyListLoader
   *  - handles relationships across join tables
   *
   *  - listens to:
   *      - join_model.created
   *      - join_model.destroyed
   *      - not implemented:
   *        - join_instance.change(object_attr)
   *        - join_instance.change(option_attr)
   */
  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.ProxyListLoader', {
  }, {
    init: function (model_name, object_attr, option_attr,
                   object_join_attr, option_model_name) {
      this._super();

      this.model_name = model_name;
      this.object_attr = object_attr;
      this.option_attr = option_attr;
      this.object_join_attr = object_join_attr;
      this.option_model_name = option_model_name;
    }, init_listeners: function (binding) {
      var self = this, model = CMS.Models[this.model_name], object_join_value = binding.instance[this.object_join_attr]
          ;

      binding.instance.bind(this.object_join_attr, function (ev, _new, _old) {
          if (binding._refresh_stubs_deferred && binding._refresh_stubs_deferred.state() !== 'pending')
            self._refresh_stubs(binding);
        });

      if (object_join_value) {
          object_join_value.bind('length', function (ev, _new, _old) {
            self._refresh_stubs(binding);
          });
        }

      model.bind('created', function (ev, mapping) {
          if (mapping instanceof model)
            self.filter_and_insert_instances_from_mappings(binding, [mapping]);
        });

      model.bind('destroyed', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });

        //  FIXME: This is only needed in DirectListLoader, right?
      model.bind('orphaned', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });
    }, is_valid_mapping: function (binding, mapping) {
        var model = CMS.Models[this.model_name], object_model = binding.instance.constructor, option_model = CMS.Models[this.option_model_name]
          ;

        return (mapping.constructor === model &&
                mapping[this.object_attr] &&
                (mapping[this.object_attr].reify() === binding.instance ||
                    (mapping[this.object_attr].reify().constructor === object_model &&
                        mapping[this.object_attr].id === binding.instance.id)) &&
                (!option_model ||
                    (mapping[this.option_attr] &&
                        mapping[this.option_attr].reify() instanceof option_model)));
      }, filter_and_insert_instances_from_mappings: function (binding, mappings) {
        var self = this, matching_mappings
          ;

        matching_mappings = can.map(can.makeArray(mappings), function (mapping) {
          if (self.is_valid_mapping(binding, mapping))
            return mapping;
        });
        return this.insert_instances_from_mappings(binding, matching_mappings);
      }, insert_instances_from_mappings: function (binding, mappings) {
        var self = this, new_results
          ;

        new_results = can.map(can.makeArray(mappings), function (mapping) {
          return self.get_result_from_mapping(binding, mapping);
        });
        this.insert_results(binding, new_results);
      }, remove_instance_from_mapping: function (binding, mapping) {
        var instance, result;
        if (this.is_valid_mapping(binding, mapping)) {
          instance = this.get_instance_from_mapping(binding, mapping);
          result = this.find_result_from_mapping(binding, mapping);
          if (instance)
            this.remove_instance(binding, instance, result);
        }
      }, get_result_from_mapping: function (binding, mapping) {
        return this.make_result({
          instance: mapping[this.option_attr].reify(), mappings: [{
              instance: mapping, mappings: [{
                  instance: true, mappings: [], binding: binding
                }], binding: binding
            }]
        });
      }, get_instance_from_mapping: function (binding, mapping) {
        return mapping[this.option_attr] && mapping[this.option_attr].reify();
      }, find_result_from_mapping: function (binding, mapping) {
        var result_i, mapping_i, result;
        for (result_i = 0; result_i < binding.list.length; result_i++) {
          result = binding.list[result_i];
          for (mapping_i = 0; mapping_i < result.mappings.length; mapping_i++) {
            mapping_result = result.mappings[mapping_i];
            if (mapping_result.instance === mapping)
              return mapping_result;
          }
        }
      }, _refresh_stubs: function (binding) {
        var self = this, model = CMS.Models[this.model_name], refresh_queue = new RefreshQueue(), object_join_attr = this.object_join_attr || model.table_plural
          ;

        // These properties only exist if the user has read access
        if (binding.instance[object_join_attr]) {
          can.each(binding.instance[object_join_attr].reify(), function (mapping) {
            refresh_queue.enqueue(mapping);
          });
        }

        return refresh_queue.trigger()
          .then(this.proxy('filter_for_valid_mappings', binding))
          .then(this.proxy('insert_instances_from_mappings', binding));
      }, filter_for_valid_mappings: function (binding, mappings) {
        // Remove incomplete mappings, including those not in our context
        //   (which the server refused to provide).
        var i, valid_mappings = [];

        for (i = 0; i < mappings.length; i++) {
          if (mappings[i][this.option_attr])
            valid_mappings.push(mappings[i]);
        }
        return valid_mappings;
      }
  });

  /*  DirectListLoader
   *  - handles direct relationships / one-to-many relationships
   *
   *  - listens to:
   *      - model.created
   *      - model.destroyed
   *      - not implemented:
   *        - instance.change(object_attr)
   */
  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.DirectListLoader', {
  }, {
    init: function (model_name, object_attr, object_join_attr) {
      this._super();

      this.model_name = model_name;
      this.object_attr = object_attr;
      this.object_join_attr = object_join_attr;
    }, init_listeners: function (binding) {
        var self = this, model = CMS.Models[this.model_name] || can.Model.Cacheable
          ;

        binding.instance.bind(this.object_join_attr, function (ev, _new, _old) {
          if (binding._refresh_stubs_deferred && binding._refresh_stubs_deferred.state() !== 'pending') {
            self._refresh_stubs(binding);
          }
        });

        model.bind('created', function (ev, mapping) {
          if (mapping instanceof model)
            self.filter_and_insert_instances_from_mappings(binding, [mapping]);
        });

        model.bind('destroyed', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });

        model.bind('orphaned', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });
      }, is_valid_mapping: function (binding, mapping) {
        var model = CMS.Models[this.model_name] || can.Model.Cacheable, object_model = binding.instance.constructor
          ;

        return (mapping instanceof model &&
                mapping[this.object_attr] &&
                (mapping[this.object_attr].reify() === binding.instance ||
                    (mapping[this.object_attr].reify().constructor === object_model &&
                        mapping[this.object_attr].id === binding.instance.id)));
      }, filter_and_insert_instances_from_mappings: function (binding, mappings) {
        var self = this, matching_mappings
          ;

        matching_mappings = can.map(can.makeArray(mappings), function (mapping) {
          if (self.is_valid_mapping(binding, mapping))
            return mapping;
        });
        return this.insert_instances_from_mappings(binding, matching_mappings);
      }, insert_instances_from_mappings: function (binding, mappings) {
        var self = this, new_results
          ;

        new_results = can.map(can.makeArray(mappings), function (mapping) {
          return self.get_result_from_mapping(binding, mapping);
        });
        this.insert_results(binding, new_results);
      }, remove_instance_from_mapping: function (binding, mapping) {
        var instance;
        if (this.is_valid_mapping(binding, mapping)) {
          instance = this.get_instance_from_mapping(binding, mapping);
          result = this.find_result_from_mapping(binding, mapping);
          if (instance)
            this.remove_instance(binding, instance, result);
        }
      }, get_result_from_mapping: function (binding, mapping) {
        return this.make_result({
          instance: mapping, mappings: [{
              instance: true, mappings: [], binding: binding
            }], binding: binding
        });
      }, get_instance_from_mapping: function (binding, mapping) {
        return mapping;
      }, find_result_from_mapping: function (binding, mapping) {
        var result_i, mapping_i, result;
        for (result_i = 0; result_i < binding.list.length; result_i++) {
          result = binding.list[result_i];
          if (result.instance === mapping)
            // DirectListLoader can't have multiple mappings
            return result.mappings[0];
        }
      }, _refresh_stubs: function (binding) {
        var that = this, refresh_queue = new RefreshQueue()
          ;

        refresh_queue.enqueue(binding.instance);

        return refresh_queue.trigger().then(function () {
          var model = CMS.Models[that.model_name], object_join_attr = that.object_join_attr, mappings = binding.instance[object_join_attr] && binding.instance[object_join_attr].reify()
            ;

          that.insert_instances_from_mappings(binding, mappings);
        });
      }
  });

  /*  IndirectListLoader
   *  - handles indirect relationships
   *  (zero-to-many, no local join but has a direct mapping in another object)
   *
   *  - listens to:
   *      - model.created
   *      - model.destroyed
   *      - not implemented:
   *        - instance.change(object_attr)
   */
  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.IndirectListLoader', {
  }, {
    init: function (model_name, object_attr) {
      this._super();

      this.model_name = model_name;
      this.object_attr = object_attr;
    }, init_listeners: function (binding) {
        var self = this, model = CMS.Models[this.model_name]
          ;

        model.bind('created', function (ev, mapping) {
          if (mapping instanceof model)
            self.filter_and_insert_instances_from_mappings(binding, [mapping]);
        });

        model.bind('destroyed', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });

        model.bind('orphaned', function (ev, mapping) {
          if (mapping instanceof model)
            self.remove_instance_from_mapping(binding, mapping);
        });
      }, is_valid_mapping: function (binding, mapping) {
        var model = CMS.Models[this.model_name], object_model = binding.instance.constructor
          ;

        return (mapping instanceof model &&
                mapping[this.object_attr] &&
                (mapping[this.object_attr].reify() === binding.instance ||
                    (mapping[this.object_attr].type === 'Context' ||
                        (mapping[this.object_attr].reify() &&
                            mapping[this.object_attr].reify().constructor === object_model) &&
                        mapping[this.object_attr].id === binding.instance.id)));
      }, filter_and_insert_instances_from_mappings: function (binding, mappings) {
        var self = this, matching_mappings
          ;

        matching_mappings = can.map(can.makeArray(mappings), function (mapping) {
          if (self.is_valid_mapping(binding, mapping))
            return mapping;
        });
        return this.insert_instances_from_mappings(binding, matching_mappings);
      }, insert_instances_from_mappings: function (binding, mappings) {
        var self = this, new_results
          ;

        new_results = can.map(can.makeArray(mappings), function (mapping) {
          return self.get_result_from_mapping(binding, mapping);
        });
        this.insert_results(binding, new_results);
      }, remove_instance_from_mapping: function (binding, mapping) {
        var instance;
        if (this.is_valid_mapping(binding, mapping)) {
          instance = this.get_instance_from_mapping(binding, mapping);
          result = this.find_result_from_mapping(binding, mapping);
          if (instance)
            this.remove_instance(binding, instance, result);
        }
      }, get_result_from_mapping: function (binding, mapping) {
        return this.make_result({
          instance: mapping, mappings: [{
              instance: true, mappings: [], binding: binding
            }], binding: binding
        });
      }, get_instance_from_mapping: function (binding, mapping) {
        return mapping;
      }, find_result_from_mapping: function (binding, mapping) {
        var result_i, mapping_i, result;
        for (result_i = 0; result_i < binding.list.length; result_i++) {
          result = binding.list[result_i];
          if (result.instance === mapping)
            // DirectListLoader can't have multiple mappings
            return result.mappings[0];
        }
      }, _refresh_stubs: function (binding) {
        var model = CMS.Models[this.model_name], object_join_attr = ('indirect_' + (this.object_join_attr || model.table_plural)), mappings = binding.instance[object_join_attr] && binding.instance[object_join_attr].reify(), params = {}, object_attr = this.object_attr + (this.object_attr !== 'context' && model.attributes[this.object_attr].indexOf('stubs') > -1 ? '.id' : '_id'), self = this
          ;
        params[object_attr] = this.object_attr === 'context' ? binding.instance.context && binding.instance.context.id : binding.instance.id;
        if (mappings || !params[object_attr]) {
          this.insert_instances_from_mappings(binding, mappings);
          return new $.Deferred().resolve(mappings);
        } else {
          return model.findAll(params).done(function (mappings) {
            //binding.instance.attr(object_join_attr, mappings);
            self.insert_instances_from_mappings(binding, mappings.reify());
          });
        }
      }, refresh_list: function () {
        return this._refresh_stubs(binding);
      }
  });

  /*  SearchListLoader
   *  - handles search relationships
   *
   *  - listens to:
   *      - model.created
   *      - model.destroyed
   *      - not implemented:
   *        - instance.change(object_attr)
   */

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.SearchListLoader', {
  }, {
    init: function (query_function, observe_types) {
      this._super();
      this.observe_types = observe_types && observe_types.split(',');
      this.query_function = query_function;
    }, init_listeners: function (binding) {
        var model = can.Model.Cacheable, that = this
          ;

        model.bind('created', function (ev, mapping) {
          if (mapping instanceof model) {
            if (_.includes(that.observe_types, mapping.type)) {
              that._refresh_stubs(binding);
            }
          }
        });

        model.bind('destroyed', function (ev, mapping) {
          if (mapping instanceof model)
            that.remove_instance_from_mapping(binding, mapping);
        });

        //  FIXME: This is only needed in DirectListLoader, right?
        model.bind('orphaned', function (ev, mapping) {
          if (mapping instanceof model)
            that.remove_instance_from_mapping(binding, mapping);
        });
      }, is_valid_mapping: function (binding, mapping) {
        return true;
      }, filter_and_insert_instances_from_mappings: function (binding, mappings) {
        var self = this, matching_mappings
          ;

        matching_mappings = can.map(can.makeArray(mappings), function (mapping) {
          if (self.is_valid_mapping(binding, mapping))
            return mapping;
        });
        return this.insert_instances_from_mappings(binding, matching_mappings);
      }, insert_instances_from_mappings: function (binding, mappings) {
        var self = this, new_results
          ;

        new_results = can.map(can.makeArray(mappings), function (mapping) {
          return self.get_result_from_mapping(binding, mapping);
        });
        this.insert_results(binding, new_results);
      }, remove_instance_from_mapping: function (binding, mapping) {
        var instance;
        if (this.is_valid_mapping(binding, mapping)) {
          instance = this.get_instance_from_mapping(binding, mapping);
          result = this.find_result_from_mapping(binding, mapping);
          if (instance)
            this.remove_instance(binding, instance, result);
        }
      }, get_result_from_mapping: function (binding, mapping) {
        return this.make_result({
          instance: mapping, mappings: [{
              instance: true, mappings: [], binding: binding
            }], binding: binding
        });
      }, get_instance_from_mapping: function (binding, mapping) {
        return mapping;
      }, find_result_from_mapping: function (binding, mapping) {
        var result_i, mapping_i, result;
        for (result_i = 0; result_i < binding.list.length; result_i++) {
          result = binding.list[result_i];
          if (result.instance === mapping)
            // DirectListLoader can't have multiple mappings
            return result.mappings[0];
        }
      }, _refresh_stubs: function (binding) {
        var object_join_attr = ('search_' + (this.object_join_attr || binding.instance.constructor.table_plural)),
          mappings = binding.instance[object_join_attr] && binding.instance[object_join_attr].reify(),
          self = this,
          result;

        if (mappings) {
          this.insert_instances_from_mappings(binding, mappings);
          return new $.Deferred().resolve(mappings);
        } else {
          result = this.query_function(binding);
          return result.pipe(function (mappings) {
            can.each(mappings, function (entry, i) {
              var _class = (can.getObject('CMS.Models.' + entry.type) || can.getObject('GGRC.Models.' + entry.type));
              mappings[i] = new _class({id: entry.id});
            });

            //binding.instance.attr(object_join_attr, mappings);
            self.insert_instances_from_mappings(binding, mappings.reify());
            return mappings;
          });
        }
      }, refresh_list: function (binding) {
        return this._refresh_stubs(binding);
      }
  });

  GGRC.ListLoaders.BaseListLoader('GGRC.ListLoaders.ReifyingListLoader', {
  }, {
    init: function (source) {
      this._super();

      if (source instanceof GGRC.ListLoaders.ListBinding)
          this.source_binding = source;
        else
          this.source = source;
    }, insert_from_source_binding: function (binding, results, index) {
        var self = this, refresh_queue = new RefreshQueue(), new_results = []
          ;

        can.each(results, function (result) {
          refresh_queue.enqueue(result.instance);
          new_results.push(self.make_result(result.instance, [result], binding));
        });
        refresh_queue.trigger().then(function () {
          self.insert_results(binding, new_results);
        });
      }, init_listeners: function (binding) {
        var self = this;

        if (this.source_binding)
          binding.source_binding = this.source_binding;
        else
          binding.source_binding = binding.instance.get_binding(this.source);

        this.insert_from_source_binding(binding, binding.source_binding.list, 0);

        binding.source_binding.list.bind('add', function (ev, results, index) {
          self.insert_from_source_binding(binding, results, index);
        });

        binding.source_binding.list.bind('remove', function (ev, results, index) {
          can.each(results, function (result) {
            self.remove_instance(binding, result.instance, result);
          });
        });
      }, _refresh_stubs: function (binding) {
        return binding.source_binding.refresh_stubs(binding);
      }
  });

  GGRC.MapperHelpers = {};

  GGRC.MapperHelpers.Proxy = function Proxy(
      option_model_name, join_option_attr, join_model_name, join_object_attr,
      instance_join_attr) {
    return new GGRC.ListLoaders.ProxyListLoader(
        join_model_name, join_object_attr, join_option_attr,
        instance_join_attr, option_model_name);
  };

  GGRC.MapperHelpers.Direct = function Direct(
      option_model_name, instance_join_attr, remote_join_attr) {
    return new GGRC.ListLoaders.DirectListLoader(
      option_model_name, instance_join_attr, remote_join_attr);
  };

  GGRC.MapperHelpers.Indirect = function Indirect(
      instance_model_name, option_join_attr) {
    return new GGRC.ListLoaders.IndirectListLoader(
      instance_model_name, option_join_attr);
  };

  GGRC.MapperHelpers.Search = function Search(query_function, observe_types) {
    return new GGRC.ListLoaders.SearchListLoader(query_function, observe_types);
  };

  GGRC.MapperHelpers.Multi = function Multi(sources) {
    return new GGRC.ListLoaders.MultiListLoader(sources);
  };

  GGRC.MapperHelpers.TypeFilter = function TypeFilter(source, model_name) {
    return new GGRC.ListLoaders.TypeFilteredListLoader(source, [model_name]);
  };

  GGRC.MapperHelpers.AttrFilter = function AttrFilter(source, filter_name, keyword, type) {
    return new GGRC.ListLoaders.AttrFilteredListLoader(source, filter_name, keyword, type);
  };

  GGRC.MapperHelpers.CustomFilter = function CustomFilter(source, filter_fn) {
    return new GGRC.ListLoaders.CustomFilteredListLoader(source, filter_fn);
  };

  GGRC.MapperHelpers.Reify = function Reify(source) {
    return new GGRC.ListLoaders.ReifyingListLoader(source);
  };

  GGRC.MapperHelpers.Cross = function Cross(local_mapping, remote_mapping) {
    return new GGRC.ListLoaders.CrossListLoader(local_mapping, remote_mapping);
  };

  GGRC.all_local_results = function (instance) {
    // Returns directly-linked objects
    var loaders, local_loaders = [], multi_loader, multi_binding
      ;

    if (instance._all_local_results_binding)
      return instance._all_local_results_binding.refresh_stubs();

    loaders = GGRC.Mappings.get_mappings_for(instance.constructor.shortName);
    can.each(loaders, function (loader, name) {
      if (loader instanceof GGRC.ListLoaders.DirectListLoader ||
          loader instanceof GGRC.ListLoaders.ProxyListLoader) {
        local_loaders.push(name);
      }
    });

    multi_loader = new GGRC.ListLoaders.MultiListLoader(local_loaders);
    instance._all_local_results_binding = multi_loader.attach(instance);
    return instance._all_local_results_binding.refresh_stubs();
  };

})(GGRC, can);
