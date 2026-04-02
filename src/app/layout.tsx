import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '쉽고 빠른 정산앱',
  description: '모임 총무용 정산 및 관리 서비스',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <main className="mobile-container">
          {children}
        </main>
      </body>
    </html>
  )
}
