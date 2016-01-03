/*!
    Copyright (C) 2014 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: laran@reciprocitylabs.com
    Maintained By: laran@reciprocitylabs.com
*/

(function (namespace, $) {
  /* function sortCustomAttributables
   *
   * Groups custom attributes by category.
   *
   */
  function sortCustomAttributables(a, b) {
    if (a.category < b.category) {
      return 1;
    } else if (a.category > b.category) {
      return -1;
    }
    return 0;
  }

  /* class CustomAttributable
   *
   * CustomAttributable does not query the backend, it is used to display a
   * list of objects in the custom attributes widget. It inherits from
   * cacheable because it needs getBinding to properly display
   * CustomAttributeDefinitions as children
   *
   */
  can.Model.Cacheable('CMS.Models.CustomAttributable', {
    findAll: function () {
      var types;
      types = GGRC.custom_attributable_types.sort(sortCustomAttributables);
      return $.when(can.map(types, function (m, i) {
        return new CMS.Models.CustomAttributable($.extend(m, {
          id: i
        }));
      }));
    }
  }, {
    // Cacheable checks if selfLink is set when the findAll deferred is done
    selfLink: '/custom_attribute_list'
  });

  can.Model.Cacheable('CMS.Models.CustomAttributeDefinition', {
    // static properties
    root_object: 'custom_attribute_definition',
    root_collection: 'custom_attribute_definitions',
    category: 'custom_attribute_definitions',
    findAll: 'GET /api/custom_attribute_definitions',
    findOne: 'GET /api/custom_attribute_definitions/{id}',
    create: 'POST /api/custom_attribute_definitions',
    update: 'PUT /api/custom_attribute_definitions/{id}',
    destroy: 'DELETE /api/custom_attribute_definitions/{id}',
    mixins: [],
    attributes: {
      values: 'CMS.Models.CustomAttributeValue.stubs',
      modified_by: 'CMS.Models.Person.stub'
    },
    links_to: {},
    defaults: {
      title: ''
    },
    init: function () {
      this.validateNonBlank('title');
      this._super.apply(this, arguments);
    }
  }, {
    init: function () {
      this._super.apply(this, arguments);
    }
  });

  can.Model.Cacheable('CMS.Models.CustomAttributeValue', {
    // static properties
    root_object: 'custom_attribute_value',
    root_collection: 'custom_attribute_values',
    category: 'custom_attribute_values',
    findAll: 'GET /api/custom_attribute_values',
    findOne: 'GET /api/custom_attribute_values/{id}',
    create: 'POST /api/custom_attribute_values',
    update: 'PUT /api/custom_attribute_values/{id}',
    destroy: 'DELETE /api/custom_attribute_values/{id}',
    mixins: [],
    attributes: {
      definition: 'CMS.Models.CustomAttributeDefinition.stub',
      modified_by: 'CMS.Models.Person.stub'
    },
    links_to: {},
    defaults: {
      title: ''
    },
    init: function () {
      this._super.apply(this, arguments);
    }
  }, {
    init: function () {
      this._super.apply(this, arguments);
    }
  });
})(this, can.$);
