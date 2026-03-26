# GitGlobe

GitGlobe is an interactive 3D globe for exploring global open-source activity through geographic repository mapping, societies, pulse signals, relationship networks, geocoding intelligence, and manifest-derived dependency insights.

## Highlights

- Interactive 3D globe with zoom, rotation, fly-to search, clustering, and dark immersive styling
- Societies system for grouped ecosystem exploration
- Pulse layer for animated activity effects
- Relationship intelligence:
  - fork networks
  - contributor overlaps
  - organization constellations
  - dependency ecosystem panel with manifest-first fallback behavior
- Regional intelligence:
  - domain-aware filtering
  - country heat layer
  - regional evolution panel from snapshot data
  - nearby discovery using browser geolocation
- Geocoding pipeline with typed dataset output and unknown-origin handling

## Stack

- Frontend: React, TypeScript, Vite, Three.js
- API routes: Vercel serverless functions
- Offline data pipelines: Python

## Project Structure

### Core App

- `src/App.tsx` - main UI shell and application state orchestration
- `src/components/Globe.tsx` - Three.js globe, nodes, unknown-origin orbital cluster, and interaction model
- `src/App.css` - primary visual styling

### Feature Components

- `src/components/SocietyOverlay.tsx`
- `src/components/SocietyPanel.tsx`
- `src/components/RelationshipDeck.tsx`
- `src/components/RecommendationPanel.tsx`
- `src/components/NearbyPanel.tsx`
- `src/components/RegionalPanel.tsx`
- `src/components/EvolutionPanel.tsx`
- `src/components/DependencyPanel.tsx`
- `src/components/UnknownOriginPanel.tsx`

### Data / Types

- `src/types/relationships.ts`
- `src/types/geocoding.ts`
- `src/types/intelligence.ts`
- `src/geo/` - shared projection utilities and canvas overlay infrastructure

### Pipelines

- `pipeline/generate_dataset.py` - geocoding dataset generator
- `pipeline/geocoder/engine.py` - waterfall geocoding engine
- `pipeline/geocoder/resolvers/` - local cache, offline rules, and OpenCage-backed external resolver
- `pipeline/geocoder/types.py` - backend geocoding schema models
- `pipeline/dependencies/generate_dependency_graph.py` - manifest-based dependency graph generator
- `pipeline/dependencies/parsers/` - `package.json`, `requirements.txt`, and `Cargo.toml` parsers
- `pipeline/dependencies/input/manifests.json` - local manifest snapshot input for dependency ingestion

### Public Data

- `public/data/repos.json`
- `public/data/fork_network.json`
- `public/data/contributor_overlaps.json`
- `public/data/org_constellations.json`
- `public/data/dependency_graph.json`
- `public/data/dependency_manifest_graph.json`
- `public/data/dependency_manifest_records.json`
- `public/data/geodata.json`
- `public/data/snapshots/{year}.json`

## Local Development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
```

## Geocoding Pipeline

Generate the geocoding dataset:

```bash
python pipeline/generate_dataset.py
```

Enable real OpenCage lookups locally:

```bash
copy .env.example .env
```

Then set `GEOCODER_API_KEY` in `.env`. The pipeline uses this waterfall:

- `local_cache`
- `offline_rules`
- `external_api`
- `fallback`

To verify the external resolver without changing the main app dataset, run against the sample fixture:

```bash
set GEOCODER_INPUT_PATH=pipeline/samples/unresolved_repos.json
set GEOCODER_OUTPUT_PATH=pipeline/samples/unresolved_geodata.json
python pipeline/generate_dataset.py
```

## Dependency Pipeline

Generate the manifest-based dependency datasets:

```bash
python pipeline/dependencies/generate_dependency_graph.py
```

Current parser coverage:

- npm via `package.json`
- Python via `requirements.txt`
- Rust via `Cargo.toml`

Outputs:

- `public/data/dependency_manifest_records.json`
- `public/data/dependency_manifest_graph.json`

## Current Capability

Implemented well:

- globe exploration and filtering
- societies and pulse
- relationship overlays
- regional intelligence panels
- nearby discovery
- offline geocoding dataset generation with real external provider support
- manifest-based dependency ingestion for sampled repositories
- unknown-origin handling in UI and globe flow
- hybrid rendering path with a Three.js globe plus shared canvas geo overlays

Still scaffolded or partial:

- broader manifest coverage across more repositories and ecosystems
- research-grade production ingestion pipeline
- large-scale geospatial architecture migration

## Notes

- Unknown-origin repositories are handled safely through `null` coordinates in `geodata.json`
- OpenCage integration is env-gated and cached through `pipeline/cache/geocode_cache.json`
- Dependency panel prefers manifest-derived links and falls back to the older affinity graph when manifest coverage is not available
- Snapshot-driven regional evolution is based on the available static snapshot datasets
- The current step-3 migration direction is hybrid: Three.js for the globe body and shared canvas overlays for scalable geo layers
