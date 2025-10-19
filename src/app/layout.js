import './globals.css'
import SupabaseProvider from '@/lib/SupabaseProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <SupabaseProvider>
          <main>{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  )
}
