import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Check route works' });
}

export async function POST() {
  return NextResponse.json({ status: 'ok', message: 'Check POST works' });
}
