# Integration Points

Three components exchange data in a linear pipeline:

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

All dates are **ISO 8601 strings** in UTC (e.g. `"2026-03-27T10:00:00Z"`), parseable by `new Date(str)` in JavaScript. All distances are in **meters**, durations in **seconds**, heart rates in **bpm**, elevations in **meters** — HealthKit SI units throughout, no conversion applied.

---

## 1. iOS App → Server

**Endpoint:** `POST /api/runs`

The iOS app sends the user's full run history on every export. The server is responsible for deduplication by run `id`.

### Request

```
Content-Type: application/json
```

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "exportDate": "2026-03-28T10:00:00Z",
  "runs": [ <Run>, ... ]
}
```

| Field        | Type   | Description                             |
|--------------|--------|-----------------------------------------|
| `deviceId`   | string | Persistent UUID generated on first app launch |
| `exportDate` | string | ISO 8601 timestamp of this export       |
| `runs`       | array  | Full run history — server deduplicates  |

---

## Data model

### `Run`

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "startDate": "2026-03-27T07:30:00Z",
  "endDate": "2026-03-27T08:45:00Z",
  "distance": 12000.0,
  "duration": 4500.0,
  "isIndoor": false,
  "calories": 620.0,
  "averageHeartRate": 142.0,
  "maxHeartRate": 163.0,
  "averagePacePerKilometer": 375.0,
  "totalElevationAscent": 48.0,
  "totalElevationDescent": 51.0,
  "splits": [ <KilometerSplit>, ... ],
  "workoutActivities": [ <WorkoutActivity>, ... ]
}
```

| Field                     | Type    | Nullable | Description |
|---------------------------|---------|----------|-------------|
| `id`                      | string  | no       | HealthKit workout UUID — stable across exports, used for deduplication |
| `startDate`               | string  | no       | ISO 8601 UTC |
| `endDate`                 | string  | no       | ISO 8601 UTC |
| `distance`                | number  | no       | Total distance in meters |
| `duration`                | number  | no       | Active duration in seconds |
| `isIndoor`                | boolean | no       | `true` for treadmill/indoor runs. When `true`, GPS route and splits will be absent and pace data comes from watch accelerometer — treat with caution |
| `calories`                | number  | yes      | Active energy burned in kcal |
| `averageHeartRate`        | number  | yes      | Average bpm over the workout |
| `maxHeartRate`            | number  | yes      | Maximum bpm |
| `averagePacePerKilometer` | number  | yes      | Seconds/km. `null` if distance is zero |
| `totalElevationAscent`    | number  | yes      | Total ascent in meters. `null` if not recorded (e.g. indoor) |
| `totalElevationDescent`   | number  | yes      | Total descent in meters. `null` if not recorded |
| `splits`                  | array   | yes      | Per-km breakdown. `null` when no GPS route available |
| `workoutActivities`       | array   | yes      | Per-phase breakdown for structured workouts. `null` for plain runs |

---

### `WorkoutActivity`

Per-phase breakdown of a structured workout (from `HKWorkout.workoutActivities`, iOS 16+). For interval runs this gives one entry per work interval and one per recovery, in chronological order.

```json
{
  "startDate": "2026-03-26T16:51:25Z",
  "endDate": "2026-03-26T16:55:55Z",
  "duration": 270.0,
  "distance": 1000.0,
  "averageHeartRate": 165.0,
  "averagePace": 270.0,
  "activityType": "running"
}
```

| Field              | Type    | Nullable | Description |
|--------------------|---------|----------|-------------|
| `startDate`        | string  | no       | ISO 8601 UTC |
| `endDate`          | string  | no       | ISO 8601 UTC |
| `duration`         | number  | no       | Phase duration in seconds |
| `distance`         | number  | yes      | Distance in meters. `null` if no distance data for this phase |
| `averageHeartRate` | number  | yes      | Average bpm during this phase |
| `averagePace`      | number  | yes      | Seconds/km. `null` if distance unavailable |
| `activityType`     | string  | no       | `"running"`, `"walking"`, or `"other(N)"` where N is the raw HealthKit activity type integer |

> **Interval detection:** Distinguish work/recovery phases by `averagePace` or `averageHeartRate`. For plain runs, `workoutActivities` is `null`.

---

### `KilometerSplit`

One entry per km of GPS-tracked distance. The final entry covers a partial km if the run doesn't end on a km boundary, with `pace` normalised to seconds/km.

```json
{
  "kilometer": 1,
  "pace": 342.8,
  "averageHeartRate": 154.0,
  "elevationAscent": 12.3,
  "elevationDescent": 4.1
}
```

| Field              | Type   | Nullable | Description |
|--------------------|--------|----------|-------------|
| `kilometer`        | int    | no       | 1-based km index |
| `pace`             | number | no       | Seconds/km for this split, normalised for partial final split |
| `averageHeartRate` | number | yes      | Average bpm during this km |
| `elevationAscent`  | number | yes      | Meters gained. `null` if net gain is zero or negative |
| `elevationDescent` | number | yes      | Meters lost. `null` if net loss is zero or negative |

---

## 2. Server — Persistence (data/runs.json)

The server persists all received runs to a local JSON file, deduplicated by run `id`. The file is gitignored (local user data).

**File:** `data/runs.json` (server root)

**Schema:** array of `Run` objects as described above. The `deviceId` and `exportDate` envelope fields are not stored per-run.

**Deduplication:** on each POST, incoming runs are filtered by `id` against existing records. Only new runs are appended.

---

## 3. Server → Agent

**Endpoint:** `GET /api/runs`

Returns the full array of persisted runs. Same schema as `data/runs.json`.

The agent currently uses: `id`, `startDate`, `distance`, `duration`, `averagePacePerKilometer`, `averageHeartRate`. The `workoutActivities` field is available for interval session detection when the agent is extended to handle structured workouts.

---

## Current vs. Target State

| Point | Current | Target |
|---|---|---|
| POST /api/runs | persists to `data/runs.json`, returns response body | done |
| GET /api/runs | returns contents of `data/runs.json` | done |
| Agent data source | reads `../runexport-agent/data/runs.json` (static, manual) | fetch `GET /api/runs` at runtime |
