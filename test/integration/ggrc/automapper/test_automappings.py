# Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: andraz@reciprocitylabs.com
# Maintained By: andraz@reciprocitylabs.com

import ggrc
import ggrc.models as models
import itertools
import os
import random
import integration.ggrc
import integration.ggrc.generator


if os.environ.get('TRAVIS', False):
  random.seed(1)  # so we can reproduce the tests if needed


counter = 0


def next(msg):
  global counter
  counter += 1
  return msg + str(counter)


class automapping_count_limit:
  def __init__(self, new_limit):
    self.new_limit = new_limit

  def __enter__(self):
    self.original_limit = ggrc.automapper.rules.count_limit
    ggrc.automapper.rules.count_limit = self.new_limit

  def __exit__(self, type, value, traceback):
    ggrc.automapper.rules.count_limit = self.original_limit


class TestAutomappings(integration.ggrc.TestCase):

  def setUp(self):
    integration.ggrc.TestCase.setUp(self)
    self.gen = integration.ggrc.generator.ObjectGenerator()
    self.api = self.gen.api

  def tearDown(self):
    integration.ggrc.TestCase.tearDown(self)

  def create_object(self, cls, data):
    name = cls._inflector.table_singular
    data['context'] = None
    res, obj = self.gen.generate(cls, name, {name: data})
    self.assertIsNotNone(obj, '%s, %s: %s' % (name, str(data), str(res)))
    return obj

  def create_mapping(self, src, dst):
    return self.create_object(models.Relationship, {
        'source': {'id': src.id, 'type': src.type},
        'destination': {'id': dst.id, 'type': dst.type}
    })

  def assert_mapping(self, obj1, obj2, missing=False):
    ggrc.db.session.flush()
    rel = models.Relationship.find_related(obj1, obj2)
    if not missing:
      self.assertIsNotNone(rel,
                           msg='%s not mapped to %s' % (obj1.type, obj2.type))
    else:
      self.assertIsNone(rel,
                        msg='%s mapped to %s' % (obj1.type, obj2.type))

  def assert_mapping_implication(self, to_create, implied, relevant=set()):
    objects = set()
    for obj in relevant:
      objects.add(obj)
    mappings = set()
    relate = lambda src, dst: (src, dst) if src < dst else (dst, src)
    if type(to_create) is not list:
      to_create = [to_create]
    for src, dst in to_create:
      objects.add(src)
      objects.add(dst)
      self.create_mapping(src, dst)
      mappings.add(relate(src, dst))
    if type(implied) is not list:
      implied = [implied]
    for src, dst in implied:
      objects.add(src)
      objects.add(dst)
      self.assert_mapping(src, dst)
      mappings.add(relate(src, dst))
    possible = set()
    for src, dst in itertools.product(objects, objects):
      possible.add(relate(src, dst))
    for src, dst in possible - mappings:
      self.assert_mapping(src, dst, missing=True)

  def with_permutations(self, mk1, mk2, mk3):
    obj1, obj2, obj3 = mk1(), mk2(), mk3()
    self.assert_mapping_implication(
        to_create=[(obj1, obj2), (obj2, obj3)],
        implied=(obj1, obj3),
    )
    obj1, obj2, obj3 = mk1(), mk2(), mk3()
    self.assert_mapping_implication(
        to_create=[(obj2, obj3), (obj1, obj2)],
        implied=(obj1, obj3),
    )

  def test_mapping_directive_to_a_program(self):
    self.with_permutations(
        lambda: self.create_object(models.Program, {'title': next('Program')}),
        lambda: self.create_object(models.Regulation, {
            'title': next('Test PD Regulation')
        }),
        lambda: self.create_object(models.Objective, {
            'title': next('Objective')
        }),
    )
    program = self.create_object(models.Program, {'title': next('Program')})
    objective1 = self.create_object(models.Objective, {
        'title': next('Objective')
    })
    objective2 = self.create_object(models.Objective, {
        'title': next('Objective')
    })
    self.assert_mapping_implication(
        to_create=[(program, objective1), (objective1, objective2)],
        implied=[],
    )

  def test_mapping_to_sections(self):
    regulation = self.create_object(models.Regulation, {
        'title': next('Test Regulation')
    })
    section = self.create_object(models.Section, {
        'title': next('Test section'),
    })
    objective = self.create_object(models.Objective, {
        'title': next('Objective')
    })
    self.assert_mapping_implication(
        to_create=[(regulation, section), (objective, section)],
        implied=(objective, regulation),

    )
    program = self.create_object(models.Program, {'title': next('Program')})
    self.assert_mapping_implication(
        to_create=[(objective, program)],
        implied=[(regulation, section),
                 (objective, section),
                 (objective, regulation)],
        relevant=[regulation, section, objective]
    )

  def test_automapping_limit(self):
    with automapping_count_limit(-1):
      program = self.create_object(models.Program, {'title': next('Program')})
      regulation = self.create_object(models.Regulation, {
          'title': next('Test PD Regulation')
      })
      objective = self.create_object(models.Objective, {
          'title': next('Objective')
      })
      self.assert_mapping_implication(
          to_create=[(regulation, objective), (objective, program)],
          implied=[],
      )

  def test_mapping_to_objective(self):
    regulation = self.create_object(models.Regulation, {
        'title': next('Test PD Regulation')
    })
    section = self.create_object(models.Section, {
        'title': next('Test section'),
        'directive': {'id': regulation.id},
    })
    control = self.create_object(models.Control, {
        'title': next('Test control')
    })
    objective = self.create_object(models.Objective, {
        'title': next('Test control')
    })
    self.assert_mapping_implication(
        to_create=[(regulation, section),
                   (section, objective),
                   (objective, control)],
        implied=[
            (regulation, objective),
            (section, control),
            (regulation, control),
        ]
    )

    program = self.create_object(models.Program, {'title': next('Program')})
    self.assert_mapping_implication(
        to_create=[(control, program)],
        implied=[
            (regulation, section),
            (section, objective),
            (objective, control),
            (regulation, objective),
            (section, control),
            (regulation, control),
        ],
        relevant=[regulation, section, objective, control]
    )

  def test_mapping_between_objectives(self):
    regulation = self.create_object(models.Regulation, {
        'title': next('Test PD Regulation')
    })
    section = self.create_object(models.Section, {
        'title': next('Test section'),
        'directive': {'id': regulation.id},
    })
    objective1 = self.create_object(models.Objective, {
        'title': next('Test Objective')
    })
    objective2 = self.create_object(models.Objective, {
        'title': next('Test Objective')
    })
    self.assert_mapping_implication(
        to_create=[(regulation, section),
                   (section, objective1),
                   (objective1, objective2)],
        implied=[
            (section, objective2),
            (regulation, objective1),
            (regulation, objective2),
        ]
    )

  def test_mapping_nested_controls(self):
    objective = self.create_object(models.Objective, {
        'title': next('Test Objective')
    })
    controlP = self.create_object(models.Control, {
        'title': next('Test control')
    })
    control1 = self.create_object(models.Control, {
        'title': next('Test control')
    })
    control2 = self.create_object(models.Control, {
        'title': next('Test control')
    })
    self.assert_mapping_implication(
        to_create=[(objective, controlP),
                   (controlP, control1),
                   (controlP, control2)],
        implied=[(objective, control1), (objective, control2)]
    )

  def test_automapping_permissions_check(self):
    _, creator = self.gen.generate_person(user_role="Creator")
    _, admin = self.gen.generate_person(user_role="gGRC Admin")

    program = self.create_object(models.Program, {'title': next('Program')})
    regulation = self.create_object(models.Regulation, {
        'title': next('Regulation'),
        'owners': [{"id": admin.id}],
    })
    owners = [{"id": creator.id}]
    self.api.set_user(creator)
    section = self.create_object(models.Section, {
        'title': next('Section'),
        'owners': owners,
    })
    objective = self.create_object(models.Objective, {
        'title': next('Objective'),
        'owners': owners,
    })
    control = self.create_object(models.Control, {
        'title': next('Control'),
        'owners': owners,
    })

    self.api.set_user(admin)
    self.assert_mapping_implication(
        to_create=[(program, regulation), (regulation, section)],
        implied=[(program, section)]
    )

    self.api.set_user(creator)
    self.assert_mapping_implication(
        to_create=[(section, objective),
                   (control, objective)],
        implied=[(program, regulation),
                 (program, section),
                 (section, regulation),
                 (control, section)],
    )

  def test_automapping_request_audit(self):
    _, creator = self.gen.generate_person(user_role="Creator")
    program = self.create_object(models.Program, {'title': next('Program')})
    audit = self.create_object(models.Audit, {
        'title': next('Audit'),
        'program': {'id': program.id},
        'status': 'Planned',
    })
    control = self.create_object(models.Control, {
        'title': next('Test control')
    })
    self.create_mapping(audit, control)
    request = self.create_object(models.Request, {
        'audit': {'id': audit.id},
        'title': next('Request'),
        'assignee': {'id': creator.id},
        'request_type': 'documentation',
        'status': 'Open',
        'requested_on': '1/1/2015',
        'due_on': '1/1/2016',
    })
    self.assert_mapping(request, program)
    self.assert_mapping(request, audit, missing=True)
    self.assert_mapping(request, control, missing=True)

  def test_automapping_control_assesment(self):
    program = self.create_object(models.Program, {'title': next('Program')})
    regulation = self.create_object(models.Regulation, {
        'title': next('Test Regulation')
    })
    audit = self.create_object(models.Audit, {
        'title': next('Audit'),
        'program': {'id': program.id},
        'status': 'Planned',
    })
    control = self.create_object(models.Control, {
        'title': next('Test control')
    })
    control_assessment = self.create_object(models.ControlAssessment, {
        'title': next('Test CA'),
        'audit': {'id': audit.id},
        'control': {'id': control.id},
    })
    self.assert_mapping_implication(
        to_create=[(program, regulation), (regulation, control_assessment)],
        implied=[(program, control_assessment)]
    )
