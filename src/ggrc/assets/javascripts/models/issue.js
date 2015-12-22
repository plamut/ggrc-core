/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: anze@reciprocitylabs.com
    Maintained By: anze@reciprocitylabs.com
*/
;(function(can) {

  can.Model.Cacheable("CMS.Models.Issue", {
    root_object : "issue",
    root_collection : "issues",
    findOne : "GET /api/issues/{id}",
    findAll : "GET /api/issues",
    update : "PUT /api/issues/{id}",
    destroy : "DELETE /api/issues/{id}",
    create : "POST /api/issues",
    mixins : ["ownable", "contactable"],
    is_custom_attributable: true,
    attributes : {
      context : "CMS.Models.Context.stub",
      modified_by : "CMS.Models.Person.stub",
      custom_attribute_values : "CMS.Models.CustomAttributeValue.stubs",
      start_date: "date",
      end_date: "date"
    },
    tree_view_options : {
      attr_list : can.Model.Cacheable.attr_list.concat([
        {attr_title: 'URL', attr_name: 'url'},
        {attr_title: 'Reference URL', attr_name: 'reference_url'}
      ])
    },
    init : function() {
      this._super && this._super.apply(this, arguments);
      this.validateNonBlank("title");
    }
  }, {
    object_model: can.compute(function() {
      return CMS.Models[this.attr("object_type")];
    }),
  });

})(this.can);
