'use client';

import { ClerkProvider, useUser } from '@clerk/nextjs';
import { ReactNode, useEffect } from 'react';

interface Props {
  children: ReactNode;
}

// This component wraps our application with the session context provider
// from NextAuth.js, making the user session available throughout the app.
function SyncUser() {
  const { isSignedIn, user } = useUser();
  useEffect(() => {
    if (!isSignedIn || !user) return;
    const run = async () => {
      try {
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            name: user.fullName,
            image: user.imageUrl,
          }),
        });
      } catch {}
    };
    run();
  }, [isSignedIn, user]);
  return null;
}

export default function Providers({ children }: Props) {
  return (
    <ClerkProvider>
      <SyncUser />
      {children}
    </ClerkProvider>
  );
}

