declare module '@clerk/nextjs' {
  import * as React from 'react';
  export const ClerkProvider: React.ComponentType<{ children?: React.ReactNode }>;
  export function useUser(): any;
  export function useClerk(): { signOut: (cb?: () => void) => void };
  export const SignIn: React.ComponentType<any>;
  export const SignUp: React.ComponentType<any>;
}

declare module '@clerk/nextjs/server' {
  export function clerkMiddleware(options?: any): any;
  export function currentUser(): Promise<any>;
}


