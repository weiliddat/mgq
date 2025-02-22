//@ts-check

import deepEqual from "fast-deep-equal";

/**
 * mongo query as a predicate function
 *
 * Terminology:
 *
 * Query refers to the document that is passed to the compiler / mongodb find that holds
 *   the query conditions (can be multiple),
 *   e.g. { "fruits.type": { "$eq": "berry", "$ne": "aggregate" }, "fruits": { "$size": 3 }}
 *
 * Cond (conditions) refers to a single path-expression pair,
 *   e.g. { "fruits.type": { "$eq": "berry", "$ne": "aggregate" }
 *
 * Path refers to dot-separated fields,
 *   e.g. "fruits.type"
 *
 * Exp (expression) refers to the object that holds operator and value pairs (can be multiple),
 *   e.g. { "$eq": "berry", "$ne": "aggregate" }
 *
 * Op (operator) refers to the logical operator that is matched against the value,
 *   e.g. "$eq"
 *
 * Ov (operator value) refers to the value that you are matching against in
 *   the context of a single operator e.g. "berry"
 *
 * Doc refers to the object that is passed to the compiled filter function
 */

// Set of condition operators
const condOps = new Set([
	"$eq",
	"$gt",
	"$gte",
	"$in",
	"$lt",
	"$lte",
	"$ne",
	"$nin",
	"$not",
	"$regex",
	"$options",
	"$mod",
	"$all",
	"$elemMatch",
	"$size",
]);

// Set of query operators
const queryOps = new Set(["$and", "$or", "$nor"]);

/**
 * Creates a new Query object
 * @param {Record<string,any>} query - The query to match against
 * @returns {Object}
 */
export function Query(query) {
	return {
		/**
		 * Matches the given document against the query
		 * @param {Record<string,any>} doc - The document to match against
		 * @returns {boolean}
		 */
		test: (doc) => matchCond(query, doc),
		/**
		 * Validates the query
		 * @throws {TypeError} if the query is invalid
		 * @returns {boolean}
		 */
		validate: () => validate(query),
	};
}

/**
 * Matches the given query against the given document
 * @param {Record<string,any>} query - The query to match against
 * @param {Record<string,any>} doc - The document to match against
 * @returns {boolean}
 */
function matchCond(query, doc) {
	const results = [];

	for (const path in query) {
		if (queryOps.has(path)) {
			if (path === "$and") {
				results.push(matchAnd(doc, path, query.$and));
			}
			if (path === "$or") {
				results.push(matchOr(doc, path, query.$or));
			}
			if (path === "$nor") {
				results.push(matchNor(doc, path, query.$nor));
			}
		} else {
			const expOrOv = query[path];
			const isAllExp = checkAllExp(expOrOv);
			const pathParts = path.split(".");

			if (isAllExp) {
				const exp = expOrOv;
				if ("$eq" in exp) {
					results.push(matchEq(doc, pathParts, exp.$eq));
				}
				if ("$ne" in exp) {
					results.push(matchNe(doc, pathParts, exp.$ne));
				}
				if ("$gt" in exp) {
					results.push(matchGt(doc, pathParts, exp.$gt));
				}
				if ("$gte" in exp) {
					results.push(matchGte(doc, pathParts, exp.$gte));
				}
				if ("$lt" in exp) {
					results.push(matchLt(doc, pathParts, exp.$lt));
				}
				if ("$lte" in exp) {
					results.push(matchLte(doc, pathParts, exp.$lte));
				}
				if ("$in" in exp) {
					results.push(matchIn(doc, pathParts, exp.$in));
				}
				if ("$nin" in exp) {
					results.push(matchNin(doc, pathParts, exp.$nin));
				}
				if ("$not" in exp) {
					results.push(matchNot(doc, path, exp.$not));
				}
				if ("$regex" in exp) {
					const ov = {
						$regex: exp.$regex,
						$options: exp.$options || "",
					};
					results.push(matchRegex(doc, pathParts, ov));
				}
				if ("$mod" in exp) {
					results.push(matchMod(doc, pathParts, exp.$mod));
				}
				if ("$all" in exp) {
					results.push(matchAll(doc, pathParts, exp.$all));
				}
				if ("$elemMatch" in exp) {
					results.push(matchElemMatch(doc, pathParts, exp.$elemMatch));
				}
				if ("$size" in exp) {
					results.push(matchSize(doc, pathParts, exp.$size));
				}
			} else {
				const ov = expOrOv;
				results.push(matchEq(doc, pathParts, ov));
			}
		}
	}

	return results.every(Boolean);
}

