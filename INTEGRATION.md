# Integration

Overview of how the three components connect. For the full API reference see [`openapi.yaml`](./openapi.yaml).

## Pipeline

```
iOS App (runexport)
      │  POST /api/runs
      ▼
Server (runexport-server)   ←→   data/runs.json
      │  GET /api/runs
      ▼
Agent (runexport-agent)
      │
      ▼
Half Marathon Tracker.md
```

- **iOS app** reads the full run history from HealthKit and POSTs it on every export. Sends all runs every time.
- **Server** deduplicates by run `id` and persists to `data/runs.json` (gitignored).
- **Agent** fetches runs from `GET /api/runs`, calls Claude to match them against the training plan, and writes actuals back to `Half Marathon Tracker.md`.

## Agent integration status

The agent currently reads from a static `data/runs.json` file in its own directory. The target is to replace this with a `GET /api/runs` fetch at runtime, making the server the single source of truth.

Fields the agent currently uses: `id`, `startDate`, `distance`, `duration`, `averagePacePerKilometer`, `averageHeartRate`.
