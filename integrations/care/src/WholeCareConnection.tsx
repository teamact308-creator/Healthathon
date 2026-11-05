import type {FormEvent} from 'react';

export default function WholeCareConnection({busy, error, onConnect}: {
  busy: boolean; error: string; onConnect: (email: string, password: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    form.reset();
    onConnect(String(data.get('email') ?? '').trim(), password);
  }
  return <section className="wc-panel wc-connection">
    <h1>Connect to WholeCare</h1>
    <p>Sign in with the WholeCare clinician account assigned to this synthetic patient. You can disconnect it here at any time.</p>
    <p>The connection can renew for up to seven days. Your password goes directly to WholeCare sign-in and is not saved by CARE.</p>
    <form onSubmit={submit}>
      <label htmlFor="wc-link-email">WholeCare email</label>
      <input id="wc-link-email" name="email" type="email" autoComplete="username" required disabled={busy}/>
      <label htmlFor="wc-link-password">WholeCare password</label>
      <input id="wc-link-password" name="password" type="password" autoComplete="current-password" required disabled={busy}/>
      <button type="submit" className="wc-button" disabled={busy}>{busy ? 'Connecting…' : 'Connect to WholeCare'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </section>;
}
