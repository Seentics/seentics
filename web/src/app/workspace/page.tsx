import { redirect } from 'next/navigation';

/** Legacy URL: account hub is removed; send users to the websites entry. */
export default function WorkspaceRedirectPage() {
  redirect('/websites');
}
