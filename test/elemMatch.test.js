import assert from "node:assert";
import test, { after, afterEach, before, describe } from "node:test";
import { Query } from "../mgq.js";
import { getFilterResults, getMongoResults } from "./utils.js";
import { Collection, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const testCases = [
	{
		name: "$elemMatch",
		query: {
			foo: {
				$elemMatch: {
					bar: { $gt: 10 },
					baz: { $lt: 100 },
				},
			},
		},
		input: [
			{
				foo: [
					{ bar: 20, baz: 90 },
					{ bar: 0, baz: 200 },
				],
			},
			{
				foo: [
					{ bar: 10, baz: 100 },
					{ bar: 20, baz: 90 },
				],
			},
			{
				foo: [
					{ bar: 20, baz: 100 },
					{ bar: 10, baz: 90 },
				],
			},
			{ foo: [{ bar: 20 }, { baz: 90 }] },
			{ foo: [{}] },
			{ foo: [] },
			{ foo: null },
		],
		expected: [
			{
				foo: [
					{ bar: 20, baz: 90 },
					{ bar: 0, baz: 200 },
				],
			},
			{
				foo: [
					{ bar: 10, baz: 100 },
					{ bar: 20, baz: 90 },
				],
			},
		],
	},
	{
		name: "$elemMatch dict access",
		query: { "foo.bar": { $elemMatch: { a: "b", c: "d" } } },
		input: [
			{
				foo: {
					bar: [
						{ a: "z", c: "d" },
						{ a: "b", c: "z" },
					],
				},
			},
			{ foo: { bar: [{}, 2, { g: "f", a: "b", c: "d" }] } },
			{
				foo: [
					{ bar: {} },
					{
						bar: [
							{ a: "z", c: "d" },
							{ a: "b", c: "d" },
						],
					},
				],
			},
			{ foo: { bar: [{ c: "d" }, { a: "b" }] } },
			{ foo: {} },
		],
		expected: [
			{ foo: { bar: [{}, 2, { g: "f", a: "b", c: "d" }] } },
			{
				foo: [
					{ bar: {} },
					{
						bar: [
							{ a: "z", c: "d" },
							{ a: "b", c: "d" },
						],
					},
				],
			},
		],
	},
	{
		name: "$elemMatch list access",
		query: { "foo.0.bar": { $elemMatch: { a: "b", c: "d" } } },
		input: [
			{
				foo: [{ bar: [{ z: "b", d: "d" }] }, { bar: [{ a: "b", c: "d" }] }],
			},
			{
				foo: [{ bar: [{ a: "b", c: "d" }] }, { bar: [{ z: "b", d: "d" }] }],
			},
			{ foo: [{ bar: [{}, 2, { g: "f", a: "b", c: "d" }] }] },
			{ foo: [{ bar: [{ c: "d" }, { a: "b" }] }] },
		],
		expected: [
			{
				foo: [{ bar: [{ a: "b", c: "d" }] }, { bar: [{ z: "b", d: "d" }] }],
			},
			{ foo: [{ bar: [{}, 2, { g: "f", a: "b", c: "d" }] }] },
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

describe("Query $elemMatch tests", async () => {
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
