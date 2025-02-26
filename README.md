# mgq

[![codecov](https://codecov.io/github/weiliddat/mgq/graph/badge.svg?token=FC3NO3ohgU)](https://codecov.io/github/weiliddat/mgq)

[MongoDB query](https://www.mongodb.com/docs/manual/reference/operator/query/) as a predicate function.

This aims to be consistent with how MongoDB's matches documents.
This includes traversal across nested dicts and lists, None and field-presence/absence handling.

JavaScript port of [mgqpy](https://pypi.org/project/mgqpy/).

```js
import { Query } from "mgq";

const predicate = Query({ "foo.bar": { $gt: 1 } });

const inputs = [
  { foo: [{ bar: [1, 2] }] },
  { foo: { bar: 1 } },
  { foo: { bar: 2 } },
  { foo: null },
];

const filtered = inputs.filter(predicate.test);

assert.deepEqual(filtered, [{ foo: [{ bar: [1, 2] }] }, { foo: { bar: 2 } }]);
```

## Supported operators

Comparison query operators

- [x] \$eq
- [x] \$eq (implicit), e.g. `{"foo": None}`
- [x] \$ne
- [x] \$gt
- [x] \$gte
- [x] \$lt
- [x] \$lte
- [x] \$in
- [x] \$nin

Logical query operators

- [x] \$and
- [x] \$and (implicit), e.g. `{"foo": 1, "bar": "baz"}`
- [x] \$or
- [x] \$not
- [x] \$nor

Evaluation query operators

- [x] \$regex
- [x] \$regex (implicit), e.g. `{"foo": re.compile('^bar')}`
- [x] \$mod
- [x] \$where

Array query operators

- [x] \$all
- [x] \$elemMatch
- [x] \$size
