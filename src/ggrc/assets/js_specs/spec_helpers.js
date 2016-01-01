/*!
 Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
 Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 Created By: swizec@reciprocitylabs.com
 Maintained By: brad@reciprocitylabs.com
 */

/*
 * Generally useful helpers
 * Primarily to support Jasmine 1.3 -> Jasmine 2
 */

// polls check function and calls done when truthy
function waitsFor(check, done) {  // eslint-disable-line no-unused-vars
  if (!check()) {
    setTimeout(function () {
      waitsFor(check, done);
    }, 1);
  } else {
    done();
  }
}

// This is primarily useful for passing as the fail case for
//  promises, since every item passed to it will show up in
//  the jasmine output.
window.failAll = function (done) {
  return function () {
    can.each(arguments, function (arg) {
      fail(JSON.stringify(arg));
    });
    if (done) {
      done();
    }
  };
};
