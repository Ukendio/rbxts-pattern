import { HttpService } from "@rbxts/services";

import type {
	Pattern,
	AnonymousSelectPattern,
	NamedSelectPattern,
	GuardPattern,
	NotPattern,
	GuardValue,
	GuardFunction,
} from "./types/Pattern";

import type { Unset, PickReturnValue, Match, MatchedValue } from "./types/Match";

import { __, PatternType } from "./PatternType";
import Object from "@rbxts/object-utils";
import { t } from "@rbxts/t";
import { InvertPattern } from "types/InvertPattern";

export const when = <a, b extends a = never>(predicate: GuardFunction<a, b>): GuardPattern<a, b> => ({
	"@rbxts-pattern/__patternKind": PatternType.Guard,
	"@rbxts-pattern/__when": predicate,
});

export const _not = <a>(pattern: Pattern<a>): NotPattern<a> => ({
	"@rbxts-pattern/__patternKind": PatternType.Not,
	"@rbxts-pattern/__pattern": pattern,
});

const ANONYMOUS_SELECT_KEY = "@ts-pattern/__anonymous-select-key";

export function _select(): AnonymousSelectPattern;
export function _select<k extends string>(key: k): NamedSelectPattern<k>;
export function _select<k extends string>(key?: k): AnonymousSelectPattern | NamedSelectPattern<k> {
	return key === undefined
		? {
				"@rbxts-pattern/__patternKind": PatternType.AnonymousSelect,
		  }
		: {
				"@rbxts-pattern/__patternKind": PatternType.NamedSelect,
				"@rbxts-pattern/__key": key,
		  };
}

type AnyConstructor = new (...args: Array<unknown>) => unknown;
export function isInstanceOf<T extends AnyConstructor>(classConstructor: T) {
	return (val: unknown): val is InstanceType<T> => val instanceof classConstructor;
}

export const instanceOf = <T extends AnyConstructor>(classConstructor: T) => when(isInstanceOf(classConstructor));

/**
 * # Pattern matching
 **/

export { Pattern, __ };

/**
 * #### match
 *
 * Entry point to create a pattern matching expression.
 *
 * It returns a `Match` builder, on which you can chain
 * several `.with(pattern, handler)` clauses.
 */
export const match = <a, b = Unset>(value: a): Match<a, b> => builder(value, []) as never;

/**
 * ### builder
 * This is the implementation of our pattern matching, using the
 * builder pattern.
 */
