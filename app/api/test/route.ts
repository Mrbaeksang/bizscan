import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  console.log(`🧪 [TEST] API 키 체크:`, !!process.env.OPENROUTER_API_KEY)
  console.log(`🧪 [TEST] 환경:`, process.env.NODE_ENV)
  console.log(`🧪 [TEST] 시간:`, new Date().toISOString())
  
  return NextResponse.json({
    success: true,
    hasApiKey: !!process.env.OPENROUTER_API_KEY,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
}