function validate(query) {
	if (!(query instanceof Object) || Array.isArray(query)) {
		throw new TypeError("query must be an object");
	}

	for (const path in query) {
		if (queryOps.has(path)) {
			if (path === "$and") {
				if (!validateQueryOps(query.$and)) {
					throw new TypeError("$and operator value must be an array");
				}
			}
			if (path === "$or") {
				if (!validateQueryOps(query.$or)) {
					throw new TypeError("$or operator value must be an array");
				}
			}
			if (path === "$nor") {
				if (!validateQueryOps(query.$nor)) {
					throw new TypeError("$nor operator value must be an array");
				}
			}

			if (Array.isArray(query[path])) {
				for (const cond of query[path]) {
					validate(cond);
				}
			}
		} else {
			const expOrOv = query[path];
			const isAllExp = checkAllExp(expOrOv);
			if (isAllExp) {
				const exp = expOrOv;
				if ("$in" in exp && !validateInNin(exp.$in)) {
					throw new TypeError("$in operator value must be an array");
				}
				if ("$nin" in exp && !validateInNin(exp.$nin)) {
					throw new TypeError("$nin operator value must be an array");
				}
				if ("$all" in exp && !validateAll(exp.$all)) {
					throw new TypeError("$all operator value must be an array");
				}
				if ("$mod" in exp && !validateMod(exp.$mod)) {
					throw new TypeError(
						"$mod operator value must be an array of 2 numbers",
					);
				}
				if ("$size" in exp && !validateSize(exp.$size)) {
					throw new TypeError("$size operator value must be a number");
				}
			}
		}
	}

	return true;
}

function checkAllExp(expOrOv) {
	return (
		expOrOv &&
		isPlainObject(expOrOv) &&
		!deepEqual(expOrOv, {}) &&
		Object.keys(expOrOv).every((key) => condOps.has(key))
	);
}

/**
 * stub undefined functions
 */
function matchAnd(doc, path, query) {
	return true;
}

function matchOr(doc, path, query) {
	return true;
}

function matchNor(doc, path, query) {
	return true;
}

/**
 * Matches if the value at the given path is not equal to the given value
 * @param {any} doc - Document to check
 * @param {string[]} pathParts - Path to the value
 * @param {any} query - Value to match against
 * @returns {boolean}
 */
function matchNe(doc, pathParts, query) {
	return !matchEq(doc, pathParts, query);
}

/**
 * Matches if the document does not match the given query
 * @param {any} doc - Document to check
 * @param {string} path - Path to the value
 * @param {any} query - Value to match against
 * @returns {boolean}
 */
function matchNot(doc, path, query) {
	return !matchCond({ [path]: query }, doc);
}

function matchRegex(doc, pathParts, query) {
	return true;
}

function matchMod(doc, pathParts, query) {
	return true;
}

function matchAll(doc, pathParts, query) {
	return true;
}

function matchElemMatch(doc, pathParts, query) {
	return true;
}

function matchSize(doc, pathParts, query) {
	return true;
}

function validateQueryOps(query) {
	return Array.isArray(query);
}

function validateInNin(value) {
	return Array.isArray(value);
}

function validateAll(value) {
	return Array.isArray(value);
}

function validateMod(value) {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}

function validateSize(value) {
	return typeof value === "number";
}

/**
 * Checks if the given value is a plain object (not null, not an array)
 * @param {any} v - The value to check
 * @returns {v is Record<any, any>}
 */
function isPlainObject(v) {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Matches equality condition for nested document traversal
 * @param {any} doc - The document/value to check
 * @param {string[]} path - Array of path segments
 * @param {any} ov - The value to match against
 * @returns {boolean}
 */
function matchEq(doc, path, ov) {
	if (path.length === 0) {
		if (Array.isArray(doc) && doc.some((d) => matchEq(d, path, ov))) {
			return true;
		}

		if (ov instanceof RegExp && typeof doc === "string") {
			if (ov.test(doc)) {
				return true;
			}
		}

		return deepEqual(doc, ov);
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchEq(doc[key], rest, ov);
	}

	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchEq(doc[idx], rest, ov);
		}
	}

	if (Array.isArray(doc)) {
		return doc.some((d) => matchEq(d, path, ov));
	}

	if (ov === null || ov === undefined) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path is in the array of values
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any[]} ov - Array of values to match against
 * @returns {boolean}
 */
function matchIn(doc, path, ov) {
	if (!validateInNin(ov)) {
		return false;
	}

	if (path.length === 0) {
		if (Array.isArray(doc) && doc.some((d) => matchIn(d, path, ov))) {
			return true;
		}

		return ov.some((o) => matchEq(doc, path, o));
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchIn(doc[key], rest, ov);
	}

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchIn(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchIn(d, path, ov));
	}

	if (ov.includes(null) || ov.includes(undefined)) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path is not in the array of values
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any[]} ov - Array of values to match against
 * @returns {boolean}
 */
