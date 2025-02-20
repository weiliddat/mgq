import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$nin list of str",
		query: {
			foo: { $nin: ["bar", "baz"] },
		},
		input: [
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: ["qux", "baz"] },
			{},
			{ foo: "qux" },
			{ foo: { foo: "bar" } },
		],
		expected: [{}, { foo: "qux" }, { foo: { foo: "bar" } }],
	},
	{
		name: "$nin list of dict and list",
		query: {
			foo: { $nin: [{ bar: "baz" }, ["bar", "baz"]] },
		},
		input: [
			{ foo: { bar: "baz" } },
			{ foo: ["bar", "baz"] },
			{ foo: [1, { bar: "baz" }] },
			{ foo: [1, ["bar", "baz"]] },
			{ foo: { bar: "qux" } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz", qux: "baz" } },
		],
		expected: [
			{ foo: { bar: "qux" } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz", qux: "baz" } },
		],
	},
	{
		name: "$nin None",
		query: {
			foo: { $nin: ["bar", null] },
		},
		input: [
			{ foo: null },
			{ bar: null },
			{},
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
		],
		expected: [{ foo: "baz" }, { foo: { foo: "bar" } }],
	},
	{
		name: "$nin nested object path",
		query: {
			"foo.bar": { $nin: ["baz", "qux"] },
		},
		input: [
			{ foo: { bar: "baz" } },
			{ foo: [{ bar: "qux" }] },
			{ foo: { bar: ["baz", "qux"] } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz", qux: "baz" } },
			{ foo: { bar: "qux", qux: "baz" } },
		],
		expected: [{}, { foo: "bar" }],
	},
	{
		name: "indexed nested object path with intermediate arrays on doc",
		query: {
			"foo.1.bar": { $nin: ["baz", "qux"] },
		},
		input: [
			{ foo: [{ bar: "baz" }, { jaz: "qux" }] },
			{ foo: [{ jaz: "qux" }, { bar: "baz" }] },
			{ foo: [{ bar: ["jaz", "baz"] }] },
			{ foo: { 1: { bar: "baz" }, 2: { jaz: "qux" } } },
			{ foo: [[{ bar: "baz" }, { jaz: "qux" }]] },
		],
		expected: [
			{ foo: [{ bar: "baz" }, { jaz: "qux" }] },
			{ foo: [{ bar: ["jaz", "baz"] }] },
			{ foo: [[{ bar: "baz" }, { jaz: "qux" }]] },
		],
	},
	{
		name: "unindexed nested object path against null",
		query: {
			"foo.bar": { $nin: ["bar", null] },
		},
		input: [
			{ foo: [{ bar: "baz" }] },
			{},
			{ foo: "bar" },
			{ foo: { bar: null } },
		],
		expected: [{ foo: [{ bar: "baz" }] }],
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

describe("Query $nin tests", async () => {
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
