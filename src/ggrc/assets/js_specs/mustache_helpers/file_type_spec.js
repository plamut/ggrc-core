/*!
  Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: peter@reciprocitylabs.com
  Maintained By: peter@reciprocitylabs.com
*/

describe("can.mustache.helper.file_type", function () {
  "use strict";

  var helper,
      instance;  // the argument passed to the helper on invocation

  beforeAll(function () {
    helper = can.Mustache._helpers.file_type.fn;
  });

  beforeEach(function () {
    instance = {
      type: "Document",
      title: "foo.bar"
    };
  });

  it("raises an error if passed an object of type other than Document",
    function () {
      var callWithInvalid,
          errMsg = "Cannot determine file type for a non-document object";

      instance.type = "FooBar";
      callWithInvalid = helper.bind(helper, instance);

      expect(callWithInvalid).toThrow(errMsg);
    }
  );

  it("raises an error if the file name cannot be determined", function () {
    var callWithInvalid,
        errMsg = "Cannot determine the object's file name";

    instance.title = undefined;
    callWithInvalid = helper.bind(helper, instance);

    expect(callWithInvalid).toThrow(errMsg);
  });

  it("returns a default value if there is no file extension", function () {
    instance.title = "txt";  // the filename matches a common extension
    expect(helper(instance)).toEqual("default");
  });

  it("returns a default value for unknown file extensions", function () {
    instance.title = "filename.foo";
    expect(helper(instance)).toEqual("default");
  });

  it("returns a correct value for plain text files", function () {
    instance.title = "file.txt";
    expect(helper(instance)).toEqual("txt");
  });

  it("it is not affected by file extension's text case", function () {
    instance.title = "file.tXT";
    expect(helper(instance)).toEqual("txt");
  });

  describe("recognizing office-like documents", function () {
    it("returns a correct value for older Word documents", function () {
      instance.title = "file.doc";
      expect(helper(instance)).toEqual("doc");
    });

    it("returns a correct value for newer Word documents", function () {
      instance.title = "file.docx";
      expect(helper(instance)).toEqual("doc");
    });

    it("returns correct value for LibreOffice Writer documents", function () {
      instance.title = "file.odt";
      expect(helper(instance)).toEqual("doc");
    });
  });

  describe("recognizing image documents", function () {
    it("returns a correct value for JPG images", function () {
      instance.title = "file.jpg";
      expect(helper(instance)).toEqual("img");
    });

    it("returns a correct value for JPG images with JPEG extension",
      function () {
        instance.title = "file.jpeg";
        expect(helper(instance)).toEqual("img");
      }
    );

    it("returns a correct value for PNG images", function () {
      instance.title = "file.png";
      expect(helper(instance)).toEqual("img");
    });

    it("returns a correct value for GIF images", function () {
      instance.title = "file.gif";
      expect(helper(instance)).toEqual("img");
    });

    it("returns a correct value for TIFF images", function () {
      instance.title = "file.tiff";
      expect(helper(instance)).toEqual("img");
    });

    it("returns a correct value for BMP images", function () {
      instance.title = "file.bmp";
      expect(helper(instance)).toEqual("img");
    });
  });

  it("returns a correct value for PDF documents", function () {
    instance.title = "file.pdf";
    expect(helper(instance)).toEqual("pdf");
  });

  describe("recognizing office-like spreadsheets", function () {
    it("returns a correct value for older Excel documents", function () {
      instance.title = "file.xls";
      expect(helper(instance)).toEqual("xls");
    });

    it("returns a correct value for newer Excel documents", function () {
      instance.title = "file.xlsx";
      expect(helper(instance)).toEqual("xls");
    });

    it("returns correct value for LibreOffice Calc documents", function () {
      instance.title = "file.ods";
      expect(helper(instance)).toEqual("xls");
    });
  });

  describe("recognizing archive files", function () {
    it("returns a correct value for ZIP archives", function () {
      instance.title = "file.zip";
      expect(helper(instance)).toEqual("zip");
    });

    it("returns a correct value for WinRAR archives", function () {
      instance.title = "file.rar";
      expect(helper(instance)).toEqual("zip");
    });

    it("returns a correct value for 7-Zip archives", function () {
      instance.title = "file.7z";
      expect(helper(instance)).toEqual("zip");
    });

    it("returns a correct value for GZip archives", function () {
      instance.title = "file.gz";
      expect(helper(instance)).toEqual("zip");
    });

    it("returns a correct value for TAR archives", function () {
      instance.title = "file.tar";
      expect(helper(instance)).toEqual("zip");
    });
  });
});
