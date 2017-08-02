/*!
    Copyright (C) 2017 Google Inc.
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
*/

(function (can, $, _, GGRC) {
  'use strict';

  var DOCUMENT_TYPES_MAP = {};

  DOCUMENT_TYPES_MAP[CMS.Models.Document.EVIDENCE] = 'document_evidence';
  DOCUMENT_TYPES_MAP[CMS.Models.Document.URL] = 'document_url';
  DOCUMENT_TYPES_MAP[CMS.Models.Document.REFERENCE_URL] = 'reference_url';

  GGRC.Components('relatedDocuments', {
    tag: 'related-documents',
    viewModel: {
      instance: {},
      documentType: '@',
      documents: [],
      isLoading: false,
      define: {

        // automatically refresh instance on related document create/remove
        autorefresh: {
          type: 'boolean',
          value: true
        }
      },
      getDocumentsQuery: function () {
        var relevantFilters = [{
          type: this.attr('instance.type'),
          id: this.attr('instance.id'),
          operation: 'relevant'
        }];
        var additionalFilter = this.attr('documentType') ?
        {
          expression: {
            left: 'document_type',
            op: {name: '='},
            right: this.attr('documentType')
          }
        } :
        [];

        var query = GGRC.Utils.QueryAPI
          .buildParam('Document', {}, relevantFilters, [], additionalFilter);
        query.order_by = [{name: 'created_at', desc: true}];

        return query;
      },
      loadDocuments: function () {
        var promise;
        var self = this;
        var query = this.getDocumentsQuery();

        this.attr('isLoading', true);
        promise = GGRC.Utils.QueryAPI.batchRequests(query).then(
          function (response) {
            var documents = response.Document.values;
            self.attr('documents').replace(documents);
            self.attr('isLoading', false);
          }
        );
        return promise;
      },
      setDocuments: function () {
        var instance = this.attr('instance');
        var documentType = this.attr('documentType');
        var isSnapshot = this.attr('isSnapshot');
        var documentPath;
        var documents;

        // load documents for non-snapshots objects
        if (!isSnapshot) {
          this.loadDocuments();
          return;
        }

        if (documentType) {
          documentPath = DOCUMENT_TYPES_MAP[documentType];
          documents = instance[documentPath];
        } else {
          // We need to display URL and Evidences together ("Related
          // Assessments pane")
          documents = instance.document_url.concat(instance.document_evidence);
        }

        this.attr('documents').replace(documents);
      },
      removeDocument: function (event) {
        var item = event.item;
        var index = this.attr('documents').indexOf(item);
        this.attr('isLoading', true);
        return this.attr('documents').splice(index, 1);
      },
      addDocuments: function (event) {
        var items = event.items;
        this.attr('isLoading', true);
        return this.attr('documents').unshift
          .apply(this.attr('documents'), items);
      },
      getRelationship: function (document, instance) {
        var instanceRelatedObjects = instance.attr('related_destinations')
          .concat(instance.attr('related_sources'));
        var documentRelatedObjects = document.attr('related_destinations')
          .concat(document.attr('related_sources'));
        var targetRelatedObject = _.find(instanceRelatedObjects,
          function (instanceRelatedObject) {
            var instanceRelatedObjectId = _.get(
              instanceRelatedObject,
              'id'
            );
            return _.some(documentRelatedObjects,
              function (documentRelatedObject) {
                var documentRelatedObjectId = _.get(
                  documentRelatedObject,
                  'id'
                );
                return instanceRelatedObjectId === documentRelatedObjectId;
              }
            );
          }
        );
        return new CMS.Models.Relationship(targetRelatedObject);
      },
      createDocument: function (data) {
        var date = new Date();
        var document = new CMS.Models.Document({
          link: data,
          title: data,
          created_at: date.toISOString(),
          context: this.instance.context || new CMS.Models.Context({
            id: null
          }),
          document_type: this.documentType
        });
        return document;
      },
      saveDocument: function (document) {
        return document.save();
      },
      createRelationship: function (document) {
        var relationship = new CMS.Models.Relationship({
          source: this.instance,
          destination: document,
          context: this.instance.context ||
            new CMS.Models.Context({id: null})
        });
        return relationship.save();
      },
      createRelatedDocument: function (data) {
        var self = this;
        var document = this.createDocument(data);

        this.attr('documents').unshift(document);
        this.attr('isLoading', true);

        return this.saveDocument(document)
          .then(this.createRelationship.bind(this))
          .then(function () {
            return self.instance.refresh();
          })
          .then(function () {
            self.instance.dispatch('refreshRelatedDocuments');
          })
          .fail(function (err) {
            console.error('Unable to create related document: ', err);
          })
          .done(function () {
            self.attr('isLoading', false);
          });
      },
      removeRelationship: function (relationship) {
        return relationship.refresh()
          .then(function (refreshedRelationship) {
            return refreshedRelationship.destroy();
          });
      },
      removeRelatedDocument: function (document) {
        var self = this;
        var documents;
        var relationship = this.getRelationship(document, this.instance);

        if (!relationship.id) {
          console.log('Unable to find relationship');
          return can.Deferred().reject({
            error: 'Unable to find relationship'
          });
        }

        documents = this.attr('documents').filter(function (item) {
          return item.id !== document.id;
        });

        this.attr('isLoading', true);
        this.attr('documents', documents);

        return this.removeRelationship(relationship)
          .then(function () {
            return self.instance.refresh();
          })
          .then(function () {
            self.instance.dispatch('refreshRelatedDocuments');
          })
          .fail(function (err) {
            console.error('Unable to remove related document: ', err);
          })
          .done(function () {
            self.attr('isLoading', false);
          });
      },
      markDocumentForDeletion: function (document) {
        var documents = this.attr('documents').filter(function (item) {
          return item !== document;
        });

        this.attr('documents', documents);
        this.instance.mark_for_deletion('related_objects_as_source', document);
      },
      markDocumentForAddition: function (data) {
        var self = this;
        var document = this.createDocument(data);

        this.attr('documents').unshift(document);
        this.attr('isLoading', true);

        return this.saveDocument(document).then(function () {
          self.instance.mark_for_addition(
            'related_objects_as_source',
            document
          );
          self.attr('isLoading', false);
        });
      }
    },
    init: function () {
      var instance = this.viewModel.attr('instance');
      var isNew = instance.isNew();
      var isSnapshot = !!(instance.snapshot || instance.isRevision);

      // don't need to load documents for unsaved instance
      if (!isNew) {
        this.viewModel.attr('isSnapshot', isSnapshot);
        this.viewModel.setDocuments();
      }
    },
    events: {
      '{viewModel.instance} refreshRelatedDocuments': function () {
        if (this.viewModel.autorefresh) {
          this.viewModel.loadDocuments();
        }
      }
    }
  });
})(window.can, window.can.$, window._, window.GGRC);
