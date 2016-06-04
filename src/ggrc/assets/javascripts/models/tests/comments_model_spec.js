/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: ivan@reciprocitylabs.com
  Maintained By: ivan@reciprocitylabs.com
*/

describe('CMS.Models.Comment', function () {
  'use strict';

  describe('updateDescription() method', function () {
    var comment;
    var dfdSave;
    var eventObj;
    var method;
    var $element;
    var $fakeBody;

    beforeEach(function () {
      $element = $('<div />');
      comment = new CMS.Models.Comment();
      method = comment.updateDescription.bind(comment);

      $fakeBody = {
        trigger: jasmine.createSpy()
      };
      spyOn(window, '$').and.returnValue($fakeBody);

      eventObj = $.Event('on-save');
      eventObj.oldVal = '';
      eventObj.newVal = '';

      spyOn(comment, 'refresh').and.returnValue(
        new can.Deferred().resolve());
      dfdSave = new can.Deferred();
      spyOn(comment, 'save').and.returnValue(dfdSave);
    });

    it('saves the instance\'s new description', function () {
      comment.attr('description', 'old description');
      eventObj.newVal = 'new description';

      method(comment, $element, eventObj);

      expect(comment.save).toHaveBeenCalled();
      expect(comment.attr('description')).toEqual('new description');
    });

    it('displays a success notification on success', function () {
      method(comment, $element, eventObj);
      dfdSave.resolve();
      expect($fakeBody.trigger).toHaveBeenCalledWith(
        'ajax:flash', {success: 'Saved.'}
      );
    });

    it('keeps the instance\'s original description on failure', function () {
      comment.attr('description', 'old description');
      eventObj.newVal = 'new description';
      eventObj.oldVal = 'old description';

      method(comment, $element, eventObj);
      dfdSave.reject('Server error');

      expect(comment.attr('description')).toEqual('old description');
    });

    it('displays an error notification on failure', function () {
      method(comment, $element, eventObj);
      dfdSave.reject('Server error');
      expect($fakeBody.trigger).toHaveBeenCalledWith(
        'ajax:flash', {error: 'There was a problem with saving.'}
      );
    });
  });
});
