/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

can.Model.LocalStorage('GGRC.Models.RecentlyViewedObject', {
  newInstance: function (attrs) {
    var title;
    if (attrs instanceof can.Model) {
      title = (attrs.title && attrs.title.trim()) ||
        (attrs.name && attrs.name.trim()) ||
        (attrs.email && attrs.email.trim());
      return new this({
        type: attrs.constructor.shortName,
        model: attrs.constructor,
        viewLink: attrs.viewLink,
        title: title
      });
    }
    return this._super(attrs);
  }
}, {
  init: function () {
    this.attr('model', GGRC.Models[this.type] || CMS.Models[this.type]);
  },
  stub: function () {
    return can.extend(this._super(), {
      title: this.title,
      viewLink: this.viewLink
    });
  }
});
