import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$not",
		query: {
			foo: { $not: { $eq: "bar" } },
		},
		input: [
			{ foo: "bar" },
			{ foo: "qux", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [{ foo: "qux", baz: 3 }, {}, { foo: { foo: "bar" } }],
	},
	{
		name: "$not multiple conditions",
		query: {
			foo: {
				$not: {
					$in: ["bar", "baz"],
					$ne: "qux",
				},
			},
		},
		input: [
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "qux", baz: 3 },
			{},
			{ foo: { foo: "bar" } },
		],
		expected: [{ foo: "qux", baz: 3 }, {}, { foo: { foo: "bar" } }],
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

describe("Query $not tests", async () => {
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
