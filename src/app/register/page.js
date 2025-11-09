'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { createHoverSoundHandler } from '../components/useHoverSound';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const playHoverSound = createHoverSoundHandler();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/api/auth/callback`,
        data: { full_name: fullName },
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else {
      const user = data.user;
      await fetch('/api/auth/upsert-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          full_name: fullName,
        }),
      });
      router.push('/login?message=registration_success');
    }
  };

  const handleGoogleRegister = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/api/auth/callback` },
    });
    if (error) console.log(error);
    else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
        await fetch('/api/auth/upsert-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            full_name: googleName,
          }),
        });
        router.push('/dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-foreground mb-6">
            <div className="w-6 h-6 border-2 border-foreground" />
          </div>
          <h1 className="text-2xl font-light text-foreground tracking-tight">
            Create Account
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={isLoading} onMouseEnter={playHoverSound} className="w-full h-11">
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="my-8">
          <Button type="button" variant="outline" onClick={handleGoogleRegister} onMouseEnter={playHoverSound} className="w-full h-11">
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
