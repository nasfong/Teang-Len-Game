# game-component

A workbench for building portable game UI components in isolation, then copying
each finished folder out to another project.

- **Preview** — `npm run dev`, then pick a component in the sidebar. Use the
  backdrop swatches to check it on dark / light / grid backgrounds.
- **Add a component** — create a self-contained folder under `src/components/`
  and register it in [`src/components/registry.jsx`](src/components/registry.jsx).
- **Ship a component** — copy its whole folder into the target project.

See [AGENTS.md](AGENTS.md) for the conventions and portability rules.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Workbench with HMR |
| `npm run build` | Production build |
| `npm run lint` | oxlint |
