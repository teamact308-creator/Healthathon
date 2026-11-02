# WholeCare authenticated demo endpoint

Deployed in wholecare-diabetes-dev with gateway JWT verification on. The handler additionally verifies Supabase Auth and assigned-patient membership. Browser origins are restricted to healthathon.vercel.app and localhost:4173. Server credentials stay in runtime secrets; requests do not log document/audio bodies or credentials.

See BUILD.md and docs/release-verification.md for behavior, tests and limitations. The app uses fictional data only. plan-extract makes structured proposals for clinician review with model/source provenance. report-submit validates file bytes and binds a private file to its due test task; only the service role can invoke the registration helper. voice-transcribe supports uploaded English/Hindi recordings and returns text for explicit human confirmation without task mutation.