function matchNin(doc, path, ov) {
	if (!validateInNin(ov)) {
		return false;
	}

	return !matchIn(doc, path, ov);
}

/**
 * Matches if the value at the given path is greater than the given value
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchGt(doc, path, ov) {
	if (path.length === 0) {
		// Handle array of documents
		if (Array.isArray(doc) && doc.some((d) => matchGt(d, path, ov))) {
			return true;
		}

		// Handle array comparison
		if (Array.isArray(doc) && Array.isArray(ov)) {
			// In JavaScript, arrays can't be directly compared with > operator
			// Compare elements one by one
			for (let i = 0; i < Math.max(doc.length, ov.length); i++) {
				if (i >= ov.length) return true;
				if (i >= doc.length) return false;
				if (doc[i] !== ov[i]) return doc[i] > ov[i];
			}
			return false;
		}

		// Handle object comparison
		if (
			typeof doc === "object" &&
			doc !== null &&
			typeof ov === "object" &&
			ov !== null &&
			!Array.isArray(doc) &&
			!Array.isArray(ov)
		) {
			const docKeys = Object.keys(doc);
			const ovKeys = Object.keys(ov);

			for (let i = 0; i < Math.max(docKeys.length, ovKeys.length); i++) {
				const docKey = docKeys[i];
				const ovKey = ovKeys[i];

				if (docKey === undefined) return false;
				if (ovKey === undefined) return true;
				if (docKey !== ovKey) return docKey > ovKey;
				if (docKey === ovKey) {
					if (doc[docKey] > ov[ovKey]) return true;
					if (doc[docKey] < ov[ovKey]) return false;
				}
			}
			return false;
		}

		// Handle number comparison
		if (typeof doc === "number" && typeof ov === "number") {
			return doc > ov;
		}

		// Handle string comparison
		if (typeof doc === "string" && typeof ov === "string") {
			return doc > ov;
		}

		return false;
	}

	const key = path[0];
	const rest = path.slice(1);

	if (isPlainObject(doc) && key in doc) {
		return matchGt(doc[key], rest, ov);
	}

	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchGt(doc[idx], rest, ov);
		}
	}

	if (Array.isArray(doc)) {
		return doc.some((d) => matchGt(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path is greater than or equal to the given value
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchGte(doc, path, ov) {
	if (path.length === 0) {
		// Handle array of documents
		if (Array.isArray(doc) && doc.some((d) => matchGte(d, path, ov))) {
			return true;
		}

		// Handle array comparison
		if (Array.isArray(doc) && Array.isArray(ov)) {
			// In JavaScript, arrays can't be directly compared with >= operator
			// Compare elements one by one
			for (let i = 0; i < Math.max(doc.length, ov.length); i++) {
				if (i >= ov.length) return true;
				if (i >= doc.length) return false;
				if (doc[i] !== ov[i]) return doc[i] > ov[i];
			}
			return true; // Arrays are equal
		}

		// Handle object comparison
		if (
			typeof doc === "object" &&
			doc !== null &&
			typeof ov === "object" &&
			ov !== null &&
			!Array.isArray(doc) &&
			!Array.isArray(ov)
		) {
			if (!Object.keys(doc).length && !Object.keys(ov).length) {
				return true;
			}

			const docKeys = Object.keys(doc);
			const ovKeys = Object.keys(ov);

			for (let i = 0; i < Math.max(docKeys.length, ovKeys.length); i++) {
				const docKey = docKeys[i];
				const ovKey = ovKeys[i];

				if (docKey === undefined) return false;
				if (ovKey === undefined) return true;
				if (docKey !== ovKey) return docKey > ovKey;
				if (docKey === ovKey) {
					if (doc[docKey] > ov[ovKey]) return true;
					if (doc[docKey] < ov[ovKey]) return false;
				}
			}
			return true; // Objects are equal
		}

		// Handle number comparison
		if (typeof doc === "number" && typeof ov === "number") {
			return doc >= ov;
		}

		// Handle string comparison
		if (typeof doc === "string" && typeof ov === "string") {
			return doc >= ov;
		}

		// Handle null comparison
		if (doc === null && ov === null) {
			return true;
		}

		return false;
	}

	const key = path[0];
	const rest = path.slice(1);

	// Handle object path traversal
	if (isPlainObject(doc) && key in doc) {
		return matchGte(doc[key], rest, ov);
	}

	// Handle array index traversal
	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchGte(doc[idx], rest, ov);
		}
	}

	// Handle array traversal
	if (Array.isArray(doc)) {
		return doc.some((d) => matchGte(d, path, ov));
	}

	// Handle null comparison
	if (ov === null) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path is less than the given value
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchLt(doc, path, ov) {
	if (path.length === 0) {
		// Handle array of documents
		if (Array.isArray(doc) && doc.some((d) => matchLt(d, path, ov))) {
			return true;
		}

		// Handle array comparison
		if (Array.isArray(doc) && Array.isArray(ov)) {
			// Compare elements one by one
			for (let i = 0; i < Math.max(doc.length, ov.length); i++) {
				if (i >= doc.length) return true;
				if (i >= ov.length) return false;
				if (doc[i] !== ov[i]) return doc[i] < ov[i];
			}
			return false;
		}

		// Handle object comparison
		if (
			typeof doc === "object" &&
			doc !== null &&
			typeof ov === "object" &&
			ov !== null &&
			!Array.isArray(doc) &&
			!Array.isArray(ov)
		) {
			if (Object.keys(doc).length === 0 && Object.keys(ov).length === 0) {
				return false;
			}

			const docKeys = Object.keys(doc);
			const ovKeys = Object.keys(ov);

			for (let i = 0; i < Math.max(docKeys.length, ovKeys.length); i++) {
				const docKey = docKeys[i];
				const ovKey = ovKeys[i];

				if (docKey === undefined) return true;
				if (ovKey === undefined) return false;
				if (docKey !== ovKey) return docKey < ovKey;
				if (docKey === ovKey) {
					if (doc[docKey] > ov[ovKey]) return false;
					if (doc[docKey] < ov[ovKey]) return true;
				}
			}
			return false;
		}

		// Handle number comparison
		if (typeof doc === "number" && typeof ov === "number") {
			return doc < ov;
		}

		// Handle string comparison
		if (typeof doc === "string" && typeof ov === "string") {
			return doc < ov;
		}

		return false;
	}

	const key = path[0];
	const rest = path.slice(1);

	// Handle object path traversal
	if (isPlainObject(doc) && key in doc) {
		return matchLt(doc[key], rest, ov);
	}

	// Handle array index traversal
	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchLt(doc[idx], rest, ov);
		}
	}

	// Handle array traversal
	if (Array.isArray(doc)) {
		return doc.some((d) => matchLt(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path is less than or equal to the given value
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchLte(doc, path, ov) {
	if (path.length === 0) {
		// Handle array of documents
		if (Array.isArray(doc) && doc.some((d) => matchLte(d, path, ov))) {
			return true;
		}

		// Handle array comparison
		if (Array.isArray(doc) && Array.isArray(ov)) {
			// Compare elements one by one since JS doesn't support direct array comparison
			for (let i = 0; i < Math.max(doc.length, ov.length); i++) {
				if (i >= doc.length) return true;
				if (i >= ov.length) return false;
				if (doc[i] !== ov[i]) return doc[i] < ov[i];
			}
			return true;
		}

		// Handle object comparison
		if (
			typeof doc === "object" &&
			doc !== null &&
			typeof ov === "object" &&
			ov !== null &&
			!Array.isArray(doc) &&
			!Array.isArray(ov)
		) {
			if (!Object.keys(doc).length && !Object.keys(ov).length) {
				return true;
			}

			const docKeys = Object.keys(doc);
			const ovKeys = Object.keys(ov);

			for (let i = 0; i < Math.max(docKeys.length, ovKeys.length); i++) {
				const docKey = docKeys[i];
				const ovKey = ovKeys[i];

				if (docKey === undefined) return true;
				if (ovKey === undefined) return false;
				if (docKey !== ovKey) return docKey < ovKey;
				if (docKey === ovKey) {
					if (doc[docKey] < ov[ovKey]) return true;
					if (doc[docKey] > ov[ovKey]) return false;
				}
			}
			return true;
		}

		// Handle number comparison
		if (typeof doc === "number" && typeof ov === "number") {
			return doc <= ov;
		}

		// Handle string comparison
		if (typeof doc === "string" && typeof ov === "string") {
			return doc <= ov;
		}

		// Handle null comparison
		if (doc === null && ov === null) {
			return true;
		}

		return false;
	}

	const key = path[0];
	const rest = path.slice(1);

	// Handle object path traversal
	if (isPlainObject(doc) && key in doc) {
		return matchLte(doc[key], rest, ov);
	}

	// Handle array index traversal
	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchLte(doc[idx], rest, ov);
		}
	}

	// Handle array traversal
	if (Array.isArray(doc)) {
		return doc.some((d) => matchLte(d, path, ov));
	}

	if (ov === null) {
		return true;
	}

	return false;
}
