import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$all",
		query: {
			foo: { $all: ["bar", "baz"] },
		},
		input: [
			{ foo: ["bar", "baz"] },
			{ foo: [["bar", "baz"]] },
			{ foo: ["qux", "bar", "baz"] },
			{ foo: ["qux", ["bar", "baz"]] },
			{ foo: "bar" },
			{ foo: ["baz"] },
			{ foo: null },
			{},
		],
		expected: [{ foo: ["bar", "baz"] }, { foo: ["qux", "bar", "baz"] }],
	},
	{
		name: "$all with nested list ov",
		query: {
			foo: { $all: [["baz", "qux"]] },
		},
		input: [
			{ foo: ["baz", "qux"] },
			{ foo: [["baz", "qux"]] },
			{
				foo: [
					["quux", "quuz"],
					["baz", "qux"],
				],
			},
			{ foo: [1, 2, ["baz", "qux"], "quux"] },
			{ foo: ["baz"] },
			{ foo: null },
			{},
		],
		expected: [
			{ foo: ["baz", "qux"] },
			{ foo: [["baz", "qux"]] },
			{
				foo: [
					["quux", "quuz"],
					["baz", "qux"],
				],
			},
			{ foo: [1, 2, ["baz", "qux"], "quux"] },
		],
	},
	{
		name: "$all with dict access",
		query: {
			"foo.bar": { $all: ["baz", "qux"] },
		},
		input: [
			{ foo: { bar: ["baz", "qux"] } },
			{ foo: [{ bar: ["baz"] }, { bar: ["baz", "qux"] }] },
			{ foo: { bar: [["baz", "qux"]] } },
			{ foo: { bar: ["quux", "baz", "qux"] } },
			{
				foo: {
					bar: [
						["quux", "quuz"],
						["baz", "qux"],
					],
				},
			},
			{ foo: { bar: [1, 2, ["baz", "qux"], "quux"] } },
			{ foo: { bar: "baz" } },
			{ foo: { bar: null } },
			{},
		],
		expected: [
			{ foo: { bar: ["baz", "qux"] } },
			{ foo: [{ bar: ["baz"] }, { bar: ["baz", "qux"] }] },
			{ foo: { bar: ["quux", "baz", "qux"] } },
		],
	},
	{
		name: "$all with indexed array access",
		query: {
			"foo.1.bar": { $all: ["baz", "qux"] },
		},
		input: [
			{ foo: [{ bar: ["baz", "qux"] }] },
			{ foo: [{ bar: ["baz"] }, { bar: ["baz", "qux"] }] },
			{ foo: [{ bar: [["baz", "qux"]] }] },
			{ foo: [1, { bar: ["quux", "baz", "qux"] }] },
			{
				foo: [
					{
						bar: [
							["quux", "quuz"],
							["baz", "qux"],
						],
					},
				],
			},
			{ foo: [{ bar: [1, 2, ["baz", "qux"], "quux"] }] },
			{ foo: { bar: "baz" } },
			{ foo: { bar: null } },
			{},
		],
		expected: [
			{ foo: [{ bar: ["baz"] }, { bar: ["baz", "qux"] }] },
			{ foo: [1, { bar: ["quux", "baz", "qux"] }] },
		],
	},
	{
		name: "$all with $elemMatch subqueries",
		query: {
			qty: {
				$all: [
					{ $elemMatch: { size: "M", num: { $gt: 50 } } },
					{ $elemMatch: { num: 100, color: "green" } },
				],
			},
		},
		input: [
			{
				code: "xyz",
				tags: ["school", "book", "bag", "headphone", "appliance"],
				qty: [
					{ size: "S", num: 10, color: "blue" },
					{ size: "M", num: 45, color: "blue" },
					{ size: "L", num: 100, color: "green" },
				],
			},
			{
				code: "abc",
				tags: ["appliance", "school", "book"],
				qty: [
					{ size: "6", num: 100, color: "green" },
					{ size: "6", num: 50, color: "blue" },
					{ size: "8", num: 100, color: "brown" },
				],
			},
			{
				code: "efg",
				tags: ["school", "book"],
				qty: [
					{ size: "S", num: 10, color: "blue" },
					{ size: "M", num: 100, color: "blue" },
					{ size: "L", num: 100, color: "green" },
				],
			},
			{
				code: "ijk",
				tags: ["electronics", "school"],
				qty: [{ size: "M", num: 100, color: "green" }],
			},
		],
		expected: [
			{
				code: "efg",
				tags: ["school", "book"],
				qty: [
					{ size: "S", num: 10, color: "blue" },
					{ size: "M", num: 100, color: "blue" },
					{ size: "L", num: 100, color: "green" },
				],
			},
			{
				code: "ijk",
				tags: ["electronics", "school"],
				qty: [{ size: "M", num: 100, color: "green" }],
			},
		],
	},
	{
		name: "$all with other $ subquery",
		query: {
			foo: {
				$all: [{ $or: [{ bar: "baz" }, { bar: "qux" }] }],
			},
		},
		input: [
			{ foo: [{ bar: "baz" }, { bar: "qux" }] },
			{ foo: [{ bar: { $eq: "baz" } }, { bar: { $eq: "qux" } }] },
		],
		expected: [],
	},
	{
		name: "$all with empty ov",
		query: { foo: { $all: [] } },
		input: [
			{ foo: [{ bar: "baz" }, { bar: "qux" }] },
			{ foo: [{ bar: { $eq: "baz" } }, { bar: { $eq: "qux" } }] },
		],
		expected: [],
	},
	{
		name: "$all with invalid query",
		query: { foo: { $all: { foo: "bar" } } },
		input: [{ foo: "bar" }],
		expected: [],
	},
];

/** @type {MongoMemoryServer} */
let mongod;

/** @type {MongoClient} */
let client;

/** @type {Collection} */
let collection;

before(async () => {
	try {
		mongod = await MongoMemoryServer.create();
		const uri = mongod.getUri();
		client = new MongoClient(uri);
		await client.connect();
		collection = client.db("test").collection("test");
	} catch (error) {
		console.error(error);
	}
});

after(async () => {
	try {
		await client.close();
		await mongod.stop();
	} catch (error) {
		console.error(error);
	}
});

afterEach(async () => {
	try {
		await collection.deleteMany({});
	} catch (error) {
		console.error(error);
	}
});

describe("Query $all tests", async () => {
	for (const { name, query, input, expected } of testCases) {
		await test(name, async () => {
			const mongoExpected = await getMongoResults(collection, query, input);
			assert.deepStrictEqual(mongoExpected, expected);

			const q = new Query(query);
			const actual = getFilterResults(q.test.bind(q), input);
			assert.deepStrictEqual(actual, expected);
		});
	}
});
