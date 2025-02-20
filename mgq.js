//@ts-check

import assert from "node:assert";
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

export function Query(query) {
	return {
		test: (doc) => matchCond(query, doc),
		validate: () => validate(query),
	};
}

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
		typeof expOrOv === "object" &&
		!Array.isArray(expOrOv) &&
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

// function matchEq(doc, pathParts, query) {
// 	return true;
// }

function matchNe(doc, pathParts, query) {
	return true;
}

function matchGt(doc, pathParts, query) {
	return true;
}

function matchGte(doc, pathParts, query) {
	return true;
}

function matchLt(doc, pathParts, query) {
	return true;
}

function matchLte(doc, pathParts, query) {
	return true;
}

function matchIn(doc, pathParts, query) {
	return true;
}

function matchNin(doc, pathParts, query) {
	return true;
}

function matchNot(doc, path, query) {
	return true;
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
