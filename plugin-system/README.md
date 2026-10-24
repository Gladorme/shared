# Plugin system

Public plugin contracts, runtime registration, and query orchestration for Perses consumers.
Import supported APIs from `@perses-dev/plugin-system`.

## Profile queries and variables

`ProfileQueryPlugin.getProfileData(spec, context, abortSignal)` receives the datasource store,
the selected `absoluteTimeRange`, and current dashboard and built-in variables in `context.variableState`.
Pass the abort signal to asynchronous work so an unmounted panel or replaced query can cancel its request.
`variableState` is optional in the public context type for compatibility with existing callers.
The runtime supplies an empty map when no variable providers are mounted.

A plugin can declare variable dependencies, including variables used to select a datasource:

```ts
dependsOn: (spec, context) => ({ variables: ['service', 'source'] })
```

`useProfileQueries` waits for declared variables to finish loading. Query caching includes their values,
the query definition, and the selected time range. Changing an unrelated variable does not issue a new query.
Returning `{ variables: [] }` declares that no variables affect the result.
Omitting the dependency hook or its `variables` property keeps compatibility with existing plugins:
they run immediately and all current variable values participate in the query key.
Dashboard refresh invalidates profile queries using the `['query', 'ProfileQuery']` prefix.

Standalone consumers that previously mounted no variable providers remain supported. Plugin loading errors,
query failures, and cancellation continue to propagate through the query result.
