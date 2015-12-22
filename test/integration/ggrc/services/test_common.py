# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: david@reciprocitylabs.com
# Maintained By: david@reciprocitylabs.com

import ggrc
import ggrc.builder
import ggrc.services
import json
import random
import time
from datetime import datetime
from ggrc import db
from ggrc.models.mixins import Base
from ggrc.services.common import Resource
from integration.ggrc import TestCase
from urlparse import urlparse
from wsgiref.handlers import format_date_time
from nose.plugins.skip import SkipTest


class ServicesTestMockModel(Base, ggrc.db.Model):
  __tablename__ = 'test_model'
  foo = db.Column(db.String)
  code = db.Column(db.String, unique=True)

  # REST properties
  _publish_attrs = ['modified_by_id', 'foo', 'code']
  _update_attrs = ['foo', 'code']

URL_MOCK_COLLECTION = '/api/mock_resources'
URL_MOCK_RESOURCE = '/api/mock_resources/{0}'
Resource.add_to(
    ggrc.app.app, URL_MOCK_COLLECTION, model_class=ServicesTestMockModel)

COLLECTION_ALLOWED = ['HEAD', 'GET', 'POST', 'OPTIONS']
RESOURCE_ALLOWED = ['HEAD', 'GET', 'PUT', 'DELETE', 'OPTIONS']


