import { NextResponse } from "next/server";
import { testRedisConnection } from "@/lib/redis";

export async function GET() {
  try {
    const isConnected = await testRedisConnection();

    if (isConnected) {
      return NextResponse.json({
        status: "success",
        message: "Redis connection successful",
      });
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: "Redis connection failed",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error testing Redis connection:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Error testing Redis connection",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
