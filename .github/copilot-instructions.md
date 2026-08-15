# Perses shared UI libraries instructions

Follow [`AGENTS.md`](../AGENTS.md) for package layering, public API compatibility, validation, and completion
requirements. For every TypeScript or React file, also follow `.github/instructions/ui.instructions.md`.

- Respect the dependency direction from `explore` through `dashboards`, `plugin-system`, and lower-level packages.
- Import other workspaces through public entry points; do not deep-import internals or introduce dependency cycles.
- Treat exported types, components, hooks, functions, CSS behavior, and persisted-data handling as public API.
- Keep shared packages reusable and application-agnostic; product routes, authentication, and administration belong in
  the main Perses application.
- Add focused tests and documentation for public behavior, and add Apache headers to new source files.
- Do not edit `dist/`, linked dependencies, or generated output. Do not change versions unless explicitly requested.
- Do not add Oxlint warnings, raise warning ceilings, or use broad suppressions.
