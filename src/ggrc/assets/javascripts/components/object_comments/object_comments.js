/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

(function (GGRC, can) {
  'use strict';

  /**
   * A component that displays the comments related to the given Model object.
   */
  GGRC.Components('objectComments', {
    tag: 'comments',

    template: can.view(
      GGRC.mustache_path +
      '/components/object_comments/object_comments.mustache'
    ),

    scope: {},

    /**
     * The component's entry point. Invoked when a new component instance has
     * been created.
     *
     * @param {Object} element - the (unwrapped) DOM element that triggered
     *   creating the component instance
     * @param {Object} options - the component instantiation options
     */
    init: function (element, options) {
      console.log('objectComments component instantiated');
    }
  });
})(window.GGRC, window.can);
