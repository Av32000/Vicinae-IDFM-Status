# IDFM Info Trafic

A Vicinae extension for checking live traffic disruptions on the Ile-de-France Mobilites network.

It lets you browse lines by transport mode, open detailed disruption reports, and mark favorite lines for quick access.

## Setup

Install dependencies:

```bash
pnpm install
```

Run the extension in development mode:

```bash
pnpm dev
```

Build the production bundle:

```bash
pnpm build
```

## Configuration

The extension requires an IDFM API token. Create one at [https://prim.iledefrance-mobilites.fr/fr](https://prim.iledefrance-mobilites.fr/fr) and add it in Vicinae as the `idfm-api-token` preference.

## Scripts

- `pnpm lint` - run Vicinae linting
- `pnpm format` - format the source files
- `pnpm parse-ref` - regenerate the line reference data from an IDFM export
- `pnpm generate-icons` - rebuild the line icons in `assets/`
