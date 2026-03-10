import { redirect } from 'next/navigation';

/** Root `/` redirects to login. Middleware handles authenticated redirects. */
export default function RootPage() {
  redirect('/login');
}
