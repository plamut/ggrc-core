/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

/* global failAll: false */
/* eslint max-nested-callbacks: 0 */

describe('can.Model.Cacheable', function () {
  beforeAll(function () {
    can.Model.Mixin('dummyable');
    spyOn(CMS.Models.Mixins.dummyable, 'add_to');

    can.Model.Cacheable.extend('CMS.Models.DummyModel', {
      root_object: 'dummy_model',
      root_collection: 'dummy_models',
      // The string update key has to be here to make the update conflict
      // tests work. See can.Model.Cacheable.init for details on how the
      // software under test is broken. --BM
      findOne: 'GET /api/dummy_models/{id}',
      findAll: 'GET /api/dummy_models/',
      update: 'PUT /api/dummy_models/{id}',
      mixins: ['dummyable'],
      attributes: {dummy_attribute: 'dummy_convert'},
      is_custom_attributable: true
    }, {});

    can.Model.Cacheable.extend('CMS.Models.DummyJoin', {
      root_object: 'dummy_join',
      root_collection: 'dummy_joins'
    }, {});
  });

  afterAll(function () {
    delete CMS.Models.DummyModel;
    delete CMS.Models.DummyJoin;
    delete CMS.Models.Mixins.dummyable;
  });

  describe('::setup', function () {
    it('prefers pre-set static names over root object & collection',
      function () {
        var Model = can.Model.Cacheable.extend('CSM.Models.Dummy', {
          root_object: 'wrong_name',
          root_collection: 'wrong_names',
          model_singular: 'RightName',
          table_singular: 'right_name',
          title_singular: 'Right Name',
          model_plural: 'RightNames',
          table_plural: 'right_names',
          title_plural: 'Right Names'
        }, {});
        // note that these are not explicit in beforeAll above.
        // model singular is CamelCased form of root_object
        expect(Model.model_singular).toBe('RightName');
        // table singular is under_scored version of same
        expect(Model.table_singular).toBe('right_name');
        // title singular is 'Human Readable' version of same
        expect(Model.title_singular).toBe('Right Name');
        // plurals are based on root collection.
        expect(Model.model_plural).toBe('RightNames');
        expect(Model.table_plural).toBe('right_names');
        expect(Model.title_plural).toBe('Right Names');
      }
    );

    it('sets various forms of the name based on root object & collection ' +
      'by default',
      function () {
        // note that these are not explicit in beforeAll above.
        // model singular is CamelCased form of root_object
        expect(CMS.Models.DummyModel.model_singular).toBe('DummyModel');
        // table singular is under_scored version of same
        expect(CMS.Models.DummyModel.table_singular).toBe('dummy_model');
        // title singular is 'Human Readable' version of same
        expect(CMS.Models.DummyModel.title_singular).toBe('Dummy Model');
        // plurals are based on root collection.
        expect(CMS.Models.DummyModel.model_plural).toBe('DummyModels');
        expect(CMS.Models.DummyModel.table_plural).toBe('dummy_models');
        expect(CMS.Models.DummyModel.title_plural).toBe('Dummy Models');
      }
    );

    it('sets findAll to default based on root_collection if not set',
      function () {
        var Model;
        spyOn(can.Model, 'setup');
        Model = can.Model.Cacheable.extend(
          'CMS.Models.DummyFind',
          {root_collection: 'foos'},
          {}
        );
        expect(Model.findAll).toBe('GET /api/foos');
      }
    );

    it('applies mixins based on the mixins property', function () {
      expect(CMS.Models.Mixins.dummyable.add_to)
        .toHaveBeenCalledWith(CMS.Models.DummyModel);
    });

    it('merges in default attributes for created_at and updated_at',
      function () {
        expect(CMS.Models.DummyModel.attributes).toEqual({
          created_at: 'datetime',
          updated_at: 'datetime',
          dummy_attribute: 'dummy_convert'
        });
      }
    );
  });

  describe('::init', function () {
    it('sets custom attributes', function () {
      // NB using $.extend here creates a new object with all of the static
      // properties of the function. This is how the custom attributable
      // is implemented in setup.
      expect(GGRC.custom_attributable_types)
        .toContain($.extend({}, CMS.Models.DummyModel));
    });
  });

  describe('::makeDestroy', function () {
    var destroy_spy;
    beforeEach(function () {
      destroy_spy = jasmine.createSpy('destroy');
      spyOn(CMS.Models.BackgroundTask, 'findOne').and.returnValue($.when());
    });

    it('finds background task if specified in return object', function (done) {
      var destroy = CMS.Models.DummyModel.makeDestroy(destroy_spy);
      destroy_spy.and.returnValue($.when({background_task: {id: 1}}));

      destroy(2).then(function () {
        expect(CMS.Models.BackgroundTask.findOne)
          .toHaveBeenCalledWith({id: 1});
        done();
      }, failAll(done));
    });

    it('polls background task if found', function (done) {
      var destroy = CMS.Models.DummyModel.makeDestroy(destroy_spy);
      var poll_spy = jasmine.createSpyObj('poll_spy', ['poll']);
      destroy_spy.and.returnValue($.when({background_task: {id: 1}}));
      CMS.Models.BackgroundTask.findOne.and.returnValue($.when(poll_spy));

      destroy(2).then(function () {
        expect(CMS.Models.BackgroundTask.findOne)
          .toHaveBeenCalledWith({id: 1});
        expect(poll_spy.poll).toHaveBeenCalled();
        done();
      }, failAll(done));
    });

    it('continues normally if no background task specified', function (done) {
      var destroy = CMS.Models.DummyModel.makeDestroy(destroy_spy);
      destroy_spy.and.returnValue($.when({dummy: {id: 1}}));

      destroy(2).then(function () {
        expect(CMS.Models.BackgroundTask.findOne).not.toHaveBeenCalled();
        done();
      }, failAll(done));
    });
  });

  describe('::update', function () {
    var _obj;
    var id = 0;

    beforeEach(function (done) {
      _obj = new CMS.Models.DummyModel({id: ++id});
      done();
    });

    it('processes args before sending', function (done) {
      var obj = _obj;
      spyOn(CMS.Models.DummyModel, 'process_args');
      spyOn(can, 'ajax').and.returnValue($.when({}));
      CMS.Models.DummyModel.update(obj.id, obj).then(function () {
        expect(CMS.Models.DummyModel.process_args).toHaveBeenCalledWith(obj);
        done();
      });
    });

    it('calls resolve_deferred_bindings after send success', function (done) {
      var obj = _obj;
      spyOn(CMS.Models.DummyModel, 'resolve_deferred_bindings')
        .and.returnValue(obj);
      spyOn(can, 'ajax')
        .and.returnValue($.when({dummy_model: {id: obj.id}}));
      CMS.Models.DummyModel
        .update(obj.id, obj.serialize())
        .then(
          function () {
            expect(CMS.Models.DummyModel.resolve_deferred_bindings)
              .toHaveBeenCalledWith(obj);
            setTimeout(function () {
              done();
            }, 10);
          },
          failAll(done)
        );
    });

    describe('update conflict', function () {
      it('triggers error flash when one property has an update conflict',
        function (done) {
          var obj = _obj;
          obj.attr('foo', 'bar');
          obj.backup();
          expect(obj._backupStore)
            .toEqual(jasmine.objectContaining({id: obj.id, foo: 'bar'}));
          obj.attr('foo', 'plonk');
          spyOn($.fn, 'trigger').and.callThrough();
          spyOn(obj, 'save').and.callFake(function () {
            return new $.Deferred(function (dfd) {
              setTimeout(function () {
                dfd.resolve(obj);
              }, 10);
            });
          });
          spyOn(obj, 'refresh').and.callFake(function () {
            // uh-oh!  The same attr has been changed locally and remotely!
            obj.attr('foo', 'thud');
            return new $.Deferred(function (dfd) {
              setTimeout(function () {
                dfd.resolve(obj);
              }, 10);
            });
          });
          spyOn(can, 'ajax').and.callFake(function () {
            return new $.Deferred(function (dfd) {
              setTimeout(function () {
                dfd.reject({status: 409}, 409, 'CONFLICT');
              }, 10);
            });
          });
          CMS.Models.DummyModel
            .update(obj.id.toString(), obj.serialize())
            .then(
              function () {
                fail('The update handler isn\'t supposed to resolve here.');
                done();
              },
              function () {
                expect($.fn.trigger).toHaveBeenCalledWith(
                  'ajax:flash', {warning: [jasmine.any(String)]});
                setTimeout(function () {
                  done();
                }, 10);
              }
            );
        }
      );

      it('refreshes model', function (done) {
        var obj = _obj;
        spyOn(obj, 'refresh').and.returnValue($.when(obj));
        spyOn(can, 'ajax').and.returnValue(
          new $.Deferred().reject({status: 409}, 409, 'CONFLICT')
        );
        CMS.Models.DummyModel.update(obj.id, obj.serialize()).then(function () {
          expect(obj.refresh).toHaveBeenCalledWith();
          setTimeout(function () {
            done();
          }, 10);
        }, failAll(done));
      });

      it('merges changed properties and saves', function (done) {
        var obj = _obj;
        obj.attr('foo', 'bar');
        obj.backup();
        expect(obj._backupStore)
          .toEqual(jasmine.objectContaining({id: obj.id, foo: 'bar'}));
        obj.attr('foo', 'plonk');
        spyOn(obj, 'save').and.returnValue($.when(obj));
        spyOn(obj, 'refresh').and.callFake(function () {
          obj.attr('baz', 'quux');
          return $.when(obj);
        });
        spyOn(can, 'ajax').and.returnValue(
          new $.Deferred().reject({status: 409}, 409, 'CONFLICT')
        );

        CMS.Models.DummyModel
          .update(obj.id, obj.serialize())
          .then(
            function () {
              expect(obj).toEqual(
                jasmine.objectContaining({
                  id: obj.id,
                  foo: 'plonk',
                  baz: 'quux'})
              );
              expect(obj.save).toHaveBeenCalled();
              setTimeout(function () {
                done();
              }, 10);
            },
            failAll(done)
          );
      });

      it('lets other error statuses pass through', function (done) {
        var obj = new CMS.Models.DummyModel({id: 1});
        var xhr = {status: 400};
        spyOn(obj, 'refresh').and.returnValue($.when(obj.serialize()));
        spyOn(can, 'ajax').and.returnValue(
          new $.Deferred().reject(xhr, 400, 'BAD REQUEST')
        );
        CMS.Models.DummyModel.update(1, obj.serialize()).then(
          failAll(done),
          function (_xhr) {
            expect(_xhr).toBe(xhr);
            done();
          }
        );
      });
    });
  });

  describe('::resolve_deferred_bindings', function () {
    it('iterates _pending_joins, calling refresh_stubs on each binding',
      function () {
        var instance = jasmine.createSpyObj('instance', ['get_binding']);
        var binding = jasmine.createSpyObj('binding', ['refresh_stubs']);
        instance._pending_joins = [
          {what: {}, how: 'add', through: 'foo'}
        ];
        instance.get_binding.and.returnValue(binding);
        spyOn($.when, 'apply').and.returnValue(new $.Deferred().reject());

        can.Model.Cacheable.resolve_deferred_bindings(instance);
        expect(binding.refresh_stubs).toHaveBeenCalled();
      }
    );

    describe('add case', function () {
      var instance;
      var binding;
      var dummy;

      beforeEach(function () {
        dummy = new CMS.Models.DummyModel({id: 1});
        instance = jasmine.createSpyObj(
          'instance', ['get_binding', 'isNew', 'refresh', 'attr']);
        binding = jasmine.createSpyObj('binding', ['refresh_stubs']);
        instance._pending_joins = [
          {what: dummy, how: 'add', through: 'foo'}
        ];
        instance.isNew.and.returnValue(false);
        instance.get_binding.and.returnValue(binding);
        binding.loader = {model_name: 'DummyJoin'};
        binding.list = [];
        spyOn(CMS.Models.DummyJoin, 'newInstance');
        spyOn(CMS.Models.DummyJoin.prototype, 'save');
      });

      afterEach(function () {
        delete CMS.Models.DummyModel.cache[1];
      });

      it('creates a proxy object when it does not exist', function () {
        can.Model.Cacheable.resolve_deferred_bindings(instance);
        expect(CMS.Models.DummyJoin.newInstance).toHaveBeenCalled();
        expect(CMS.Models.DummyJoin.prototype.save).toHaveBeenCalled();
      });

      it('does not create proxy object when it already exists', function () {
        binding.list.push({instance: dummy});
        can.Model.Cacheable.resolve_deferred_bindings(instance);
        expect(CMS.Models.DummyJoin.newInstance).not.toHaveBeenCalled();
        expect(CMS.Models.DummyJoin.prototype.save).not.toHaveBeenCalled();
      });
    });

    describe('remove case', function () {
      var instance;
      var binding;
      var dummy;
      var dummy_join;

      beforeEach(function () {
        dummy = new CMS.Models.DummyModel({id: 1});
        dummy_join = new CMS.Models.DummyJoin({id: 1});
        instance = jasmine.createSpyObj(
          'instance', ['get_binding', 'isNew', 'refresh', 'attr']);
        binding = jasmine.createSpyObj('binding', ['refresh_stubs']);
        instance._pending_joins = [
          {what: dummy, how: 'remove', through: 'foo'}
        ];
        instance.isNew.and.returnValue(false);
        instance.get_binding.and.returnValue(binding);
        binding.loader = {model_name: 'DummyJoin'};
        binding.list = [];
        spyOn(CMS.Models.DummyJoin, 'newInstance');
        spyOn(CMS.Models.DummyJoin.prototype, 'save');
      });

      it('removes proxy object if it exists', function () {
        binding.list.push({
          instance: dummy,
          get_mappings: function () {
            return [dummy_join];
          }
        });
        spyOn(dummy_join, 'refresh').and.returnValue($.when());
        spyOn(dummy_join, 'destroy');
        can.Model.Cacheable.resolve_deferred_bindings(instance);
        expect(dummy_join.destroy).toHaveBeenCalled();
      });
    });
  });

  describe('::findAll', function () {
    it('throws errors when called directly on Cacheable instead of a subclass',
      function () {
        expect(can.Model.Cacheable.findAll).toThrow(
          'No default findAll() exists for subclasses of Cacheable'
        );
      }
    );

    it('unboxes collections when passed back from the find', function (done) {
      spyOn(can, 'ajax').and.returnValue(
        $.when({dummy_models_collection: {dummy_models: [{id: 1}]}})
      );

      CMS.Models.DummyModel.findAll().then(function (data) {
        expect(can.ajax).toHaveBeenCalled();
        expect(data).toEqual(jasmine.any(can.List));
        expect(data.length).toBe(1);
        expect(data[0]).toEqual(jasmine.any(CMS.Models.DummyModel));
        expect(data[0]).toEqual(jasmine.objectContaining({id: 1}));
        done();
      }, failAll(done));
    });

    it('makes a collection of a single object when passed back from the find',
      function (done) {
        spyOn(can, 'ajax').and.returnValue($.when({id: 1}));
        CMS.Models.DummyModel.findAll().then(function (data) {
          expect(can.ajax).toHaveBeenCalled();
          expect(data).toEqual(jasmine.any(can.List));
          expect(data.length).toBe(1);
          expect(data[0]).toEqual(jasmine.any(CMS.Models.DummyModel));
          expect(data[0]).toEqual(jasmine.objectContaining({id: 1}));
          done();
        }, failAll(done));
      }
    );

    // NB -- This unit test is brittle.  It's difficult to unit test for
    // things like timing, and it's a bit of a hack to spy on Date.now()
    // since that function is used in more places than just our modelize
    // function. -- BM 2015-02-03
    it('only pushes instances into the list for 100ms before yielding',
      function (done) {
        var st;
        var list = new CMS.Models.DummyModel.List();
        var dummy_models = [
          {id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}, {id: 7}
        ];

        // Have our modelized instances ready for when
        var dummy_insts = CMS.Models.DummyModel.models(dummy_models);

        // we want to see how our observable list gets items over time,
        // so spy on the push method
        spyOn(list, 'push').and.callThrough();
        spyOn(can, 'ajax').and.returnValue($.when(dummy_models));

        // preload Date.now() because it's called once before we even
        // get to modelizing
        st = 4;
        spyOn(Date, 'now').and.callFake(function () {
          // Date.now() is called once at the start of modelizeMS (internal
          // function in findAll) once in an unknown location and once per item.
          if ((++st % 5) === 0) {
            // after three, push the time ahead 100ms to force a new
            // call to modelizeMS
            st += 100;
          }
          return st;
        });
        // return model instances for the list of returned items from the server
        spyOn(CMS.Models.DummyModel.List, 'newInstance').and.returnValue(list);
        // spy so we don't return the list to observe more than once.  That is,
        // models calls new DummyModel.List() which we're already spying out,
        // so spy models() out in order to *not* call it.
        spyOn(CMS.Models.DummyModel, 'models').and.callFake(function (items) {
          var ids = can.map(items, function (item) {
            return item.id;
          });
          return can.map(dummy_insts, function (inst) {
            return ~can.inArray(inst.id, ids) ? inst : undefined;
          });
        });
        CMS.Models.DummyModel.findAll().then(function () {
          // finally, we show that with the 100ms gap between pushing ids 3 and 4, we force a separate push.
          expect(list.push).toHaveBeenCalledWith(
            jasmine.objectContaining({id: 1}),
            jasmine.objectContaining({id: 2}),
            jasmine.objectContaining({id: 3})
          );
          expect(list.push).toHaveBeenCalledWith(
            jasmine.objectContaining({id: 4}),
            jasmine.objectContaining({id: 5}),
            jasmine.objectContaining({id: 6})
          );
          expect(list.push).toHaveBeenCalledWith(
            jasmine.objectContaining({id: 7})
          );
          done();
        }, failAll(done));
      }
    );
  });

  describe('::findPage', function () {
    it('throws errors when called directly on Cacheable instead of a subclass',
      function () {
        expect(can.Model.Cacheable.findPage).toThrow(
         'No default findPage() exists for subclasses of Cacheable'
        );
      }
    );
  });

  describe('#refresh', function () {
    var inst;

    beforeEach(function () {
      inst = new CMS.Models.DummyModel({href: '/api/dummy_models/1'});
      spyOn(can, 'ajax').and.returnValue(new $.Deferred(function (dfd) {
        setTimeout(function () {
          dfd.resolve(inst.serialize());
        }, 10);
      }));
    });
    afterEach(function () {
      delete CMS.Models.DummyModel.cache[undefined];
    });

    it('calls the object endpoint with the supplied href if no selfLink',
      function (done) {
        inst.refresh().then(function () {
          expect(can.ajax).toHaveBeenCalledWith(jasmine.objectContaining({
            url: '/api/dummy_models/1',
            type: 'get'
          }));
          done();
        }, fail);
      }
    );

    it('throttles the requests to once per second', function (done) {
      inst.refresh();
      inst.refresh();
      setTimeout(function () {
        inst.refresh().then(function () {
          expect(can.ajax.calls.count()).toBe(2);
          done();
        }, fail);
      }, 1000); // 1000ms is enough to trigger a new call to the debounced func
      inst.refresh().then(function () {
        expect(can.ajax.calls.count()).toBe(1);
      }, fail);
    });

    it('backs up the refreshed state immediately after refreshing',
      function (done) {
        spyOn(CMS.Models.DummyModel, 'model').and.returnValue(inst);
        spyOn(inst, 'backup');
        inst.refresh().then(function () {
          expect(inst.backup).toHaveBeenCalled();
          done();
        }, fail);
      }
    );
  });

  describe('::parse_deep_property_descriptor', function () {
    it('produces an immutable descriptor', function () {
      var desc =
        can.Model.Cacheable.parse_deep_property_descriptor('foo.bar|baz|quux');
      var zero = desc[0][0];
      var one = desc[1];

      try {
        desc[0][0] = 0;
        desc[1] = 0;
      } catch (err) {
        // we may get an error trying to modify an immutable object
      }
      expect(desc[0][0]).toEqual(zero);
      expect(desc[1]).toEqual(one);
    });
  });

  describe('#get_deep_property', function () {
    var equip = function (value) {
      if (typeof value === 'object') {
        value.get_deep_property =
          can.Model.Cacheable.prototype.get_deep_property;
        _.each(value, equip);
      }
      return value;
    };
    var get = function (key, value) {
      var desc = can.Model.Cacheable.parse_deep_property_descriptor(key);
      return equip(value).get_deep_property(desc);
    };

    it('gets a simple property', function () {
      expect(get('foo', {foo: 'bar'})).toBe('bar');
      expect(get('foo', {foo: 2})).toBe(2);
      expect(get('foo', {})).toBe(null);
    });

    it('gets a nested property', function () {
      var value = {
        foo: 'bar',
        bar: {
          foo: 1,
          bar: '2',
          baz: {foo: 'foo'}
        }
      };
      expect(get('foo', value)).toBe('bar');
      expect(get('bar', value)).toBe(value.bar);
      expect(get('bar.foo', value)).toBe(1);
      expect(get('bar.bar', value)).toBe('2');
      expect(get('bar.baz.foo', value)).toBe('foo');
    });

    it('gets and element from an array', function () {
      expect(get('0.1', [[undefined, 2], []])).toBe(2);
      expect(get('a.1', {a: ['foo', 'bar']})).toBe('bar');
    });

    it('chooses first non-empty', function () {
      var value1 = {
        foo: {
          bar: {
            quux: 3
          }
        }
      };
      var value2 = {
        foo: {
          baz: {
            quux: 3
          }
        }
      };
      expect(get('foo.bar|baz.quux', value1)).toBe(3);
      expect(get('foo.bar|baz.quux', value2)).toBe(3);
    });

    it('automatically calls reify when available', function () {
      var value = {
        foo: {
          reify: function () {
            return {bar: 'baz'};
          }
        }
      };
      expect(get('foo.bar', value)).toBe('baz');
    });

    it('does a multi-get for GET_ALL', function () {
      var value = {
        foo: [
          {bar: 1},
          {bar: 2},
          {baz: 3}
        ]
      };
      expect(get('foo.GET_ALL.bar|baz', value)).toEqual([1, 2, 3]);
    });

    it('produces a tree for nested multi-get', function () {
      var value = {
        foo: [
          {bar: [{y: 1}, {x: 2}, {x: 3}]},
          {bar: [{x: 4}, {x: 5}, {y: 6}]},
          {baz: [{y: 7}, {x: 8}, {x: 9}]}
        ]
      };
      expect(get('foo.GET_ALL.bar|baz.GET_ALL.x|y', value))
        .toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });
  });
});
