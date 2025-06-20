import { NextResponse } from "next/server";
import { warmCache } from "@/lib/cache-warmer";

export async function POST() {
  try {
    await warmCache();
    return NextResponse.json({
      status: "success",
      message: "Cache warming completed successfully",
    });
  } catch (error) {
    console.error("Error warming cache:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to warm cache",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
