# @perses-dev/dashboards

Reusable dashboard components and state for Perses applications.

## Panel layout editing

`Dashboard` uses [Snapgrid](https://snapgrid.dev) to arrange, resize, and move panels.
In edit mode, drag a panel by its Move button to another expanded panel group, including an empty group.
The panel reference and repeat settings move with it. Repeated groups continue to share their underlying layout.
Moving or resizing is disabled while viewing a panel full screen or outside edit mode.

Consumers rendering `GridLayout` components directly can wrap sibling grids in Snapgrid's `SnapGridGroup`
to enable transfers between them. The grids must use the same `DashboardProvider`.
Custom grid styling should target Snapgrid's `.snapgrid`, `.snapgrid-item`, and `.snapgrid-resize-handle` classes.

## Validation

Run unit tests with `npm run test -w @perses-dev/dashboards`.
The browser regression test exercises panel dragging in Chromium:

```sh
npx playwright install chromium
npm run test:browser -w @perses-dev/dashboards
```
