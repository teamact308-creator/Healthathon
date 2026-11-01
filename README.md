# Healthathon
Team Act — WholeCare Diabetes

Interactive diabetes care coordination prototype using fictional patient data.

- `npm start` starts the local preview at http://localhost:4173.
- `/` is the main WholeCare app, connected to Supabase with four separate sign-ins.
- `/database.html` is the minimal database verification workspace.
- `npm test` checks occurrence mapping and the reference workflow engine.
- [MVP and full application inventory](docs/mvp-and-product-review.md)
- [Database setup and verification](database/README.md)
- [Demo walkthrough and build scope](BUILD.md)

The server-side OpenAI key connection has been verified; see `supabase/functions/openai-connection-check/README.md`. Document extraction, voice and WhatsApp workflows are not implemented yet. This is a development prototype, not a clinical system.
