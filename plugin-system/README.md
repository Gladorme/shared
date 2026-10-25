# Plugin system

Public plugin contracts, runtime registration, and query orchestration for Perses consumers.
Import supported APIs from `@perses-dev/plugin-system`.

## Query variables

Time series, log, trace, profile, JSON, alert, silence, and annotation plugins receive dashboard and built-in
variables in `context.variableState`. Mount the variable providers with these query hooks, including profiles.
`ProfileQueryContext.variableState` is required, just like the other query contexts.

A query plugin can declare variable dependencies, including variables used to select a datasource:

```ts
dependsOn: (spec, context) => ({ variables: ['service', 'source'] })
```

Query hooks wait for those variables to finish loading. Query caching includes their values, the query definition,
and the time range where applicable. Changing an unrelated variable does not issue a new query.
Returning `{ variables: [] }` declares that no variables affect the result. Omitting the dependency hook or its
`variables` property makes the query depend on all current variables, including waiting for their values.

Query-backed list variables receive their declared dependencies in `context.variables`. Declare each variable
used by the query in `dependsOn` so chained variables resolve in order and refresh when their inputs change.
A list variable cannot depend on itself; an omitted dependency list is empty to avoid circular loading.

## Profile queries

`ProfileQueryPlugin.getProfileData(spec, context, abortSignal)` receives the datasource store,
the selected `absoluteTimeRange`, and `variableState`. Pass the abort signal to asynchronous work so an unmounted
panel or replaced query can cancel its request. Dashboard refresh invalidates profile queries using the
`['query', 'ProfileQuery']` prefix. Plugin loading errors, query failures, and cancellation propagate through the
query result.
