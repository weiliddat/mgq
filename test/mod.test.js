import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$mod",
		query: {
			foo: { $mod: [3, 0] },
		},
		input: [
			{ foo: -3 },
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{ foo: 3 },
			{ foo: 4 },
			{ foo: 5 },
			{ foo: 6 },
			{ foo: "6" },
		],
		expected: [{ foo: -3 }, { foo: 0 }, { foo: 3 }, { foo: 6 }],
	},
	{
		name: "$mod with floats",
		query: {
			foo: { $mod: [3.5, 0.1] },
		},
		input: [
			{ foo: 2.9 },
			{ foo: 3.0 },
			{ foo: 3.1 },
			{ foo: 3.5 },
			{ foo: 3.9 },
			{ foo: 4 },
			{ foo: 5 },
		],
		expected: [{ foo: 3.0 }, { foo: 3.1 }, { foo: 3.5 }, { foo: 3.9 }],
	},
	{
		name: "$mod with negative input",
		query: {
			foo: { $mod: [-3, -0] },
		},
		input: [
			{ foo: -3 },
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{ foo: 3 },
			{ foo: 4 },
			{ foo: 5 },
			{ foo: 6 },
		],
		expected: [{ foo: -3 }, { foo: 0 }, { foo: 3 }, { foo: 6 }],
	},
	{
		name: "$mod with dict access",
		query: {
			"foo.bar": { $mod: [3, 0] },
		},
		input: [{ foo: { bar: -3 } }],
		expected: [{ foo: { bar: -3 } }],
	},
	{
		name: "$mod against list",
		query: {
			foo: { $mod: [3, 0] },
		},
		input: [{ foo: [3] }, { foo: [3, 6] }, { foo: [3, 1] }],
		expected: [{ foo: [3] }, { foo: [3, 6] }, { foo: [3, 1] }],
	},
	{
		name: "$mod with indexed list",
		query: {
			"foo.1": { $mod: [3, 1] },
		},
		input: [{ foo: [3, 6] }, { foo: [3, 1] }],
		expected: [{ foo: [3, 1] }],
	},
	{
		name: "$mod with implicit list access",
		query: {
			"foo.bar": { $mod: [3, 1] },
		},
		input: [
			{ foo: null },
			{ foo: [] },
			{ foo: [{ bar: 6 }] },
			{ foo: [{ bar: 1 }] },
		],
		expected: [{ foo: [{ bar: 1 }] }],
	},
	{
		name: "$mod with invalid query",
		query: {
			foo: { $mod: "bar" },
		},
		input: [{ foo: 1 }],
		expected: [],
	},
	{
		name: "$mod with invalid query",
		query: {
			foo: { $mod: ["1", "0"] },
		},
		input: [{ foo: 1 }],
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

describe("Query $mod tests", async () => {
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
