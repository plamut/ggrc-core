/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (ns, can) {
  can.Model.Cacheable('CMS.Models.Person', {
    root_object: 'person',
    root_collection: 'people',
    category: 'entities',
    findAll: 'GET /api/people',
    findOne: 'GET /api/people/{id}',
    create: 'POST /api/people',
    update: 'PUT /api/people/{id}',
    destroy: 'DELETE /api/people/{id}',
    search: function (request, response) {
      return $.ajax({
        type: 'get',
        url: '/api/people',
        dataType: 'json',
        data: {s: request.term},
        success: function (data) {
          response($.map(data, function (item) {
            return can.extend({}, item.person, {
              label: item.person.email,
              value: item.person.id
            });
          }));
        }
      });
    },
    is_custom_attributable: true,
    attributes: {
      context: 'CMS.Models.Context.stub',
      modified_by: 'CMS.Models.Person.stub',
      object_people: 'CMS.Models.ObjectPerson.stubs',
      language: 'CMS.Models.Option.stub',
      user_roles: 'CMS.Models.UserRole.stubs',
      name: 'trimmed',
      email: 'trimmedLower',
      custom_attribute_values: 'CMS.Models.CustomAttributeValue.stubs'
    },
    defaults: {
      name: '',
      email: '',
      contact: null,
      owners: null
    },
    convert: {
      trimmed: function (val) {
        return (val && val.trim) ? val.trim() : val;
      },
      trimmedLower: function (val) {
        return ((val && val.trim) ? val.trim() : val).toLowerCase();
      }
    },
    serialize: {
      trimmed: function (val) {
        return (val && val.trim) ? val.trim() : val;
      },
      trimmedLower: function (val) {
        return ((val && val.trim) ? val.trim() : val).toLowerCase();
      }
    },
    findInCacheByEmail: function (email) {
      var result = null;
      var that = this;
      can.each(Object.keys(this.cache || {}), function (k) {
        if (that.cache[k].email === email) {
          result = that.cache[k];
          return false;
        }
      });
      return result;
    },
    tree_view_options: {
      show_view: GGRC.mustache_path + '/people/tree.mustache',
      header_view: GGRC.mustache_path + '/people/tree_header.mustache',
      footer_view: GGRC.mustache_path + '/people/tree_footer.mustache',
      add_item_view: GGRC.mustache_path + '/people/tree_add_item.mustache'
    },
    list_view_options: {
      find_params: {
        __sort: 'name,email'
      }
    },
    init: function () {
      var rEmail = /^[-!#$%&\'*+\\.\/0-9=?A-Z^_`{|}~]+@([-0-9A-Z]+\.)+([0-9A-Z]){2,4}$/i;
      this._super.apply(this, arguments);

      this.validateNonBlank('email');
      this.validateFormatOf('email', rEmail);
    }
  }, {
    display_name: function () {
      return this.email;
    },
    autocomplete_label: function () {
      return this.name ? this.name + ' <span class="url-link">' + this.email + '</span>' : this.email;
    }
  });
})(this, can);
