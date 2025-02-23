import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$size",
		query: { foo: { $size: 2 } },
		input: [
			{ foo: [1, "a"] },
			{ foo: [{}, {}] },
			{ foo: [1, 2, 3] },
			{ foo: [] },
			{ foo: null },
		],
		expected: [{ foo: [1, "a"] }, { foo: [{}, {}] }],
	},
	{
		name: "$size 0",
		query: { foo: { $size: 0 } },
		input: [
			{ foo: [1, "a"] },
			{ foo: [{}, {}] },
			{ foo: [1, 2, 3] },
			{ foo: [] },
			{ foo: null },
		],
		expected: [{ foo: [] }],
	},
	{
		name: "$size dict access",
		query: { "foo.bar": { $size: 2 } },
		input: [
			{ foo: { bar: [1, 2] } },
			{ foo: [{ bar: {} }, { bar: [2, 2] }] },
			{ foo: { bar: [{}, 2, { g: "f", a: "b", c: "d" }] } },
			{ foo: {} },
			{ foo: [{ bar: [1] }, { bar: [2] }] },
		],
		expected: [
			{ foo: { bar: [1, 2] } },
			{ foo: [{ bar: {} }, { bar: [2, 2] }] },
		],
	},
	{
		name: "$size list access",
		query: { "foo.0.bar": { $size: 2 } },
		input: [
			{ foo: [{ bar: [1, 2] }, { bar: [1, 2, 3] }] },
			{ foo: [{ bar: [1, 2, 3] }, { bar: [1, 2] }] },
			{ foo: { bar: [1, 2] } },
		],
		expected: [{ foo: [{ bar: [1, 2] }, { bar: [1, 2, 3] }] }],
	},
	{
		name: "$size with float",
		query: { foo: { $size: 2.0 } },
		input: [
			{ foo: [1, "a"] },
			{ foo: [{}, {}] },
			{ foo: [1, 2, 3] },
			{ foo: [] },
			{ foo: null },
		],
		expected: [{ foo: [1, "a"] }, { foo: [{}, {}] }],
	},
	{
		name: "$size with invalid query",
		query: { foo: { $size: "bar" } },
		input: [{ foo: [1, 2] }],
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

describe("Query $size tests", async () => {
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
