/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $) {
  can.Component.extend({
    tag: 'paginate',
    template: can.view(GGRC.mustache_path + '/base_objects/paginate.mustache'),
    scope: {
      list: null,
      current: 0,
      /**
        * Current page
        *
        * Returns current page, array is zero indexed so we are adding one,
        * to be more human readable
        *
        * @return {Number} - Number of current page
        */
      currentPage: function () {
        return this.attr('current') + 1;
      },
      /**
        * Sets previous page
        *
        * @param {Object} scope - current page context
        * @param {jQuery.Object} el - clicked element
        * @param {Object} ev - click event handler
        */
      setPrevious: function (scope, el, ev) {
        var current = this.attr('current') - 1;

        ev.preventDefault();
        if (current >= 0) {
          this.attr('current', current);
        }
      },
      /**
        * Sets next page
        *
        * @param {Object} scope - current page context
        * @param {jQuery.Object} el - clicked element
        * @param {Object} ev - click event handler
        */
      setNext: function (scope, el, ev) {
        var current = this.attr('current') + 1;
        var total = this.attr('totalPages');

        ev.preventDefault();
        if (current < total) {
          this.attr('current', current);
        }
      },
      perPage: '@',
      /**
        * List of currently displayed enteries
        *
        * We are slicing input list into parts and passing them to enteries
        *
        * @return {Array} - List of enteries for current page
        */
      entries: function () {
        var list = this.attr('list');
        var perPage = Number(this.attr('perPage'));
        var current = this.attr('current');

        return list.slice(current * perPage, current * perPage + perPage);
      },
      /**
        * Get list of pages
        *
        * @return {Array} - List of pagination objects
        *                   {
        *                     number: `Display page - we are adding 1 to avoid having page 0`
        *                     pageNum: `True page number that gets passed to setPage function`
        *                   }
        */
      totalPages: function () {
        var list = this.attr('list');
        var perPage = Number(this.attr('perPage'));

        return Math.ceil(list.length / perPage);
      }
    }
  });
})(window.can, window.can.$);
