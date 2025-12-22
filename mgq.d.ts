/**
 * MongoDB query as a predicate function
 *
 * @example
 * ```js
 * import { Query } from "mgq";
 *
 * const predicate = Query({ "foo.bar": { $gt: 1 } });
 * const inputs = [{ foo: { bar: 2 } }, { foo: { bar: 0 } }];
 * const filtered = inputs.filter(predicate.test);
 * // [{ foo: { bar: 2 } }]
 * ```
 */

// Comparison query operators
export interface ComparisonOperators<T = unknown> {
	/** Matches values that are equal to a specified value */
	$eq?: T;
	/** Matches values that are not equal to a specified value */
	$ne?: T;
	/** Matches values that are greater than a specified value */
	$gt?: T;
	/** Matches values that are greater than or equal to a specified value */
	$gte?: T;
	/** Matches values that are less than a specified value */
	$lt?: T;
	/** Matches values that are less than or equal to a specified value */
	$lte?: T;
	/** Matches any of the values specified in an array */
	$in?: T[];
	/** Matches none of the values specified in an array */
	$nin?: T[];
}

// Regex operators
export interface RegexOperators {
	/** Matches values that match a specified regular expression */
	$regex?: string | RegExp;
	/** Modifies the $regex to enable options (i, m, s) */
	$options?: string;
}

// Evaluation operators
export interface EvaluationOperators {
	/** Performs a modulo operation on the value of a field and selects documents with a specified result */
	$mod?: [divisor: number, remainder: number];
}

// Array operators
export interface ArrayOperators<T = unknown> {
	/** Matches arrays that contain all elements specified in the query */
	$all?: T[] | Array<{ $elemMatch: QueryCondition }>;
	/** Selects documents if element in the array field matches all the specified $elemMatch conditions */
	$elemMatch?: QueryCondition;
	/** Selects documents if the array field is a specified size */
	$size?: number;
}

// Negation operator
export interface NotOperator {
	/** Inverts the effect of a query expression */
	$not?: QueryExpression;
}

/**
 * Query expression for a single field path
 * Combines all condition operators that can be applied to a field
 */
export interface QueryExpression<T = unknown>
	extends ComparisonOperators<T>,
		RegexOperators,
		EvaluationOperators,
		ArrayOperators<T>,
		NotOperator {}

/**
 * Primitive values that can be used for implicit $eq matching
 */
export type PrimitiveValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Date
	| RegExp;

/**
 * A single query condition value - either a direct value (implicit $eq) or an expression object
 */
export type QueryConditionValue =
	| PrimitiveValue
	| PrimitiveValue[]
	| QueryExpression;

/**
 * Document type - represents any document that can be queried
 * Uses PropertyKey (string | number | symbol) to allow all JavaScript object key types
 */
export type Document = Record<PropertyKey, unknown>;

/**
 * Query condition object
 * Maps field paths to query expressions or values
 */
export interface QueryCondition {
	/** Joins query clauses with a logical AND returns all documents that match the conditions of all clauses */
	$and?: QueryCondition[];
	/** Joins query clauses with a logical OR returns all documents that match the conditions of any clause */
	$or?: QueryCondition[];
	/** Joins query clauses with a logical NOR returns all documents that fail to match any clause */
	$nor?: QueryCondition[];
	/** Matches documents that satisfy a JavaScript expression */
	$where?: ((this: Document) => boolean) | string;
	/** Field path to query expression or value */
	[path: string]:
		| QueryConditionValue
		| QueryCondition[]
		| ((this: Document) => boolean)
		| undefined;
}

/**
 * Query instance returned by the Query function
 */
export interface QueryInstance {
	/**
	 * Tests whether a document matches the query
	 * @param doc - The document to test against the query
	 * @returns true if the document matches, false otherwise
	 *
	 * @example
	 * ```js
	 * const query = Query({ age: { $gt: 18 } });
	 * query.test({ age: 21 }); // true
	 * query.test({ age: 16 }); // false
	 * ```
	 */
	test(doc: Document): boolean;

	/**
	 * Validates the query structure
	 * @throws {TypeError} if the query is invalid
	 * @returns the query instance for chaining
	 *
	 * @example
	 * ```js
	 * const query = Query({ $in: "invalid" }).validate(); // throws TypeError
	 * ```
	 */
	validate(): QueryInstance;
}

/**
 * Creates a new Query instance that can test documents against a MongoDB-style query
 *
 * @param query - A MongoDB-style query object
 * @returns A QueryInstance with test and validate methods
 *
 * @example
 * ```js
 * import { Query } from "mgq";
 *
 * // Simple equality
 * const q1 = Query({ name: "Alice" });
 *
 * // Comparison operators
 * const q2 = Query({ age: { $gt: 18, $lt: 65 } });
 *
 * // Nested paths
 * const q3 = Query({ "address.city": "NYC" });
 *
 * // Logical operators
 * const q4 = Query({ $or: [{ status: "active" }, { admin: true }] });
 *
 * // Array operators
 * const q5 = Query({ tags: { $all: ["js", "ts"] } });
 *
 * // Use with Array.filter
 * const users = [{ name: "Alice", age: 25 }, { name: "Bob", age: 17 }];
 * const adults = users.filter(q2.test);
 * ```
 */
export function Query(query: QueryCondition): QueryInstance;
