'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Button } from '../../components/ui/buttonemeg'
import { Input } from '../../components/ui/inpug'
import { Label } from '../../components/ui/labek'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Moon, Sun, Mail, Lock, User, Chrome } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnon)

export default function LoginRegisterPage() {
  const router = useRouter()

  const [theme, setTheme] = useState('light')
  const [envWarning, setEnvWarning] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [resetEmail, setResetEmail] = useState('')

  const [isResetOpen, setIsResetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnon) {
      setEnvWarning('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  const playClickSound = () => {
    if (typeof window === 'undefined') return
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const audioContext = new AudioCtx()
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()
      osc.connect(gain)
      gain.connect(audioContext.destination)
      osc.frequency.value = 800
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.28, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12)
      osc.start(audioContext.currentTime)
      osc.stop(audioContext.currentTime + 0.12)
    } catch {}
  }

  const toggleTheme = () => {
    playClickSound()
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    playClickSound()
    setError(null)
    setLoading(true)

    if (!supabaseUrl || !supabaseAnon) {
      setError('Supabase is not configured')
      setLoading(false)
      return
    }

    // debug: log full response to console when debugging
    const res = await supabase.auth.signInWithPassword({ email, password })
    console.log('signInWithPassword result', res)
    setLoading(false)

    if (res.error) {
      setError(res.error.message)
      return
    }

    router.push('/dashboard')
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    playClickSound()
    setError(null)
    setLoading(true)

    if (!supabaseUrl || !supabaseAnon) {
      setError('Supabase is not configured')
      setLoading(false)
      return
    }

    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    console.log('signUp result', res)

    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }

    const userId = res.data?.user?.id
    const userEmail = res.data?.user?.email
    if (userId && userEmail) {
      try {
        await fetch(`${window.location.origin}/api/auth/upsert-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: userId, email: userEmail, full_name: name }),
        })
      } catch (e) {
        console.error('upsert-user fetch error', e)
      }
    }

    setLoading(false)
    router.push('/dashboard')
  }

  const handleGoogleLogin = async () => {
  playClickSound()
  setError(null)

  if (!supabaseUrl || !supabaseAnon) {
    setError('Supabase is not configured')
    return
  }

  const redirectTarget = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback2` : undefined
  console.log('google oauth redirectTo:', redirectTarget)

  const res = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTarget }
  })
  console.log('signInWithOAuth start result', res)
  if (res.error) setError(res.error.message)
}

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    playClickSound()
    setError(null)

    if (!supabaseUrl || !supabaseAnon) {
      setError('Supabase is not configured')
      return
    }

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset/callback` : undefined
    const res = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo })
    console.log('resetPasswordForEmail', res)
    if (res.error) setError(res.error.message)
    else {
      setIsResetOpen(false)
      setResetEmail('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground transition-all duration-500 p-4">
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 p-3 rounded-full bg-card text-card-foreground backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 border border-border"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <Card className="w-full max-w-lg shadow-2xl border border-border bg-card text-card-foreground backdrop-blur-md">
        <CardHeader className="space-y-1 text-center pb-4">
          <CardTitle className="text-3xl font-light tracking-tight">Welcome</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">Sign in to your account or create a new one</CardDescription>
        </CardHeader>

        <CardContent>
          {envWarning && (
            <div className="mb-4 p-3 rounded bg-destructive text-destructive-foreground">{envWarning}</div>
          )}

          {error && <div className="mb-4 p-3 rounded bg-destructive text-destructive-foreground">{error}</div>}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted text-foreground">
              <TabsTrigger value="login" onClick={playClickSound} className="data-[state=active]:bg-background data-[state=active]:text-foreground transition-all">Login</TabsTrigger>
              <TabsTrigger value="register" onClick={playClickSound} className="data-[state=active]:bg-background data-[state=active]:text-foreground transition-all">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="font-light">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="font-light">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                  </div>
                </div>

                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <button type="button" onClick={playClickSound} className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Forgot password?</button>
                  </DialogTrigger>

                  <DialogContent className="bg-popover text-popover-foreground backdrop-blur-md border border-border">
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                    <DialogHeader/>
                    <DialogDescription className="text-muted-foreground">
                      Enter your email address and we&apos;ll send you a reset link.
                    </DialogDescription>
                  </DialogHeader>

                    <form onSubmit={handlePasswordReset}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email" className="font-light">Email</Label>
                          <Input id="reset-email" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Send Reset Link</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{loading ? 'Signing in...' : 'Sign In'}</Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
              </div>

              <Button type="button" variant="outline" onClick={handleGoogleLogin} className="w-full border-border hover:bg-muted text-foreground">
                <Chrome className="mr-2 h-4 w-4" />Google
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="font-light">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-name" type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="font-light">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password" className="font-light">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="register-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring" required />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{loading ? 'Creating...' : 'Create Account'}</Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
              </div>

              <Button type="button" variant="outline" onClick={handleGoogleLogin} className="w-full border-border hover:bg-muted text-foreground">
                <Chrome className="mr-2 h-4 w-4" />Google
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
