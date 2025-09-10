'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// This component wraps our application with the session context provider
// from NextAuth.js, making the user session available throughout the app.
export default function Providers({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}

