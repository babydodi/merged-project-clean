'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Mail, Lock, User, Chrome } from 'lucide-react'
import { Button } from '../../components/ui/buttonemeg'
import { Input } from '../../components/ui/inpug'
import { Label } from '../../components/ui/labek'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog'

export default function LoginRegisterPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()

  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        return
      }
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setError('Unexpected error during sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      // best-effort upsert: server will verify session when available
      if (data?.user?.id) {
        fetch(`${window.location.origin}/api/auth/upsert-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: data.user.id, email: data.user.email, full_name: name }),
        }).catch((e) => console.error('upsert-user error', e))
      }
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setError('Unexpected error during registration')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e) => {
    e?.preventDefault()
    setError('')
    try {
      const redirectTo = `${window.location.origin}/reset/callback`
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo })
      if (resetErr) setError(resetErr.message)
      else {
        setIsResetOpen(false)
        setResetEmail('')
      }
    } catch (err) {
      console.error(err)
      setError('Unexpected error sending reset email')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/api/auth/callback2`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      })
      if (error) setError(error.message)
      // normally the browser redirects away here
    } catch (err) {
      console.error(err)
      setError('Unexpected error starting OAuth')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-light">Welcome</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">Sign in or create an account</CardDescription>
        </CardHeader>

        <CardContent>
          {error && <div className="mb-4 p-3 rounded bg-destructive text-destructive-foreground">{error}</div>}

          <Tabs value={tab} onValueChange={setTab} className="w-full">
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

                <div className="flex items-center justify-between">
                  <label className="flex items-center text-sm">
                    <input type="checkbox" className="mr-2" />
                    Remember me
                  </label>
                  <button type="button" onClick={() => setIsResetOpen(true)} className="text-sm underline">Forgot password?</button>
                </div>

                <Button type="submit" disabled={loading}>{loading ? 'Signing...' : 'Sign In'}</Button>
              </form>

              <div className="my-6 text-center text-xs uppercase">Or continue with</div>

              <Button variant="outline" onClick={handleGoogleLogin}><Chrome className="mr-2 h-4 w-4" />Continue with Google</Button>
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

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email to receive a reset link.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordReset} className="space-y-4 mt-4">
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
    </div>
  )
}
