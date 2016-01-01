/*!
  Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
  Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
  Created By: miha@reciprocitylabs.com
  Maintained By: miha@reciprocitylabs.com
  */

/* eslint max-nested-callbacks: 0 */

describe('GGRC.query_parser', function () {
  var values = {
    a: 'b',
    hello: 'world',
    n: '22',
    '5words': 'These are just 5 words',
    'bacon ipsum':
      'Bacon ipsum dolor amet meatloaf pork loin fatback ball' +
      'tip chicken frankfurter swine bresaola beef ribs ribeye shankle sho' +
      'rt ribs drumstick leberkas sirloin. Turducken hamburger drumstick g' +
      'round round ham biltong. Alcatra turkey brisket pancetta jowl bilto' +
      'ng meatball, shank pork chop. Flank fatback capicola chuck chicken ' +
      'jerky venison meatball beef drumstick.'
  };

  var all_keys = Object.keys(values);

  var parser_structure = {
    parse: jasmine.any(Function),
    join_queries: jasmine.any(Function),
    generated: {
      parse: jasmine.any(Function),
      SyntaxError: jasmine.any(Function)
    }
  };

  it('should exist', function () {
    expect(GGRC.query_parser).toEqual(parser_structure);
  });

  describe('parse', function () {
    it('parses an empty query', function () {
      var empty_result = {
        expression: {},
        keys: [],
        evaluate: jasmine.any(Function),
        order_by: {keys: [], order: '', compare: null}
      };

      expect(GGRC.query_parser.parse('')).toEqual(empty_result);
      expect(GGRC.query_parser.parse(' ')).toEqual(empty_result);
      expect(GGRC.query_parser.parse(' \t ')).toEqual(empty_result);
      expect(GGRC.query_parser.parse('\t')).toEqual(empty_result);
    });

    it('parses text search queries', function () {
      var text_search_queries = [
        '!~a',
        '!~word',
        '!~ --this --is',
        '!~ order by something',
        '!~ order by s,thing',
        '!~ order by s,thin  "elese" g',
        '!~7531902 468'
      ];

      can.each(text_search_queries, function (query_str) {
        var text = query_str.replace('!~', '').trim();

        expect(GGRC.query_parser.parse(query_str)).toEqual({
          expression: {
            text: text,
            op: {name: 'exclude_text_search'},
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [],
          evaluate: jasmine.any(Function)
        });
      });
    });

    it('parses text search queries', function () {
      var textSearchQueries = [
        'a',
        'word',
        ' --this --is',
        ' order by s,thin  "elese" g',
        '~a',
        '~word',
        '~ --this --is',
        '~ order by something',
        '~ order by s,thing',
        '~ order by s,thin  "elese" g',
        '~7531902 468'
      ];

      can.each(textSearchQueries, function (query_str) {
        var text = query_str.replace('~', '').trim();

        expect(GGRC.query_parser.parse(query_str)).toEqual({
          expression: {
            text: text,
            op: {name: 'text_search'},
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [],
          evaluate: jasmine.any(Function)
        });
      });
    });

    it('parses \'=\' queries', function () {
      var simple_queries = [
        'a=b',
        'hello=world',
        ' with = spaces',
        'but= not_all_spaces  '
      ];

      can.each(simple_queries, function (query_str) {
        var query = query_str.split('=');
        expect(GGRC.query_parser.parse(query_str)).toEqual({
          expression: {
            left: query[0].trim(),
            op: {name: '=', evaluate: jasmine.any(Function)},
            right: query[1].trim(),
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [query[0].trim()],
          evaluate: jasmine.any(Function)
        });
      });
    });

    it('parses \'~\' queries', function () {
      expect(
        GGRC.query_parser.parse('5words ~ just')
      ).toEqual({
        expression: {
          left: '5words',
          op: {name: '~', evaluate: jasmine.any(Function)},
          right: 'just',
          evaluate: jasmine.any(Function)
        },
        order_by: {keys: [], order: '', compare: null},
        keys: ['5words'],
        evaluate: jasmine.any(Function)
      });
    });

    it('works with order by statement', function () {
      expect(
        GGRC.query_parser.parse(
          '5words ~ just order by some,"name with spaces" desc')
      ).toEqual({
        expression: {
          left: '5words',
          op: {name: '~', evaluate: jasmine.any(Function)},
          right: 'just',
          evaluate: jasmine.any(Function)
        },
        order_by: {
          keys: ['some', 'name with spaces'],
          order: 'desc',
          compare: jasmine.any(Function)
        },
        keys: ['5words'],
        evaluate: jasmine.any(Function)
      });
    });

    it('parses relevant queries', function () {
      expect(GGRC.query_parser.parse('#SomeClass,1,2,3,4#'))
        .toEqual({
          expression: {
            object_name: 'SomeClass',
            op: {name: 'relevant'},
            ids: ['1', '2', '3', '4'],
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [],
          evaluate: jasmine.any(Function)
        });

      expect(GGRC.query_parser.parse('#SomeClass,1,2,3,4# or #A,1# and #B,2#'))
        .toEqual({
          expression: {
            left: {
              object_name: 'SomeClass',
              op: {name: 'relevant'},
              ids: ['1', '2', '3', '4'],
              evaluate: jasmine.any(Function)
            },
            op: {name: 'OR', evaluate: jasmine.any(Function)},
            right: {
              left: {
                object_name: 'A',
                op: {name: 'relevant'},
                ids: ['1'],
                evaluate: jasmine.any(Function)
              },
              op: {name: 'AND', evaluate: jasmine.any(Function)},
              right: {
                object_name: 'B',
                op: {name: 'relevant'},
                ids: ['2'],
                evaluate: jasmine.any(Function)
              },
              evaluate: jasmine.any(Function)
            },
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [],
          evaluate: jasmine.any(Function)
        });

      expect(GGRC.query_parser.parse('#SomeClass,1,2,3,4# or #A,1#'))
        .toEqual({
          expression: {
            left: {
              object_name: 'SomeClass',
              op: {name: 'relevant'},
              ids: ['1', '2', '3', '4'],
              evaluate: jasmine.any(Function)
            },
            op: {name: 'OR', evaluate: jasmine.any(Function)},
            right: {
              object_name: 'A',
              op: {name: 'relevant'},
              ids: ['1'],
              evaluate: jasmine.any(Function)
            },
            evaluate: jasmine.any(Function)
          },
          order_by: {keys: [], order: '', compare: null},
          keys: [],
          evaluate: jasmine.any(Function)
        });
    });

    describe('evaluate', function () {
      it('returns true on an empty query', function () {
        expect(GGRC.query_parser.parse('').evaluate()).toEqual(true);
        expect(GGRC.query_parser.parse(' ').evaluate()).toEqual(true);
        expect(GGRC.query_parser.parse('\t').evaluate()).toEqual(true);
        expect(GGRC.query_parser.parse('  \t  ').evaluate()).toEqual(true);
        expect(GGRC.query_parser.parse('    \t').evaluate()).toEqual(true);
      });

      it('works on simple queries', function () {
        expect(GGRC.query_parser.parse('a=b')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser.parse('n = 22')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser.parse('5words = "These are just 5 words"')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser.parse('5words = "is a phraze"')
            .evaluate(values)).toEqual(false);
        expect(GGRC.query_parser.parse('n != "this is a phraze"')
            .evaluate(values)).toEqual(true);
      });

      it('works on more comlpex queries', function () {
        expect(GGRC.query_parser.parse('a=b')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser.parse('(n = 22 or n = 5)')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser
            .parse('(n = 22 and  n = 5) and ("bacon ipsum" !~ bacon)')
            .evaluate(values)).toEqual(false);
        expect(GGRC.query_parser
            .parse('("bacon ipsum" ~ bacon) and ("bacon ipsum" !~ bacon)')
            .evaluate(values)).toEqual(false);
        expect(GGRC.query_parser
            .parse('(n = 22 or n = 5) and ("bacon ipsum" ~ bacon)')
            .evaluate(values)).toEqual(true);
        expect(GGRC.query_parser.parse('n != "something that does not exist"')
            .evaluate(values)).toEqual(true);
      });

      it('does full text search', function () {
        expect(GGRC.query_parser.parse('b')
            .evaluate(values, ['n'])).toEqual(false);
        expect(GGRC.query_parser.parse('b')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse('~ 22')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse('bacon')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse('bacon ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse(' ~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse(' ~ bacon something ipsum')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse('order bacon something ipsum')
            .evaluate(values, all_keys)).toEqual(false);
      });

      it('does full text exclude search', function () {
        expect(GGRC.query_parser.parse('!~b')
            .evaluate(values, ['n'])).toEqual(true);
        expect(GGRC.query_parser.parse('!~b')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse('!~ 22')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse('!~bacon')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse('!~bacon ipsum')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse(' !~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse(' !~ bacon something ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse('!~order bacon something ipsum')
            .evaluate(values, all_keys)).toEqual(true);
      });

      it('evaluates expressions that end with a full text search', function () {
        expect(GGRC.query_parser.parse('hello=worldoo or ~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser
            .parse('(hello=worldoo or n=22 ) and ~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse('hello=worldoo and ~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(false);
        expect(GGRC.query_parser.parse('hello=world and ~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(true);
        expect(GGRC.query_parser.parse(' !~ bacon ipsum')
            .evaluate(values, all_keys)).toEqual(false);
      });
    });

    describe('join_queries', function () {
      it('joins two queries with AND by default', function () {
        var same_queries = [
          ['a=b and c=d', 'a=b', 'c=d'],
          ['(a=b) and (c=d)', 'a=b', 'c=d'],
          ['(a=b or c=A) and (c=d)', 'a=b or c=A', 'c=d'],
          ['(a=b or c=A) and (c=d)', '(a=b or c=A) and (c=d)', ''],
          ['(a=b or c=A) and (c=d)', '', '(a=b or c=A) and (c=d)']
        ];

        can.each(same_queries, function (queries) {
          expect(
            JSON.stringify(GGRC.query_parser.parse(queries[0]))
          ).toEqual(
            JSON.stringify(
              GGRC.query_parser.join_queries(
                GGRC.query_parser.parse(queries[1]),
                GGRC.query_parser.parse(queries[2])
              )
            )
          );
        });
      });

      it('joins two queries with OR', function () {
        var same_queries = [
          ['a=b or c=d', 'a=b', 'c=d'],
          ['(a=b) or (c=d)', 'a=b', 'c=d'],
          ['(a=b and c=A) or (c=d)', 'a=b and c=A', 'c=d']
        ];

        can.each(same_queries, function (queries) {
          expect(
            JSON.stringify(GGRC.query_parser.parse(queries[0]))
          ).toEqual(
            JSON.stringify(
              GGRC.query_parser.join_queries(
                GGRC.query_parser.parse(queries[1]),
                GGRC.query_parser.parse(queries[2]),
                'OR'
              )
            )
          );
        });
      });

      it('evaluates joined queries correctly', function () {
        var queries = [
          ['(hello=worldoo or n=22 ) and ~ bacon ipsum',
            '(hello=worldoo or n=22 )',
            '  ~ bacon ipsum'], // should eval to true
          ['hello=worldoo and ~ bacon ipsum',
            'hello=worldoo',
            '~ bacon ipsum'] // should eval to false
        ];

        expect(
          GGRC.query_parser.parse(queries[0][0]).evaluate(values, all_keys)
        ).toEqual(true);
        expect(
          GGRC.query_parser.parse(queries[0][1]).evaluate(values, all_keys)
        ).toEqual(true);
        expect(
          GGRC.query_parser.parse(queries[0][2]).evaluate(values, all_keys)
        ).toEqual(true);

        expect(
          GGRC.query_parser.join_queries(
            GGRC.query_parser.parse(queries[0][1]),
            GGRC.query_parser.parse(queries[0][2])
          ).evaluate(values, all_keys)
        ).toEqual(true);

        expect(
          GGRC.query_parser.parse(queries[1][0]).evaluate(values, all_keys)
        ).toEqual(false);
        expect(
          GGRC.query_parser.parse(queries[1][1]).evaluate(values, all_keys)
        ).toEqual(false);
        expect(
          GGRC.query_parser.parse(queries[1][2]).evaluate(values, all_keys)
        ).toEqual(true);

        expect(
          GGRC.query_parser.join_queries(
            GGRC.query_parser.parse(queries[1][1]),
            GGRC.query_parser.parse(queries[1][2])
          ).evaluate(values, all_keys)
        ).toEqual(false);
      });
    });
  });
});
