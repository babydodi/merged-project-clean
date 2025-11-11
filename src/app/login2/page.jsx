'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Button } from '../../components/ui/buttonemeg'
import { Input } from '../../components/ui/inpug'
import { Label } from '../../components/ui/labek'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'
import { Mail, Lock, User, Chrome } from 'lucide-react'

export default function LoginRegisterPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [resetEmail, setResetEmail] = useState('')

  const [isResetOpen, setIsResetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fallback: if provider returned tokens in hash (implicit), set client session
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (access_token) {
      // build session on client (temporary fallback)
      supabase.auth.setSession({ access_token, refresh_token })
        .then(res => {
          console.log('setSession result', res)
          if (!res.error) {
            // clean URL hash and navigate
            history.replaceState(null, '', window.location.pathname + window.location.search)
            router.push('/dashboard')
          } else {
            setError(res.error.message || 'Failed to set session')
          }
        })
        .catch((e) => {
          console.error('setSession error', e)
          setError('Failed to set session')
        })
    }
  }, [supabase, router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await supabase.auth.signInWithPassword({ email, password })
      console.log('signIn result', res)
      if (res.error) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch (e) {
      console.error(e)
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
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
        // best-effort upsert call to your server route (server will verify session if available)
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

      router.push('/dashboard')
    } catch (e) {
      console.error(e)
      setError('Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)

    // redirect target must match what you set in Google Console & Supabase
    const redirectTarget = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/callback2` : undefined
    console.log('google oauth redirectTo:', redirectTarget)

    // start OAuth via auth-helpers client (PKCE flow)
    const res = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTarget }
    })
    console.log('signInWithOAuth start', res)
    if (res.error) setError(res.error.message)
    // In typical flow browser redirects away here; result is informational.
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset/callback` : undefined
      const res = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo })
      console.log('resetPasswordForEmail', res)
      if (res.error) setError(res.error.message)
      else {
        setIsResetOpen(false)
        setResetEmail('')
      }
    } catch (e) {
      console.error(e)
      setError('Unexpected error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-light">Welcome</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">Sign in or create an account</CardDescription>
        </CardHeader>

        <CardContent>
          {error && <div className="mb-4 p-3 rounded bg-destructive text-destructive-foreground">{error}</div>}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-sm underline">Forgot password?</button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                      <DialogDescription>Enter your email to receive a reset link.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordReset}>
                      <div>
                        <Label htmlFor="reset-email">Email</Label>
                        <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                      </div>
                      <DialogFooter>
                        <Button type="submit">Send Reset Link</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>

                <Button type="submit" disabled={loading}>{loading ? 'Signing...' : 'Sign In'}</Button>
              </form>

              <div className="my-6 text-center text-xs uppercase">Or continue with</div>

              <Button variant="outline" onClick={handleGoogleLogin}>
                <Chrome className="mr-2 h-4 w-4" /> Continue with Google
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-name">Name</Label>
                  <Input id="register-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="register-password">Password</Label>
                  <Input id="register-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Account'}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
