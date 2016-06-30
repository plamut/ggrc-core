/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe('GGRC.Components.calculator', function () {
  'use strict';

  var Component;  // the component under test

  var $calculator;
  var origTimeoutInterval;

  beforeAll(function () {
    origTimeoutInterval = jasmine.DEFAULT_TIMEOUT_INTERVAL;  // 5 seconds
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 300 * 1000;

    Component = GGRC.Components.get('calculator');
  });

  afterAll(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = origTimeoutInterval;
  });

  // HOWTO: instantiating a component in a test
  beforeEach(function () {
    var renderer = can.view.mustache(
      '<calculator operator="settings.op"></calculator>');

    var htmlFragment = renderer({
      settings: {
        op: '-',
        foo: 'bar'
      }
    });

    $('body').append(htmlFragment);

    // we preferan actual jQuery object, and not just a document fragment
    $calculator = $('body').find('calculator');
  });

  afterEach(function () {
    $('calculator').remove();
  });

  describe('defining the scope', function () {
    var scope;

    beforeAll(function () {
      // A reference to the component's scope object can be obtained directly
      // from its prototype (the component itself is a function).
      scope = Component.prototype.scope;
    });

    it('sets the default operation to addition', function () {
      expect(scope.operator).toEqual('+');
    });

    it('provides a helper function for computations', function () {
      // just for the demo, you would probably not write such test in practice
      expect(typeof scope._compute).toEqual('function');
    });
  });

  // HOWTO: test a scope method
  describe('_addHistoryItem() method', function () {
    var method;
    var fakeScope;

    beforeAll(function () {
      method = Component.prototype.scope._addHistoryItem;
    });

    beforeEach(function () {
      fakeScope = new can.Map({
        resultsHistory: []
      });
      method = method.bind(fakeScope);  // <-- important
    });

    it('prepends the history list with the new item', function () {
      fakeScope.attr('resultsHistory', ['17 + 2.5 = 19.5']);
      method('*', 4.1, 5, 20.5);
      expect(fakeScope.resultsHistory.attr()).toEqual(
        ['4.1 * 5 = 20.5', '17 + 2.5 = 19.5']
      );
    });
  });

  // HOWTO: test DOM event handlers and DOM tree manipulations
  describe('toggling the hint text', function () {
    var scope;
    var $hintContainer;
    var $linkBtn;

    beforeEach(function () {
      scope = $calculator.scope();
      $linkBtn = $calculator.find('[name="btnResult"]');
      $hintContainer = $calculator.find('p.hint');
    });

    it('displays a hint when hovering over the calculate button', function () {
      var text;
      scope.attr('displayHint', false);

      $linkBtn.trigger('mouseover');

      text = $hintContainer.text().trim();
      expect(text).toEqual('Click the button to see the result.');
    });

    it('hides a hint when hovering out of the calculate button', function () {
      var text;
      scope.attr('displayHint', true);

      $linkBtn.trigger('mouseout');

      text = $hintContainer.text().trim();
      expect(text).toEqual('');
    });
  });

  // A trick to pause the test run, allowing us plenty of time to visually
  // explore the DOM tree and our component in the browser.
  it('just waits', function (done) {
    setTimeout(done, jasmine.DEFAULT_TIMEOUT_INTERVAL - 500);
  });
});
