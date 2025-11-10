'use client'

import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function LoginRegisterPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center 
      bg-gradient-to-br from-[#FAF0CA] via-[#FFE8E7] to-[#FCF0F4] 
      dark:from-[#0a0a0a] dark:via-[#102837] dark:to-[#1a1a1a] 
      transition-all duration-500 p-4">

      {/* زر تبديل الثيم */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-[#102837]/80 
        backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-[#102837]" />
        ) : (
          <Sun className="w-5 h-5 text-[#FAF0CA]" />
        )}
      </button>

      {/* كارد تسجيل الدخول */}
      <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-foreground">تسجيل الدخول</h1>
        <form className="space-y-4">
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            className="w-full p-2 border border-input rounded bg-white dark:bg-black text-foreground"
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            className="w-full p-2 border border-input rounded bg-white dark:bg-black text-foreground"
          />
          <button
            type="submit"
            className="w-full bg-primary text-white p-2 rounded hover:bg-secondary transition-all"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  )
}
