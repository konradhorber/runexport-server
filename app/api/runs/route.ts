import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "data/runs.json");

interface WorkoutActivity {
  startDate: string;
  endDate: string;
  duration: number;
  distance?: number;
  averageHeartRate?: number;
  averagePace?: number;
  activityType: string;
}

interface KilometerSplit {
  kilometer: number;
  pace: number;
  averageHeartRate?: number;
  elevationAscent?: number;
  elevationDescent?: number;
}

interface Run {
  id: string;
  startDate: string;
  endDate: string;
  distance: number;
  duration: number;
  isIndoor: boolean;
  calories?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  averagePacePerKilometer?: number;
  totalElevationAscent?: number;
  totalElevationDescent?: number;
  splits?: KilometerSplit[];
  workoutActivities?: WorkoutActivity[];
}

interface RunExportRequest {
  deviceId: string;
  exportDate: string;
  runs: Run[];
}

function loadRuns(): Run[] {
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function saveRuns(runs: Run[]): void {
  writeFileSync(DATA_FILE, JSON.stringify(runs, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(loadRuns());
}

export async function POST(request: NextRequest) {
  const body: RunExportRequest = await request.json();

  const existing = loadRuns();
  const existingIds = new Set(existing.map((r) => r.id));

  const newRuns = body.runs.filter((r) => !existingIds.has(r.id));

  if (newRuns.length > 0) {
    saveRuns([...existing, ...newRuns]);
  }

  return NextResponse.json({
    success: true,
    runsProcessed: newRuns.length,
    message: `${newRuns.length} new run(s) added, ${body.runs.length - newRuns.length} duplicate(s) skipped`,
  });
}
