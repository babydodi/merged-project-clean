"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from '../../components/ui/buttonemeg';
import { Input } from '../../components/ui/inpug';
import { Label } from '../../components/ui/labek';
import { createHoverSoundHandler } from '../../components/useHoverSound';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Hover sound handler
  const playHoverSound = createHoverSoundHandler();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate email
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate password length FIRST
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      // Store user data in localStorage for prototype
      try {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", email);
      } catch {}
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      {/* Minimalist container with generous spacing */}
      <div className="w-full max-w-md">
        {/* Logo/Brand area - minimal icon */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-foreground mb-6">
            <div className="w-6 h-6 border-2 border-foreground" />
          </div>
          <h1 className="text-2xl font-light text-foreground tracking-tight">
            Create Account
          </h1>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {/* Register form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-normal text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background border-border focus:border-foreground transition-colors"
              placeholder="your@email.com"
            />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-normal text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={isLoading}
              className="h-11 bg-background border-border focus:border-foreground transition-colors"
              placeholder="••••••••"
            />
          </div>

          {/* Confirm Password field */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-normal text-foreground"
            >
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="h-11 bg-background border-border focus:border-foreground transition-colors"
              placeholder="••••••••"
            />
          </div>

          {/* Submit button with hover sound */}
          <Button
            type="submit"
            disabled={isLoading}
            onMouseEnter={playHoverSound}
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90 font-normal transition-colors"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Social signup options */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            onMouseEnter={playHoverSound}
            className="w-full h-11 font-normal"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>
        </div>

        {/* Sign in link */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Already have an account?{" "}
          <Link
            href="/login"
            onMouseEnter={playHoverSound}
            className="text-foreground hover:text-muted-foreground font-normal transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
