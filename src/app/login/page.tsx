'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (isLogin) {
      // Handle Login
      const result = await signIn('credentials', {
        redirect: false, // We will handle redirect manually
        email,
        password,
      });

      if (result?.error) {
        setError('Invalid email or password.');
        setIsLoading(false);
      } else {
        // Successful login: trigger background sync then redirect
        try {
          await fetch('/api/sync?wait=true', { method: 'POST' });
        } catch {
          // best-effort; ignore
        }
        router.push('/dashboard');
      }
    } else {
      // Handle Sign Up
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create account.');
        }

        // After successful sign up, automatically log the user in
        const result = await signIn('credentials', {
            redirect: false,
            email,
            password,
        });

        if (result?.error) {
             setError('Account created, but login failed. Please try logging in manually.');
             setIsLoading(false);
        } else {
            router.push('/dashboard');
        }

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-fuchsia-50 to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-indigo-100 via-sky-100 to-emerald-100 blur opacity-80" />
          <div className="relative w-full p-8 space-y-6 bg-white rounded-2xl shadow border border-slate-200">
            <h1 className="text-2xl font-bold text-center text-slate-900">
              Welcome to Xeno
            </h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-2 font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
                </button>
              </div>
            </form>
            <p className="text-sm text-center text-slate-600">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(null); }}
                className="ml-1 font-medium text-indigo-600 hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
