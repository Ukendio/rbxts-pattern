<h1 align="center">ts-pattern</h1>

<p align="center">
The exhaustive Pattern Matching library for <a href="https://www.roblox-ts.com">Roblox-TS</a>
with smart type inference.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rbxts/rbxts-pattern">
    <img src="https://img.shields.io/npm/dm/ts-pattern.svg" alt="downloads per month" height="18">
  </a>
  <a href="https://www.npmjs.com/package/@rbxts/rbxts-pattern">
    <img src="https://img.shields.io/npm/v/ts-pattern.svg" alt="npm version" height="18">
  </a>
  <a href="https://www.npmjs.com/package/@rbxts/rbxts-pattern">
    <img src="https://img.shields.io/npm/l/ts-pattern.svg" alt="license" height="18">
  </a>
</p>

```ts
import { match, _select } from "@rbxts/rbxts-pattern";
import { HttpService } from "@rbxts/services";

const response = HttpService.RequestAsync({
	Url: "http://httpin.org/post",
	Method: "POST",
	Headers: {
		["Content-Type"]: "application/json",
	},
	Body: HttpService.JSONEncode({ Hello: "World" })
});

match(response)
	.with({Success: true}, ({StatusMessage, StatusCode, Body}) => {
		print(`Status code: ${StatusCode}, ${StatusMessage}\nResponse body:\n${Body}`)
	})
	.with(__, ({StatusMessage, StatusCode}) => print(`The request failed: ${StatusCode}, ${StatusMessage}`))
	.exhaustive();

```

## About

Write **better** and **safer conditions**. Pattern matching lets you express complex conditions in a single, compact expression. Your code becomes **shorter** and **more readable**. Exhaustiveness checking ensures you haven’t forgotten **any possible case**.

## Features

- Works on **any data structure**: nested objects, arrays, tuples, Sets, Maps, Vecs, Hashmaps and all primitive types.
- **Typesafe**, with helpful type inference.
- **Exhaustive matching** support, enforcing that you are matching every possible case with `.exhaustive()`.
- **Expressive API**, with catch-all and type specific **wildcards**: `__`.
- Supports `when(<predicate>)` and `not(<pattern>)` patterns for complex cases.
- Supports properties selection, via the `select(<name?>)` function.
- Tiny bundle footprint.

## What is Pattern Matching?

Pattern Matching is a technique coming from functional programming languages to declaratively write conditional code branches based on the structure of a value. This technique has proven itself to be much more powerful and much less verbose than imperative alternatives (if/else/switch statements) especially when branching on complex data structures or on several values.

