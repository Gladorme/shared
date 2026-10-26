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

The signal `use…Queries` hooks all use `staleTime: Infinity`. Cached results remain fresh until invalidated,
including by manual or scheduled dashboard refresh. Changed query inputs produce separate cache entries.

Signal queries (including the single time series and annotation hooks) and list-variable option queries use
`structuralSharing: false` for performance: deeply comparing large datasets on every refetch can be expensive
and block the main thread. Disabling structural sharing skips that comparison. Refetched objects keep their
new references even when their contents are equal. Cache keys and request deduplication are unchanged.
The bulk time series hook still accepts an explicit `queryOptions.structuralSharing` override.

## Signal queries

Each runtime follows the same flow: build its context, load plugins by kind/version/registry, evaluate `dependsOn`,
filter variable values for the cache key, wait for dependencies, and execute the plugin with an abort signal.
The bulk hooks use `usePlugins`; the single time series and annotation hooks use `usePlugin`.
Both paths resolve the same plugin identity when executing the query.

Every plugin method below receives `(spec, context, abortSignal)`. Every context includes `datasourceStore` and
`variableState`. Pass the abort signal to asynchronous work so an unmounted panel or replaced query can cancel its
request. Once variable dependencies are ready, plugin loading errors and query failures surface in the query result.

| Signal | Runtime hooks | Plugin method | Time range in context | Refresh prefix |
| --- | --- | --- | --- | --- |
| Time series | `useTimeSeriesQueries`, `useTimeSeriesQuery` | `TimeSeriesQueryPlugin.getTimeSeriesData` | `absoluteTimeRange` | `['query', 'TimeSeriesQuery']` |
| Logs | `useLogQueries` | `LogQueryPlugin.getLogData` | `absoluteTimeRange` | `['query', 'LogQuery']` |
| Traces | `useTraceQueries` | `TraceQueryPlugin.getTraceData` | `absoluteTimeRange` | `['query', 'TraceQuery']` |
| Profiles | `useProfileQueries` | `ProfileQueryPlugin.getProfileData` | `absoluteTimeRange` | `['query', 'ProfileQuery']` |
| JSON | `useJsonQueries` | `JsonQueryPlugin.getJsonData` | None | `['query', 'JsonQuery']` |
| Alerts | `useAlertsQueries` | `AlertsQueryPlugin.getAlertsData` | None | `['query', 'AlertsQuery']` |
| Silences | `useSilencesQueries` | `SilencesQueryPlugin.getSilencesData` | None | `['query', 'SilencesQuery']` |
| Annotations | `useAnnotations`, `useAnnotationData` | `AnnotationPlugin.getAnnotationData` | `absoluteTimeRange` | `['annotation']` |

Dashboard refresh invalidates `['query']` and `['annotation']`. Applications can invalidate an individual signal
using its prefix above. Annotations additionally support `['annotation', annotationSpec]` for editor previews.

### Remaining API differences

- All time-dependent plugin contexts use `absoluteTimeRange`, including list-variable plugins.
  The trace context permits an omitted range for ID-based trace or span lookups; its runtime hook supplies the
  selected range. Profile queries require a range because profile data is queried over a time interval.
- JSON returns arbitrary JSON; alerts and silences represent current state. Their contexts and cache keys have no
  explicit time range. A dependency on a time-related built-in variable can still change their cache keys.
- Time series has `mode`, `suggestedStepMs`, caller query options, and active-query helpers. The bulk hook includes
  mode and suggested step in its cache key. The single hook retains its existing React Query cache/refetch defaults
  and keeps suggested step outside the key; it currently ignores `mode` and query options other than `enabled`.
  Those existing single-hook limitations are not changed by this alignment. Explicit `enabled: false` disables
  either hook.
- Annotations accept `AnnotationSpec` directly rather than a `QueryDefinition` wrapper and share complete query
  options between panel and preview hooks so both consumers use the same cache and infinite freshness policy.
- Query-backed list variables use the separate `['variable']` cache and `context.variables`. Their dependency
  default is an empty list, as described above, rather than every variable.
