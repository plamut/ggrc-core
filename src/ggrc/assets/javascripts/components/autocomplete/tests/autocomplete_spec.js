/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Components.autocomplete', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('autocomplete');
  });

  describe('defining default scope values', function () {
    var scope;

    beforeAll(function () {
      scope = Component.prototype.scope;
    });

    it('sets the automappingOff flag to true', function () {
      expect(scope().automappingOff).toBe(true);
    });
  });

  describe('item selected event handler', function () {
    var eventData;
    var eventObj;
    var fakeViewModel;
    var handler;  // the event handler under test
    var $childInput;
    var $element;

    beforeEach(function () {
      fakeViewModel = new can.Map({});
      handler = Component.prototype.events['autocomplete:select'].bind({
        viewModel: fakeViewModel
      });

      eventData = {
        item: {id: 123, type: 'Foo'}
      };
      eventObj = $.Event('autocomplete:select');

      $element = $('<div></div>');
      spyOn($element, 'triggerHandler');

      $childInput = $('<input></input>');
      $element.append($childInput);

      // the $element needs to be added to the DOM to test its focus
      $('body').append($element);
    });

    afterEach(function () {
      $element.remove();
    });

    it('triggers the item-selected event with the selected item object as ' +
      'the event argument',
      function () {
        handler($element, eventObj, eventData);

        expect($element.triggerHandler).toHaveBeenCalledWith({
          type: Component.prototype._EV_ITEM_SELECTED,
          selectedItem: {id: 123, type: 'Foo'}
        });
      }
    );

    it('emits the item-selected event using the dispatch mechanism',
      function () {
        spyOn(fakeViewModel, 'dispatch');

        handler($element, eventObj, eventData);

        expect(fakeViewModel.dispatch).toHaveBeenCalledWith({
          type: 'itemSelected',
          selectedItem: {id: 123, type: 'Foo'}
        });
      }
    );

    it('removes focus from the input element', function () {
      $childInput.focus();
      handler($element, eventObj, eventData);
      expect(document.activeElement).not.toBe($childInput[0]);
    });
  });
});
