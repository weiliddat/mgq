import { Collection } from "mongodb";

/**
 * Get the results of a query from a MongoDB collection
 * @param {Collection} collection - The collection to run the query on
 * @param {Object} query - The query to run
 * @param {Object[]} input - The input documents to insert into the collection
 * @returns {Promise<Object[]>} The results of the query
 */
export async function getMongoResults(collection, query, input) {
	try {
		await collection.insertMany(structuredClone(input));
		const results = await collection
			.find(query, { serializeFunctions: true })
			.project({ _id: 0 })
			.toArray();
		return results;
	} catch (error) {
		console.error(error);
		return [];
	}
}

export function getFilterResults(testFn, input) {
	return input.filter(testFn);
}
