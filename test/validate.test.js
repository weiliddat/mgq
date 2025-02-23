import assert from "node:assert";
import { describe, test } from "node:test";
import { Query } from "../mgq.js";

describe("Query Validation", () => {
	test("basic validation", () => {
		assert.doesNotThrow(() => Query({ foo: "bar" }).validate());
		assert.throws(() => Query(null).validate(), TypeError);
		assert.throws(() => Query([{ foo: "bar" }]).validate(), TypeError);
	});

	test("$and validation", () => {
		assert.doesNotThrow(() => Query({ $and: [{ foo: "bar" }] }).validate());
		assert.throws(() => Query({ $and: "not-a-list" }).validate(), TypeError);
		assert.throws(
			() => Query({ $and: [{ foo: "bar" }, "not-a-dict"] }).validate(),
			TypeError,
		);
		assert.throws(
			() =>
				Query({
					$and: [{ foo: "bar" }, { $and: "not-a-list" }],
				}).validate(),
			TypeError,
		);
	});

	test("$or validation", () => {
		assert.doesNotThrow(() => Query({ $or: [{ foo: "bar" }] }).validate());
		assert.throws(() => Query({ $or: "not-a-list" }).validate(), TypeError);
		assert.throws(
			() => Query({ $or: [{ foo: "bar" }, "not-a-dict"] }).validate(),
			TypeError,
		);
		assert.throws(
			() =>
				Query({
					$or: [{ foo: "bar" }, { $or: "not-a-list" }],
				}).validate(),
			TypeError,
		);
	});

	test("$nor validation", () => {
		assert.doesNotThrow(() => Query({ $nor: [{ foo: "bar" }] }).validate());
		assert.throws(() => Query({ $nor: "not-a-list" }).validate(), TypeError);
		assert.throws(
			() => Query({ $nor: [{ foo: "bar" }, "not-a-dict"] }).validate(),
			TypeError,
		);
		assert.throws(
			() =>
				Query({
					$nor: [{ foo: "bar" }, { $nor: "not-a-list" }],
				}).validate(),
			TypeError,
		);
	});

	test("$in and $nin validation", () => {
		assert.doesNotThrow(() =>
			Query({ foo: { $in: ["bar", "baz"] } }).validate(),
		);
		assert.doesNotThrow(() =>
			Query({ foo: { $nin: ["bar", "baz"] } }).validate(),
		);
		assert.throws(
			() => Query({ foo: { $in: "not-a-list" } }).validate(),
			TypeError,
		);
		assert.throws(
			() => Query({ foo: { $nin: "not-a-list" } }).validate(),
			TypeError,
		);
	});

	test("$all validation", () => {
		assert.doesNotThrow(() =>
			Query({ foo: { $all: ["bar", "baz"] } }).validate(),
		);
		assert.doesNotThrow(() => Query({ foo: { $all: [] } }).validate());
		assert.doesNotThrow(() =>
			Query({ foo: { $all: [{ $elemMatch: { foo: "bar" } }] } }).validate(),
		);
		assert.throws(
			() => Query({ foo: { $all: "not-a-list" } }).validate(),
			TypeError,
		);
		assert.throws(
			() => Query({ foo: { $all: { foo: "bar" } } }).validate(),
			TypeError,
		);
		assert.throws(
			() => Query({ foo: { $all: [{ $and: [{ foo: "bar" }] }] } }).validate(),
			TypeError,
		);
	});

	test("$mod validation", () => {
		assert.doesNotThrow(() => Query({ foo: { $mod: [5, 1] } }).validate());
		assert.throws(
			() => Query({ foo: { $mod: "not-a-list" } }).validate(),
			TypeError,
		);
		assert.throws(
			() => Query({ foo: { $mod: ["a", "b"] } }).validate(),
			TypeError,
		);
	});

	test("$size validation", () => {
		assert.doesNotThrow(() => Query({ foo: { $size: 2 } }).validate());
		assert.throws(() => Query({ foo: { $size: "2" } }).validate(), TypeError);
		assert.throws(
			() => Query({ foo: { $size: ["a", "b"] } }).validate(),
			TypeError,
		);
	});
});

test("validate should return query", () => {
	const query = Query({ foo: "bar" });
	assert.deepStrictEqual(query.validate(), query);
});
