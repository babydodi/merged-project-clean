'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Moon, Sun, Mail, Lock, User, Chrome } from 'lucide-react'

const LoginRegisterPage = () => {
  const [theme, setTheme] = useState('light')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [isResetOpen, setIsResetOpen] = useState(false)
  const router = useRouter()

  // Play click sound
  const playClickSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  }

  // Toggle theme
  const toggleTheme = () => {
    playClickSound()
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark')
  }

  // Handle login
  const handleLogin = (e) => {
    e.preventDefault()
    playClickSound()
    // Placeholder - user will integrate Supabase later
    console.log('Login:', { email, password })
    router.push('/dashboard')
  }

  // Handle register
  const handleRegister = (e) => {
    e.preventDefault()
    playClickSound()
    // Placeholder - user will integrate Supabase later
    console.log('Register:', { name, email, password })
    router.push('/dashboard')
  }

  // Handle Google login
  const handleGoogleLogin = () => {
    playClickSound()
    // Placeholder - user will integrate Supabase later
    console.log('Google login')
    router.push('/dashboard')
  }

  // Handle password reset
  const handlePasswordReset = (e) => {
    e.preventDefault()
    playClickSound()
    // Placeholder - user will integrate Supabase later
    console.log('Password reset for:', resetEmail)
    setIsResetOpen(false)
    setResetEmail('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAF0CA] via-[#FFE8E7] to-[#FCF0F4] dark:from-[#0a0a0a] dark:via-[#102837] dark:to-[#1a1a1a] transition-all duration-500 p-4">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-[#102837]/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? (
          <Moon className="w-5 h-5 text-[#102837]" />
        ) : (
          <Sun className="w-5 h-5 text-[#FAF0CA]" />
        )}
      </button>

      {/* Main Card */}
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 dark:bg-[#102837]/90 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center pb-4">
          <CardTitle className="text-3xl font-light tracking-tight text-[#102837] dark:text-[#E5E4E4]">
            Welcome
          </CardTitle>
          <CardDescription className="text-sm text-[#102837]/60 dark:text-[#E5E4E4]/60">
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-[#E5E4E4]/50 dark:bg黑/20">
              <TabsTrigger 
                value="login" 
                onClick={playClickSound}
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#102837] data-[state=active]:text-[#102837] dark:data-[state=active]:text-[#FAF0CA] transition-all"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                onClick={playClickSound}
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-[#102837] data-[state=active]:text-[#102837] dark:data-[state=active]:text-[#FAF0CA] transition-all"
              >
                Register
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#102837]/40 dark:text-[#E5E4E4]/40" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4] placeholder:text-[#102837]/40 dark:placeholder:text-[#E5E4E4]/40"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#102837]/40 dark:text-[#E5E4E4]/40" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4] placeholder:text-[#102837]/40 dark:placeholder:text-[#E5E4E4]/40"
                      required
                    />
                  </div>
                </div>

                {/* Forgot Password */}
                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      onClick={playClickSound}
                      className="text-sm text-[#102837]/60 dark:text-[#E5E4E4]/60 hover:text-[#102837] dark:hover:text-[#FAF0CA] transition-colors underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-white/95 dark:bg-[#102837]/95 backdrop-blur-md border-[#102837]/20 dark:border-[#E5E4E4]/20">
                    <DialogHeader>
                      <DialogTitle className="text-[#102837] dark:text-[#E5E4E4]">Reset Password</DialogTitle>
                      <DialogDescription className="text-[#102837]/60 dark:text-[#E5E4E4]/60">
                        Enter your email address and we&apos;ll send you a reset link.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordReset}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                            Email
                          </Label>
                          <Input
                            id="reset-email"
                            type="email"
                            placeholder="you@example.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4]"
                            required
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="submit"
                          className="w-full bg-[#102837] hover:bg-[#102837]/90 dark:bg-[#FAF0CA] dark:hover:bg-[#FAF0CA]/90 text-white dark:text-[#102837] transition-all duration-300"
                        >
                          Send Reset Link
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button
                  type="submit"
                  className="w-full bg-[#102837] hover:bg-[#102837]/90 dark:bg-[#FAF0CA] dark:hover:bg-[#FAF0CA]/90 text-white dark:text-[#102837] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                >
                  Sign In
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#102837]/20 dark:border-[#E5E4E4]/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-[#102837] px-2 text-[#102837]/60 dark:text-[#E5E4E4]/60">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full border-[#102837]/20 dark:border-[#E5E4E4]/20 hover:bg-[#E5E4E4]/50 dark:hover:bg黑/20 text-[#102837] dark:text-[#E5E4E4] transition-all duration-300 hover:scale-[1.02]"
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                    Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#102837]/40 dark:text-[#E5E4E4]/40" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4] placeholder:text-[#102837]/40 dark:placeholder:text-[#E5E4E4]/40"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#102837]/40 dark:text-[#E5E4E4]/40" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4] placeholder:text-[#102837]/40 dark:placeholder:text-[#E5E4E4]/40"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-[#102837] dark:text-[#E5E4E4] font-light">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#102837]/40 dark:text-[#E5E4E4]/40" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-[#E5E4E4]/30 dark:bg黑/20 border-[#102837]/20 dark:border-[#E5E4E4]/20 focus:border-[#102837] dark:focus:border-[#FAF0CA] text-[#102837] dark:text-[#E5E4E4] placeholder:text-[#102837]/40 dark:placeholder:text-[#E5E4E4]/40"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#102837] hover:bg-[#102837]/90 dark:bg-[#FAF0CA] dark:hover:bg-[#FAF0CA]/90 text-white dark:text-[#102837] transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                >
                  Create Account
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[#102837]/20 dark:border-[#E5E4E4]/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-[#102837] px-2 text-[#102837]/60 dark:text-[#E5E4E4]/60">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full border-[#102837]/20 dark:border-[#E5E4E4]/20 hover:bg-[#E5E4E4]/50 dark:hover:bg黑/20 text-[#102837] dark:text-[#E5E4E4] transition-all duration-300 hover:scale-[1.02]"
              >
                <Chrome className="mr-2 h-4 w-4" />
                Google
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginRegisterPage
