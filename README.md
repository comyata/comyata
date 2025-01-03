# Comyata - computing data

[![Github actions Build](https://github.com/comyata/comyata/actions/workflows/blank.yml/badge.svg)](https://github.com/comyata/comyata/actions)
[![Coverage Status](https://img.shields.io/codecov/c/github/comyata/comyata/main.svg?style=flat-square)](https://codecov.io/gh/comyata/comyata/branch/main)

Use data like programs: write data templates with embedded queries, logic and transformations.

Run them in the browser or on a server, save the templates in files or a database, and do whatever you want.

**🕹️ Examples:**

- Runtime with React hooks: [codesandbox](https://codesandbox.io/p/devbox/github/comyata/comyata/tree/main/apps/sandbox?file=%2Fsrc%2FPages%2FPageHome.tsx) | [stackblitz](https://stackblitz.com/github/comyata/comyata/tree/main/apps/sandbox?file=src%2FPages%2FPageHome.tsx) | [source in apps/sandbox](./apps/sandbox)
- Runtime with minimal setup: [codesandbox](https://codesandbox.io/p/devbox/github/comyata/comyata/tree/main/apps/minimal-runtime?file=%2Fsrc%2Findex.ts) | [stackblitz](https://stackblitz.com/github/comyata/comyata/tree/main/apps/minimal-runtime?file=src%2Findex.ts) | [source in apps/minimal-runtime](./apps/minimal-runtime)
- FileEngine as API Server: [codesandbox](https://codesandbox.io/p/devbox/github/comyata/comyata/tree/main/server/fe) | [stackblitz](https://stackblitz.com/github/comyata/comyata/tree/main/server/fe) | [source in server/fe](./server/fe)

**📦 Packages:**

- @comyata/run [![MIT license](https://img.shields.io/npm/l/@comyata/run?style=flat-square)](https://github.com/comyata/comyata/blob/main/LICENSE) [![npm (scoped)](https://img.shields.io/npm/v/@comyata/run?style=flat-square)](https://www.npmjs.com/package/@comyata/run) [![JS compatibility](https://img.shields.io/badge/ESM--f7e018?style=flat-square&logo=javascript)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
- @comyata/fe [![MIT license](https://img.shields.io/npm/l/@comyata/fe?style=flat-square)](https://github.com/comyata/comyata/blob/main/LICENSE) [![npm (scoped)](https://img.shields.io/npm/v/@comyata/fe?style=flat-square)](https://www.npmjs.com/package/@comyata/fe) [![JS compatibility](https://img.shields.io/badge/ESM--f7e018?style=flat-square&logo=javascript)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

**📖 Contents:**

- [Syntax](#syntax)
- [Setup Runtime](#setup-runtime)
- [Setup File Engine](#setup-file-engine)
- [Runtime vs. FileEngine](#runtime-vs-fileengine)
- [Deep Dive](#deep-dive)
- [Motivation](#motivation)
- [Specification](#specification)
- [Inspiration](#inspiration)
- [Development](#development)
- [License](#license)

## Syntax

Comyata is JSON compatible and can be written and stored in different formats, YAML is recommended for easy writing and reading by humans.

Any `string` value can be made computable by starting it with an engine-tag and wrapping it into `{` `}` brackets. Tags define the engine needed to compute the expression.

For [JSONata](https://jsonata.org/), the default engine, the engine tag is `$`. To use JSONata, write it like `${ 10 + 5 }`.

In this YAML example, the `calc` property uses JSONata, while `static` is just plain data and is not dynamic:

```yaml
calc: ${ 10 + 5 }
static: Lorem Ipsum
```

The equivalent JSON looks like:

```json
{
    "calc": "${ 10 + 5 }",
    "static": "Lorem Ipsum"
}
```

Both produce the following data output:

```json
{
    "calc": 15,
    "static": "Lorem Ipsum"
}
```

## Setup Runtime

Runtime, for any environment:

```shell
npm i -S @comyata/run
```

👉 Check out the [minimal runtime example](./apps/minimal-runtime/src/index.ts) for a simple code demonstration.

## Setup File Engine

File Engine, especially for server environments:

```shell
npm i -S @comyata/run @comyata/fe
```

👉 Check out the [server example](./server/fe) to learn more.

## Runtime vs. FileEngine

The runtime supports evaluating a single template at a time and does not handle importing other templates. From the runtime's perspective, each template is independent of any others.

The file engine builds on the runtime by adding a layer that manages importing, caching, and loading templates.

It supports adapters to import templates from any source. Included are the `remoteImporter` for HTTP (handling `http://` and `https://` URLs) and the `fileImporter` for local files (using `file://` URLs).

You can add custom importers to its trie-based matcher, which selects the appropriate importer for an `$import(address)` based on how the `address` begins. This functionality is not limited to URLs.

Use the [included importers](./packages/comyata-fe/Importer) as a foundation to create your own.

For the file engine, everything is treated as a "file", whether it's imported from the filesystem, the web, or a database. Each file is uniquely identified by its `fileId`, which is the same as its `$import` address.

The included importers offer a `converter` option to easily extend support for different file formats. By default, YAML and JSON are supported. To enable support for other formats like CSV, see the [server example](./server/fe/src/FileEngine/setupFileEngine.ts).

> Currently, importers are also used for `$load`, which only retrieves the data without evaluating the file as a template.

## Deep Dive

Comyata uses a flexible data template format with a pluggable parser and runtime, designed for dynamic structured data generation and just-in-time computation at a low-code level.

The template format is safely JSON de/serializable, yet it allows access to any object type within the JS runtime and thus as results - e.g. JSONata can resolve to native `File` in browsers and `Buffer` in NodeJS.

All expressions in a single data template are asynchronously computed, sharing one input and runtime context, while running independently of each other. This allows access to stable references to pre-start, start, and completion snapshots, as well as progression events with partial results.

Combined with [JSONata](https://jsonata.org/) it provides a powerful functional-programming influenced data querying, transformation and generation framework.

Want to use something else? Easily mix Liquid, JSONata or any other engine to produce dynamic results, even within the same template!

Add custom functions or use the file engine to easily `$load` data or `$import` other data templates:

```yaml
# load data from rest:
official_name: ${ $load("https://restcountries.com/v3.1/alpha/gb")[0].name.official }

# import data-templates:
customers_in_london: ${ $import('./customers.json')[city = 'London'] }

# add custom functions as adapter:
hits_count_from_london: ${ $sql('SELECT count(*) FROM hits where city = "London"') }
```

## Motivation

The initial challenges which resulted in this framework:

- From storage to runtime to UI: safe ways to use computed fields with schema-driven configurations and user interfaces in data management solutions.
- Dynamic, on-the-fly data-to-data generation for information management systems and static site generators: minimizing friction and content duplication in generating dynamic, structured data from distributed sources and diverse formats.

## Specification

### Template Targets

Templates must enable:

- data-templates must always be in JSON compatible data: object, array, string, number, null, boolean
- computed field expressions are always strings, they can compute to anything, including complex objects and files
- computed field expressions are serializable by standards (YAML/JSON) without further escaping, to include together with other non-computed data
- parsing and detection does not require any escaping, parsing and knowledge about the actual expression syntax
- computed field expressions can be detected without separate fields metadata
- computed field expressions are safe to store in DBs
- while the templates must be readable and writable by humans, the languages main appliance is providing a JS-data structure
    1. which can be JIT parsed and computed
    2. UIs can JIT
        1. compute and render the computations result, incl. optimistic rendering of results and progress
        2. render and manage an editor for data-shapes or individual computed fields, without the clutter needed when directly working with text files

### Computed Syntax Rules

Achieved by these simple syntax rules for computed fields:

- expressions are always string
- one field can only have a single expression
- engine matching uses 'startsWith' and 'endsWith' checks, only with the given DataNodes engine-tags
- DataNodes with engine-tags, which are not defined in one environment, will not be executed or parsed at all - as not known by parser
- one DataNode-root ('DataFile' for FileEngine) can have many expressions

## Inspiration

> Part of this section only applies to how `@comyata/fe` works with importing templates.

The library and syntax is inspired by [stated-js](https://github.com/cisco-open/stated), but with different core philosophies:

- `$import` is resolved at runtime, returning compatible values for chaining and direct access
    - in stated: not possible to access object results with `$import('file').prop_a`
    - in stated: not possible to use the result in other functions like `$merge([$import('fileA'), $import('fileB')])`
- all expressions and imports have their own scope, it is possible to access values by relative selectors using functions (for JSONata)
    - in stated: relative selectors are possible, not using JSONata but jsonpointer around the JSONata expression
        - using additional parsers and DAG building to get the dependencies resolved in the needed order
        - adding parent values to nested evaluations to inject all relative data
            - thought: most likely the reason why they use the `$` prefix for added variables, as then not in conflict with variables of the template
        - while destroying the option to use JSONata on the result; all the benefits of having the results directly available for queries are lost
    - in comyata: optionally enable (the dangerous) cross-resolving to use computed fields within other computed fields, be aware this allows creating deadlocks, which in stated should be solved by the DAG
    - in comyata: multiple times importing the same file will only compute it one time within one computation-cycle, allowing access to the same result without the need to access other computed fields or create temporary variables for sharing the result
- default JSONata syntax for function and variable access: functions with `$` prefix and variables without
    - in stated: functions and context variables must be prefixed with `$`, making the JSONata expressions incompatible with other tooling defaults
- relative file resolving based from where the import is done, for filesystem and URLs
    - in stated: no relative file resolving, imports are always resolved against the configured importPath
- repeatable, cachable and incremental computable instance around virtual states of files and their data, objects and expressions
    - in stated: single instance around the expression template object without independent access to all files
- optional functionality based on property names
    - in stated: by default properties with some suffix/prefix will be used by the lib to perform side-effects or set variables, thus usage with existing data may not work as intended
- extendable `$import/$load` to support more file formats, add authentication for API calls or even use databases for `$import`
- support for any engine to produce dynamic data
    - in stated: limited to JSONata
- very small, in just <100kB (strict ESM, no separate client/server bundles)
    - stated is >5MB (mostly due to included bundles for client, server, commonjs and ESM support)

## Development

Clone repository, then install all deps:

```shell
npm i
```

Start development servers from root folder:

```shell
npm run dev
```

Now open the [app at `localhost:8080`](http://localhost:8080) or the [server at `localhost:8081`](http://localhost:8081).

Lint, test, build types + JS:

```shell
npm run build
```

Start test driven:

```shell
npm run tdd
```

Run the [minimal-runtime](./apps/minimal-runtime) example:

```shell
npm run -w comyata-minimal-runtime start
```

## License

This project is distributed as **free software** under the **MIT License**, see [License](https://github.com/comyata/comyata/blob/main/LICENSE).

© 2024 Michael Becker https://i-am-digital.eu
