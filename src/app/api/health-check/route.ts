import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ status: 'ok', timestamp: Date.now() });
}

// We want this endpoint to be as light as possible
export const runtime = 'edge';