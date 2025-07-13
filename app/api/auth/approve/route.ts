import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/auth/session-store-file'

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sid')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }
    
    const success = sessionStore.approve(sessionId)
    
    if (!success) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>승인 실패</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                   display: flex; align-items: center; justify-content: center; 
                   min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; 
                        border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            h1 { color: #e53e3e; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            button { background: #3182ce; color: white; border: none; 
                    padding: 0.75rem 1.5rem; border-radius: 4px; 
                    font-size: 1rem; cursor: pointer; }
            button:hover { background: #2c5282; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ 승인 실패</h1>
            <p>유효하지 않거나 이미 처리된 요청입니다.</p>
            <button onclick="window.close()">창 닫기</button>
          </div>
        </body>
        </html>`,
        { 
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      )
    }
    
    console.log(`✅ [APPROVAL] 분석 승인됨 - Session: ${sessionId}`)
    
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>승인 완료</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                 display: flex; align-items: center; justify-content: center; 
                 min-height: 100vh; margin: 0; background: #f5f5f5; }
          .container { text-align: center; padding: 2rem; background: white; 
                      border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { color: #48bb78; margin-bottom: 1rem; }
          p { color: #666; margin-bottom: 1.5rem; }
          button { background: #3182ce; color: white; border: none; 
                  padding: 0.75rem 1.5rem; border-radius: 4px; 
                  font-size: 1rem; cursor: pointer; }
          button:hover { background: #2c5282; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ 승인 완료</h1>
          <p>분석이 승인되었습니다. BizScan에서 진행됩니다.</p>
          <button onclick="window.close()">창 닫기</button>
        </div>
        <script>
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>`,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    )
    
  } catch (error) {
    console.error('❌ [APPROVAL] 승인 처리 중 오류:', error)
    return NextResponse.json(
      { error: '승인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}