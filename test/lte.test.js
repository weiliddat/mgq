import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$lte number",
		query: { foo: { $lte: 1 } },
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
		expected: [{ foo: 0 }, { foo: 1 }],
	},
	{
		name: "$lte str",
		query: { foo: { $lte: "bar" } },
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
		expected: [{ foo: "baa" }, { foo: "bar" }],
	},
	{
		name: "$lte str",
		query: { foo: { $lte: "1" } },
		input: [
			{ foo: 0 },
			{ foo: 1 },
			{ foo: 2 },
			{},
			{ foo: "0" },
			{ foo: "1" },
			{ foo: "baa" },
			{ foo: "bar" },
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [{ foo: "0" }, { foo: "1" }],
	},
	{
		name: "$lte none",
		query: { foo: { $lte: null } },
		input: [
			{ foo: -1 },
			{ foo: 0 },
			{ foo: 1 },
			{},
			{ foo: "baz" },
			{ foo: { foo: "bar" } },
			{ foo: null },
		],
		expected: [{}, { foo: null }],
	},
	{
		name: "nested object path, $lte number",
		query: { "foo.bar": { $lte: 1 } },
		input: [
			{ foo: { bar: 0 } },
			{ foo: { bar: 1 } },
			{ foo: { bar: 2 } },
			{},
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [{ foo: { bar: 0 } }, { foo: { bar: 1 } }],
	},
	{
		name: "nested object path, $lte str",
		query: { "foo.bar": { $lte: "baj" } },
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
		expected: [{ foo: { bar: "baa" } }, { foo: { bar: "baj" } }],
	},
	{
		name: "nested object path, $lte None",
		query: { "foo.bar": { $lte: null } },
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
		expected: [{}, { foo: null }],
	},
	{
		name: "intermediate indexed array, $lte number",
		query: { "foo.1.bar": { $lte: 1 } },
		input: [
			{ foo: [{}, { bar: 0 }] },
			{ foo: [{ bar: 2 }, {}] },
			{},
			{ foo: "bar" },
			{ foo: [{ bar: "baz" }] },
			{ foo: null },
		],
		expected: [{ foo: [{}, { bar: 0 }] }],
	},
	{
		name: "doc leaf array, $lte number",
		query: { "foo.bar": { $lte: 1 } },
		input: [
			{ foo: { bar: [0, -1] } },
			{ foo: { bar: [2, 1] } },
			{ foo: { bar: [2, 3] } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz" } },
			{ foo: null },
		],
		expected: [{ foo: { bar: [0, -1] } }, { foo: { bar: [2, 1] } }],
	},
	{
		name: "unindexed nested object path with intermediate arrays on doc",
		query: { "a.b.c": { $lte: 1 } },
		input: [
			{ a: [{ b: [{ c: 0 }] }] },
			{ a: [{ b: [{ c: [1] }] }] },
			{ a: [{ b: [{ c: 2 }] }] },
			{},
			{ a: { b: "bar" } },
			{ a: null },
		],
		expected: [{ a: [{ b: [{ c: 0 }] }] }, { a: [{ b: [{ c: [1] }] }] }],
	},
	{
		name: "nested object path, object comparison",
		query: { "foo.bar": { $lte: { baz: "qux" } } },
		input: [
			{ foo: { bar: {} } },
			{ foo: { bar: { baa: "zap" } } },
			{ foo: { bar: { baz: "bux" } } },
			{ foo: { bar: { baz: "qux" } } },
			{ foo: { bar: { baz: "zap" } } },
			{ foo: { bar: { bla: "jaz" } } },
			{ foo: { bar: { baz: "qux", bla: "jaz" } } },
			{},
			{ foo: "bar" },
			{ foo: { bar: "baz" } },
		],
		expected: [
			{ foo: { bar: {} } },
			{ foo: { bar: { baa: "zap" } } },
			{ foo: { bar: { baz: "bux" } } },
			{ foo: { bar: { baz: "qux" } } },
		],
	},
	{
		name: "nested object path, object comparison empty ov",
		query: { "foo.bar": { $lte: {} } },
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
		expected: [{ foo: { bar: {} } }],
	},
	{
		name: "nested object path, object comparison many keys",
		query: { "foo.bar": { $lte: { a: "b", c: "d" } } },
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
			{ foo: { bar: {} } },
			{ foo: { bar: { a: "a" } } },
			{ foo: { bar: { a: "b" } } },
			{ foo: { bar: { a: "b", b: "a" } } },
			{ foo: { bar: { a: "b", c: "c" } } },
			{ foo: { bar: { a: "b", c: "d" } } },
		],
	},
	{
		name: "nested object path, list comparison",
		query: { "foo.bar": { $lte: ["bar", "baz"] } },
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
			{ foo: { bar: ["bar"] } },
			{ foo: { bar: ["bar", "baz"] } },
			{ foo: { bar: ["baa", "bzz"] } },
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

describe("Query $lte tests", async () => {
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
