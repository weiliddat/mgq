import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$gt number",
		query: { foo: { $gt: 1 } },
		input: [
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{ foo: "0" },
			{ foo: "1" },
			{ foo: "2" },
			{},
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [{ foo: 2 }],
	},
	{
		name: "$gt str",
		query: { foo: { $gt: "bar" } },
		input: [
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{},
			{ foo: "baa" },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [{ foo: "baz" }],
	},
	{
		name: "$gt str",
		query: { foo: { $gt: "1" } },
		input: [
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{},
			{ foo: "baa" },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [{ foo: "baa" }, { foo: "bar" }, { foo: "baz" }],
	},
	{
		name: "$gt none",
		query: { foo: { $gt: null } },
		input: [
			{ foo: -1 },
			{ foo: 0 },
			{ foo: 1 },
			{},
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [],
	},
	{
		name: "nested object path, $gt number",
		query: { "foo.bar": { $gt: 1 } },
		input: [
			{ foo: { bar: 0 } },
			{ foo: { bar: 1 } },
			{ foo: { bar: 2 } },
			{},
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [{ foo: { bar: 2 } }],
	},
	{
		name: "nested object path, $gt str",
		query: { "foo.bar": { $gt: "baj" } },
		input: [
			{ foo: { bar: 0 } },
			{ foo: { bar: 1 } },
			{ foo: { bar: 2 } },
			{},
			{ foo: { bar: "baa" } },
			{ foo: { bar: "baj" } },
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [{ foo: { bar: "baz" } }],
	},
	{
		name: "nested object path, $gt None",
		query: { "foo.bar": { $gt: null } },
		input: [
			{ foo: { bar: {} } },
			{ foo: { bar: [] } },
			{ foo: { bar: -1 } },
			{ foo: { bar: 0 } },
			{ foo: { bar: 1 } },
			{},
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [],
	},
	{
		name: "intermediate indexed array, $gt number",
		query: { "foo.1.bar": { $gt: 1 } },
		input: [
			{ foo: [{}, { bar: 2 }] },
			{ foo: [{ bar: 2 }, {}] },
			{},
			{ foo: "bar" },
			{ foo: [{ bar: "baz" }] },
			{ foo: null },
		],
		expected: [{ foo: [{}, { bar: 2 }] }],
	},
	{
		name: "doc leaf array, $gt number",
		query: { "foo.bar": { $gt: 1 } },
		input: [
			{ foo: { bar: [0, 1] } },
			{ foo: { bar: [1, 2] } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [{ foo: { bar: [1, 2] } }],
	},
	{
		name: "unindexed nested object path with intermediate arrays on doc",
		query: { "a.b.c": { $gt: 1 } },
		input: [
			{ a: [{ b: [{ c: 0 }] }] },
			{ a: [{ b: [{ c: 2 }] }] },
			{},
			{ a: { b: "bar" } },
			{ a: null },
		],
		expected: [{ a: [{ b: [{ c: 2 }] }] }],
	},
	{
		name: "nested object path, object comparison",
		query: { "foo.bar": { $gt: { baz: "qux" } } },
		input: [
			{ foo: { bar: {} } },
			{ foo: { bar: { baa: "zap" } } },
			{ foo: { bar: { baz: "qux" } } },
			{ foo: { bar: { baz: "bux" } } },
			{ foo: { bar: { baz: "zap" } } },
			{ foo: { bar: { bla: "jaz" } } },
			{ foo: { bar: { baz: "qux", bla: "jaz" } } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz" } },
		],
		expected: [
			{ foo: { bar: { baz: "zap" } } },
			{ foo: { bar: { bla: "jaz" } } },
			{ foo: { bar: { baz: "qux", bla: "jaz" } } },
		],
	},
	{
		name: "nested object path, object comparison empty ov",
		query: { "foo.bar": { $gt: {} } },
		input: [
			{ foo: { bar: {} } },
			{ foo: { bar: null } },
			{ foo: { bar: 1 } },
			{ foo: { bar: "baz" } },
			{ foo: { bar: { baz: "qux" } } },
			{ foo: { bar: { baz: "qux", bla: "jaz" } } },
			{},
			{ foo: "bar" },
		],
		expected: [
			{ foo: { bar: { baz: "qux" } } },
			{ foo: { bar: { baz: "qux", bla: "jaz" } } },
		],
	},
	{
		name: "nested object path, object comparison many keys",
		query: { "foo.bar": { $gt: { a: "b", c: "d" } } },
		input: [
			{ foo: { bar: {} } },
			{ foo: { bar: { a: "a" } } },
			{ foo: { bar: { a: "b" } } },
			{ foo: { bar: { a: "c" } } },
			{ foo: { bar: { b: "a" } } },
			{ foo: { bar: { a: "b", b: "a" } } },
			{ foo: { bar: { a: "b", c: "c" } } },
			{ foo: { bar: { a: "b", c: "d" } } },
			{ foo: { bar: { a: "b", c: "e" } } },
			{ foo: { bar: { a: "b", d: "a" } } },
			{ foo: { bar: { a: "b", c: "d", e: "f" } } },
		],
		expected: [
			{ foo: { bar: { a: "c" } } },
			{ foo: { bar: { b: "a" } } },
			{ foo: { bar: { a: "b", c: "e" } } },
			{ foo: { bar: { a: "b", d: "a" } } },
			{ foo: { bar: { a: "b", c: "d", e: "f" } } },
		],
	},
	{
		name: "nested object path, list comparison",
		query: { "foo.bar": { $gt: ["bar", "baz"] } },
		input: [
			{ foo: { bar: ["bar"] } },
			{ foo: { bar: ["zzz"] } },
			{ foo: { bar: ["bar", "baz"] } },
			{ foo: { bar: ["baz", "bar"] } },
			{ foo: { bar: ["baa", "bzz"] } },
			{ foo: { bar: ["bzz", "baa"] } },
			{ foo: { bar: ["bar", "baz", "qux"] } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz" } },
		],
		expected: [
			{ foo: { bar: ["zzz"] } },
			{ foo: { bar: ["baz", "bar"] } },
			{ foo: { bar: ["bzz", "baa"] } },
			{ foo: { bar: ["bar", "baz", "qux"] } },
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

describe("Query $gt tests", async () => {
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
