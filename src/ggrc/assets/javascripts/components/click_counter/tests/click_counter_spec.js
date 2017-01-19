/*!
  Copyright (C) 2017 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Components.clickCounter', function () {
  'use strict';

  var Component;  // the component under test
  var method;  // the method under test
  var vm;  // fake viewmodel
  var result;

  beforeAll(function () {
    Component = GGRC.Components.get('clickCounter');
  });

  describe('inflatedStats() method', function () {
    beforeEach(function () {
      vm = new can.Map({
        count: 0
      });
      method = Component.prototype.viewModel.inflatedStats.bind(vm);
    });

    it('returns double the amount of actual clicks', function () {
      vm.attr('count', 7);
      result = method();
      expect(result).toEqual(14);
    });
  });

  describe('_updateCount() method', function () {
    beforeEach(function () {
      vm = new can.Map({
        count: 0
      });
      method = Component.prototype.viewModel._updateCount.bind(vm);
    });

    it('increments the current click count by one', function () {
      vm.attr('count', 8);
      result = method();
      expect(vm.attr('count')).toEqual(9);
    });
  });

  // component "integration" tests
  describe('DOM interactions', function () {
    var $rootNode;

    beforeEach(function () {
      var template = [
        '<click-counter-wrapper>',
        '  <click-counter count="initialClickCount"></click-counter>',
        '</click-counter-wrapper>'
      ].join('');

      var renderer = can.view.mustache(template);
      var docFragment = renderer({});

      $rootNode = $(docFragment).find('click-counter-wrapper');
    });

    afterEach(function () {
      $rootNode.remove();
    });

    it('initially displays 5 real clicks', function () {
      var $label = $rootNode.find('label.real');
      var text = $label.text();
      expect(text).toEqual('Total clicks: 5');
    });

    it('updates the count info labels on button click', function () {
      var $labelReal = $rootNode.find('label.real');
      var $labelFake = $rootNode.find('label.fake');
      var $button = $rootNode.find('.clickable');

      $button.click();

      expect($labelReal.text()).toEqual('Total clicks: 6');
      expect($labelFake.text()).toEqual('Faked clicks: 12');
    });
  });
});
