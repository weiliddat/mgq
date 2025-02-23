import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$regex",
		query: {
			foo: {
				$regex: "^ba",
			},
		},
		input: [
			{ foo: {} },
			{ foo: null },
			{ foo: 1 },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "BAR" },
			{ foo: "BAZ" },
			{ foo: "qux" },
			{ foo: "quux" },
		],
		expected: [{ foo: "bar" }, { foo: "baz" }],
	},
	{
		name: "$regex with i flag",
		query: {
			foo: {
				$regex: "^ba",
				$options: "i",
			},
		},
		input: [
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "BAR" },
			{ foo: "BAZ" },
			{ foo: "qux" },
			{ foo: "quux" },
		],
		expected: [{ foo: "bar" }, { foo: "baz" }, { foo: "BAR" }, { foo: "BAZ" }],
	},
	{
		name: "$regex with s flag",
		query: {
			foo: {
				$regex: "bar.baz",
				$options: "s",
			},
		},
		input: [{ foo: "bar_baz" }, { foo: "bar\nbaz" }, { foo: "bar baz" }],
		expected: [{ foo: "bar_baz" }, { foo: "bar\nbaz" }, { foo: "bar baz" }],
	},
	{
		name: "$regex with m flag",
		query: {
			foo: {
				$regex: "^baz",
				$options: "m",
			},
		},
		input: [
			{ foo: "baz" },
			{ foo: "bar_baz" },
			{ foo: "bar\nbaz" },
			{ foo: "bar baz" },
		],
		expected: [{ foo: "baz" }, { foo: "bar\nbaz" }],
	},
	// JS has no native support for x flag
	// {
	// 	name: "$regex with x flag",
	// 	query: {
	// 		foo: {
	// 			$regex: "^ baz $",
	// 			$options: "x",
	// 		},
	// 	},
	// 	input: [
	// 		{ foo: "baz" },
	// 		{ foo: "bar_baz" },
	// 		{ foo: "bar\nbaz" },
	// 		{ foo: "bar baz" },
	// 	],
	// 	expected: [{ foo: "baz" }],
	// },
	{
		name: "$regex with nested dict/lists",
		query: {
			"foo.bar": { $regex: "^baz" },
		},
		input: [
			{ foo: [{ bar: "bazo" }] },
			{ foo: { bar: ["bazi"] } },
			{ foo: { bar: ["qux", "bazqux"] } },
			{ foo: ["bar", "baz"] },
			{ foo: null },
			{},
		],
		expected: [
			{ foo: [{ bar: "bazo" }] },
			{ foo: { bar: ["bazi"] } },
			{ foo: { bar: ["qux", "bazqux"] } },
		],
	},
	{
		name: "$regex with indexed lists",
		query: {
			"foo.0.bar": { $regex: "^baz" },
		},
		input: [
			{ foo: [{ bar: "bazo" }] },
			{ foo: { bar: ["bazi"] } },
			{ foo: { bar: ["qux", "bazqux"] } },
			{ foo: ["bar", "baz"] },
			{ foo: null },
			{},
		],
		expected: [{ foo: [{ bar: "bazo" }] }],
	},
	{
		name: "implicit $regex",
		query: {
			foo: /^ba/i,
		},
		input: [
			{ foo: {} },
			{ foo: null },
			{ foo: 1 },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "BAR" },
			{ foo: "BAZ" },
			{ foo: "qux" },
			{ foo: "quux" },
		],
		expected: [{ foo: "bar" }, { foo: "baz" }, { foo: "BAR" }, { foo: "BAZ" }],
	},
	{
		name: "$in with implicit $regex",
		query: {
			foo: {
				$in: [/^ba/i, /^qu/i],
			},
		},
		input: [
			{ foo: {} },
			{ foo: null },
			{ foo: 1 },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "BAR" },
			{ foo: "BAZ" },
			{ foo: "qux" },
			{ foo: "quux" },
		],
		expected: [
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: "BAR" },
			{ foo: "BAZ" },
			{ foo: "qux" },
			{ foo: "quux" },
		],
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

describe("Query $regex tests", async () => {
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
