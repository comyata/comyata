# Comyata - computable data templates

Model data with dynamic parts easily, write data structures including queries and transformations.

Run it in the browser or on a server, save the templates in files or a database, and do whatever you want.

- [Deep Dive](#deep-dive)
- [Setup Runtime](#setup-runtime)
- [Setup File Engine](#setup-file-engine)
- [Development](#development)
- [Inspiration](#inspiration)
- [License](#license)

🕹️ [codesandbox](https://codesandbox.io/p/devbox/github/comyata/comyata/tree/main/apps/sandbox?file=%2Fsrc%2FPages%2FPageHome.tsx) | [stackblitz](https://stackblitz.com/github/comyata/comyata/tree/main/apps/sandbox) | [source in apps/sandbox](./apps/sandbox)

- @comyata/run [![MIT license](https://img.shields.io/npm/l/@comyata/run?style=flat-square)](https://github.com/comyata/comyata/blob/main/LICENSE) [![npm (scoped)](https://img.shields.io/npm/v/@comyata/run?style=flat-square)](https://www.npmjs.com/package/@comyata/run) [![JS compatibility](https://img.shields.io/badge/ESM--f7e018?style=flat-square&logo=javascript)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)
- @comyata/fe [![MIT license](https://img.shields.io/npm/l/@comyata/fe?style=flat-square)](https://github.com/comyata/comyata/blob/main/LICENSE) [![npm (scoped)](https://img.shields.io/npm/v/@comyata/fe?style=flat-square)](https://www.npmjs.com/package/@comyata/fe) [![JS compatibility](https://img.shields.io/badge/ESM--f7e018?style=flat-square&logo=javascript)](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

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

## Setup Runtime

Runtime, for any environment:

```shell
npm i -S @comyata/run
```

```ts
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, ComputeStats, runtime } from '@comyata/run/Runtime'

// 1. Setup Parser with engines nodes

const nodeTypes = [
    DataNodeJSONata,
]

const parser = new Parser(nodeTypes)

// 2. Configure Engines

const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData) => {
    return computedNode.expr.evaluate(
        context,
        {
            // allow access to raw data via relative access:
            self: () => parentData[0],
            parent: () => parentData.slice(1),
            root: () => parentData[parentData.length - 1],
            // ... add any custom function here ...
        },
    )
}

// 3. Define a template and run a computation with a context

const template = {
    name: '${ "Surfboard " & variant.shortName }',
    price: 70.25,
    discount: 10,
    discountedPrice: '${ $self().price * (100 - $self().discount) / 100 }',
}

// parse the template into a DataNode
const dataNode = parser.parse(template)

const context = {
    variant: {shortName: 'Blue'},
}

// pass all to the runtime
const runner = runtime(
    dataNode,
    context,
    {
        // wire engine tags and their compute function
        [DataNodeJSONata.engine]: jsonataCompute,
    },
)

// get the output
const output = await runner.output()
```

This results in the following output data:

```json
{
    "name": "Surfboard Blue",
    "price": 70.25,
    "discount": 10,
    "discountedPrice": 63.225
}
```

## Setup File Engine

File Engine, especially for server environments:

```shell
npm i -S @comyata/run @comyata/fe
```

> Check the [server example](./server/fe) to learn more.

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

Lint, build typings + JS:

```shell
npm run build
```

Create new lock-file for sandbox/server requires setting `workspaces` to false.

```shell
# updating lock file requires already published packages
# first release, then update lock, then push again
cd apps/sandbox && npm i --package-lock-only --workspaces false
```

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
            - thought: most likely the reason why they use the `$` prefix for added variables, as then not in conflict with runtime variables
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
- any engine for dynamic data
    - in stated: limited to JSONata

## License

This project is distributed as **free software** under the **MIT License**, see [License](https://github.com/comyata/comyata/blob/main/LICENSE).

© 2024 Michael Becker https://i-am-digital.eu