const builder = <a, b>(
	value: a,
	cases: {
		test: (value: a) => boolean;
		_select: (value: a) => never;
		handler: (...args: unknown[]) => never;
	}[],
) => {
	const run = () => {
		const entry = cases.find(({ test }) => {
			return test(value);
		});

		if (!entry) {
			let displayedValue;
			try {
				displayedValue = HttpService.JSONEncode(value);
			} catch (e) {
				displayedValue = value;
			}
			throw `Pattern matching error: no pattern matches value ${displayedValue}`;
		}
		return entry.handler(entry._select(value), value);
	};

	return {
		with(...args: Pattern<a>[]) {
			const handler = args[args.size() - 1];

			const patterns: Pattern<a>[] = [];
			const predicates: ((value: a) => unknown)[] = [];
			for (let i = 0; i < args.size() - 1; i++) {
				const arg = args[i];
				if (typeIs(arg, "function")) {
					predicates.push(arg);
				} else {
					patterns.push(arg);
				}
			}

			const selected: Record<string, unknown> = {};

			const doesMatch = (value: a) => {
				return (
					patterns.some((pattern) => {
						return matchPattern(pattern, value, (key, value) => {
							selected[key] = value;
						});
					}) && predicates.every((predicate) => predicate(value) as boolean)
				);
			};

			return builder(value, [
				...cases,
				{
					test: doesMatch,
					handler,
					_select: (value: a) =>
						Object.keys(selected).size() !== 0
							? selected[ANONYMOUS_SELECT_KEY] !== undefined
								? selected[ANONYMOUS_SELECT_KEY]
								: selected
							: value,
				},
			] as never);
		},
		numberSet<p extends number[], c>(set: p, handler: (value: GuardValue<p>) => PickReturnValue<b, c>) {
			const selected: Record<string, unknown> = {};
			const doesMatch = (value: number) => set.includes(value);

			return builder(value, [
				...cases,
				{
					test: doesMatch,
					handler,
					_select: () =>
						Object.keys(selected).size() !== 0
							? selected[ANONYMOUS_SELECT_KEY] !== undefined
								? selected[ANONYMOUS_SELECT_KEY]
								: selected
							: value,
				},
			] as never);
		},
		numberRange<p extends number[], c>(range: p, handler: (value: GuardValue<p>) => PickReturnValue<b, c>) {
			const selected: Record<string, unknown> = {};
			const rangeLength = range[1] - range[0];
			const getFullRange = new Array<number>(rangeLength);

			for (let i = range[0]; i < range[1]; i++) {
				getFullRange.push(i);
			}

			const doesMatch = (value: number) => range.includes(value);

			return builder(value, [
				...cases,
				{
					test: doesMatch,
					handler,
					_select: () =>
						Object.keys(selected).size() !== 0
							? selected[ANONYMOUS_SELECT_KEY] !== undefined
								? selected[ANONYMOUS_SELECT_KEY]
								: selected
							: value,
				},
			] as never);
		},

		when: <p extends (value: a) => unknown, c>(
			predicate: p,
			handler: (value: GuardValue<p>) => PickReturnValue<b, c>,
		) =>
			builder<a, PickReturnValue<b, c>>(value, [
				...cases,
				{ test: predicate, handler, _select: (value: a) => value },
			] as never),

		otherwise: <c>(handler: () => PickReturnValue<b, c>): PickReturnValue<b, c> =>
			builder<a, PickReturnValue<b, c>>(value, [
				...cases,

				{
					test: () => true,
					handler,
					_select: (value: a) => value,
				},
			] as never).run(),

		exhaustive: () => run(),

		run,
	};
};

const isObject = (value: unknown): value is Object => typeIs(value, "table");

const isGuardPattern = (x: unknown): x is GuardPattern<unknown> => {
	const pattern = x as GuardPattern<unknown>;
	return (
		pattern &&
		pattern["@rbxts-pattern/__patternKind"] === PatternType.Guard &&
		typeIs(pattern["@rbxts-pattern/__when"], "function")
	);
};

const isNotPattern = (x: unknown): x is NotPattern<unknown> => {
	const pattern = x as NotPattern<unknown>;
	return pattern && pattern["@rbxts-pattern/__patternKind"] === PatternType.Not;
};

const isNamedSelectPattern = (x: unknown): x is NamedSelectPattern<string> => {
	const pattern = x as NamedSelectPattern<string>;
	return pattern && pattern["@rbxts-pattern/__patternKind"] === PatternType.NamedSelect;
};

const isAnonymousSelectPattern = (x: unknown): x is AnonymousSelectPattern => {
	const pattern = x as AnonymousSelectPattern;
	return pattern && pattern["@rbxts-pattern/__patternKind"] === PatternType.AnonymousSelect;
};

