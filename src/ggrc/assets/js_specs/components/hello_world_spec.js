/*
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

GGRC.Components = GGRC.Components || {};

GGRC.Components.hello = can.Component.extend({
  tag: 'hello-world',
  template: [
    '<div>',
    '  {{#if visible}}{{message}}{{else}}Click me{{/if}}',
    '  <ul>',
    '    <li class="li-foo">foo</li>',
    '    <li class="li-bar">bar</li>',
    '  </ul>',
    '</div>'
  ].join(''),
  scope: {
    visible: false,
    message: 'Hello There!'
  },
  events: {
    click: function () {
      console.log('hello-world component onclick');
      this.scope.attr('visible', !this.scope.attr('visible'));
    },

    'li[class="li-foo"] click': function () {
      console.log('<li> with class li-foo clicked!');
      this.scope.attr('fooClicked', 111);
    }
  }
});

describe('TEST CANJS COMPONENT', function () {
  var $el;
  var inst;  // instance of the component

  beforeEach(function () {
    var hookupOptions = {
      tagName: 'my-component',
      options: new can.view.Scope(),
      scope: new can.view.Scope()
    };

    $el = $('<p>JUHUHU</p>');
    // $('body').append($el);  // seems like this is not even needed?
                               // In this particular case at least...

    inst = new GGRC.Components.hello($el[0], hookupOptions);
  });

  it('initializes scope message to Hello There', function () {
    expect(inst.scope.attr('message')).toEqual('Hello There!');
  });

  it('toggles visibility on click', function () {
    expect(inst.scope.attr('visible')).toBe(false);
    $el.click();
    expect(inst.scope.attr('visible')).toBe(true);
    $el.click();
    expect(inst.scope.attr('visible')).toBe(false);
  });

  it('clicks the li[class="li-foo"]', function () {
    expect(inst.scope.attr('fooClicked')).toBeUndefined();
    $el.find('[class="li-foo"]').click();
    expect(inst.scope.attr('fooClicked')).toEqual(111);
  });
});
