/*!
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: ivan@reciprocitylabs.com
  Maintained By: ivan@reciprocitylabs.com
*/

describe('GGRC.Components.inlineEdit', function () {
  'use strict';

  var Component;  // the component under test

  beforeAll(function () {
    Component = GGRC.Components.get('inlineEdit');
  });

  describe('rendering inline edit for different types', function () {
    var template;
    var frag;
    var types = [
      'checkbox',
      'input',
      'text',
      'dropdown'
    ];

    types.forEach(function (type) {
      it(type + ' component should be rendered', function () {
        template = can.view.mustache('<inline-edit type="' + type + '" />');
        frag = template({});
        frag = $(frag);
        expect(frag.find('inline-' + type).length).toEqual(1);
      });
    });
  });

  describe('component scope methods', function () {
    var $el;
    var ev;
    var scope;

    beforeEach(function () {
      ev = {
        preventDefault: jasmine.createSpy()
      };
      scope = new can.Map({
        context: {}
      });
    });

    describe('enableEdit() method', function () {
      var enableEdit;

      beforeEach(function () {
        enableEdit = Component.prototype.scope.enableEdit;
        enableEdit = enableEdit.bind(scope);
      });

      it('enters the edit mode if editing allowed', function () {
        scope.attr('context.isEdit', false);
        scope.attr('readonly', false);

        enableEdit(scope, $el, ev);
        expect(scope.attr('context.isEdit')).toEqual(true);
      });

      it('does not enter the edit mode if editing not allowed', function () {
        scope.attr('context.isEdit', false);
        scope.attr('readonly', true);

        enableEdit(scope, $el, ev);
        expect(scope.attr('context.isEdit')).toEqual(false);
      });
    });

    it('onCancel() exits edit mode', function () {
      var onCancel = Component.prototype.scope.onCancel;
      scope.attr('context.isEdit', true);

      onCancel.call(scope, scope, $el, ev);
      expect(scope.attr('context.isEdit')).toEqual(false);
    });
  });

  describe('component init()', function () {
    var scope;
    var instance;
    var method;
    var componentInst;

    beforeAll(function () {
      method = Component.prototype.init;
    });
    beforeEach(function () {
      instance = new can.Map({
        title: 'Hello world',
        toggle: true,
        dropdown: ''
      });
      scope = new can.Map({
        instance: instance,
        context: {
          isEdit: false
        }
      });
      componentInst = {
        scope: scope
      };
    });

    describe('sets values custom attribute checkbox', function () {
      beforeEach(function () {
        scope.attr('caId', 123);
        scope.attr('type', 'checkbox');
      });
      it('context.value should be false for 0', function () {
        scope.attr('value', '0');
        method.call(componentInst);
        expect(scope.attr('context.value')).toEqual(false);
      });
      it('context.value should be true for 1', function () {
        scope.attr('value', '1');
        method.call(componentInst);
        expect(scope.attr('context.value')).toEqual(true);
      });
    });
    describe('sets values checkbox', function () {
      beforeEach(function () {
        scope.attr('type', 'checkbox');
        scope.attr('property', 'toggle');
      });
      it('context.value should be false', function () {
        scope.attr('instance.toggle', false);
        method.call(componentInst);
        expect(scope.attr('context.value')).toEqual(false);
      });
      it('context.value should be true', function () {
        scope.attr('instance.toggle', true);
        method.call(componentInst);
        expect(scope.attr('context.value')).toEqual(true);
      });
    });
    describe('sets values dropdown', function () {
      beforeEach(function () {
        scope.attr('property', 'dropdown');
      });
      it('context.values should be list when string', function () {
        var options = 'a,b,c,d';
        scope.attr('values', options);
        method.call(componentInst);
        expect(scope.attr('context.values').serialize())
          .toEqual(['a', 'b', 'c', 'd']);
      });
      it('context.values should be list when string', function () {
        var options = ['a', 'b', 'c', 'd'];
        scope.attr('values', options);
        method.call(componentInst);

        expect(scope.attr('context.values').serialize())
          .toEqual(['a', 'b', 'c', 'd']);
      });
    });
  });
});
