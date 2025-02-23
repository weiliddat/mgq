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
 */
export function Query(query) {
	const queryInstance = {
		/**
		 * Matches the given document against the query
		 * @param {Record<string,any>} doc - The document to match against
		 * @returns {boolean}
		 */
		test: (doc) => matchCond(query, doc),

		/**
		 * Validates the query
		 * @throws {TypeError} if the query is invalid
		 */
		validate: () => {
			validate(query);
			return queryInstance;
		},
	};

	return queryInstance;
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
 * Validates query operators like $and, $or, $nor
 * @param {any} query - The query to validate
 * @returns {boolean}
 */
function validateQueryOps(query) {
	return Array.isArray(query);
}

/**
 * Validates $in $nin operators
 * @param {any} value - The value to validate
 * @returns {boolean}
 */
function validateInNin(value) {
	return Array.isArray(value);
}

/**
 * Validates $all operator
 * @param {any} value - The value to validate
 * @returns {boolean}
 */
function validateAll(value) {
	const isArray = Array.isArray(value);

	if (isArray) {
		if (value.length === 0) {
			return true;
		}

		if (
			value.every(
				(v) =>
					isPlainObject(v) && Object.keys(v).some((k) => k.startsWith("$")),
			)
		) {
			return validateAllElemMatch(value);
		}
	}

	return isArray;
}

/**
 * Validates $all operator with $elemMatch
 * @param {any[]} ov - The value to validate
 * @returns {boolean}
 */
function validateAllElemMatch(ov) {
	return ov.every(
		(o) => typeof o === "object" && o !== null && "$elemMatch" in o,
	);
}

/**
 * Validates $mod operator
 * @param {any} value - The value to validate
 * @returns {boolean}
 */
function validateMod(value) {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === "number" &&
		typeof value[1] === "number"
	);
}

/**
 * Validates $size operator
 * @param {any} value - The value to validate
 * @returns {boolean}
 */
function validateSize(value) {
	return typeof value === "number";
}

/**
 * Checks if the given value is a plain object
 * (not null, not an array, not a regex, not a date)
 * @param {any} v - The value to check
 * @returns {v is Record<any, any>}
 */
function isPlainObject(v) {
	return (
		typeof v === "object" &&
		v !== null &&
		!Array.isArray(v) &&
		!(v instanceof RegExp) &&
		!(v instanceof Date)
	);
}

/**
 * Checks if the given value is null or undefined
 * @param {any} v - The value to check
 * @returns {boolean}
 */
function isNil(v) {
	return v === null || v === undefined;
}

/**
 * Matches if the document matches all the given queries
 * @param {any} doc - The document to match against
 * @param {string} path - The path to match against
 * @param {any} ov - The queries to match against
 * @returns {boolean}
 */
function matchAnd(doc, path, ov) {
	if (!validateQueryOps(ov)) {
		return false;
	}

	return ov.every((cond) => matchCond(cond, doc));
}

/**
 * Matches if the document matches any of the given queries
 * @param {any} doc - The document to match against
 * @param {string} path - The path to match against
 * @param {any} ov - The queries to match against
 * @returns {boolean}
 */
function matchOr(doc, path, ov) {
	if (!validateQueryOps(ov)) {
		return false;
	}

	return ov.some((cond) => matchCond(cond, doc));
}

/**
 * Matches if the document does not match any of the given queries
 * @param {any} doc - The document to match against
 * @param {string} path - The path to match against
 * @param {any} ov - The queries to match against
 * @returns {boolean}
 */
