/*!
    Copyright (C) 2014 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (can) {
  can.Construct('can.Model.Mixin', {
    extend: function (fullName, klass, proto) {
      var tempname;
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
      can.getObject('CMS.Models.Mixins' +
        (parts.length ? '.' + parts.join('.') : ''),
        window, true)[shortName] = Constructor;
      return Constructor;
    },
    newInstance: function () {
      throw new Error('Mixins cannot be directly instantiated');
    },
    add_to: function (cls) {
      var setupfns;
      if (this === can.Model.Mixin) {
        throw new Error(
          'Must only add a subclass of Mixin to an object, not Mixin itself');
      }
      setupfns = function (obj) {
        return function (fn, key) {
          var oldfn;
          var blockedKeys = ['fullName', 'defaults', '_super', 'constructor'];
          var aspect = ~key.indexOf(':') ?
            key.substr(0, key.indexOf(':')) : 'after';
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

        can.each(this, setupfns(cls));
        can.each(this.prototype, setupfns(cls.prototype));
      }
    }
  }, {});

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
      if (!this.contact) {
        this.attr('contact', {id: GGRC.current_user.id, type: 'Person'});
      }
    },
    form_preload: function (new_object_form) {
      if (new_object_form && !this.contact) {
        this.attr('contact', {id: GGRC.current_user.id, type: 'Person'});
      }
    }
  });

  can.Model.Mixin('unique_title', {
    'after:init': function () {
      this.validate(['title', '_transient:title'], function (newVal, prop) {
        if (prop === 'title') {
          return this.attr('_transient:title');
        } else if (prop === '_transient:title') {
          return newVal; // the title error is the error
        }
      });
    }
  }, {
    save_error: function (e) {
      if (/title values must be unique\.$/.test(e)) {
        this.attr('_transient:title', e);
      }
    },
    after_save: function () {
    // Currently we do not have a way of searching for similarly
    //  titled objects through the search API or the declarative
    //  model layer, but it's recommended that we show users when
    //  a name for an object is too similar to ones already in the
    //  system.  --BM 5/2/2014

    // var that = this
    // , search_params = {
    //   q: this.title
    // , counts_only: true
    // };
    // if (this._last_search === undefined || this._last_search !== this.title) {
    //   this._last_search = this.title; // remember last search term
    //   $.get('/search', search_params).done(function(data) {
    //     var count = data.results.counts[that.constructor.model_singular] - 1;
    //     if(count > 0) {
    //       $(document.body).trigger("ajax:flash", {
    //         warning : "Warning: your "
    //           + that.constructor.title_singular
    //           + " title '"
    //           + that.title
    //           + "' is similar to "
    //           + count
    //           + " other title"
    //           + (count === 1 ? "" : "s")
    //       });
    //     }
    //   });
    // }
      this.removeAttr('_transient:title');
    },
    'before:attr': function (key, val) {
      if (key === 'title' && arguments.length > 1) {
        this.attr('_transient:title', null);
      }
    }
  });
})(this.can);