Pattern Matching is implemented in Haskell, Rust, Swift, Elixir and many other languages. There is [a tc39 proposal](https://github.com/tc39/proposal-pattern-matching) to add Pattern Matching to the EcmaScript specification, but it is still in stage 1 and isn't likely to land before several years (if ever). Luckily, pattern matching can be implemented in userland. `rbxts-pattern` Provides a typesafe pattern matching implementation that you can start using today.

## Installation

Via npm

```
npm install @rbxts/rbxts-pattern
```

# Documentation

- [Code Sandbox Examples](#code-sandbox-examples)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
  - [`match`](#match)
  - [`.with`](#with)
  - [`.when`](#when)
  - [`.otherwise`](#otherwise)
  - [`.run`](#run)
  - [`isMatching`](#ismatching)
  - [Patterns](#patterns)
    - [Literals](#literals)
    - [`__` wildcard](#__-wildcard)
    - [`__.string` wildcard](#__string-wildcard)
    - [`__.number` wildcard](#__number-wildcard)
    - [`__.boolean` wildcard](#__boolean-wildcard)
    - [Objects](#objects)
    - [Lists (arrays)](#lists-arrays)
    - [Tuples (arrays)](#tuples-arrays)
    - [`when` guards](#when-guards)
    - [`not` patterns](#not-patterns)
    - [`select` patterns](#select-patterns)
    - [`instanceOf` patterns](#instanceof-patterns)
- [Type inference](#type-inference)
- [Inspirations](#inspirations)

### Matching several patterns

As you may know, `switch` statements allow handling several cases with
the same code block:

```ts
switch (type) {
  case 'text':
  case 'span':
  case 'p':
    return 'text';

  case 'btn':
  case 'button':
    return 'button';
}
```

Similarly, ts-pattern lets you pass several patterns to `.with()` and if
one of these patterns matches your input, the handler function will be called:

```ts
const sanitize = (name: string) =>
  match(name)
    .with('text', 'span', 'p', () => 'text')
    .with('btn', 'button', () => 'button')
    .otherwise(() => name);

sanitize('span'); // 'text'
sanitize('p'); // 'text'
sanitize('button'); // 'button'
```

Obviously, it also works with more complex patterns than strings. Exhaustive matching also works as you would expect.

## API Reference

### `match`

```ts
match(value);
```

Create a `Match` object on which you can later call `.with`, `.when`, `.otherwise` and `.run`.

#### Signature

```ts
function match<TInput, TOutput>(input: TInput): Match<TInput, TOutput>;
```

#### Arguments

- `input`
  - **Required**
  - the input value your patterns will be tested against.

### `.with`

```ts
match(...)
  .with(pattern, [...patterns], handler)
```

#### Signature

```ts
function with(
  pattern: Pattern<TInput>,
  handler: (value: TInput, selections: Selections<TInput>) => TOutput
): Match<TInput, TOutput>;

// Overload for multiple patterns
function with(
  pattern1: Pattern<TInput>,
  ...patterns: Pattern<TInput>[],
  // no selection object is provided when using multiple patterns
  handler: (value: TInput) => TOutput
): Match<TInput, TOutput>;

// Overload for guard functions
function with(
  pattern: Pattern<TInput>[],
  when: (value: TInput) => unknown,
  handler: (
    [selection: Selection<TInput>, ]
    value: TInput
  ) => TOutput
): Match<TInput, TOutput>;
```

#### Arguments

- `pattern: Pattern<TInput>`
  - **Required**
  - The pattern your input must match for the handler to be called.
  - [See all valid patterns below](#patterns)
  - If you provide several patterns before providing the `handler`, the `with` clause will match if one of the patterns matches.
- `when: (value: TInput) => unknown`
  - Optional
  - Additional condition the input must satisfy for the handler to be called.
  - The input will match if your guard function returns a truthy value.
  - `TInput` might be narrowed to a more precise type using the `pattern`.
- `handler: (value: TInput, selections: Selections<TInput>) => TOutput`
  - **Required**
  - Function called when the match conditions are satisfied.
  - All handlers on a single `match` case must return values of the same type, `TOutput`.
  - `TInput` might be narrowed to a more precise type using the `pattern`.
  - `selections` is an object of properties selected from the input with the [`select` function](#select-patterns).

### `.when`

```ts
match(...)
  .when(predicate, handler)
```

#### Signature

```ts
function when(
  predicate: (value: TInput) => unknown,
  handler: (value: TInput) => TOutput
): Match<TInput, TOutput>;
```

#### Arguments

- `predicate: (value: TInput) => unknown`
  - **Required**
  - Condition the input must satisfy for the handler to be called.
- `handler: (value: TInput) => TOutput`
  - **Required**
  - Function called when the predicate condition is satisfied.
  - All handlers on a single `match` case must return values of the same type, `TOutput`.

### `.exhaustive`

```ts
match(...)
  .with(...)
  .exhaustive()
```

Executes the match case, return its result, and enable exhaustive pattern matching, making sure at compile time that all possible cases are handled.

#### Signature

```ts
function exhaustive(): IOutput;
```

### `.otherwise`

```ts
match(...)
  .with(...)
  .otherwise(defaultHandler)
```

Executes the match case and return its result.

#### Signature

```ts
function otherwise(defaultHandler: (value: TInput) => TOutput): TOutput;
```

#### Arguments

- `defaultHandler: (value: TInput) => TOutput`
  - **Required**
  - Function called if no pattern matched the input value.
  - Think of it as the `default:` case of `switch` statements.
  - All handlers on a single `match` case must return values of the same type, `TOutput`.

### `.run`

```ts
match(...)
  .with(...)
  .run()
```

Executes the match case and return its result.

#### Signature

```ts
function run(): TOutput;
```

### `isMatching`

With a single argument:

```ts
import { isMatching, __ } from 'ts-pattern';

const isBlogPost = isMatching({
  title: __.string,
  description: __.string,
});

if (isBlogPost(value)) {
  // value: { title: string, description: string }
}
```

With two arguments:

```ts
const blogPostPattern = {
  title: __.string,
  description: __.string,
};

if (isMatching(blogPostPattern, value)) {
  // value: { title: string, description: string }
}
```

Type guard function to check if a value is matching a pattern or not.

#### Signature

```ts
export function isMatching<p extends Pattern<any>>(
  pattern: p
): (value: any) => value is InvertPattern<p>;
export function isMatching<p extends Pattern<any>>(
  pattern: p,
  value: any
): value is InvertPattern<p>;
```

#### Arguments

- `pattern: Pattern<any>`
  - **Required**
  - The pattern a value should match.
- `value?: any`
  - **Optional**
  - if a value is given as second argument, `isMatching` will return a boolean telling us whether or not the value matches the pattern.
  - if the only argument given to the function is the pattern, then `isMatching` will return a **type guard function** taking a value and returning a boolean telling us whether or not the value matches the pattern.

### Patterns

Patterns are values matching one of the possible shapes of your input. They can
be literal values, data structures, wildcards, or special functions like `not`,
`when` and `select`.

If your input isn't typed, (if it's a `any` or a `unknown`), you have no constraints
on the shape of your pattern, you can put whatever you want. In your handler, your
value will take the type described by your pattern.

#### Literals

Literals are primitive JavaScript values, like number, string, boolean, bigint, null, undefined, and symbol.

```ts
import { match } from 'rbxts-pattern';

const input: unknown = 2;

const output = match(input)
  .with(2, () => 'number: two')
  .with(true, () => 'boolean: true')
  .with('hello', () => 'string: hello')
  .with(undefined, () => 'undefined')
  .otherwise(() => 'something else');

print(output);
// => 'two'
```

#### `__` wildcard

The `__` pattern will match any value.

```ts
import { match, __ } from 'rbxts-pattern';

const input = 'hello';

const output = match(input)
  .with(__, () => 'It will always match')
  .otherwise(() => 'This string will never be used');

console.log(output);
// => 'It will always match'
```

#### `__.string` wildcard

The `__.string` pattern will match any value of type `string`.

```ts
import { match, __ } from 'rbxts-pattern';

const input = 'hello';

const output = match(input)
  .with('bonjour', () => 'Won‘t match')
  .with(__.string, () => 'it is a string!')
  .run();

print(output);
// => 'it is a string!'
```

#### `__.number` wildcard

The `__.number` pattern will match any value of type `number`.

```ts
import { match, __ } from 'rbxts-pattern';

const input = 2;

const output = match<number | string>(input)
  .with(__.string, () => 'it is a string!')
  .with(__.number, () => 'it is a number!')
  .run();

print(output);
// => 'it is a number!'
```

#### `__.boolean` wildcard

The `__.boolean` pattern will match any value of type `boolean`.

```ts
import { match, __ } from 'rbxts-pattern';

const input = true;

const output = match<number | string | boolean>(input)
  .with(__.string, () => 'it is a string!')
  .with(__.number, () => 'it is a number!')
  .with(__.boolean, () => 'it is a boolean!')
  .run();

print(output);
// => 'it is a boolean!'
```

#### Objects

A pattern can be an object with sub-pattern properties. In order to match,
the input must be an object with all properties defined on the pattern object
and each property must match its sub-pattern.

```ts
import { match } from 'rbxts-pattern';

type Input =
  | { type: 'user'; name: string }
  | { type: 'image'; src: string }
  | { type: 'video'; seconds: number };

let input: Input = { type: 'user', name: 'Gabriel' };

const output = match(input)
  .with({ type: 'image' }, () => 'image')
  .with({ type: 'video', seconds: 10 }, () => 'video of 10 seconds.')
  .with({ type: 'user' }, ({ name }) => `user of name: ${name}`)
  .otherwise(() => 'something else');

print(output);
// => 'user of name: Gabriel'
```

#### Arrays 

To match on a list of values, your pattern can be an array with a single sub-pattern in it.
This sub-pattern will be tested against all elements in your input array, and they
must all match for your list pattern to match.

```ts
import { match, __ } from 'rbxts-pattern';

type Input = { title: string; content: string }[];

let input: Input = [
  { title: 'Hello world!', content: 'This is a very interesting content' },
  { title: 'Bonjour!', content: 'This is a very interesting content too' },
];

const output = match(input)
  .with(
    [{ title: __.string, content: __.string }],
    (posts) => 'a list of posts!'
  )
  .otherwise(() => 'something else');

print(output);
// => 'a list of posts!'
```

```ts
import { match, __ } from 'rbxts-pattern';

type Input = Map<string, string | number>;

const input: Input = new Map([
  ['a', 1],
  ['b', 2],
  ['c', 3],
]);

const output = match<Input>(input)
  .with(new Map([['b', 2]]), (map) => `map.get('b') is 2`)
  .with(new Map([['a', __.string]]), (map) => `map.get('a') is a string`)
  .with(
    new Map([
      ['a', __.number],
      ['c', __.number],
    ]),
    (map) => `map.get('a') and map.get('c') are number`
  )
  .otherwise(() => '');

print(output);
// => 'map.get('b') is 2'
```

#### `when` guards

the `when` function enables you to test the input with a custom guard function.
The pattern will match only if all `when` functions return a truthy value.

Note that you can narrow down the type of your input by providing a
[Type Guard function](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards) to when.

```ts
import { match, when } from 'rbxts-pattern';

type Input = { score: number };

const output = match<Input>({ score: 10 })
  .with(
    {
      score: when((score): score is 5 => score === 5),
    },
    (input) => '😐' // input is inferred as { score: 5 }
  )
  .with({ score: when((score) => score < 5) }, () => '😞')
  .with({ score: when((score) => score > 5) }, () => '🙂')
  .run();

console.log(output);
// => '🙂'
```

#### `not` patterns

The `not` function enables you to match on everything **but** a specific value.
it's a function taking a pattern and returning its opposite:

```ts
import { match, not } from 'ts-pattern';

type Input = boolean | number;

const toNumber = (input: Input) =>
  match(input)
    .with(not(__.boolean), (n) => n) // n: number
    .with(true, () => 1)
    .with(false, () => 0)
    .run();

console.log(toNumber(2));
// => 2
console.log(toNumber(true));
// => 1
```

#### `select` patterns

The `select` function enables us to pick a piece of our input data structure
and inject it in our handler function.

It's especially useful when pattern matching on deep data structure to
avoid the hassle of destructuring it in the handler function.

Selections can be either named (with `select('someName')`) or anonymous (with `select()`).

You can have only one anonymous selection by pattern, and the selected value will be directly inject in your handler as first argument:

```ts
import { match, select } from 'rbxts-pattern';

type Input =
  | { type: 'post'; user: { name: string } }
  | { ... };

const input = { type: 'post', user: { name: 'Gabriel' } }

const output = match<Input>(input)
    .with(
      { type: 'post', user: { name: select() } },
      username => username // username: string
    )
    .otherwise(() => 'anonymous');

print(output);
// => 'Gabriel'
```

If you need to select several things inside your input data structure, you can name your selections by giving a string to `select(<name>)`. Each selection will be passed as first argument to your handler in an object.

```ts
import { match, select } from 'rbxts-pattern';

type Input =
  | { type: 'post'; user: { name: string }, content: string }
  | { ... };

const input = { type: 'post', user: { name: 'Gabriel' }, content: 'Hello!' }

const output = match<Input>(input)
    .with(
      { type: 'post', user: { name: select('name') }, content: select('body') },
      ({ name, body }) => `${name} wrote "${body}"`
    )
    .otherwise(() => '');

print(output);
// => 'Gabriel wrote "Hello!"'
```

#### `instanceOf` patterns

The `instanceOf` function lets you build a pattern to check if
a value is an instance of a class:

```ts
import { match, instanceOf } from 'rbxts-pattern';

class A {
  a = 'a';
}
class B {
  b = 'b';
}

type Input = { value: A | B };

const input = { value: new A() };

const output = match<Input>(input)
  .with({ value: instanceOf(A) }, (a) => {
    return 'instance of A!';
  })
  .with({ value: instanceOf(B) }, (b) => {
    return 'instance of B!';
  })
  .exhaustive();

print(output);
// => 'instance of A!'
```

### type inference

`rbxts-pattern` heavily relies on TypeScript's type system to automatically infer the precise type of your input value based on your pattern. Here are a few examples showing how the input type would be narrowed using various patterns:

```ts
type Input = { type: string } | string;

match<Input, 'ok'>({ type: 'hello' })
  .with(__, (value) => 'ok') // value: Input
  .with(__.string, (value) => 'ok') // value: string
  .with(
    when((value) => true),
    (value) => 'ok' // value: Input
  )
  .with(
    when((value): value is string => true),
    (value) => 'ok' // value: string
  )
  .with(not('hello'), (value) => 'ok') // value: Input
  .with(not(__.string), (value) => 'ok') // value: { type: string }
  .with(not({ type: __.string }), (value) => 'ok') // value: string
  .with(not(when(() => true)), (value) => 'ok') // value: Input
  .with({ type: __ }, (value) => 'ok') // value: { type: string }
  .with({ type: __.string }, (value) => 'ok') // value: { type: string }
  .with({ type: when(() => true) }, (value) => 'ok') // value: { type: string }
  .with({ type: not('hello' as const) }, (value) => 'ok') // value: { type: string }
  .with({ type: not(__.string) }, (value) => 'ok') // value: never
  .with({ type: not(when(() => true)) }, (value) => 'ok') // value: { type: string }
  .run();
```

## Inspirations

This library is a heavily forked version of TS-pattern by gvergnaurd. The purpose of the package was originally derived from an article by Wim Jongeneel:
[Pattern Matching in TypeScript with Record and Wildcard Patterns](https://medium.com/swlh/pattern-matching-in-typescript-with-record-and-wildcard-patterns-6097dd4e471d).

#### how is this different from `ts-pattern`

`rbxts-pattern` has a few notable differences from typescript-pattern-matching & ts-pattern:

- Reworked to be compatible with [Luau](luau-lang.org) APIs
- Designed to be unit tested.
- It supports comparing metatables.
- It provides a "catch all" pattern: `__`.
- It supports exhaustive matching with `.exhaustive()`.
- It supports deep selection with the `_select()` function.
- Its type inference works on deeper patterns and is well tested.
- It provides additional number utility such as numberRange and numberRet.
- It supports multiple data structures such as maps, arrays, vec, hashmaps, tuples and regular objects.