function matchNor(doc, path, ov) {
	if (!validateQueryOps(ov)) {
		return false;
	}

	return !ov.some((cond) => matchCond(cond, doc));
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

/**
 * Matches if the value at the given path is equal to the queried value
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

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchEq(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchEq(d, path, ov));
	}

	if (isNil(ov)) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path is not equal to the queried value
 * @param {any} doc - Document to check
 * @param {string[]} pathParts - Path to the value
 * @param {any} query - Value to match against
 * @returns {boolean}
 */
function matchNe(doc, pathParts, query) {
	return !matchEq(doc, pathParts, query);
}

/**
 * Matches if the value at the given path is in the array of queried values
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
 * Matches if the value at the given path is not in the array of queried values
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
 * Matches if the value at the given path is greater than the queried value
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
		if (isPlainObject(doc) && isPlainObject(ov)) {
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

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchGt(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchGt(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path is greater than or equal to the queried value
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
		if (isPlainObject(doc) && isPlainObject(ov)) {
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
		if (isNil(doc) && isNil(ov)) {
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

	// Handle array traversal
	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchGte(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchGte(d, path, ov));
	}

	// Handle null comparison
	if (isNil(ov)) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path is less than the queried value
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
		if (isPlainObject(doc) && isPlainObject(ov)) {
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

	// Handle array traversal
	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchLt(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchLt(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path is less than or equal to the queried value
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
		if (isPlainObject(doc) && isPlainObject(ov)) {
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
		if (isNil(doc) && isNil(ov)) {
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

	// Handle array traversal
	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchLte(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchLte(d, path, ov));
	}

	if (isNil(ov)) {
		return true;
	}

	return false;
}

/**
 * Matches if the value at the given path matches the queried regex
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchRegex(doc, path, ov) {
	if (path.length === 0) {
		if (Array.isArray(doc) && doc.some((d) => matchRegex(d, path, ov))) {
			return true;
		}

		if (typeof doc !== "string") {
			return false;
		}

		let flags = "";
		if (ov.$options.includes("i")) {
			flags += "i";
		}
		if (ov.$options.includes("m")) {
			flags += "m";
		}
		if (ov.$options.includes("s")) {
			flags += "s";
		}

		const matcher = new RegExp(ov.$regex, flags);
		return matcher.test(doc);
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchRegex(doc[key], rest, ov);
	}

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchRegex(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchRegex(d, path, ov));
	}

	return false;
}

/**
 * Matches if items in the value (array) at the given path match the queried $elemMatch
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchElemMatch(doc, path, ov) {
	if (path.length === 0) {
		if (!Array.isArray(doc)) {
			return false;
		}

		return doc.some((d) => matchCond(ov, d));
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchElemMatch(doc[key], rest, ov);
	}

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchElemMatch(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchElemMatch(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path matches the queried divisor and remainder
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchMod(doc, path, ov) {
	if (!validateMod(ov)) {
		return false;
	}

	if (path.length === 0) {
		if (Array.isArray(doc) && doc.some((d) => matchMod(d, path, ov))) {
			return true;
		}

		if (typeof doc !== "number") {
			return false;
		}

		const divisor = Math.floor(ov[0]);
		const expected_remainder = Math.floor(ov[1]);
		const doc_remainder = Math.floor(doc % divisor);

		return doc_remainder === expected_remainder;
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchMod(doc[key], rest, ov);
	}

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchMod(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchMod(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path matches the queried size
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchSize(doc, path, ov) {
	if (!validateSize(ov)) {
		return false;
	}

	if (path.length === 0) {
		if (!Array.isArray(doc)) {
			return false;
		}

		return doc.length === Number.parseInt(ov);
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchSize(doc[key], rest, ov);
	}

	if (Array.isArray(doc)) {
		if (/^\d+$/.test(key)) {
			const idx = Number.parseInt(key);
			if (idx < doc.length) {
				return matchSize(doc[idx], rest, ov);
			}
		}
		return doc.some((d) => matchSize(d, path, ov));
	}

	return false;
}

/**
 * Matches if the value at the given path matches the queried $all
 * @param {any} doc - Document to check
 * @param {string[]} path - Path to the value
 * @param {any} ov - Value to match against
 * @returns {boolean}
 */
function matchAll(doc, path, ov) {
	if (!validateAll(ov)) {
		return false;
	}

	if (ov.length === 0) {
		return false;
	}

	if (validateAllElemMatch(ov)) {
		const elem_match_query = {
			$and: ov.map((o) => ({ [path.join(".")]: o })),
		};
		return matchCond(elem_match_query, doc);
	}

	if (path.length === 0) {
		if (!Array.isArray(doc)) {
			return false;
		}

		return ov.every(
			(o) => doc.find((dv) => deepEqual(dv, o)) || deepEqual(doc, o),
		);
	}

	const key = path[0];
	const rest = path.slice(1);

	if (typeof doc === "object" && doc !== null && key in doc) {
		return matchAll(doc[key], rest, ov);
	}

	if (Array.isArray(doc) && /^\d+$/.test(key)) {
		const idx = Number.parseInt(key);
		if (idx < doc.length) {
			return matchAll(doc[idx], rest, ov);
		}
	}

	if (Array.isArray(doc)) {
		return doc.some((d) => matchAll(d, path, ov));
	}

	return false;
}
