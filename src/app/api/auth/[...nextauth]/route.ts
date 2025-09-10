import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth'; // We will create this file next

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
