/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('CMS.Controllers.TreeViewNode', function () {
  'use strict';

  var Ctrl;  // the controller under test

  beforeAll(function () {
    Ctrl = CMS.Controllers.TreeViewNode;
  });

  describe('draw_node() method', function () {
    var ctrlInst;  // fake controller instance
    var ifNotRemovedResult;  // fake return value of the _ifNotRemoved() method
    var method;
    var $element;

    beforeEach(function () {
      ifNotRemovedResult = {};
      $element = $('<div></div>');

      ctrlInst = {
        options: new can.Map({
          show_view: '/foo/bar.mustache'
        }),
        element: $element,
        _draw_node_in_progress: false,
        _draw_node_deferred: new can.Deferred(),
        add_child_lists_to_child: jasmine.createSpy(),
        _ifNotRemoved: jasmine.createSpy().and.returnValue(ifNotRemovedResult),
        replace_element: jasmine.createSpy()
      };

      method = Ctrl.prototype.draw_node.bind(ctrlInst);

      spyOn(can, 'view');
    });

    it('doesn\'t render if DOM element is null', function () {
      ctrlInst.element = undefined;
      expect(method()).toBe(undefined);
    });

    it('renders the DOM element with the "active" CSS class if node active',
      function () {
        var callArgs;
        var callback;

        ctrlInst.options.attr('isActive', false);
        ctrlInst.options.attr('disable_lazy_loading', true);
        $element.addClass('active');

        method();

        expect(can.view).toHaveBeenCalledWith(
          '/foo/bar.mustache',
          ctrlInst.options,
          ifNotRemovedResult
        );

        expect(ctrlInst._ifNotRemoved).toHaveBeenCalled();
        callArgs = ctrlInst._ifNotRemoved.calls.mostRecent().args;
        callback = callArgs[0];

        // simulate invoking the callback and observe the effect
        $element.removeClass('active');
        callback();

        expect(ctrlInst.element.hasClass('active')).toBe(true);
      }
    );

    it('renders the DOM element without the "active" CSS class if ' +
      'node not active',
      function () {
        var callArgs;
        var callback;

        ctrlInst.options.attr('isActive', false);
        ctrlInst.options.attr('disable_lazy_loading', true);
        $element.removeClass('active');  // make sure it is indeed inactive

        method();

        expect(can.view).toHaveBeenCalledWith(
          '/foo/bar.mustache',
          ctrlInst.options,
          ifNotRemovedResult
        );

        expect(ctrlInst._ifNotRemoved).toHaveBeenCalled();
        callArgs = ctrlInst._ifNotRemoved.calls.mostRecent().args;
        callback = callArgs[0];

        // simulate invoking the callback and observe the effect
        callback();

        expect(ctrlInst.element.hasClass('active')).toBe(false);
      }
    );
  });

  describe('expand() method', function () {
    var ctrlInst;  // fake controller instance
    var displaySubtreesDfd;
    var method;
    var $tree;

    beforeEach(function () {
      $tree = $([
        '<li class="tree-item">',
        '  <div>',
        '    <div class="openclose"></div>',
        '  </div>',
        '</li>'
      ].join(''));

      displaySubtreesDfd = new can.Deferred();

      ctrlInst = {
        element: $tree,
        options: new can.Map({
          show_view: '/foo/bar.mustache'
        }),
        _ifNotRemoved: jasmine.createSpy().and.callFake(function (callback) {
          return callback;
        }),
        display_subtrees:
          jasmine.createSpy().and.returnValue(displaySubtreesDfd)
      };

      method = Ctrl.prototype.expand.bind(ctrlInst);
    });

    it('triggers displaying the subtrees if currently not expanded',
      function (done) {
        // the node has been expanded before...
        ctrlInst._expand_deferred = new can.Deferred();

        // ...but it's currently not expanded
        $tree.find('.openclose').removeClass('active');

        method();

        setTimeout(function () {
          expect(ctrlInst.display_subtrees).toHaveBeenCalled();
          done();
        }, 10);
      }
    );
  });
});
