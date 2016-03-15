/*
  Copyright (C) 2016 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

(function () {

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
    //'helper: {{#if_string "aaa"}}this string{{else}}NOT STRING{{/if_string}}',
    'helper: {{helper_foo}}',  // TODO: local helpers don't work! Booo!
                              // maybe call can.view.render(template)
                              // and invoke component with this rendered template?
    'foo: {{bar_xy}}',
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
  },

  // TODO: the problem - cannot use local helpers! scope is empty!
  helpers: {
    helper_foo: function () {
      console.log('local helper_foo invoked!!!');
      return 'FOO HELPER WORKS';
    }
  },

  init: function () {
    // debugger;
    console.log('This is INIIIIT');
  }
});

describe('TEST CANJS COMPONENT', function () {
  var $el;
  var inst;  // instance of the component

  beforeEach(function () {
    var hookupOptions = {
      tagName: 'hello-world',
      options: new can.view.Scope(),
      scope: new can.view.Scope()
    };


    var helpers = GGRC.Components.hello.prototype.helpers;
    var scope = GGRC.Components.hello.prototype.scope;
    var events = GGRC.Components.hello.prototype.events;
    // scope.helper_foo = helpers.helper_foo;   // hack, but should work?


    var renderer = can.view.mustache('<hello-world>JUHUHU</hello-world>');
    window._haha = renderer({});  // or pass any other scope

    //debugger;
    $('body').append(window._haha);

    //$el = $('<p>JUHUHU</p>');
    // $el = $('<hello-world>JUHUHU</hello-world>');
    // $('body').append($el);  // seems like this is not even needed?
    //                            // In this particular case at least...

    // now do the usual stuff... get scope, click etc...

    // debugger;
    // var template = can.view.mustache("<hello-world>JUH22</hello-world>");
    // var result = template({bar_xy:'TRALALA'});
    // $('body').append(result);

    // var myc = $('body hello-world');
    // var scope = myc.scope();  // <----- this!
        // also works myc.click() etc.

    // ampak kako do helperjev in vsega?? to se pa ne da?
    // druga možnost je direktno instanco ustvariti, ampak
    // lokalni helperji ne delajo...
    // delajo pa globalni?

    // inst = new GGRC.Components.hello($el[0], hookupOptions);
  });

  afterEach(function () {
    debugger;
    var $e = $('body hello-world');
    $e.remove();
  });

  it('initializes scope message to Hello There', function () {
    debugger;
    var $el = $('body hello-world');
    var scope = $el.scope();

    // now do stuff like $el.click, inspect generated DOM, unit-test handlers
    // through the COmponent.prototype.handlers etc.

    expect(scope.attr('message')).toEqual('Hello There!');
  });

  xit('toggles visibility on click', function () {
    expect(inst.scope.attr('visible')).toBe(false);
    $el.click();
    expect(inst.scope.attr('visible')).toBe(true);
    $el.click();
    expect(inst.scope.attr('visible')).toBe(false);
  });

  xit('clicks the li[class="li-foo"]', function () {
    expect(inst.scope.attr('fooClicked')).toBeUndefined();
    $el.find('[class="li-foo"]').click();
    expect(inst.scope.attr('fooClicked')).toEqual(111);
  });
});


})();
