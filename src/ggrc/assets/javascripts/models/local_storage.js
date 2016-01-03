/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

// LocalStorage model, stubs AJAX requests to storage instead of going to the server.  Useful when a REST resource hasn't yet been implemented
// Adapted from an example in the CanJS documentation.  http://canjs.us/recipes.html

(function (can) {
  // Base model to handle reading / writing to local storage
  can.Model('can.Model.LocalStorage', {
    makeFindOne: function (findOne) {
      if (typeof findOne === 'function' && this !== can.Model.LocalStorage) {
        return findOne;
      }
      return function (params, success, error) {
        var instance;
        var def = new can.Deferred();
        var key;
        var data;

        params = params || {};
        // Key to be used for local storage
        key = [this._shortName, params.id].join(':');
        // Grab the current data, if any
        data = window.localStorage.getItem(key);

        // Bind success and error callbacks to the deferred
        def.then(success, error);
        // If we had existing local storage data...
        if (data) {
          // Create our model instance
          instance = this.store[params.id] || this.model(JSON.parse(data));
          // Resolve the deferred with our instance
          def.resolve(instance);
          // Otherwise hand off the deferred to the ajax request
        } else {
          def.reject({
            status: 404,
            responseText: 'Object with id ' + params.id + ' was not found'
          });
        }
        return def;
      };
    },
    makeFindAll: function (findAll) {
      if (typeof findAll === 'function' && this !== can.Model.LocalStorage) {
        return findAll;
      }
      return function (params, success, error) {
        var def = new can.Deferred();
        var key = [this._shortName, 'ids'].join(':');
        var data = window.localStorage.getItem(key);
        var returns = new can.Model.List();
        var that = this;
        params = params || {};

        if (data) {
          can.each(JSON.parse(data), function (id) {
            var k;
            var d;
            var pkeys;

            if (params.id === null || params.id === id) {
              k = [that._shortName, id].join(':');
              d = window.localStorage.getItem(k);

              if (d) {
                d = that.store[id] || JSON.parse(d);
                pkeys = Object.keys(params);
                if (pkeys.length < 1 || can.filter(pkeys, function (k) {
                  return params[k] !== d[k];
                }).length < 1) {
                  returns.push(that.model(d));
                }
              }
            }
          });
        }
        def.resolve(returns);
        return def;
      };
    },
    makeCreate: function (create) {
      if (typeof create === 'function' && this !== can.Model.LocalStorage) {
        return create;
      }
      return function (params) {
        var key = [this._shortName, 'ids'].join(':');
        var data = window.localStorage.getItem(key);
        var newkey = 1;
        var def = new can.Deferred();
        var item;

        // add to list
        if (data) {
          data = JSON.parse(data);
          newkey = Math.max.apply(Math, data.concat([0])) + 1;
          data.push(newkey);
        } else {
          data = [newkey];
        }
        window.localStorage.setItem(key, JSON.stringify(data));

        // create new
        key = [this._shortName, newkey].join(':');
        item = this.model(can.extend({id: newkey}, params));
        window.localStorage.setItem(key, JSON.stringify(item.serialize()));

        def.resolve(item);
        if (this.created) {
          this.created(item);
        }
        return def;
      };
    },
    makeUpdate: function (update) {
      if (typeof update === 'function' && this !== can.Model.LocalStorage) {
        return update;
      }
      return function (id, params) {
        var key = [this._shortName, id].join(':');
        var data = window.localStorage.getItem(key);
        var def = new can.Deferred();
        var item;

        if (data) {
          data = JSON.parse(data);
          if (params._removedKeys) {
            can.each(params._removedKeys, function (key) {
              if (!params[key]) {
                delete data[key];
              }
            });
          }
          delete params._removedKeys;
          can.extend(data, params);
          item = this.model({}).attr(data);

          window.localStorage.setItem(key, JSON.stringify(item.serialize()));
          def.resolve(item);
          if (this.updated) {
            this.updated(item);
          }
        } else {
          def.reject({
            status: 404,
            responseText: 'The object with id ' + id + ' was not found.'
          });
        }
        return def;
      };
    },
    makeDestroy: function (destroy) {
      if (typeof destroy === 'function' && this !== can.Model.LocalStorage) {
        return destroy;
      }
      return function (id) {
        var def = new can.Deferred();
        var key = [this._shortName, id].join(':');
        var item = this.model({id: id});
        var data;

        if (window.localStorage.getItem(key)) {
          window.localStorage.removeItem(key);

          // remove from list
          key = [this._shortName, 'ids'].join(':');
          data = window.localStorage.getItem(key);

          data = JSON.parse(data);
          data.splice(can.inArray(id, data), 1);
          window.localStorage.setItem(key, JSON.stringify(data));

          def.resolve(item);
          if (this.destroyed) {
            this.destroyed(item);
          }
        } else {
          def.reject({
            status: 404,
            responseText: 'Object with id ' + id + ' was not found'
          });
        }
        return def;
      };
    },
    clearAll: function () {
      window.localStorage.clear();
    }
  }, {
    removeAttr: function (attr) {
      this._super(attr);
      if (!this._removedKeys) {
        this._data._removedKeys = this._removedKeys = [];
      }
      this._removedKeys.push(attr);
      return this;
    }
  });
})(this.can);
