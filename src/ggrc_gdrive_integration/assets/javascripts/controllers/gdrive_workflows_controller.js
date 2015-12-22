/*
 * Copyright (C) 2013-2014 Google Inc., authors, and contributors <see AUTHORS file>
 * Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
 * Created By: brad@reciprocitylabs.com
 * Maintained By: brad@reciprocitylabs.com
 */
(function(can, $) {
var create_folder = function (cls, title_generator, parent_attr, model, ev, instance) {
  var that = this,
      dfd,
      folder,
      has_parent = true,
      owner = cls === CMS.Models.Request ? "assignee" : "contact";

  if (instance instanceof cls) {
    if (parent_attr) {
      dfd = instance[parent_attr].reify().get_binding("folders").refresh_instances();
    } else {
      has_parent = false;
      dfd = $.when([{}]); //make parent_folder instance be undefined;
                          // GDriveFolder.create will translate that into 'root'
    }
    return dfd.then(function (parent_folders) {
      parent_folders = can.map(parent_folders, function (pf) {
        return pf.instance && pf.instance.userPermission &&
              (pf.instance.userPermission.role === "writer" ||
              pf.instance.userPermission.role === "owner") ?
              pf : undefined;
      });
      if (has_parent && parent_folders.length < 1){
        return new $.Deferred().reject("no write permissions on parent");
      }
      var xhr = new CMS.Models.GDriveFolder({
        title: title_generator(instance),
        parents: parent_folders.length ? parent_folders[0].instance : undefined
      }).save();
      report_progress("Creating Drive folder for " + title_generator(instance), xhr);
      return xhr;
    }).then(function(created_folder) {
      var refresh_queue;
      folder = created_folder;

      return report_progress(
        "Linking folder \"" + folder.title + "\" to " + instance.constructor.title_singular,
        new CMS.Models.ObjectFolder({
          folder: folder,
          folderable: instance,
          context: instance.context || { id : null }
        }).save()
      );
    }).then($.proxy(instance, "refresh"))
    .then(function () {
      if (!(instance instanceof CMS.Models.Audit)) {
        return that.update_permissions(model, ev, instance);  //done automatically on refresh for Audits
      }
    }).then(function () {
      return folder;
    }, function () {
      //rejected case from previous
      return $.when();
    });
  } else {
    dfd = new $.Deferred();
    return dfd.reject("Type mismatch");
  }
};

function partial_proxy(fn) {
  var args = can.makeArray(arguments).slice(1);
  return function() {
    return fn.apply(this, args.concat(can.makeArray(arguments)));
  };
}

var allops = [];
function report_progress(str, xhr) {

  function build_flashes() {
    var flash = {}
    , container_string = "<div class='audit-status'>"
    , head_string = "<div class='audit-status-head'>"
    , list_bridge = " [Click to open]</div><ul class='flash-expandable'>"
    , closer = "</ul></div></div>"
    , successes = [container_string + head_string + "Actions completed successfully." + list_bridge]
    , failures = [container_string + head_string + "There were errors." + list_bridge]
    , pendings = [container_string + head_string + "GDrive actions in progress..." + list_bridge]
    , success_count = 0
    , failure_count = 0
    , pending_count = 0;

    can.each(allops, function(op) {
      switch(op.xhr.state()) {
        case "resolved":
        successes.push("<li>" + op.str + " -- Done</li>");
        success_count++;
        break;
        case "rejected":
        failures.push("<li>" + op.str + " -- FAILED</li>");
        failure_count++;
        break;
        case "pending":
        pendings.push("<li>" + op.str + "...</li>");
        pending_count++;
      }
    });

    if (success_count) {
      flash.success = successes.concat(closer);
    } else {
      flash.success = [];
    }
    if (failure_count) {
      flash.error = failures.concat(closer);
    } else {
      flash.error = [];
    }
    if (pending_count) {
      flash.warning = pendings.concat(closer);
    } else {
      flash.warning = [];
    }
    $(document.body).trigger("ajax:flash", flash);
    // initialize items in hidden state
    $('.audit-status ul.flash-expandable').each(function() {
      $(this).hide();
    });
    // hide empty lists: alerts without a li
    $('.alert:not(:has(li))').each(function() {
      $(this).hide();
    });
  }

  allops.push({str : str, xhr : xhr});
  xhr.always(build_flashes);
  build_flashes();
  return xhr;
}

var permissions_by_type = {
  "Program" : [{
    role: "writer",
    value: "owners"
  }, {
    role: "writer",
    value: "contact"
  }],
  "Audit" : [{
    role: "writer",
    value: "contact",
  }, {
    role: "reader",
    value: "findAuditors"
  }, {
    role: "writer",
    value: function() {
      return new RefreshQueue().enqueue(this.requests.reify())
      .trigger().then(function(reqs) {
        return new RefreshQueue().enqueue(can.map(reqs, function(req) {
          return req.assignee.reify();
        })).trigger();
      });
    }
  }],
  "Request" : [{
    value: "assignee",
    role: "writer"
  }]
};

can.Control("GGRC.Controllers.GDriveWorkflow", {
  attach_files: function(files, type, object){
    return new RefreshQueue().enqueue(files).trigger().then(function(files){
      can.each(files, function(file) {
        //Since we can re-use existing file references from the picker, check for that case.
        CMS.Models.Document.findAll({link : file.alternateLink }).done(function(d) {
          if(d.length) {
            //file found, just link to object
            report_progress(
              "Linking Drive file \"" + d[0].title + "\"",
              $.when([new CMS.Models.ObjectDocument({
                  context : object.context || {id : null}
                  , documentable : object
                  , document : d[0]
                }).save(),
              ])
            )
          } else {
            if(type === 'folders'){
              report_progress("Linking folder " + file.title,
                new CMS.Models.ObjectFolder({
                  folderable : object
                  , folder : file
                  , context : object.context || {id: null}
                }).save()
              );
              return;
            }
            //file not found, make Document object.
            report_progress(
              "Linking new Drive file \"" + file.title + "\""
              , new CMS.Models.Document({
                context : object.context || {id : null}
                , title : file.title
                , link : file.alternateLink
              }).save().then(function(doc) {
                return $.when([
                  new CMS.Models.ObjectDocument({
                    context : object.context || {id : null}
                    , documentable : object
                    , document : doc
                  }).save(),
                  new CMS.Models.ObjectFile({
                    context : object.context || {id : null}
                    , file : file
                    , fileable : doc
                  }).save()
                ]);
              })
            );
          }
        });
      });
    });
  }
}, {
  request_create_queue : []
  , user_permission_ids : {}

  , create_program_folder : partial_proxy(create_folder, CMS.Models.Program, function(inst) { return inst.title + " Audits"; }, null)
  /*
    NB: We don't do folder creation on Program creation now.  Only when the first Audit is created does the Program folder
    get created as well.
  */

  , create_audit_folder : partial_proxy(create_folder, CMS.Models.Audit, function(inst) { return inst.title; }, "program")

  // When creating requests as part of audit workflow, wait for audit to have a folder link before
  // trying to create subfolders for request.  If the audit and its folder link are already created
  //  we can do the request folder immediately.
  , create_request_folder : partial_proxy(
    create_folder, CMS.Models.Request, function(inst) { return inst.objective.reify().title; }, "audit")

  , link_request_to_new_folder_or_audit_folder : function(model, ev, instance) {
    if(instance instanceof CMS.Models.Request) {
      if(this._audit_create_in_progress || instance.audit.reify().object_folders.length < 1) {
        this.request_create_queue.push(instance);
      } else {
        if(instance.objective) {
          return instance.delay_resolving_save_until(this.create_request_folder(model, ev, instance));
        } else {

          if(Permission.is_allowed("create", "ObjectFolder", instance.context.id || null)) {

            return instance.delay_resolving_save_until(
              report_progress(
                'Linking new Request to Audit folder'
                , new CMS.Models.ObjectFolder({
                  folder_id : instance.audit.reify().object_folders[0].reify().folder_id
                  , folderable : instance
                  , context : instance.context || { id : null }
                }).save()
              )
            );
          } else {
            return $.when();
          }
        }
      }
    }
  }

  , resolve_permissions : function(folder, instance) {
    var permissions = {};
    var permission_dfds = [];
    var that = this;

    var push_person = function(dfds, role, email, queue_to_top) {
      if(!permissions[email] || permissions[email] !== "writer" || role !== "reader") {
        email = email.toLowerCase();
        permissions[email] = role;
        if(!that.user_permission_ids[email]) {
          if(queue_to_top) {
            dfds.push(CMS.Models.GDriveFilePermission.findUserPermissionId(email).then(function(permissionId) {
              that.user_permission_ids[permissionId] = email;
              that.user_permission_ids[email] = permissionId;
            }));
          } else {
            return CMS.Models.GDriveFilePermission.findUserPermissionId(email).then(function(permissionId) {
              that.user_permission_ids[permissionId] = email;
              that.user_permission_ids[email] = permissionId;
            });
          }
        }
      }
    };

    // Special case: for requests with no objective, the folder is the same
    //  as the Audit folder and *must* use the Audit permissions structure
    //  instead of the Request structure.
    if(instance instanceof CMS.Models.Request && !instance.objective) {
      return instance.audit.reify().refresh().then(function(audit) {
        return that.resolve_permissions(folder, audit);
      });
    }

    can.each(permissions_by_type[instance.constructor.model_singular], function(entry) {
      var role = entry.role;
      var people = typeof entry.value === "string" ? instance[entry.value] : entry.value;
      var pdfd = [];
      if(typeof people === "function") {
        people = people.call(instance);
      }
      // in some cases we have a list,
      //  in others we have a deferred resolving to a list.
      // In both cases we need to wait for any person found in the list
      //  to refresh.
      // this has been done previously with permission_dfds,
      //  but if we have a new wait, we need to place the dfd waiting
      //  for the list to resolve in permission_dfds and then chain to the
      //  refresh of each person.


      function iterate_people(dfds, people) {
        can.each(!people || people.push ? people : [people], function(person) {
          if(person.person) {
            person = person.person;
          }
          person = person.reify();
          if(person.selfLink) {
            person = person.email;
            push_person(dfds, role, person, true);
          } else {
            dfds.push(
              person.refresh()
              .then(function(p) { return p.email; })
              .then($.proxy(push_person, null, dfds, role))
            );
          }
        });
      }

      if(can.isDeferred(people)) {
        // if we have to wait for people to resolve,
        //  then we have to have permission_dfds wait
        //  for its chain to finish.
        permission_dfds.push(
          people.then($.proxy(iterate_people, that, pdfd))
          .then(function() {
            return $.when.apply($, pdfd);
          })
        );
      } else {
        // Otherwise we can push the refresh of
        //  each person directly onto permission_dfds
        iterate_people(permission_dfds, people);
      }
    });
    if(GGRC.config.GAPI_ADMIN_GROUP) {
      push_person(permission_dfds, "writer", GGRC.config.GAPI_ADMIN_GROUP, true);
    }
    if(instance instanceof CMS.Models.Program) {
      var auths = {};
      //setting user roles does create a quirk because we want to be sure that a user with
      //  access doesn't accidentally remove his own access to a resource while trying to change it.
      //  So a user may have more than one role at this point, and we only want to change the GDrive
      //  permission based on the most recent one.

      instance.get_binding("authorizations").refresh_instances().then(function(authmapping) {
        // FIXME: This will cause missing authorizations, but this function
        //   needs to be reworked to ensure required paths are loaded before
        //   use (.person and .role).
        if (authmapping instanceof can.List){
          authmapping = authmapping[0];
        }
        if (!authmapping.instance.selfLink)
          return;
        var auth = authmapping.instance;
        if(!auths[auth.person.reify().email]
           || auth.created_at.getTime() > auths[auth.person.reify().email].created_at.getTime()
        ) {
          auths[auth.person.reify().email] = auth;
        }
      });
      can.each(auths, function(auth) {
        var person = auth.person.reify()
        , role = auth.role.reify()
        , rolesmap = {
          ProgramOwner : "writer"
          , ProgramEditor : "writer"
          , ProgramReader : "reader"
        };

        if(rolesmap[role.name] && person.email) { // only push valid emails
          //Authorizations like "Auditor" do not get Program permissions.
          //  Only the ones in the map above get permissions
          push_person([], rolesmap[role.name], person.email, true);
        }
      });
    }

    return $.when.apply($, permission_dfds).then(function() {
      return permissions;
    });
  }


  , update_permissions : function(model, ev, instance) {
    var dfd
    , that = this
    , permission_ids = {};

    if(!(instance instanceof model) || instance.__permissions_update_in_progress)
      return $.when();

    instance.__permissions_update_in_progress = true;

    // TODO check whether person is the logged-in user, and use OAuth2 identifier if so?
    return instance.get_binding("folders").refresh_instances().then(function(binding_list) {
      var binding_dfds = [];
      can.each(binding_list, function(binding) {
        binding_dfds.push($.when(
          that.resolve_permissions(binding.instance, instance)
          , binding.instance.findPermissions()
        ).then(function(permissions_to_create, permissions_to_delete) {
          var permissions_dfds = [];
          permissions_to_delete = can.map(permissions_to_delete, function(permission) {
            /* NB: GDrive sometimes provides the email address assigned to a permission and sometimes not.
               Email addresses will match on permissions that are sent outside of GMail/GApps/google.com
               while "Permission IDs" will match on internal account permissions (where email address is
               usually not provided).  Check both.

               A previous revision of this tried building email addresses with permission.name + "@" + permission.domain
               but the name field is likely different from the LDAP name for users, maybe less so with domains,
               but the effect is it creates bad values for email sometimes when used.
            */

            var email = permission.emailAddress
                        ? permission.emailAddress.toLowerCase()
                        : that.user_permission_ids[permission.id];
            var pending_permission = permissions_to_create[email];

            // Case matrix.
            // 0: existing is owner -- delete existing and current.  Owner remains owner.
            // 1: pending (to create) does not exist, existing (to delete) exists -- do nothing, delete existing later
            // 2: pending exists, existing does not. -- we won't get here because we're iterating (do nothing, create pending later)
            // 3: pending and existing exist, have same role. -- delete both, do nothing later.
            // 4: pending and existing exist, pending is writer but existing is reader -- delete existing, create writer later.
            // 5: pending and existing exist, pending is reader but existing is writer -- do nothing, delete writer first.

            switch(true) {
            case (permission.role === "owner"):
              delete permissions_to_create[email];
              return;
            case (!pending_permission):
              return permission;
            case (pending_permission === permission.role):
              delete permissions_to_create[email];
              return;
            case (pending_permission !== "reader" && permission.role === "reader"):
              return;
            case (pending_permission === "reader" && permission.role !== "reader"):
              return permission;
            }

          });

          can.each(permissions_to_delete, function(permission) {
            permissions_dfds.push(report_progress(
              'Removing '
              + permission.role
              + ' permission on folder "'
              + binding.instance.title
              + '" for '
              + (that.user_permission_ids[permission.id]
                || permission.emailAddress
                || permission.value
                || (permission.name && permission.domain && (permission.name + "@" + permission.domain))
                || permission.id)
              , permission.destroy()
            ).then(null, function() {
              return new $.Deferred().resolve(); //wait on these even if they fail.
            }));
          });

          can.each(permissions_to_create, function(role, user) {
            permissions_dfds.push(
              that.update_permission_for(binding.instance, user, that.user_permission_ids[user], role)
              .then(null, function() {
                return new $.Deferred().resolve(); //wait on these even if they fail.
              })
            );
          });

          return $.when.apply($, permissions_dfds);
        }));
      });
      return $.when.apply($, binding_dfds);
    }).always(function() {
      delete instance.__permissions_update_in_progress;
    });
  }

  , update_permission_for : function(item, person, permissionId, role) {
    //short circuit any operation if the user isn't allowed to add permissions
    if(item.userPermission.role !== "writer" && item.userPermission.role !== "owner")
      return new $.Deferred().reject("User is not authorized to modify this object");

    if(person.email) {
      person = person.email;
    }

    return report_progress(
      'Creating ' + role + ' permission on folder "' + item.title + '" for ' + person
      , new CMS.Models.GDriveFolderPermission({
        folder : item
        , email : person
        , role : role
        , permission_type : person === GGRC.config.GAPI_ADMIN_GROUP ? "group" : "user"
      }).save()
    );
  }

  // extracted out of {Request updated} for readability.
  , move_files_to_new_folder : function(audit_folders, new_folder, audit_files, request_responses) {
    var tldfds = [];
    can.each(audit_files, function(file) {
      //if the file is still referenced in more than one request without an objective,
      // don't remove from the audit.
      tldfds.push(
        CMS.Models.ObjectDocument.findAll({
          "document.link" : file.alternateLink
        }).then(function(obds) {
          //filter out any object-documents that aren't Responses.
          var connected_request_responses = [], other_responses = [];
          var responses = can.map(obds, function(obd) {
            var dable = obd.documentable.reify();
            if(dable instanceof CMS.Models.Response) {
              if(~can.inArray(dable, request_responses)) {
                connected_request_responses.push(dable);
              } else {
                other_responses.push(dable);
              }
              return obd.documentable.reify();
            }
          });

          if(connected_request_responses.length > 0) {
            file.addToParent(new_folder);
            return new RefreshQueue().enqueue(other_responses).trigger().then(function(reified_responses) {
              var dfds = [];

              if(can.map(reified_responses, function(resp) {
                  if(!resp.request.reify().objective) {
                    return resp;
                  }
                }).length < 1
              ) {
                //If no other request is still using the Audit folder version,
                // remove from the audit folder.
                can.each(audit_folders, function(af) {
                  dfds.push(file.removeFromParent(af));
                });
              }

              return $.when.apply($, dfds);
            });
          }
        })
      );
    });

    report_progress(
      "Moving files to new Request folder"
      , $.when.apply($, tldfds)
    );
  }

  , move_files_to_audit_folder : function(instance, audit_folders, req_folders, files) {
    //move each file from the old Request folder to the Audit folders
    var move_dfds = [];
    can.each(files, function(file) {
      var parent_ids = can.map(file.parents, function(p) { return p.id; });
      move_dfds.push(file.addToParent(audit_folders[0]));
      can.each(req_folders, function(rf) {
        if(~can.inArray(rf.id, parent_ids)) {
          move_dfds.push(file.removeFromParent(req_folders[0]));
        }
      });
    });
    report_progress(
      "Moving files to the Audit folder"
      , $.when.apply($, move_dfds).done(function() {
        can.each(req_folders, function(rf) {
          if(!rf.selfLink || rf.userPermission.role !== "writer" && rf.userPermission.role !== "owner")
            return;  //short circuit any operation if the user isn't allowed to add permissions

          report_progress(
            'Checking whether folder "' + rf.title + '" is empty'
            , CMS.Models.GDriveFile.findAll({parents : rf.id}).then(function(orphs) {
              if(orphs.length < 1) {
                report_progress(
                  'Deleting empty folder "' + rf.title + '"'
                  , rf.destroy()
                );
              } else {
                console.warn("can't delete folder", rf.title, "as files still exist:", orphs);
              }
            })
          );
        });
      })
    );
    report_progress(
      'Linking Request to Audit folder'
      , new CMS.Models.ObjectFolder({
        folder_id : instance.audit.reify().object_folders[0].reify().folder_id
        , folderable : instance
        , context : instance.context || { id : null }
      }).save()
    );
  }

  , update_audit_owner_permission : function(model, ev, instance){

    if(!(instance instanceof CMS.Models.Audit)) {
      return;
    }

    var dfd = instance.delay_resolving_save_until(this.update_permissions(model, ev, instance));
  }

  , update_request_folder : function(model, ev, instance) {
    var that = this;
    if(!(instance instanceof CMS.Models.Request) || instance._folders_mutex) {
      return;
    }

    instance._folders_mutex = true;

    return instance.delay_resolving_save_until(
      $.when(
      instance.get_binding("folders").refresh_instances()
      , instance.audit.reify().get_binding("folders").refresh_instances()
    ).then(function(req_folders_mapping, audit_folders_mapping) {
      var audit_folder, af_index, obj_folder_to_destroy, obj_destroy_dfds;
      if(audit_folders_mapping.length < 1)
        return; //can't do anything if the audit has no folder
      //reduce the binding lists to instances only -- makes for easier comparison
      var req_folders =  can.map(req_folders_mapping, function(rf) { return rf.instance; });
      //Check whether or not the current user has permissions to modify the audit folder.
      var audit_folders = can.map(audit_folders_mapping, function(af) {
        if(!af.instance.selfLink || af.instance.userPermission.role !== "writer" && af.instance.userPermission.role !== "owner")
          return;  //short circuit any operation if the user isn't allowed to edit
        return af.instance;
      });

      if(audit_folders.length < 1) {
        return;  // no audit folder to work on, or none that the user can edit.
      }

      // check the array of request_folers against the array of audit_folders to see if there is a match.
      af_index = can.reduce(req_folders, function(res, folder) {
        return (res >= 0) ? res : can.inArray(folder, audit_folders);
      }, -1);

      if(af_index > -1) {
        if (instance.objective) {
          //we added an objective where previously there was not one.

          //First remove the mapping to the audit folder, else we could constantly revisit this process.
          audit_folder = audit_folders[af_index];
          obj_folder_to_destroy = req_folders_mapping[can.inArray(audit_folder, req_folders)].mappings[0].instance;

          return $.when(
            report_progress(
              'Linking Request "' + instance.objective.reify().title + '" to new folder'
              , new CMS.Models.GDriveFolder({
                title : instance.objective.reify().title
                , parents : audit_folders
              }).save().then(function(folder) {
                return new CMS.Models.ObjectFolder({
                  folder : folder
                  , folder_id : folder.id
                  , folderable : instance
                  , context : instance.context || { id : null }
                }).save().then(function() { return folder; });
              })
            )
            , CMS.Models.GDriveFile.findAll({parentfolderid : audit_folders[0].id})
            , instance.responses.reify()
            , obj_folder_to_destroy.refresh().then(function(of) { return of.destroy(); })
          ).then(
            that.proxy("move_files_to_new_folder", audit_folders)
            , function() {
              console.warn("a prerequisite failed", arguments[0]);
            }
          ).done(function() {
            that.update_permissions(model, ev, instance);
          });
        } else {
          that.update_permissions(model, ev, instance);
        }
      } else if(req_folders.length < 1) {
        return;
      } else if(af_index < 0 && !instance.objective) {
        //we removed the objective.  This is the easier case.
        obj_destroy_dfds = can.map(req_folders_mapping, function(b) {
          b.mappings[0].instance.refresh().then(function(of) { of.destroy(); });
          return CMS.Models.GDriveFile.findAll({parents : b.instance.id});
        });

        return $.when(
          CMS.Models.GDriveFile.findAll({parents : req_folders[0].id})
          , $.when.apply($, obj_destroy_dfds).then(function() {
            return can.unique(
              can.reduce(arguments, function(a, b) {
                return a.concat(b);
              }, [])
            );
          })
        ).then(
          that.proxy("move_files_to_audit_folder", instance, audit_folders, req_folders)
        ).done(function() {
          return that.update_permissions(model, ev, instance);
        });
      }
    }).always(function() {
      delete instance._folders_mutex;
    })
    );
  }

  , "a.create-folder click" : function(el, ev) {
    var data = el.closest("[data-model], :data(model)").data("model") || GGRC.make_model_instance(GGRC.page_object);
    this.create_folder_if_nonexistent(data);
  }
  , create_folder_if_nonexistent : function(object) {
    var dfd = object.get_binding("folders").refresh_instances()
    , that = this
    , parent_prop = {
      "Program" : null
      , "Audit" : "program"
      , "Request" : "audit"
    };
    // maybe we also need to create a parent folder if we don't already have a folder for this object.
    if(parent_prop[object.constructor.shortName] && !object.get_mapping("folders").length) {
      dfd = $.when(dfd, this.create_folder_if_nonexistent(object[parent_prop[object.constructor.shortName]].reify()));
    }
    return dfd.then(function foldercheck() {
      var folder_dfd;
      if(object.get_mapping("folders").length) {
        //assume we already tried refreshing folders.
      } else if(object instanceof CMS.Models.Request) {
        if(that._audit_create_in_progress || object.audit.reify().get_mapping("folders").length < 1) {
          that.request_create_queue.push(object);
        } else {
          that.link_request_to_new_folder_or_audit_folder(object.constructor, {}, object);
        }
      } else {
        folder_dfd = that["create_" + object.constructor.table_singular + "_folder"](object.constructor, {}, object);
        if(object instanceof CMS.Models.Audit) {
          folder_dfd.done(function(fld) {
            new RefreshQueue().enqueue(object.requests.reify()).trigger().done(function(reqs) {
              can.each(reqs, function(req) {
                if(!req.objective) {
                  new CMS.Models.ObjectFolder({
                    folderable : req
                    , folder : fld
                    , context : req.context
                  }).save();
                }
              });
            });
          });
        }
        return folder_dfd;
      }
    });
  }

  , "a.show-meeting click" : function(el, ev){
    var instance = el.closest("[data-model], :data(model)").data("model")
      , cev = el.closest("[data-model], :data(cev)").data("cev")
      , subwin;
    function poll() {
      if(!subwin) {
        return; //popup blocker didn't allow a reference to the open window.
      } else if(subwin.closed) {
        cev.refresh().then(function() {
          instance.attr({
            title : cev.summary
            , start_at : cev.start
            , end_at : cev.end
          });
          can.each(instance.get_mapping("people"), function(person_binding) {
            instance.mark_for_deletion("people", person_binding.instance);
          });
          can.each(cev.attendees, function(attendee) {
            instance.mark_for_addition("people", attendee);
          });
          instance.save();
        });
      } else {
        setTimeout(poll, 5000);
      }
    }
    subwin = window.open(cev.htmlLink, cev.summary);
    setTimeout(poll, 5000);
  }
  , ".audit-status-head click": function(el, ev){
    $(ev.currentTarget.parentElement).find('ul.flash-expandable').toggle();
  }
});

// Because we're using a view from GGRC.Templates here, we have to encase
//  this component definition in a jQuery document.ready callback -- otherwise
//  GGRC.Templates would not yet exist.
$(function() {
can.Component.extend({
  tag: "ggrc-gdrive-folder-picker",
  template: can.view(GGRC.mustache_path + "/gdrive/gdrive_folder.mustache"),
  scope : {
    no_detach: "@",
    deferred: "@",
    tabindex: "@",
    placeholder: "@",
    readonly: "@",

    /**
     * Helper method for unlinking all object folders currently linked to the
     * given instance.
     *
     * @param {Object} instance - an instance of a model object (e.g Audit) for
     *   which to unlink the object folders from
     * @return {Object} - a deferred object that is resolved when the instance's
     *   object folders have been successfully unlinked from it
     */
    _unlinkObjFolders: function (instance) {
      var deleteDeferred;

      // make sure the object_folders list is up to date, and then delete all
      // existing upload folders currently mapped to the instance
      deleteDeferred = instance.refresh().then(function () {
        var deferredDeletes,
            obj_folders = instance.object_folders;

        // delete folders and collect their deferred delete objects
        deferredDeletes = $.map(obj_folders, function (folder) {
          var deferredDestroy = folder
            .reify()
            .refresh()
            .then(function (folder_refreshed) {
              return folder_refreshed.destroy();
            });

          return deferredDestroy;
        });

        return $.when.apply($, deferredDeletes);
      });

      return deleteDeferred;
    }
  },
  events: {
    init: function() {
      var that = this;
      this.element.removeAttr("tabindex");
      this.scope.attr("_folder_change_pending", true);
      this.scope.instance.get_binding("folders").refresh_instances().then(that._ifNotRemoved(function(folders) {
        that.scope.attr("current_folder", folders[0] ? folders[0].instance : null);
        that.options.folder_list = folders;
        that.on();
      }), that._ifNotRemoved(function(error) {
        that.scope.removeAttr("_folder_change_pending");
        that.scope.attr('folder_error', error);
        that.options.instance = that.scope.instance;
        that.on();
      })).then(function() {
        // Try to load extended folders if main folder was not found
        if (!that.scope.instance.get_binding("extended_folders") || that.scope.current_folder || that.scope.folder_error) {
          that.scope.removeAttr("_folder_change_pending");
          return;
        }
        that.scope.instance.get_binding("extended_folders").refresh_instances().then(that._ifNotRemoved(function(folders) {
          that.scope.removeAttr("_folder_change_pending");
          that.scope.attr("current_folder", folders[0] ? folders[0].instance : null);
          that.options.folder_list = folders;
          that.on();
        }), that._ifNotRemoved(function(error) {
          that.scope.removeAttr("_folder_change_pending");
          that.scope.attr('folder_error', error);
          that.options.instance = that.scope.instance;
          that.on();
        }));
      });
    },
    "{instance} change": function(inst, ev, attr) {
      var that = this;
      // Error recovery from previous refresh_instances error when we couldn't set up the binding.
      if(this.scope.folder_error) {
        this.scope.instance.get_binding("folders").refresh_instances().then(function(folders) {
          that.scope.attr("current_folder", folders[0] ? folders[0].instance : null);
          that.scope.removeAttr("_folder_change_pending");
          that.options.folder_list = folders;
          delete that.options.instance;
          that.on();
        }, function(error) {
          that.scope.removeAttr("_folder_change_pending");
          that.scope.attr('folder_error', error);
        }).then(function() {
          // Try to load extended folders if main folder was not found
          if (!that.scope.instance.get_binding("extended_folders") || that.scope.current_folder || that.scope.folder_error) {
            that.scope.removeAttr("_folder_change_pending");
            return;
          }
          that.scope.instance.get_binding("extended_folders").refresh_instances().then(that._ifNotRemoved(function(folders) {
            that.scope.removeAttr("_folder_change_pending");
            that.scope.attr("current_folder", folders[0] ? folders[0].instance : null);
            that.options.folder_list = folders;
            delete that.options.instance;
            that.on();
          }), that._ifNotRemoved(function(error) {
            that.scope.removeAttr("_folder_change_pending");
            that.scope.attr('folder_error', error);
          }));
        });
      }
    },
    "{folder_list} change": function() {
      var pjlength;
      var item = this.scope.instance.get_binding("folders").list[0];
      if(!item && this.scope.instance.get_binding("extended_folders")) {
        item = this.scope.instance.get_binding("extended_folders").list[0];
      }
      this.scope.attr("current_folder", item ? item.instance : null);

      if(this.scope.deferred && this.scope.instance._pending_joins) {
        pjlength = this.scope.instance._pending_joins.length;
        can.each(this.scope.instance._pending_joins.slice(0).reverse(), function(pj, i) {
          if(pj.through === "folders") {
            this.scope.instance._pending_joins.splice(pjlength - i - 1, 1);
          }
        });
      }
    },

    /**
     * Handle a click on the button for detaching an upload folder from
     * a model instance (e.g. an Audit).
     *
     * @param {Object} el - The jQuery-wrapped DOM element on which the event
     *   has been triggered.
     * @param {Object} ev - The event object.
     */
    "a[data-toggle=gdrive-remover] click" : function(el, ev) {
      var scope = this.scope,
          dfd;

      if(scope.deferred) {
        if(scope.current_folder) {
          scope.instance.mark_for_deletion("folders", scope.current_folder);
        } else if (scope.folder_error && !scope.instance.object_folders) {
          // If object_folders are not defined for this instance the error
          // is from extended_folders, we just need to clear folder_error
          // in this case.
          scope.attr('folder_error', null);
        } else {
          can.each(scope.instance.object_folders.reify(), function(object_folder){
            object_folder.refresh().then(function(of){
              scope.instance.mark_for_deletion("object_folders", of);
            });
          });
        }
        dfd = $.when();
      } else {
        dfd = scope._unlinkObjFolders(scope.instance);
      }

      dfd.then(function () {
        if (scope.instance.get_binding("extended_folders")) {
          $.when(
            scope.instance.get_binding("folders").refresh_instances(),
            scope.instance.get_binding("extended_folders").refresh_instances()
          ).then(function (local_bindings, extended_bindings) {
            var self_folders, remote_folders;
            self_folders = can.map(local_bindings, function(folder_binding) {
              return folder_binding.instance;
            });
            remote_folders = can.map(extended_bindings, function(folder_binding) {
              return ~can.inArray(folder_binding.instance, self_folders) ? undefined : folder_binding.instance;
            });

            scope.attr("current_folder", remote_folders[0] || null);
          });
        } else {
          scope.attr("current_folder", null);
        }

        scope.attr('folder_error', null);
      });
    },

    "a[data-toggle=gdrive-picker] click" : function(el, ev) {

      var dfd = GGRC.Controllers.GAPI.authorize(["https://www.googleapis.com/auth/drive"]),
          folder_id = el.data("folder-id");
      dfd.then(function(){
        gapi.load('picker', {'callback': createPicker});

        // Create and render a Picker object for searching images.
        function createPicker() {
          window.oauth_dfd.done(function(token, oauth_user) {
            var dialog,
                picker = new google.picker.PickerBuilder()
                  .setOAuthToken(gapi.auth.getToken().access_token)
                  .setDeveloperKey(GGRC.config.GAPI_KEY)
                  .setCallback(pickerCallback);

            if(el.data('type') === 'folders'){
              var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                .setMimeTypes(["application/vnd.google-apps.folder"])
                .setSelectFolderEnabled(true);
              picker.setTitle('Select folder');
              picker.addView(view);
            }
            else{
              var docsUploadView = new google.picker.DocsUploadView()
                    .setParent(folder_id),
                  docsView = new google.picker.DocsView()
                    .setParent(folder_id);

              picker.addView(docsUploadView)
                .addView(docsView)
                .enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
            }
            picker = picker.build();
            picker.setVisible(true);
            // use undocumented fu to make the Picker be "modal" - https://b2.corp.google.com/issues/18628239
            // this is the "mask" displayed behind the dialog box div
            $('div.picker-dialog-bg').css('zIndex', 2000);  // there are multiple divs of that sort
            // and this is the dialog box modal div, which we must display on top of our modal, if any

            dialog = GGRC.Utils.getPickerElement(picker);
            if (dialog) {
              dialog.style.zIndex = 2001; // our modals start with 1050
            }
          });
        }

        function pickerCallback(data) {

          var files, model,
              PICKED = google.picker.Action.PICKED,
              ACTION = google.picker.Response.ACTION,
              DOCUMENTS = google.picker.Response.DOCUMENTS,
              CANCEL = google.picker.Action.CANCEL;

          if (data[ACTION] == PICKED) {
            if(el.data('type') === 'folders') {
              model = CMS.Models.GDriveFolder;
            } else {
              model = CMS.Mdoels.GDriveFile;
            }
            files = model.models(data[DOCUMENTS]);
            el.trigger('picked', {
              files: files
            });
          }
          else if (data[ACTION] == CANCEL) {
            el.trigger('rejected');
          }
        }
      });
    },

    /**
     * Handle an event of the user picking a new GDrive upload folder.
     *
     * @param {Object} el - The jQuery-wrapped DOM element on which the event
     *   has been triggered.
     * @param {Object} ev - The event object.
     * @param {Object} data - Additional event data.
     *   @param {Array} data.files - The list of GDrive folders the user picked
     *     in the GDrive folder picker modal.
     */
    ".entry-attachment picked": function (el, ev, data) {
      var dfd,
          files = data.files || [],
          scope = this.scope,
          refreshDeferred;  // instance's deferred object_folder refresh action

      if(el.data("type") === "folders"
         && files.length
         && files[0].mimeType !== "application/vnd.google-apps.folder"
      ) {
        $(document.body).trigger("ajax:flash", {
          error: "ERROR: Something other than a Drive folder was chosen for a folder slot.  Please choose a folder."
        });
        return;
      }

      this.scope.attr('_folder_change_pending', true);

      if (!el.data('replace')) {
        dfd = $.when();
      } else {
        if(scope.deferred) {
          if(scope.current_folder) {
            scope.instance.mark_for_deletion("folders", scope.current_folder);
          } else if (scope.folder_error && !scope.instance.object_folders) {
            // If object_folders are not defined for this instance the error
            // is from extended_folders, we just need to clear folder_error
            // in this case.
            scope.attr('folder_error', null);
          } else {
            can.each(scope.instance.object_folders.reify(), function(object_folder){
              object_folder.refresh().then(function(of){
                scope.instance.mark_for_deletion("object_folders", of);
              });
            });
          }
          dfd = $.when();
        } else {
          dfd = scope._unlinkObjFolders(scope.instance);
        }
      }

      return dfd.then(function() {
        if(scope.deferred) {
          return $.when.apply(
            $,
            can.map(files, function(file) {
              scope.instance.mark_for_addition("folders", file);
              return file.refresh();
            })
          );
        } else {
          return GGRC.Controllers.GDriveWorkflow.attach_files(
            files,
            el.data('type'),
            scope.instance
            );
        }
      }).then(function() {
        scope.attr('_folder_change_pending', false);
        scope.attr('folder_error', null);
        scope.attr("current_folder", files[0]);
        if(scope.deferred && scope.instance._transient) {
          scope.instance.attr("_transient.folder", files[0]);
        }
      });
    }
  }
});

can.Component.extend({
  tag: "ggrc-gdrive-picker-launcher",
  template: can.view(GGRC.mustache_path + "/gdrive/gdrive_file.mustache"),
  scope: {
    instance: null,
    deferred: "@",
    icon: "@",
    link_text: "@",
    link_class: "@",
    click_event: "@",
    verify_event: "@",
    modal_description: "@",
    modal_title: "@",
    modal_button: "@",
    trigger_upload: function (scope, el, ev) {
      // upload files without a parent folder (risk assesment)
      var that = this,
          verify_dfd = $.Deferred(),
          folder_id = el.data("folder-id"),
          dfd;

      // Create and render a Picker object for searching images.
      function createPicker() {
        window.oauth_dfd.done(function (token, oauth_user) {
          var dialog,
              picker = new google.picker.PickerBuilder()
                  .setOAuthToken(gapi.auth.getToken().access_token)
                  .setDeveloperKey(GGRC.config.GAPI_KEY)
                  .setCallback(pickerCallback);

          if (el.data('type') === 'folders') {
            var view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true);
            picker.addView(view);
          }
          else {
            var docsUploadView = new google.picker.DocsUploadView()
                    .setParent(folder_id),
                docsView = new google.picker.DocsView()
                    .setParent(folder_id);

            picker.addView(docsUploadView)
                .addView(docsView)
                .enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
          }
          picker = picker.build();
          picker.setVisible(true);

          dialog = GGRC.Utils.getPickerElement(picker);
          if (dialog) {
            dialog.style.zIndex = 2001; // our modals start with 1050
          }
        });
      }

      function pickerCallback(data) {
        var files, models,
            PICKED = google.picker.Action.PICKED,
            ACTION = google.picker.Response.ACTION,
            DOCUMENTS = google.picker.Response.DOCUMENTS,
            CANCEL = google.picker.Action.CANCEL;

        if (data[ACTION] == PICKED) {
          files = CMS.Models.GDriveFile.models(data[DOCUMENTS]);
          that.attr("pending", true);
          return new RefreshQueue().enqueue(files).trigger().then(function (files) {
            doc_dfds = that.handle_file_upload(files);
            $.when.apply($, doc_dfds).then(function () {
              // Trigger modal:success event on scope
              can.trigger(that, "modal:success", {arr: can.makeArray(arguments)});
              el.trigger("modal:success", {arr: can.makeArray(arguments)});
              that.attr('pending', false);
            });
          });
        }
        else if (data[ACTION] == CANCEL) {
          //TODO: hadle canceled uplads
          el.trigger('rejected');
        }
      }

      if (scope.attr("verify_event")) {
        GGRC.Controllers.Modals.confirm({
          modal_description: scope.attr("modal_description"),
          modal_confirm: scope.attr("modal_button"),
          modal_title: scope.attr("modal_title"),
          button_view : GGRC.mustache_path + "/gdrive/confirm_buttons.mustache"
        }, verify_dfd.resolve);
      } else {
        verify_dfd.resolve();
      }

      verify_dfd.done(function () {
        dfd = GGRC.Controllers.GAPI.authorize(["https://www.googleapis.com/auth/drive"]);
        dfd.then(function () {
          gapi.load('picker', {'callback': createPicker});
        });
      });
    },

    trigger_upload_parent: function(scope, el, ev) {
      // upload files with a parent folder (audits and workflows)
      var that = this,
          verify_dfd = $.Deferred(),
          parent_folder_dfd;

      function is_own_folder(mapping, instance) {
        if(mapping.binding.instance !== instance)
          return false;
        if(!mapping.mappings || mapping.mappings.length < 1 || mapping.instance === true)
          return true;
        else {
          return can.reduce(mapping.mappings, function(current, mp) {
            return current || is_own_folder(mp, instance);
          }, false);
        }
      }

      if (scope.attr("verify_event")) {
        GGRC.Controllers.Modals.confirm({
          modal_description: scope.attr("modal_description"),
          modal_confirm: scope.attr("modal_button"),
          modal_title: scope.attr("modal_title"),
          button_view : GGRC.mustache_path + "/gdrive/confirm_buttons.mustache"
        }, verify_dfd.resolve);
      } else {
        verify_dfd.resolve();
      }

      verify_dfd.done(function () {
        if(that.instance.attr("_transient.folder")) {
          parent_folder_dfd = $.when([{ instance: that.instance.attr("_transient.folder") }]);
        } else {
          parent_folder_dfd = that.instance.get_binding("extended_folders").refresh_instances();
        }
        can.Control.prototype.bindXHRToButton(parent_folder_dfd, el);

        parent_folder_dfd.done(function(bindings) {
          var parent_folder;
          if(bindings.length < 1 || !bindings[0].instance.selfLink) {
            //no ObjectFolder or cannot access folder from GAPI
            el.trigger(
                "ajax:flash"
                , {
                  warning : 'Can\'t upload: No GDrive folder found'
                });
            return;
          }

          parent_folder = can.map(bindings, function(binding) {
            return can.reduce(binding.mappings, function(current, mp) {
              return current || is_own_folder(mp, that.instance);
            }, false) ? binding.instance : undefined;
          });
          parent_folder = parent_folder[0] || bindings[0].instance;

          //NB: resources returned from uploadFiles() do not match the properties expected from getting
          // files from GAPI -- "name" <=> "title", "url" <=> "alternateLink".  Of greater annoyance is
          // the "url" field from the picker differs from the "alternateLink" field value from GAPI: the
          // URL has a query parameter difference, "usp=drive_web" vs "usp=drivesdk".  For consistency,
          // when getting file references back from Picker, always put them in a RefreshQueue before
          // using their properties. --BM 11/19/2013
          parent_folder.uploadFiles().then(function(files) {
            that.attr("pending", true);
            return new RefreshQueue().enqueue(files).trigger().then(function(fs) {
              return $.when.apply($, can.map(fs, function(f) {
                if(!~can.inArray(parent_folder.id, can.map(f.parents, function(p) { return p.id; }))) {
                  return f.copyToParent(parent_folder);
                } else {
                  return f;
                }
              }));
            });
          }).done(function() {
            var files = can.map(
                    can.makeArray(arguments),
                    function(file) {
                      return CMS.Models.GDriveFile.model(file);
                    }),
                doc_dfds = that.handle_file_upload(files);
            $.when.apply($, doc_dfds).then(function() {
              can.trigger(that, "modal:success", {arr: can.makeArray(arguments)});
              el.trigger("modal:success", { arr: can.makeArray(arguments) });
              that.attr('pending', false);
            });
          });
        });
      });
    },

    handle_file_upload: function(files){
      var that = this,
          doc_dfds = [];

      can.each(files, function(file) {
        //Since we can re-use existing file references from the picker, check for that case.
        var dfd = CMS.Models.Document.findAll({link : file.alternateLink }).then(function(d) {
          var doc_dfd, object_doc, object_file;

          if(d.length < 1) {
            d.push(
              new CMS.Models.Document({
                context : that.instance.context || {id : null}
                , title : file.title
                , link : file.alternateLink
              })
            );
          }
          if(that.deferred || !d[0].isNew()) {
            doc_dfd = $.when(d[0]);
          } else {
            doc_dfd = d[0].save();
          }

          doc_dfd = doc_dfd.then(function(doc) {
            if(that.deferred) {
              that.instance.mark_for_addition("documents", doc, {
                context : that.instance.context || {id : null}
              });
            } else {
              object_doc = new CMS.Models.ObjectDocument({
                  context : that.instance.context || {id : null}
                  , documentable : that.instance
                  , document : doc
                }).save();
            }

            return $.when(
              CMS.Models.ObjectFile.findAll({ file_id : file.id, fileable_id : d[0].id }),
              object_doc
            ).then(function(ofs) {
              if(ofs.length < 1) {
                if(that.deferred) {
                  doc.mark_for_addition("files", file, {
                    context : that.instance.context || {id : null}
                  });
                } else {
                  return new CMS.Models.ObjectFile({
                    context : that.instance.context || {id : null}
                    , file : file
                    , fileable : doc
                  }).save();
                }
            }})
            .then(function() {
              return doc;
            });
          });
          return doc_dfd;
        });
        doc_dfds.push(dfd);
      });
      return doc_dfds;
    }
  },
  events: {
    init: function() {
      if(!this.scope.link_class) {
        this.scope.attr("link_class", "btn");
      }
    }
    , "{scope} modal:success": function(_scope, _event) {
      var instance = this.scope.instance.reify();
      instance.refresh();
    }
  }
});


  $(document.body).ggrc_controllers_g_drive_workflow();
});

})(this.can, this.can.$);
