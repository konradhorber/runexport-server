import { GET, POST } from "@/app/api/runs/route";
import { NextRequest } from "next/server";
import * as fs from "fs";

jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

const makeRun = (id: string) => ({
  id,
  startDate: "2026-03-27T07:30:00Z",
  endDate: "2026-03-27T08:45:00Z",
  distance: 12000.0,
  duration: 4500.0,
  isIndoor: false,
});

const makeRequest = (body: object) =>
  new NextRequest("http://localhost:3000/api/runs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("GET /api/runs", () => {
  it("returns an empty array when the data file does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns stored runs when the data file exists", async () => {
    const runs = [makeRun("run-1"), makeRun("run-2")];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(runs) as never);

    const res = await GET();
    expect(await res.json()).toEqual(runs);
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe("POST /api/runs", () => {
  it("stores new runs and returns the correct count", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const runs = [makeRun("run-1"), makeRun("run-2")];
    const res = await POST(makeRequest({ deviceId: "dev-1", exportDate: "2026-03-28T10:00:00Z", runs }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.runsProcessed).toBe(2);
    expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

    const written = JSON.parse((mockFs.writeFileSync.mock.calls[0][1] as string));
    expect(written).toHaveLength(2);
    expect(written.map((r: { id: string }) => r.id)).toEqual(["run-1", "run-2"]);
  });

  it("deduplicates runs that already exist in the store", async () => {
    const existing = [makeRun("run-1")];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing) as never);

    const runs = [makeRun("run-1"), makeRun("run-2")];
    const res = await POST(makeRequest({ deviceId: "dev-1", exportDate: "2026-03-28T10:00:00Z", runs }));
    const body = await res.json();

    expect(body.runsProcessed).toBe(1);

    const written = JSON.parse((mockFs.writeFileSync.mock.calls[0][1] as string));
    expect(written).toHaveLength(2);
    expect(written.map((r: { id: string }) => r.id)).toEqual(["run-1", "run-2"]);
  });

  it("does not write to disk when all runs are duplicates", async () => {
    const existing = [makeRun("run-1")];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing) as never);

    const res = await POST(makeRequest({ deviceId: "dev-1", exportDate: "2026-03-28T10:00:00Z", runs: [makeRun("run-1")] }));
    const body = await res.json();

    expect(body.runsProcessed).toBe(0);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("appends new runs to the existing store", async () => {
    const existing = [makeRun("run-1")];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing) as never);

    await POST(makeRequest({ deviceId: "dev-1", exportDate: "2026-03-28T10:00:00Z", runs: [makeRun("run-2"), makeRun("run-3")] }));

    const written = JSON.parse((mockFs.writeFileSync.mock.calls[0][1] as string));
    expect(written).toHaveLength(3);
    expect(written.map((r: { id: string }) => r.id)).toEqual(["run-1", "run-2", "run-3"]);
  });
});
