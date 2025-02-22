import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$nor",
		query: {
			$nor: [{ foo: "bar", baz: { $ne: null } }, { baz: { $gt: 2 } }],
		},
		input: [
			{ foo: "bar" },
			{ foo: "bar", baz: 1 },
			{ foo: "qux", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [{ foo: "bar" }, {}, { foo: { foo: "bar" } }],
	},
	{
		name: "nested $nor and $or",
		query: {
			$nor: [
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
		expected: [
			{ foo: "bar", baz: 1 },
			{ foo: "bar", baz: 2 },
			{},
			{ foo: { foo: "bar" } },
		],
	},
	{
		name: "nested $nor and $and",
		query: {
			$nor: [
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
			{ foo: "bar", baz: 1 },
			{ foo: "bar", baz: 2 },
			{},
			{ foo: { foo: "bar" } },
		],
	},
	{
		name: "invalid $nor query",
		query: {
			$nor: { foo: "bar" },
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

describe("Query $nor tests", async () => {
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
