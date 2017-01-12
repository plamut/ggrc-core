/*!
  Copyright (C) 2017 Google Inc.
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

describe('GGRC.Controllers.SpinnerInjector', function () {
  'use strict';

  var Ctrl;  // the control under test

  beforeAll(function () {
    Ctrl = GGRC.Controllers.SpinnerInjector;
  });

  describe('inject() method', function () {
    var ctrlInst;  // fake control instance
    var inject;
    var $container;

    beforeEach(function () {
      function CtrlMock() {}

      CtrlMock.prototype.remove = jasmine.createSpy();
      CtrlMock.SPINNER_TEMPLATE = '<div id="fakeSpinner"></div>';

      ctrlInst = new CtrlMock();
      inject = Ctrl.prototype.inject.bind(ctrlInst);

      $container = $('<div id="contaner"></div>');
    });

    it('inserts spinner into the given container', function () {
      inject($container);
      expect($container.find('#fakeSpinner').length).toEqual(1);
    });

    it('removes previously inserted spinner from the DOM', function () {
      var $anotherContainer = $('<div id="anotherContaner"></div>');
      var $existingSpinner = $('<div id="existingSpinner"></div>');

      $anotherContainer.append($existingSpinner);
      ctrlInst.$spinner = $existingSpinner;

      ctrlInst.remove.and.callFake(function () {
        $existingSpinner.remove();
      });

      inject($container);

      expect($anotherContainer.find('#existingSpinner').length).toEqual(0);
    });
  });

  describe('remove() method', function () {
    var ctrlInst;  // fake control instance
    var remove;
    var $container;
    var $spinner;

    beforeEach(function () {
      ctrlInst = {};
      remove = Ctrl.prototype.remove.bind(ctrlInst);

      $container = $('<div id="contaner"></div>');
      $spinner = $('<div id="spinner"></div>');
      $container.append($spinner);
    });

    it('removes the existing spinner from the DOM', function () {
      ctrlInst.$spinner = $spinner;
      remove();
      expect($container.find('#spinner').length).toEqual(0);
      expect(ctrlInst.$spinner).toBeFalsy();
    });
  });
});