class TestResource(TestCase):
  def setUp(self):
    super(TestResource, self).setUp()
    # Explicitly create test tables
    if not ServicesTestMockModel.__table__.exists(db.engine):
      ServicesTestMockModel.__table__.create(db.engine)
    with self.client.session_transaction() as session:
      session['permissions'] = {
          "__GGRC_ADMIN__": {"__GGRC_ALL__": {"contexts": [0]}}
      }

  def tearDown(self):
    super(TestResource, self).tearDown()
    # Explicitly destroy test tables
    # Note: This must be after the 'super()', because the session is
    #   closed there.  (And otherwise it might stall due to locks).
    if ServicesTestMockModel.__table__.exists(db.engine):
      ServicesTestMockModel.__table__.drop(db.engine)

  def mock_url(self, resource=None):
    if resource is not None:
      return URL_MOCK_RESOURCE.format(resource)
    return URL_MOCK_COLLECTION

  def mock_json(self, model):
    format = '%Y-%m-%dT%H:%M:%S'
    updated_at = unicode(model.updated_at.strftime(format))
    created_at = unicode(model.created_at.strftime(format))
    return {
        u'id': int(model.id),
        u'selfLink': unicode(URL_MOCK_RESOURCE.format(model.id)),
        u'type': unicode(model.__class__.__name__),
        u'modified_by': {
            u'href': u'/api/people/1',
            u'id': model.modified_by_id,
            u'type': 'Person',
            u'context_id': None
        } if model.modified_by_id is not None else None,
        u'modified_by_id': int(model.modified_by_id),
        u'updated_at': updated_at,
        u'created_at': created_at,
        u'context':
            {u'id': model.context_id}
            if model.context_id is not None else None,
        u'foo': (unicode(model.foo) if model.foo else None),
    }

  def mock_model(self, id=None, modified_by_id=1, **kwarg):
    if 'id' not in kwarg:
      kwarg['id'] = random.randint(0, 999999999)
    if 'modified_by_id' not in kwarg:
      kwarg['modified_by_id'] = 1
    mock = ServicesTestMockModel(**kwarg)
    ggrc.db.session.add(mock)
    ggrc.db.session.commit()
    return mock

  def http_timestamp(self, timestamp):
    return format_date_time(time.mktime(timestamp.utctimetuple()))

  def get_location(self, response):
    """Ignore the `http://localhost` prefix of the Location"""
    return response.headers['Location'][16:]

  def assertRequiredHeaders(self, response,
                            headers={'Content-Type': 'application/json'}):
    self.assertIn('Etag', response.headers)
    self.assertIn('Last-Modified', response.headers)
    self.assertIn('Content-Type', response.headers)
    for k, v in headers.items():
      self.assertEqual(v, response.headers.get(k))

  def assertAllow(self, response, allowed=None):
    self.assert405(response)
    self.assertIn('Allow', response.headers)
    if allowed:
      self.assertItemsEqual(allowed, response.headers['Allow'].split(', '))

  def assertOptions(self, response, allowed):
    self.assertIn('Allow', response.headers)
    self.assertItemsEqual(allowed, response.headers['Allow'].split(', '))

  def headers(self, *args, **kwargs):
    ret = list(args)
    ret.append(('X-Requested-By', 'Unit Tests'))
    ret.extend(kwargs.items())
    return ret

  def test_X_Requested_By_required(self):
    response = self.client.post(self.mock_url())
    self.assert400(response)
    response = self.client.put(self.mock_url() + '/1', data='blah')
    self.assert400(response)
    response = self.client.delete(self.mock_url() + '/1')
    self.assert400(response)

  def test_empty_collection_get(self):
    response = self.client.get(self.mock_url(), headers=self.headers())
    self.assert200(response)

  def test_missing_resource_get(self):
    response = self.client.get(self.mock_url('foo'), headers=self.headers())
    self.assert404(response)

  @SkipTest
  def test_collection_get(self):
    date1 = datetime(2013, 4, 17, 0, 0, 0, 0)
    date2 = datetime(2013, 4, 20, 0, 0, 0, 0)
    mock1 = self.mock_model(
        modified_by_id=42, created_at=date1, updated_at=date1)
    mock2 = self.mock_model(
        modified_by_id=43, created_at=date2, updated_at=date2)
    response = self.client.get(self.mock_url(), headers=self.headers())
    self.assert200(response)
    self.assertRequiredHeaders(
        response,
        {
            'Last-Modified': self.http_timestamp(date2),
            'Content-Type': 'application/json',
        })
    self.assertIn('test_model_collection', response.json)
    self.assertEqual(2, len(response.json['test_model_collection']))
    self.assertIn('selfLink', response.json['test_model_collection'])
    self.assertIn('test_model', response.json['test_model_collection'])
    collection = response.json['test_model_collection']['test_model']
    self.assertEqual(2, len(collection))
    self.assertDictEqual(self.mock_json(mock2), collection[0])
    self.assertDictEqual(self.mock_json(mock1), collection[1])

  @SkipTest
  def test_resource_get(self):
    date1 = datetime(2013, 4, 17, 0, 0, 0, 0)
    mock1 = self.mock_model(
        modified_by_id=42, created_at=date1, updated_at=date1)
    response = self.client.get(self.mock_url(mock1.id), headers=self.headers())
    self.assert200(response)
    self.assertRequiredHeaders(
        response,
        {
            'Last-Modified': self.http_timestamp(date1),
            'Content-Type': 'application/json',
        })
    self.assertIn('services_test_mock_model', response.json)
    self.assertDictEqual(self.mock_json(mock1),
                         response.json['services_test_mock_model'])

  def test_collection_put(self):
    self.assertAllow(
        self.client.put(URL_MOCK_COLLECTION, headers=self.headers()),
        COLLECTION_ALLOWED)

  def test_collection_delete(self):
    self.assertAllow(
        self.client.delete(URL_MOCK_COLLECTION, headers=self.headers()),
        COLLECTION_ALLOWED)

  def test_collection_post_successful(self):
    data = json.dumps(
        {'services_test_mock_model': {'foo': 'bar', 'context': None}})
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='application/json',
        data=data,
        headers=self.headers(),
    )
    self.assertStatus(response, 201)
    self.assertIn('Location', response.headers)
    response = self.client.get(
        self.get_location(response), headers=self.headers())
    self.assert200(response)
    self.assertIn('Content-Type', response.headers)
    self.assertEqual('application/json', response.headers['Content-Type'])
    self.assertIn('services_test_mock_model', response.json)
    self.assertIn('foo', response.json['services_test_mock_model'])
    self.assertEqual('bar', response.json['services_test_mock_model']['foo'])
    # check the collection, too
    response = self.client.get(URL_MOCK_COLLECTION, headers=self.headers())
    self.assert200(response)
    self.assertEqual(
        1, len(response.json['test_model_collection']['test_model']))
    self.assertEqual(
        'bar', response.json['test_model_collection']['test_model'][0]['foo'])

  def test_collection_post_successful_single_array(self):
    data = json.dumps(
        [{'services_test_mock_model': {'foo': 'bar', 'context': None}}])
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='application/json',
        data=data,
        headers=self.headers(),
    )
    self.assert200(response)
    self.assertEqual(type(response.json), list)
    self.assertEqual(len(response.json), 1)

    response = self.client.get(URL_MOCK_COLLECTION, headers=self.headers())
    self.assert200(response)
    self.assertEqual(
        1, len(response.json['test_model_collection']['test_model']))
    self.assertEqual(
        'bar', response.json['test_model_collection']['test_model'][0]['foo'])

  def test_collection_post_successful_multiple(self):
    data = json.dumps([
      {'services_test_mock_model': {'foo': 'bar1', 'context': None}},
      {'services_test_mock_model': {'foo': 'bar2', 'context': None}},
    ])
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='application/json',
        data=data,
        headers=self.headers(),
    )
    self.assert200(response)
    self.assertEqual(type(response.json), list)
    self.assertEqual(len(response.json), 2)
    self.assertEqual(
        'bar1', response.json[0][1]['services_test_mock_model']['foo'])
    self.assertEqual(
        'bar2', response.json[1][1]['services_test_mock_model']['foo'])
    response = self.client.get(URL_MOCK_COLLECTION, headers=self.headers())
    self.assert200(response)
    self.assertEqual(
        2, len(response.json['test_model_collection']['test_model']))

  def test_collection_post_successful_multiple_with_errors(self):
    data = json.dumps([
      {'services_test_mock_model':
        {'foo': 'bar1', 'code': 'f1', 'context': None}},
      {'services_test_mock_model':
        {'foo': 'bar1', 'code': 'f1', 'context': None}},
      {'services_test_mock_model':
        {'foo': 'bar2', 'code': 'f2', 'context': None}},
      {'services_test_mock_model':
        {'foo': 'bar2', 'code': 'f2', 'context': None}},
    ])
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='application/json',
        data=data,
        headers=self.headers(),
    )

    self.assertEqual(403, response.status_code)
    self.assertEqual([201, 403, 201, 403], [i[0] for i in response.json])
    self.assertEqual(
        'bar1', response.json[0][1]['services_test_mock_model']['foo'])
    self.assertEqual(
        'bar2', response.json[2][1]['services_test_mock_model']['foo'])
    response = self.client.get(URL_MOCK_COLLECTION, headers=self.headers())
    self.assert200(response)
    self.assertEqual(
        2, len(response.json['test_model_collection']['test_model']))

  def test_collection_post_bad_request(self):
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='application/json',
        data='This is most definitely not valid content.',
        headers=self.headers(),
    )
    self.assert400(response)

  def test_collection_post_bad_content_type(self):
    response = self.client.post(
        URL_MOCK_COLLECTION,
        content_type='text/plain',
        data="Doesn't matter, now does it?",
        headers=self.headers(),
    )
    self.assertStatus(response, 415)

  def test_put_successful(self):
    mock = self.mock_model(foo='buzz')
    response = self.client.get(self.mock_url(mock.id), headers=self.headers())
    self.assert200(response)
    self.assertRequiredHeaders(response)
    obj = response.json
    self.assertEqual('buzz', obj['services_test_mock_model']['foo'])
    obj['services_test_mock_model']['foo'] = 'baz'
    url = urlparse(obj['services_test_mock_model']['selfLink']).path
    original_headers = dict(response.headers)
    # wait a moment so that we can be sure to get differing Last-Modified
    # after the put - the lack of latency means it's easy to end up with
    # the same HTTP timestamp thanks to the standard's lack of precision.
    time.sleep(1.1)
    response = self.client.put(
        url,
        data=json.dumps(obj),
        headers=self.headers(
            ('If-Unmodified-Since', original_headers['Last-Modified']),
            ('If-Match', original_headers['Etag']),
        ),
        content_type='application/json',
    )
    self.assert200(response)
    response = self.client.get(url, headers=self.headers())
    self.assert200(response)
    self.assertNotEqual(
        original_headers['Last-Modified'], response.headers['Last-Modified'])
    self.assertNotEqual(
        original_headers['Etag'], response.headers['Etag'])
    self.assertEqual('baz', response.json['services_test_mock_model']['foo'])

  def test_put_bad_request(self):
    mock = self.mock_model(foo='tough')
    response = self.client.get(self.mock_url(mock.id), headers=self.headers())
    self.assert200(response)
    self.assertRequiredHeaders(response)
    url = urlparse(response.json['services_test_mock_model']['selfLink']).path
    response = self.client.put(
        url,
        content_type='application/json',
        data='This is most definitely not valid content.',
        headers=self.headers(
            ('If-Unmodified-Since', response.headers['Last-Modified']),
            ('If-Match', response.headers['Etag']))
    )
    self.assert400(response)

  @SkipTest
  def test_put_and_delete_conflict(self):
    mock = self.mock_model(foo='mudder')
    response = self.client.get(self.mock_url(mock.id), headers=self.headers())
    self.assert200(response)
    self.assertRequiredHeaders(response)
    obj = response.json
    obj['services_test_mock_model']['foo'] = 'rocks'
    mock = ggrc.db.session.query(ServicesTestMockModel).filter(
        ServicesTestMockModel.id == mock.id).one()
    mock.foo = 'dirt'
    ggrc.db.session.add(mock)
    ggrc.db.session.commit()
    url = urlparse(obj['services_test_mock_model']['selfLink']).path
    original_headers = dict(response.headers)
    response = self.client.put(
        url,
        data=json.dumps(obj),
        headers=self.headers(
            ('If-Unmodified-Since', original_headers['Last-Modified']),
            ('If-Match', original_headers['Etag'])
        ),
        content_type='application/json',
    )
    self.assertStatus(response, 409)
    response = self.client.delete(
        url,
        headers=self.headers(
            ('If-Unmodified-Since', original_headers['Last-Modified']),
            ('If-Match', original_headers['Etag'])
        ),
        content_type='application/json',
    )
    self.assertStatus(response, 409)

  @SkipTest
  def test_put_and_delete_missing_precondition(self):
    mock = self.mock_model(foo='tricky')
    response = self.client.get(self.mock_url(mock.id), headers=self.headers())
    self.assert200(response)
    obj = response.json
    obj['services_test_mock_model']['foo'] = 'strings'
    url = urlparse(obj['services_test_mock_model']['selfLink']).path
    response = self.client.put(
        url,
        data=json.dumps(obj),
        content_type='application/json',
        headers=self.headers(),
    )
    self.assertStatus(response, 428)
    response = self.client.delete(url, headers=self.headers())
    self.assertStatus(response, 428)

  @SkipTest
  def test_delete_successful(self):
    mock = self.mock_model(foo='delete me')
    response = self.client.get(self.mock_url(mock.id), headers=self.headers())
    self.assert200(response)
    url = urlparse(response.json['services_test_mock_model']['selfLink']).path
    response = self.client.delete(
        url,
        headers=self.headers(
            ('If-Unmodified-Since', response.headers['Last-Modified']),
            ('If-Match', response.headers['Etag']),
        ),
    )
    self.assert200(response)
    response = self.client.get(url, headers=self.headers())
    # 410 would be nice! But, requires a tombstone.
    self.assert404(response)

  def test_options(self):
    mock = self.mock_model()
    response = self.client.open(
        self.mock_url(mock.id), method='OPTIONS', headers=self.headers())
    self.assertOptions(response, RESOURCE_ALLOWED)

  def test_collection_options(self):
    response = self.client.open(
        self.mock_url(), method='OPTIONS', headers=self.headers())
    self.assertOptions(response, COLLECTION_ALLOWED)

  def test_get_bad_accept(self):
    mock1 = self.mock_model(foo='baz')
    response = self.client.get(
        self.mock_url(mock1.id),
        headers=self.headers(('Accept', 'text/plain')))
    self.assertStatus(response, 406)
    self.assertEqual('text/plain', response.headers.get('Content-Type'))
    self.assertEqual('application/json', response.data)

  def test_collection_get_bad_accept(self):
    response = self.client.get(
        URL_MOCK_COLLECTION,
        headers=self.headers(('Accept', 'text/plain')))
    self.assertStatus(response, 406)
    self.assertEqual('text/plain', response.headers.get('Content-Type'))
    self.assertEqual('application/json', response.data)

  def test_get_if_none_match(self):
    mock1 = self.mock_model(foo='baz')
    response = self.client.get(
        self.mock_url(mock1.id),
        headers=self.headers(('Accept', 'application/json')))
    self.assert200(response)
    previous_headers = dict(response.headers)
    response = self.client.get(
        self.mock_url(mock1.id),
        headers=self.headers(
            ('Accept', 'application/json'),
            ('If-None-Match', previous_headers['Etag']),
        ),
    )
    self.assertStatus(response, 304)
    self.assertIn('Etag', response.headers)

  @SkipTest
  def test_collection_get_if_non_match(self):
    self.mock_model(foo='baz')
    response = self.client.get(
        URL_MOCK_COLLECTION,
        headers=self.headers(('Accept', 'application/json')))
    self.assert200(response)
    previous_headers = dict(response.headers)
    response = self.client.get(
        URL_MOCK_COLLECTION,
        headers=self.headers(
            ('Accept', 'application/json'),
            ('If-None-Match', previous_headers['Etag']),
        ),
    )
    self.assertStatus(response, 304)
    self.assertIn('Etag', response.headers)
