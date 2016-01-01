/*
 * Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: brad@reciprocitylabs.com
 * Maintained By: brad@reciprocitylabs.com
 */

(function (can) {
  var scopes = ['https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/apps.groups.settings'];
  var gdrive_findAll;
  var gapi_request_with_auth = GGRC.gapi_request_with_auth;

  /*
    create a search query that matches the expected format for GDrive API.
    It's a series of boolean constructors with operators for testing equality
    and list membership (the 'in' operator).  Add more fields as necessary, as
    this is the minimal needed set.

    Reference for search query format:
    https://developers.google.com/drive/search-parameters
  */
  window.process_gapi_query = function (params) {
    var qstr = [];
    var i;
    for (i in params) {
      if (_.has(params, i)) {
        switch (i) {
          case 'parents':
            qstr.push('\'' +
              (params[i].id ? params[i].id : params[i]) + '\' in ' + i);
            break;
          case 'mimeType':
            qstr.push(i + ' = \'' + params[i] + '\'');
            break;
          case 'mimeTypeNot':
            qstr.push('mimeType != \'' + params[i] + '\'');
            break;
          default:
            break;
        }
      }
    }
    return qstr.join(' and ');
  };

  // Template for all findAll operations on GDrive objects.
  // https://developers.google.com/drive/v2/reference/files/list
  gdrive_findAll = function (extra_params, extra_path) {
    return function (params) {
      var that = this;
      var q;
      var path;
      params = params || {};

      // Short-circuit for refresh queue, because GAPI doesn't play that.
      if (params.id__in) {
        return $.when.apply($, can.map(params.id__in.split(','), function (id) {
          return that.findOne({id: id});
        })).then(function () {
          return can.makeArray(arguments);
        });
      }

      if (params.parentfolderid) {
        params.parents = params.parentfolderid;
        delete params.parentfolderid;
      }
      if (!params.parents && !params.id) {
        params.parents = 'root';
      }
      $.extend(params, extra_params);
      q = process_gapi_query(params);
      path = '/drive/v2/files';

      if (params.id) {
        path += '/' + params.id;
      }
      if (extra_path) {
        path += extra_path;
      }
      if (q) {
        path += '?q=' + encodeURIComponent(q);
      }

      return gapi_request_with_auth({
        path: path,
        method: 'get',
        callback: function (dfd, result) {
          var objs;

          if (!result || result.error) {
            dfd.reject(result ? result.error : JSON.parse(arguments[1]));
          } else if (result.items) {
            objs = result.items;
            can.each(objs, function (obj) {
              obj.selfLink = obj.selfLink || '#';
            });
            dfd.resolve(objs);
          // single object case
          } else {
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    };
  };

/**
  GDrive files not including folders.  Folders are also files in GDrive,
  with a particular MIME type, but we distinguish between them here as
  different object types for conceptual ease.

  https://developers.google.com/drive/v2/reference/files
*/
  can.Model.Cacheable('CMS.Models.GDriveFile', {
    findAll: gdrive_findAll({
      mimeTypeNot: 'application/vnd.google-apps.folder'
    }),
    findOne: gdrive_findAll({}),
    addToParent: function (object, parent) {
      if (typeof parent === 'string') {
        parent = {id: parent};
      }
      return gapi_request_with_auth({
        path: '/drive/v2/files/' + object.id + '/parents',
        method: 'post',
        body: parent.stub ? parent.stub() : parent,
        callback: function (dfd, result) {
          if (result && result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve();
          }
        },
        scopes: scopes
      }).done(function () {
        object.refresh();
      });
    },
    copyToParent: function (object, parent) {
      if (typeof parent === 'string') {
        parent = {id: parent};
      }

      return gapi_request_with_auth({
        path: '/drive/v2/files/' + object.id + '/copy',
        method: 'post',
        body: {parents: [{id: parent.id}], title: object.title},
        callback: function (dfd, result) {
          if (result && result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    },
    removeFromParent: function (object, parent_id) {
      if (typeof object !== 'object') {
        object = this.store[object];
      }
      return gapi_request_with_auth({
        path: '/drive/v2/files/' + parent_id + '/children/' + object.id,
        method: 'delete',
        callback: function (dfd, result) {
          if (result && result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve();
          }
        },
        scopes: scopes
      }).done(function () {
        object.refresh();
      });
    },
    destroy: function (id) {
      return gapi_request_with_auth({
        path: '/drive/v2/files/' + id + '/trash',
        method: 'post',
        callback: function (dfd, result) {
          if (result && result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    },
    from_id: function (id) {
      return new this({id: id});
    },
    attributes: {
      permissions: 'CMS.Models.GDriveFilePermission.models',
      revisions: 'CMS.Models.GDriveFileRevision.models'
    }
  }, {
    findPermissions: function () {
      return CMS.Models.GDriveFilePermission.findAll(this.serialize());
    },
    findRevisions: function () {
      return CMS.Models.GDriveFileRevision.findAll(this.serialize());
    },
    refresh: function (params) {
      return this.constructor.findOne({id: this.id})
        .then($.proxy(this.constructor, 'model'))
        .done(function (d) {
          d.updated();
          //  Trigger complete refresh of object -- slow, but fixes live-binding
          //  redraws in some cases
          can.trigger(d, 'change', '*');
        });
    },
    addToParent: function (parent) {
      return this.constructor.addToParent(this, parent);
    },
    copyToParent: function (parent) {
      return this.constructor.copyToParent(this, parent);
    },
    removeFromParent: function (parent) {
      return this.constructor.removeFromParent(this, parent.id || parent);
    }
  });

  /*
    The separate type for folders.

    The docs have a special page about working with folders, which is
    worth reading:
    https://developers.google.com/drive/web/folder
  */
  CMS.Models.GDriveFile('CMS.Models.GDriveFolder', {
    findAll: gdrive_findAll({mimeType: 'application/vnd.google-apps.folder'}),
    create: function (params) {
      if (!params.parents) {
        params.parents = [{id: 'root'}];
      }
      return gapi_request_with_auth({
        path: '/drive/v2/files',
        method: 'post',
        body: {
          mimeType: 'application/vnd.google-apps.folder',
          title: params.title,
          parents: params.parents.push ? params.parents : [params.parents]
        },
        callback: function (dfd, result) {
          if (result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    },
    findChildFolders: function (params) {
      if (typeof params !== 'string') {
        params = params.id;
      }
      return this.findAll({parents: params});
    },
    addChildFolder: function (parent, params) {
      return this.create($.extend({parent: parent}, params));
    },
    from_id: function (id) {
      return new this({id: id});
    },
    // Note that when you get the file and folder objects back from the server
    // the current user's permission on the file comes back in the 'userPermission'
    // property, but we can't modelize these permissions because they always have ID "me"
    attributes: {
      permissions: 'CMS.Models.GDriveFolderPermission.models',
      revisions: 'CMS.Models.GDriveFileRevision.models'
    }
  }, {
    findChildFolders: function () {
      return this.constructor.findChildFolders(this);
    },
    findPermissions: function () {
      return CMS.Models.GDriveFolderPermission.findAll(this.serialize());
    },
    uploadFiles: function () {
      var that = this;
      var dfd = new $.Deferred();
      gapi.load('picker', {callback: createPicker});

      // A simple callback implementation.
      function pickerCallback(data) {
        if (data[google.picker.Response.ACTION] ===
            google.picker.Action.PICKED) {
          dfd.resolve(
            CMS.Models.GDriveFile.models(data[google.picker.Response.DOCUMENTS])
          );
        } else if (data[google.picker.Response.ACTION] ===
          google.picker.Action.CANCEL) {
          dfd.reject('action cancelled');
        }
      }

      // Create and render a Picker object for searching images.
      function createPicker() {
        window.oauth_dfd.done(function (token, oauth_user) {
          var dialog;
          var picker = new google.picker.PickerBuilder();
          var docs = new google.picker.DocsUploadView();

          picker.addView(docs.setParent(that.id))
            .addView(google.picker.ViewId.DOCS)
            .setOAuthToken(gapi.auth.getToken().access_token)
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setDeveloperKey(GGRC.config.GAPI_KEY)
            .setCallback(pickerCallback)
            .build();

          picker.setVisible(true);
          dialog = GGRC.Utils.getPickerElement(picker);
          if (dialog) {
            dialog.style.zIndex = 4001; // our modals start with 2050
          }
        });
      }

      return dfd.promise();
    }
  });

  /*
    permissions come from a sub-endpoint of the files endpoint, so we
    can get away with just using findAll from the File/Folder model with a little tweak
  */
  can.Model.Cacheable('CMS.Models.GDriveFilePermission', {
    // call findAll with id param.
    findAll: gdrive_findAll({}, '/permissions'),
    id: 'etag', // id is a user's Permission ID, so using etags instead for cache keys.
    create: function (params) {
      var file = typeof params.file === 'object' ? params.file.id : params.file;

      return gapi_request_with_auth({
        path: '/drive/v2/files/' +
          file + '/permissions?sendNotificationEmails=false',
        method: 'post',
        body: {
          role: params.role || 'writer',
          type: params.permission_type || 'user',
          value: params.email ||
            CMS.Models.get_instance('Person', params.person.id).email
        },
        callback: function (dfd, result) {
          if (result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            result.file = typeof params.file === 'object' ? params.file :
              CMS.Models.GDriveFile.cache[params.file];
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    },
    destroy: function (etag) {
      return this.cache[etag].destroy();
    },
    findUserPermissionId: function (person) {
      var person_email = typeof person === 'string' ? person : person.email;
      return gapi_request_with_auth({
        path: '/drive/v2/permissionIds/' + person_email,
        method: 'get',
        callback: function (dfd, result) {
          if (result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            dfd.resolve(result.id);
          }
        },
        scopes: scopes
      });
    }
  }, {
    destroy: function () {
      var that = this;
      return gapi_request_with_auth({
        path: this.selfLink.replace(/https?:\/\/[^\/]+/, ''), // have to relativize the url
        method: 'delete',
        callback: function (dfd, result) {
          if (result && result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            can.trigger(that, 'destroyed', that);
            can.trigger(that.constructor, 'destroyed', that);
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    }
  });

  CMS.Models.GDriveFilePermission('CMS.Models.GDriveFolderPermission', {
    create: function (params) {
      var folder = typeof params.folder === 'object' ? params.folder.id :
        params.folder;

      return gapi_request_with_auth({
        path: '/drive/v2/files/' + folder +
          '/permissions?sendNotificationEmails=false',
        method: 'post',
        body: {
          role: params.role || 'writer',
          type: params.permission_type || 'user',
          value: params.email ||
            CMS.Models.get_instance('Person', params.person.id).email
        },
        callback: function (dfd, result) {
          if (result.error) {
            dfd.reject(dfd, result.error.status, result.error);
          } else {
            result.folder = typeof params.folder === 'object' ? params.folder :
              CMS.Models.GDriveFolder.cache[params.folder];
            dfd.resolve(result);
          }
        },
        scopes: scopes
      });
    }
  }, {});

  can.Model.Cacheable('CMS.Models.GDriveFileRevision', {
    findAll: gdrive_findAll({}, '/revisions'),
    id: 'etag', // id is a user's Permission ID, so using etags instead for cache keys.
    attributes: {
      modifiedDate: 'datetime'
    }
  }, {
  });

  can.Model.Join('CMS.Models.ObjectFolder', {
    root_object: 'object_folder',
    root_collection: 'object_folders',
    findAll: 'GET /api/object_folders?__include=folder',
    create: 'POST /api/object_folders',
    update: 'PUT /api/object_folders/{id}',
    destroy: 'DELETE /api/object_folders/{id}',
    join_keys: {
      folderable: can.Model.Cacheable,
      folder: CMS.Models.GDriveFolder
    },
    attributes: {
      modified_by: 'CMS.Models.Person.stub',
      folder: 'CMS.Models.GDriveFolder.stub',
      folderable: 'CMS.Models.get_stub'
    },
    model: function (params) {
      if (typeof params === 'object') {
        if (params.folder_id) {
          params.folder = new CMS.Models.GDriveFolder({
            id: params.folder_id,
            href: '/drive/v2/files/' + params.folder_id
          }).stub();
        }
      }
      return this._super(params);
    }
  }, {
    setup: function () {
      this._super.apply(this, arguments);
    },
    init: function () {
      this._super.apply(this, arguments);
      if (!this.folder && this.folder_id) {
        this.attr('folder', new CMS.Models.GDriveFolder({
          id: this.folder_id,
          parentfolderid: this.parent_folder_id,
          href: '/drive/v2/files/' + this.folder_id
        }));
      }
    },
    serialize: function (attr) {
      var serial;
      if (!attr) {
        serial = this._super.apply(this, arguments);
        serial.folder_id = serial.folder ? serial.folder.id : serial.folder_id;
        delete serial.folder;
        return serial;
      }
      if (attr === 'folder_id') {
        return this.folder_id || this.folder.id;
      }
      return this._super.apply(this, arguments);
    }
  });

  can.Model.Join('CMS.Models.ObjectFile', {
    root_object: 'object_file',
    root_collection: 'object_files',
    findAll: 'GET /api/object_files',
    create: 'POST /api/object_files',
    update: 'PUT /api/object_files/{id}',
    destroy: 'DELETE /api/object_files/{id}',
    join_keys: {
      fileable: can.Model.Cacheable,
      file: CMS.Models.GDriveFile
    },
    attributes: {
      modified_by: 'CMS.Models.Person.stub',
      file: 'CMS.Models.GDriveFile.stub',
      fileable: 'CMS.Models.get_stub'
    },
    model: function (params) {
      if (typeof params === 'object' && params.file_id) {
        params.file = new CMS.Models.GDriveFile({
          id: params.file_id,
          href: '/drive/v2/files/' + params.file_id
        }).stub();
      }
      return this._super(params);
    }
  }, {
    serialize: function (attr) {
      var serial;
      if (!attr) {
        serial = this._super.apply(this, arguments);
        serial.file_id = serial.file ? serial.file.id : serial.file_id;
        delete serial.file;
        return serial;
      }
      if (attr === 'file_id') {
        return this.file_id || this.file.id;
      }
      return this._super.apply(this, arguments);
    }
  });
})(window.can);
