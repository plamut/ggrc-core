/*!
    Copyright (C) 2016 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/


describe("display prefs model", function() {

  var display_prefs, exp;
  beforeAll(function() {
    display_prefs = new CMS.Models.DisplayPrefs();
    exp = CMS.Models.DisplayPrefs.exports;
  });

  afterEach(function() {
    display_prefs.removeAttr(window.location.pathname);
    display_prefs.isNew() || display_prefs.destroy();
  });

  describe("#init", function( ){
    it("sets autoupdate to true by default", function() {
      expect(display_prefs.autoupdate).toBe(true);
    });

  });

  describe("low level accessors", function() {
    beforeEach(function() {
      display_prefs.attr("foo", "bar");
    });

    afterEach(function() {
      display_prefs.removeAttr("foo");
      display_prefs.removeAttr("baz");
    });

    describe("#makeObject", function() {

      it("returns the model itself with no args", function() {
        expect(display_prefs.makeObject()).toBe(display_prefs);
      });

      it("returns an empty can.Observe when the key does not resolve to an Observable", function() {
        expect(display_prefs.makeObject("foo")).not.toBe("bar");
        var newval = display_prefs.makeObject("baz");
        expect(newval instanceof can.Observe).toBeTruthy();
        expect(newval.serialize()).toEqual({});
      });

      it("makes a nested path of can.Observes when the key has multiple levels", function() {
        var newval = display_prefs.makeObject("baz", "quux");
        expect(display_prefs.baz.quux instanceof can.Observe).toBeTruthy();
      });

    });

    describe("#getObject", function() {
      it("returns a set value whether or not the value is an Observe", function() {
        expect(display_prefs.getObject("foo")).toBe("bar");
        display_prefs.makeObject("baz", "quux");
        expect(display_prefs.getObject("baz").serialize()).toEqual({ "quux" : {}});
      });

      it("returns undefined when the key is not found", function(){
        expect(display_prefs.getObject("xyzzy")).not.toBeDefined();
      });
    });
  });

  describe("top nav", function () {
    afterEach(function() {
      display_prefs.resetPagePrefs();
      //display_prefs.removeAttr(exp.path);
    });

    describe("hiddenness", function () {
      it("sets nav hidden", function() {
        display_prefs.setTopNavHidden("this arg is ignored", true);
        expect(
          display_prefs.attr(exp.path).top_nav.is_hidden
        ).toBe(true);
      });

      it("gets nav hidden", function () {
        display_prefs.setTopNavHidden("this arg is ignored", true);

        expect(display_prefs.getTopNavHidden()).toBe(true);
      });

      it("returns false by default", function () {
        expect(display_prefs.getTopNavHidden()).toBe(false);
      });
    });

    describe("widget list", function () {
      it("sets widget list", function () {
        display_prefs.setTopNavWidgets("this arg is ignored", {a:1, b: 2});

        expect(
          display_prefs.attr(exp.path).top_nav.widget_list.serialize()
        ).toEqual({a: 1, b: 2});
      });

      it("gets widget list", function () {
        display_prefs.setTopNavWidgets("this arg is ignored", {a: 1, b: 2});

        expect(display_prefs.getTopNavWidgets()).toEqual({a: 1, b: 2});
      });

      it("returns {} by default", function () {
        expect(display_prefs.getTopNavWidgets()).toEqual({});
      });
    });
  });

   describe("filter hiding", function () {
     afterEach(function() {
       display_prefs.resetPagePrefs();
     });

     it("sets filter hidden", function() {
       display_prefs.setFilterHidden(true);

       expect(
         display_prefs.attr(exp.path).filter_widget.is_hidden
       ).toBe(true);
     });

     it("gets filter hidden", function () {
       display_prefs.setFilterHidden(true);

       expect(display_prefs.getFilterHidden()).toBe(true);
     });

     it("returns false by default", function () {
       expect(display_prefs.getFilterHidden()).toBe(false);
     });
   });


  describe("#setCollapsed", function() {
    afterEach(function() {
      display_prefs.removeAttr(exp.COLLAPSE);
      display_prefs.removeAttr(exp.path);
    });

    it("sets the collapse value for a widget", function() {
      display_prefs.setCollapsed("this arg is ignored", "foo", true);

      expect(display_prefs.attr([exp.path, exp.COLLAPSE, "foo"].join("."))).toBe(true);
    });
  });

  function getSpecs (func, token, fooValue, barValue) {
    var fooMatcher = typeof fooValue === "object" ? "toEqual" : "toBe";
    var barMatcher = typeof barValue === "object" ? "toEqual" : "toBe";

    return function() {
      function getTest() {
        var fooActual = display_prefs[func]("unit_test", "foo");
        var barActual = display_prefs[func]("unit_test", "bar");

        expect(fooActual.serialize ? fooActual.serialize() : fooActual)[fooMatcher](fooValue);
        expect(barActual.serialize ? barActual.serialize() : barActual)[barMatcher](barValue);
      }

      var exp_token;
      beforeEach(function() {
        exp_token = exp[token]; //late binding b/c not available when describe block is created
      });

      // TODO: figure out why these fail, error is "can.Map: Object does not exist thrown"
      describe("when set for a page", function() {
        beforeEach(function() {
          display_prefs.makeObject(exp.path, exp_token).attr("foo", fooValue);
          display_prefs.makeObject(exp.path, exp_token).attr("bar", barValue);
        });
        afterEach(function() {
          display_prefs.removeAttr(exp.path);
        });

        it("returns the value set for the page", getTest);
      });

      describe("when not set for a page", function() {
        beforeEach(function() {
          display_prefs.makeObject(exp_token, "unit_test").attr("foo", fooValue);
          display_prefs.makeObject(exp_token, "unit_test").attr("bar", barValue);
        });
        afterEach(function() {
          display_prefs.removeAttr(exp.path);
          display_prefs.removeAttr(exp_token);
        });

        it("returns the value set for the page type default", getTest);

        it("sets the default value as the page value", function() {
          display_prefs[func]("unit_test", "foo");
          var fooActual = display_prefs.attr([exp.path, exp_token, "foo"].join("."));
          expect(fooActual.serialize ? fooActual.serialize() : fooActual)[fooMatcher](fooValue);
        });
      });
    };
  }

  describe("#getCollapsed", getSpecs("getCollapsed", "COLLAPSE", true, false));

  describe("#getSorts", getSpecs("getSorts", "SORTS", ["baz, quux"], ["thud", "jeek"]));


  function setSpecs(func, token, fooValue, barValue) {
    return function() {
      var exp_token;
      beforeEach(function() {
        exp_token = exp[token];
      });
      afterEach(function() {
        display_prefs.removeAttr(exp_token);
        display_prefs.removeAttr(exp.path);
      });


      it("sets the value for a widget", function() {
        display_prefs[func]("this arg is ignored", "foo", fooValue);
        var fooActual  = display_prefs.attr([exp.path, exp_token, "foo"].join("."));
        expect(fooActual.serialize ? fooActual.serialize() : fooActual).toEqual(fooValue);
      });

      it("sets all values as a collection", function() {
        display_prefs[func]("this arg is ignored", {"foo" : fooValue, "bar" : barValue});
        var fooActual = display_prefs.attr([exp.path, exp_token, "foo"].join("."));
        var barActual = display_prefs.attr([exp.path, exp_token, "bar"].join("."));
        expect(fooActual.serialize ? fooActual.serialize() : fooActual).toEqual(fooValue);
        expect(barActual.serialize ? barActual.serialize() : barActual).toEqual(barValue);
      });
    };
  }

  describe("#setSorts", setSpecs("setSorts", "SORTS", ["bar", "baz"], ["thud", "jeek"]));

  describe("#getWidgetHeights", function() {});

  describe("#getWidgetHeight", getSpecs("getWidgetHeight", "HEIGHTS", 100, 200));

  describe("#setWidgetHeight", setSpecs("setWidgetHeight", "HEIGHTS", 100, 200));

  describe("#getColumnWidths", getSpecs("getColumnWidths", "COLUMNS", [6, 6], [8, 4]));

  describe("#getColumnWidthsForSelector", function() {
    it("calls getColumnWidths with the ID of the supplied element", function() {
      var $foo = affix("#foo");
      var $bar = affix("#bar");

      spyOn(display_prefs, "getColumnWidths");

      display_prefs.getColumnWidthsForSelector("unit_test", $foo);
      expect(display_prefs.getColumnWidths).toHaveBeenCalledWith("unit_test", "foo");
    });
  });

  describe("#setColumnWidths", setSpecs("setColumnWidths", "COLUMNS", [6,6], [4,8]));

  describe("Set/Reset functions", function() {

    describe("#resetPagePrefs", function() {

      beforeEach(function() {
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          display_prefs.makeObject(exp_token, "unit_test").attr("foo", "bar"); //page type defaults
          display_prefs.makeObject(exp.path, exp_token).attr("foo", "baz"); //page custom settings
        });
      });
      afterEach(function() {
        display_prefs.removeAttr(exp.path);
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          display_prefs.removeAttr(exp_token);
        });
      });

      it("sets the page layout to the default for the page type", function() {
        display_prefs.resetPagePrefs();
        can.each(["getSorts", "getCollapsed", "getWidgetHeight", "getColumnWidths"], function(func) {
          expect(display_prefs[func]("unit_test", "foo")).toBe("bar");
        });
      });

    });

    describe("#setPageAsDefault", function() {
      beforeEach(function() {
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          display_prefs.makeObject(exp_token, "unit_test").attr("foo", "bar"); //page type defaults
          display_prefs.makeObject(exp.path, exp_token).attr("foo", "baz"); //page custom settings
        });
      });
      afterEach(function() {
        display_prefs.removeAttr(exp.path);
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          display_prefs.removeAttr(exp_token);
        });
      });

      it("sets the page layout to the default for the page type", function() {
        display_prefs.setPageAsDefault("unit_test");
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          expect(display_prefs.attr([exp_token, "unit_test", "foo"].join("."))).toBe("baz");
        })
      });

      it("keeps the page and the defaults separated", function() {
        display_prefs.setPageAsDefault("unit_test");
        can.each(["setColumnWidths", "setCollapsed", "setWidgetHeight", "setSorts"], function(func) {
          display_prefs[func]("unit_test", "foo", "quux");
        });
        can.each([exp.COLUMNS, exp.HEIGHTS, exp.SORTS, exp.COLLAPSE], function(exp_token) {
          expect(display_prefs.attr([exp_token, "unit_test", "foo"].join("."))).toBe("baz");
        });
      });

    });

  });

  describe("#findAll", function() {
    var dp_noversion, dp2_outdated, dp3_current;
    beforeEach(function() {
      dp_noversion = new CMS.Models.DisplayPrefs({});
      dp2_outdated = new CMS.Models.DisplayPrefs({ version : 1});
      dp3_current = new CMS.Models.DisplayPrefs({ version : CMS.Models.DisplayPrefs.version });

      spyOn(can.Model.LocalStorage, "findAll").and.returnValue(new $.Deferred().resolve([dp_noversion, dp2_outdated, dp3_current]));
      spyOn(dp_noversion, "destroy");
      spyOn(dp2_outdated, "destroy");
      spyOn(dp3_current, "destroy");
    });
    it("deletes any prefs that do not have a version set", function(done) {
      var dfd = CMS.Models.DisplayPrefs.findAll().done(function(dps) {
        expect(dps).not.toContain(dp_noversion);
        expect(dp_noversion.destroy).toHaveBeenCalled();
      });

      waitsFor(function() { //sanity check --ensure deferred resolves/rejects
        return dfd.state() !== "pending";
      }, done);
    });
    it("deletes any prefs that have an out of date version", function() {
      CMS.Models.DisplayPrefs.findAll().done(function(dps) {
        expect(dps).not.toContain(dp2_outdated);
        expect(dp2_outdated.destroy).toHaveBeenCalled();
      });
    });
    it("retains any prefs that do not have a version set", function() {
      CMS.Models.DisplayPrefs.findAll().done(function(dps) {
        expect(dps).toContain(dp3_current);
        expect(dp3_current.destroy).not.toHaveBeenCalled();
      });
    });
  });

  describe("#findOne", function() {
    var dp_noversion, dp2_outdated, dp3_current;
    beforeEach(function() {
      dp_noversion = new CMS.Models.DisplayPrefs({});
      dp2_outdated = new CMS.Models.DisplayPrefs({ version : 1});
      dp3_current = new CMS.Models.DisplayPrefs({ version : CMS.Models.DisplayPrefs.version });
    });
    it("404s if the display pref does not have a version set", function(done) {
      spyOn(can.Model.LocalStorage, "findOne").and.returnValue(new $.Deferred().resolve(dp_noversion));
      spyOn(dp_noversion, "destroy");
      var dfd = CMS.Models.DisplayPrefs.findOne().done(function(dps) {
        fail("Should not have resolved findOne for the unversioned display pref");
      }).fail(function(pseudoxhr) {
        expect(pseudoxhr.status).toBe(404);
        expect(dp_noversion.destroy).toHaveBeenCalled();
      });
      waitsFor(function() { //sanity check --ensure deferred resolves/rejects
        return dfd.state() !== "pending";
      }, done);
    });
    it("404s if the display pref has an out of date version", function() {
      spyOn(can.Model.LocalStorage, "findOne").and.returnValue(new $.Deferred().resolve(dp2_outdated));
      spyOn(dp2_outdated, "destroy");
      CMS.Models.DisplayPrefs.findOne().done(function(dps) {
        fail("Should not have resolved findOne for the outdated display pref");
      }).fail(function(pseudoxhr) {
        expect(pseudoxhr.status).toBe(404);
        expect(dp2_outdated.destroy).toHaveBeenCalled();
      });
    });
    it("retains any prefs that do not have a version set", function() {
      spyOn(can.Model.LocalStorage, "findOne").and.returnValue(new $.Deferred().resolve(dp3_current));
      spyOn(dp3_current, "destroy");
      CMS.Models.DisplayPrefs.findOne().done(function(dps) {
        expect(dp3_current.destroy).not.toHaveBeenCalled();
      }).fail(function() {
        fail("Should have resolved on findOne for the current display pref");
      });
    });
  });

});