// tells us if the value matches a given pattern.
const matchPattern = <a, p extends Pattern<a>>(
	pattern: p,
	value: a,
	_select: (key: string, value: unknown) => void,
): boolean => {
	if (isObject(pattern)) {
		if (pattern === __) return true;

		if (isNamedSelectPattern(pattern)) {
			_select(pattern["@rbxts-pattern/__key"], value);
			return true;
		}

		if (isAnonymousSelectPattern(pattern)) {
			_select(ANONYMOUS_SELECT_KEY, value);
			return true;
		}

		if (isGuardPattern(pattern)) {
			return pattern["@rbxts-pattern/__when"](value) === true;
		}

		if (isNotPattern(pattern))
			return !matchPattern(pattern["@rbxts-pattern/__pattern"] as Pattern<a>, value, _select);

		if (!isObject(value)) return false;

		if (t.array(t.any)(pattern)) {
			if (!t.array(t.any)(value)) return false;

			// List pattern
			if (pattern.size() === 1) {
				const selected: Record<string, unknown[]> = {};

				const listSelect = (key: string, value: unknown) => {
					selected[key] = [...(selected[key] || []), value];
				};

				const doesMatch = value.every((v) => matchPattern(pattern[0], v, listSelect));

				if (doesMatch) {
					Object.keys(selected).forEach((key) => _select(key, selected[key]));
				}

				return doesMatch;
			}

			// Tuple pattern
			return pattern.size() === value.size()
				? (pattern as unknown as []).every((subPattern, i) =>
						matchPattern(subPattern, (value as unknown as [])[i], _select),
				  )
				: false;
		}

		if (t.map(t.any, t.any)(pattern)) {
			if (!t.map(t.any, t.any)(value)) return false;
			return [...(Object.keys(pattern) as never[])].every((key) =>
				matchPattern(pattern.get(key), value.get(key), _select),
			);
		}

		if (t.set(t.any)(pattern)) {
			if (!t.set(t.any)(value)) return false;

			if (pattern.isEmpty()) return true;

			if (pattern.size() === 1) {
				const [subPattern] = [...Object.values(pattern)];
				return Object.values(__).includes(subPattern as never)
					? matchPattern([subPattern], [...Object.values(value)], _select)
					: value.has(subPattern as never);
			}

			return [...Object.values(pattern)].every((subPattern) => value.has(subPattern as never));
		}

		if (t.map(t.string, t.string)(pattern) && t.map(t.string, t.string)(value)) {
			return Object.keys(pattern).every((k: string): boolean =>
				matchPattern(pattern[k as never], value[k as never], _select),
			);
		}
	}

	if (typeIs(pattern, "string")) {
		if (pattern === __.string) return typeIs(value, "string");
		if (pattern === __.boolean) return typeIs(value, "boolean");
		if (pattern === __.number) return typeIs(value, "number");
	}

	function deepEquals(a: object, b: object) {
		if (typeOf(a) !== typeOf(b)) return false;

		if (typeOf(a) === "table") {
			for (const [k, v] of pairs(a)) {
				const par = b[k as never];
				const [a1, b1] = [deepEquals(v, par), deepEquals(par, v)] as LuaTuple<[boolean, boolean]>;

				if (!a1 || !b1) return false;
			}

			return true;
		}

		if (a === b) return true;

		return false;
	}
	return deepEquals(value as never, pattern as never);
};

/**
 * Helper function taking a pattern and returning a **type guard** function telling
 * us whether or not a value matches the pattern.
 *
 * @param pattern the Pattern the value should match
 * @returns a function taking the value and returning whether or not it matches the pattern.
 */
export function isMatching<p extends Pattern<unknown>>(
	pattern: p,
): (value: unknown) => value is MatchedValue<unknown, InvertPattern<p>>;
/**
 * **type guard** function taking a pattern and a value and returning a boolean telling
 * us whether or not the value matches the pattern.
 *
 * @param pattern the Pattern the value should match
 * @param value
 * @returns a boolean telling whether or not the value matches the pattern.
 */
export function isMatching<p extends Pattern<unknown>>(
	pattern: p,
	value: unknown,
): value is MatchedValue<unknown, InvertPattern<p>>;
export function isMatching<p extends Pattern<unknown>>(
	...args: [pattern: p, value?: unknown]
): boolean | ((vale: unknown) => boolean) {
	if (args.length === 1) {
		const [pattern] = args;
		return (value: unknown): value is MatchedValue<unknown, InvertPattern<p>> =>
			matchPattern(pattern, value, () => {});
	}
	if (args.length === 2) {
		const [pattern, value] = args;
		return matchPattern(pattern, value, () => {});
	}

	throw `isMatching wasn't given enough arguments: expected 1 or 2, received ${args.length}.`;
}
