/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

(function (GGRC, can) {
  'use strict';

  /**
   * A helper function for computing the difference between the two Revisions
   * of an object.
   *
   * The function assumes that the given revisions are two distinct Revisions
   * of the same object (application entity).
   *
   * NOTE: The object fields that do not have a user-friendly alias defined are
   * considered "internal", and are thus not included in the resulting diff
   * objects, because they are not meant to be shown to the end user.
   *
   * @param {CMS.Models.Revision} rev1 - the older of the two revisions
   * @param {CMS.Models.Revision} rev2 - the newer of the two revisions
   *
   * @return {Array} - A "diff" object describing the changes between the
   *   revisions. The object has the following attributes:
   *   - madeBy: the user who made the changes
   *   - updatedAt: the time when the changes have been made
   *   - changes:
   *       A list of objects describing the modified attributes of the
   *       instance`, with each object having the following attributes:
   *         - fieldName: the name of the changed`instance` attribute
   *         - origVal: the attribute's original value
   *         - newVal: the attribute's new (modified) value
   */
  function revisionDiff(rev1, rev2) {
    var diff = {
      madeBy: null,
      updatedAt: null,
      changes: []
    };
    var attrDefs = GGRC.model_attr_defs[rev2.resource_type];

    diff.madeBy = 'User ' + rev2.modified_by.id;
    diff.updatedAt = rev2.updated_at;

    can.each(rev2.content, function (value, fieldName) {
      var origVal = rev1.content[fieldName];
      var displayName;
      if (attrDefs) {
        displayName = (_.find(attrDefs, function (attr) {
          return attr.attr_name === fieldName;
        }) || {}).display_name;
      } else {
        displayName = fieldName;
      }

      if (displayName && value !== origVal) {
        diff.changes.push({
          fieldName: displayName,
          origVal: origVal,
          newVal: value
        });
      }
    });

    return diff;
  }

  /**
   * Compute the the history of changes for the given object.
   *
   * The computed list of changes is sorted from oldest to newest (the helper
   * assumes that the `instance`'s revision history is also sorted
   * chronologically with the oldest Revision first).
   *
   * The helper creates a new Mustache context containing the `objectChanges`
   * attribute. That attribute is list of "diff" objects representing the
   * differences between the pairs of two successive Revisions of the
   * `instance`. The diff objects follow the format returned by the
   * `caclulateDiff` helper function.
   *
   * Example usage of the helper in a mustache template:
   *
   *   {{#revisions_diff instance}}
   *     {{#objectChanges}}
   *       ...
   *     {{/objectChanges}}
   *   {{/revision_diff}}
   *
   * @param {can.Model.Cacheable} instance - an application entity instance
   * @param {Object} options - a CanJS options argument passed to every helper
   *
   * @return {String} - the rendered instance history log
   *
   */
  function calculateRevisionsDiff(instance, options) {
    var diff;
    var diffList = [];
    var i;
    var newContext;

    var instResolved = Mustache.resolve(instance);

    var revisions = instResolved.get_mapping('revision_history');
    revisions = _.map(revisions, 'instance');

    // Only operate on the list if the Revision history has been fully
    // fetched from the server (and not just the Revision objects stubs).
    if ((revisions.length > 0) && revisions[0].content) {
      for (i = 1; i < revisions.length; i++) {
        diff = revisionDiff(revisions[i - 1], revisions[i]);
        diffList.push(diff);
      }
    }

    newContext = options.contexts.add({
      objectChanges: diffList
    });

    return options.fn(newContext);
  }

  /**
   * A component that calculates and renders the given Model object's revision
   * history.
   */
  GGRC.Components('objectHistory', {
    tag: 'revision-log',

    template: can.view(
      GGRC.mustache_path +
      '/components/object_history/object_history.mustache'
    ),

    scope: {
      instance: null
    },

    helpers: {
      revisions_diff: calculateRevisionsDiff
    }
  });
})(window.GGRC, window.can);
