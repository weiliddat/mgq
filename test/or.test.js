import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$or",
		query: {
			$or: [{ foo: "bar", baz: { $ne: null } }, { baz: { $gt: 2 } }],
		},
		input: [
			{ foo: "bar" },
			{ foo: "bar", baz: 1 },
			{ foo: "qux", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [
			{ foo: "bar", baz: 1 },
			{ foo: "qux", baz: 3 },
		],
	},
	{
		name: "nested $or",
		query: {
			$or: [
				{ foo: "bar", baz: null },
				{
					$or: [
						{ foo: "bar", baz: { $gt: 2 } },
						{ foo: "bar", baz: { $lt: 0 } },
					],
				},
			],
		},
		input: [
			{ foo: "bar" },
			{ foo: "bar", baz: -1 },
			{ foo: "bar", baz: 1 },
			{ foo: "bar", baz: 2 },
			{ foo: "bar", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [{ foo: "bar" }, { foo: "bar", baz: -1 }, { foo: "bar", baz: 3 }],
	},
	{
		name: "nested $or and $and",
		query: {
			$or: [
				{
					$and: [{ foo: "bar" }, { baz: null }],
				},
				{
					$and: [{ foo: null }, { baz: "qux" }],
				},
				{
					$and: [{ foo: "bar" }, { baz: { $gt: 2 } }],
				},
				{
					$and: [{ foo: "bar" }, { baz: { $lt: 0 } }],
				},
			],
		},
		input: [
			{ foo: "bar" },
			{ baz: "qux" },
			{ foo: "bar", baz: -1 },
			{ foo: "bar", baz: 1 },
			{ foo: "bar", baz: 2 },
			{ foo: "bar", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [
			{ foo: "bar" },
			{ baz: "qux" },
			{ foo: "bar", baz: -1 },
			{ foo: "bar", baz: 3 },
		],
	},
	{
		name: "invalid $or query",
		query: {
			$or: { foo: "bar" },
		},
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

describe("Query $or tests", async () => {
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
