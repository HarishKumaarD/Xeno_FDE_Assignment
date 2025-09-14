// src/app/login/page.tsx
"use client";

import { SignIn, SignUp, useUser } from "@clerk/nextjs";
import { useState } from "react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { isLoaded } = useUser();

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 via-fuchsia-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If already signed in, still show the page; user can navigate or sign out

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-fuchsia-50 to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-indigo-100 via-sky-100 to-emerald-100 blur opacity-80" />
          <div className="relative w-full p-8 space-y-6 bg-white rounded-2xl shadow border border-slate-200">
            <h1 className="text-2xl font-bold text-center text-slate-900">Welcome to Xeno</h1>
            <div className="space-y-6">
              {isLogin ? (
                <SignIn 
                  routing="hash" 
                  signUpUrl="#"
                  afterSignInUrl="/dashboard"
                  redirectUrl="/dashboard"
                />
              ) : (
                <SignUp 
                  routing="hash" 
                  signInUrl="#"
                  afterSignUpUrl="/dashboard"
                  redirectUrl="/dashboard"
                />
              )}
            </div>
            <p className="text-sm text-center text-slate-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 font-medium text-indigo-600 hover:underline"
              >
                {isLogin ? "Sign Up" : "Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}