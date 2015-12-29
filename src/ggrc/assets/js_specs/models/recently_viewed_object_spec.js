/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: silas@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

describe('can.Model.RecentlyViewedObjects', function () {
  describe('::newInstance', function () {
    it('creates a new recently viewed object given non-Model instance',
      function () {
        var obj = GGRC.Models.RecentlyViewedObject.newInstance({foo: 'bar'});
        expect(obj.foo).toBe('bar');
        expect(obj instanceof GGRC.Models.RecentlyViewedObject).toBeTruthy();
      }
    );

    it('references original Model type when passed in as argument',
      function () {
        var obj;
        var rvoObj;

        spyOn(GGRC.Models.RecentlyViewedObject.prototype, 'init');
        can.Model('RVO');
        obj = new window.RVO({
          viewLink: '/',
          title: 'blah'
        });

        rvoObj = GGRC.Models.RecentlyViewedObject.newInstance(obj);
        expect(rvoObj.type).toBe('RVO');
        expect(rvoObj.model).toBe(window.RVO);
        expect(rvoObj.viewLink).toBe('/');
        expect(rvoObj.title).toBe('blah');
      }
    );
  });

  describe('#stub', function () {
    it('include title and view link', function () {
      var obj = {
        viewLink: '/',
        title: 'blah'
      };
      var rvoObj = new GGRC.Models.RecentlyViewedObject(obj).stub();

      expect(rvoObj.title).toBe('blah');
      expect(rvoObj.viewLink).toBe('/');
      expect(rvoObj.id).not.toBeDefined();
    });
  });
});
