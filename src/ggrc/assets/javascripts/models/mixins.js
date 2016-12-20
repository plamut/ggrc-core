/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can) {
  can.Construct('can.Model.Mixin', {
    extend: function (fullName, klass, proto) {
      var tempname;
      var mixinName;
      var parts;
      var shortName;
      var Constructor;

      if (typeof fullName === 'string') {
        // Mixins do not go into the global namespace.
        tempname = fullName;
        fullName = '';
      }
      Constructor = this._super(fullName, klass, proto);

      // instead mixins sit under CMS.Models.Mixins
      if (tempname) {
        parts = tempname.split('.');
        shortName = parts.pop();
        Constructor.fullName = tempname;
      } else {
        Constructor.fullName = shortName =
          'Mixin_' + Math.floor(Math.random() * Math.pow(36, 8)).toString(36);
        parts = [];
      }
      mixinName = 'CMS.Models.Mixins' + (parts.length ?
        '.' + parts.join('.') :
          '');
      can.getObject(mixinName, window, true)[shortName] = Constructor;
      return Constructor;
    },
    newInstance: function () {
      throw new Error('Mixins cannot be directly instantiated');
    },
    add_to: function (cls) {
      var setupfns;
      if (this === can.Model.Mixin) {
        throw new Error('Must only add a subclass of Mixin to an object,' +
          ' not Mixin itself');
      }
      setupfns = function (obj) {
        return function (fn, key) {
          var blockedKeys = ['fullName', 'defaults', '_super', 'constructor'];
          var aspect = ~key.indexOf(':') ?
            key.substr(0, key.indexOf(':')) :
            'after';
          var oldfn;
          var key;

          key = ~key.indexOf(':') ? key.substr(key.indexOf(':') + 1) : key;
          if (fn !== can.Model.Mixin[key] && !~can.inArray(key, blockedKeys)) {
            oldfn = obj[key];
            // TODO support other ways of adding functions.
            //  E.g. "override" (doesn't call super fn at all)
            //       "sub" (sets this._super for mixin function)
            //       "chain" (pushes result of oldfn onto args)
            //       "before"/"after" (overridden function)
            // TODO support extension for objects.
            //   Necessary for "attributes"/"serialize"/"convert"
            // Defaults will always be "after" for functions
            //  and "override" for non-function values
            if (oldfn && typeof oldfn === 'function') {
              switch (aspect) {
                case 'before':
                  obj[key] = function () {
                    fn.apply(this, arguments);
                    return oldfn.apply(this, arguments);
                  };
                  break;
                case 'after':
                  obj[key] = function () {
                    oldfn.apply(this, arguments);
                    return fn.apply(this, arguments);
                  };
                  break;
                default:
                  break;
              }
            } else if (aspect === 'extend') {
              obj[key] = $.extend(obj[key], fn);
            } else {
              obj[key] = fn;
            }
          }
        };
      };
      if (!~can.inArray(this.fullName, cls._mixins)) {
        cls._mixins = cls._mixins || [];
        cls._mixins.push(this.fullName);
        for (key in this) {
          if (this.hasOwnProperty(key)) {
            setupfns(cls).call(null, this[key], key);
          }
        }
        can.each(this.prototype, setupfns(cls.prototype));
      }
    }
  }, {
  });

  can.Model.Mixin('ownable', {
    'after:init': function () {
      if (!this.owners) {
        this.attr('owners', []);
      }
    }
  });

  can.Model.Mixin('contactable', {
    // NB : Because the attributes object
    //  isn't automatically cloned into subclasses by CanJS (this is an intentional
    //  exception), when subclassing a class that uses this mixin, be sure to pull in the
    //  parent class's attributes using `can.extend(this.attributes, <parent_class>.attributes);`
    //  in the child class's static init function.
    'extend:attributes': {
      contact: 'CMS.Models.Person.stub',
      secondary_contact: 'CMS.Models.Person.stub'
    }
  }, {
    before_create: function () {
      var person = {
        id: GGRC.current_user.id,
        type: 'Person'
      };
      if (!this.contact) {
        this.attr('contact', person);
      }
    },
    form_preload: function (newObjectForm) {
      var person = {
        id: GGRC.current_user.id,
        type: 'Person'
      };
      if (newObjectForm && !this.contact) {
        this.attr('contact', person);
        this.attr('_transient.contact', person);
      } else if (this.contact) {
        this.attr('_transient.contact', this.contact);
      }
    }
  });

  can.Model.Mixin('ca_update', {}, {
    after_save: function () {
      this.attr('isReadyForRender', true);
    },
    info_pane_preload: function () {
      this.refresh();
    }
  });

  /**
   * A mixin to use for objects that can have their status automatically
   * changed when they are edited.
   *
   * @class CMS.Models.Mixins.autoStatusChangeable
   */
  can.Model.Mixin('autoStatusChangeable', {}, {

    /**
     * Display a confirmation dialog before starting to edit the instance.
     *
     * The dialog is not shown if the instance is either in the "Not Started",
     * or the "In Progress" state - in that case an already resolved promise is
     * returned.
     *
     * @return {Promise} A promise resolved/rejected if the user chooses to
     *   confirm/reject the dialog.
     */
    confirmBeginEdit: function () {
      var STATUS_NOT_STARTED = 'Not Started';
      var STATUS_IN_PROGRESS = 'In Progress';
      var IGNORED_STATES = [STATUS_NOT_STARTED, STATUS_IN_PROGRESS];

      var TITLE = [
        'Confirm moving ', this.type, ' to "', STATUS_IN_PROGRESS, '"'
      ].join('');

      var DESCRIPTION = [
        'If you modify a value, the status of the ', this.type,
        ' will move from "', this.status, '" to "',
        STATUS_IN_PROGRESS, '" - are you sure about that?'
      ].join('');

      var confirmation = $.Deferred();

      if (_.includes(IGNORED_STATES, this.status)) {
        confirmation.resolve();
      } else {
        GGRC.Controllers.Modals.confirm({
          modal_description: DESCRIPTION,
          modal_title: TITLE,
          button_view: GGRC.mustache_path + '/gdrive/confirm_buttons.mustache'
        }, confirmation.resolve, confirmation.reject);
      }

      return confirmation.promise();
    }
  });

  can.Model.Mixin('unique_title', {
    'after:init': function () {
      this.validate(['title', '_transient.title'], function (newVal, prop) {
        if (prop === 'title') {
          return this.attr('_transient.title');
        } else if (prop === '_transient.title') {
          return newVal; // the title error is the error
        }
      });
    }
  }, {
    save_error: function (val) {
      if (/title values must be unique\.$/.test(val)) {
        this.attr('_transient.title', val);
      }
    },
    after_save: function () {
      this.removeAttr('_transient.title');
    },
    'before:attr': function (key, val) {
      if (key === 'title' &&
          arguments.length > 1 &&
          this._transient) {
        this.attr('_transient.title', null);
      }
    }
  });
  // TODO: remove this mixin and all related logic from Front-end part
  can.Model.Mixin('relatable', {
  }, {
    related_self: function () {
      var model = CMS.Models[this.type];
      return this._related(
        model.relatable_options.relevantTypes,
        model.relatable_options.threshold
      );
    },
    /**
     * Return objects of single type above threshold that are
     * mapped to specified mapped objects.
     *
     * @param {Object} relevantTypes - object with specified first degree
     *   binding (objectBinding), second degree binding (relatableBinding) and
     *   weights that individual second degree bindings are carrying.
     *
     *   relevantTypes = {
     *     @ObjectType: {
     *       objectBinding: @first-degree-mapping,
     *       relatableBinding: @second-degree-mapping,
     *       weight: @weight-of-objects
     *     },
     *     Audit: {
     *       objectBinding: 'audits',
     *       relatableBinding: 'program_requests',
     *       weight: 5
     *     },
     *     Regulation: {
     *       objectBinding: 'related_regulations',
     *       relatableBinding: 'related_requests',
     *       weight: 3
     *     }, ...
     *   }
     * @param {Number} threshold - minimum weight required to render related
     *   object
     *
     */
    _related: function (relevantTypes, threshold) {
      var that = this;
      var relatable = $.Deferred();
      var connectionsCount = {};
      var relatedObjectsDeferreds = [];
      var mappedObjectDeferreds = _.map(relevantTypes, function (rtype) {
        return this.get_binding(rtype.objectBinding).refresh_instances();
      }.bind(this));

      $.when.apply($, mappedObjectDeferreds).done(function () {
        _.each(_.toArray(arguments), function (mappedObjectInstances) {
          if (!mappedObjectInstances.length) {
            return;
          }
          relatedObjectsDeferreds = relatedObjectsDeferreds.concat(
            _.map(mappedObjectInstances, function (mappedObj) {
              var insttype = mappedObj.instance.type;
              var binding = relevantTypes[insttype].relatableBinding;
              return mappedObj.instance.get_binding(
                binding).refresh_instances();
            }));
        });
        $.when.apply($, relatedObjectsDeferreds).done(function () {
          _.each(_.toArray(arguments), function (relatedObjects) {
            _.each(relatedObjects, function (relObj) {
              var type = relObj.binding.instance.type;
              var weight = relevantTypes[type].weight;
              if (relObj.instance.id !== that.id) {
                if (connectionsCount[relObj.instance.id] === undefined) {
                  connectionsCount[relObj.instance.id] = {
                    count: weight,
                    object: relObj
                  };
                } else {
                  connectionsCount[relObj.instance.id].count += weight;
                }
              }
            });
          });
          relatable.resolve(
            _.map(_.sortBy(_.filter(connectionsCount, function (item) {
              if (item.count >= threshold) {
                return item;
              }
            }), 'count').reverse(),
              function (item) {
                return item.object;
              }));
        });
      });
      return relatable;
    }
  });

  /**
   * A mixin to use for objects that can have a time limit imposed on them.
   *
   * @class CMS.Models.Mixins.timeboxed
   */
  can.Model.Mixin('timeboxed', {
    'extend:attributes': {
      start_date: 'date',
      end_date: 'date'
    },

    // Override default CanJS's conversion/serialization of dates, because
    // that takes the browser's local timezone into account, which we do not
    // want with our UTC dates. Having plain UTC-formatted date strings is
    // more suitable for the current structure of the app.
    serialize: {
      date: function (val, type) {
        return val;
      }
    },

    convert: {
      date: function (val, oldVal, fn, type) {
        return val;
      }
    }
  }, {
  });
})(this.can);
