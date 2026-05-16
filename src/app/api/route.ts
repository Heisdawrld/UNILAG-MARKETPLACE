import { NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db";

export async function GET() {
  const dbAvailable = isDatabaseAvailable();

  return NextResponse.json({
    message: "UNILAG Marketplace API",
    status: dbAvailable ? "operational" : "degraded",
    database: dbAvailable ? "connected" : "not_configured",
    version: "1.0.0",
  });
}
