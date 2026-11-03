# Password recovery and changes

Updated 3 November 2026.

## For demo users

All four persona logins currently use .test email addresses, which are not deliverable inboxes. Sign in using the existing demo login, choose Change password in the header, supply the current password, and choose/confirm a memorable passphrase of 12–128 characters. The backend may reject additional weak/unchanged passwords under its current policy. A change re-authenticates the same account and leaves its user ID, role assignments and patient records intact. No password is changed automatically by this release.

After changing your password, sign in again. The local saved provisioning credentials are then stale for that persona. Do not copy your new password into repository/Drive documentation or chat. A forgotten password on a .test account needs authorized account administration; an email-reset screen cannot deliver to a fictional inbox. Mapping roles to real verified inboxes requires an explicit account-owner decision and must preserve identity/membership bindings.

## For accounts with real inboxes

Forgot password? opens an email recovery form with a generic existence-neutral success message. Supabase sends the recovery email; the app does not create accounts or alter roles. Provider email/rate limits apply. The standard Supabase recovery email ConfirmationURL must redirect to the hosted app, which consumes the implicit PASSWORD_RECOVERY fragment. The reset screen validates the access token against Supabase /user, displays the destination account, accepts matching 12–128-character passwords, then updates that same authenticated user. There is no automatic workspace sign-in from a reset fragment. Expired/invalid/wrong-type links show a request-new-link path. Request/query tokens are removed from browser history before asynchronous handling; the recovery access token remains memory-only and is cleared on completion/back-navigation. Refreshing an incomplete reset requires reopening/requesting a valid link. PKCE/custom token-hash email templates are not implemented by this standalone REST client.

Verified saved on 3 November 2026 after explicit owner approval: Supabase Auth URL configuration allows https://healthathon.vercel.app/?reset=1 (and http://localhost:4173/?reset=1 for the local demo); Site URL is https://healthathon.vercel.app/. These are project settings, not database migrations. Configured custom SMTP or Supabase's restricted default sender must permit the intended real recipient. No real email delivery is claimed until an authorized real inbox is tested. Do not send test recovery mail to arbitrary people or attempt delivery to the four fictional persona inboxes.

## Security and limitations

Only the public publishable key is used. No service/admin key, password or reset token is logged or added to app diagnostics. Signed-in password change checks the current identity, verifies the current password through a fresh password grant, and ensures the returned user ID matches before updating. Backend password/reauthentication policy remains authoritative. Both flows request global refresh-session logout after a successful change, clear local state and require sign-in; logout is best effort, and existing access JWTs may remain valid until expiry. Do not advertise instant access-token revocation. Recovery does not grant clinical roles or bypass row-level security.

Automated tests cover trusted recovery routes, wrong/expired URL states, matching/length validation, no network for .test/untrusted destinations and transient recovery-state clearing. Browser verification uses invalid links/demo email requests without changing existing persona passwords or sending real mail. Actual new-password submission is left to the user. Database/schema and Twilio settings remain unchanged.
