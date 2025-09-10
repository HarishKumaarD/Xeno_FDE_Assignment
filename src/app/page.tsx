import { redirect } from 'next/navigation';

export default function HomePage() {
  // This function will automatically redirect any user
  // who lands on the homepage to the /login page.
  redirect('/login');

  // Since redirect() is called, this part will never be rendered.
  // We can return null or an empty fragment.
  return null;
}
