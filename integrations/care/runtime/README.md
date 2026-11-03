# Isolated CARE runtime and recovery

This records the actual tested local environment on 3 November 2026. The GitHub repository contains our plugin source, not cloned CARE core, Docker images/volumes, generated environments or account links. The development machine's ignored `.local/care-setup/care_scaffold` holds those runtime dependencies. This is an actual local integration, not the public Vercel deployment.

## Revisions and boundaries

- Official `ohcnetwork/care_scaffold`: `a3ecf5e913da949dfff89b1107f5aad7f112584a`.
- Official CARE backend: `67a46185eb98ee4b79b38ecee84d8a69d173306e`.
- Official care_fe frontend: `57205b8978045d67b0299c1bd7c2d03fe640d945`.
- Backend plugin: independent `care/care_wholecare` repository generated using `scripts/new-plugin.sh --name wholecare --title 'WholeCare Diabetes'` and extended with this repository's `backend/` source.
- Frontend plugin: independent `care_wholecare_fe` repository with this folder's package/lockfile, src, checks, scripts and HTML/config files.

Both core repositories remained at those revisions with **zero tracked changes** after browser acceptance. Do not patch their source/settings/translations/migrations/types to extend this plugin. Upstream scaffold guidance is at https://github.com/ohcnetwork/care_scaffold. Read its bootstrap prompt and relevant skills before recreating the environment. Its AGENTS.md is repository guidance, not permission for unrelated external account actions.

## Machine/runtime

The Apple Silicon machine has 8 GiB RAM. Homebrew supplied Colima 0.10.3/Lima 2.2.1, Docker CLI 29.9.2, Compose 5.7.0 and Buildx 0.38.1. The dedicated `wholecare-care` Colima profile uses 2 CPUs, 4 GiB RAM and a 35 GiB virtual disk. It mounts only this ignored scaffold workspace writable. It was started with `--activate=false --ssh-config=false`; no autostart service was installed and the global Docker context was not changed. Use the explicit `DOCKER_CONTEXT=colima-wholecare-care` on every Docker/wrapper operation.

Compose project: `care_scaffold_58b2f1fc66d3`. Services: backend, celery, db, redis, minio. The successful build used Buildx. The scaffold configurator's `.agent/compose.override.yaml` owns isolated names, volumes and loopback-only published ports. Always use its wrapper, never core make targets or a bare Compose invocation.

Saved local ports:

- CARE API: 47416; CARE host UI: 47417; plugin preview: 47418.
- PostgreSQL: 47419; Redis: 47420; MinIO: 47421/47422; debugger: 47423.
- Existing WholeCare preview remains 4173; independent fixture preview remains 4183.

## Existing machine: start or stop

From the project root:

```sh
W="$PWD/.local/care-setup/care_scaffold"
colima start --profile wholecare-care --activate=false --ssh-config=false
DOCKER_CONTEXT=colima-wholecare-care "$W/.agent/compose.sh" up -d
"$W/.agent/frontend.sh"
```

The final command stays running in its terminal. In a separate terminal:

```sh
cd .local/care-setup/care_scaffold/care_wholecare_fe
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 47418 --strictPort
```

After changing plugin source, sync it into the independent runtime plugin checkout, rebuild and hard-reload CARE. There is no federated HMR. The scaffold frontend starts from external `.agent/frontend.env`; `REACT_CARE_API_URL` must target `http://localhost:47416`, and `REACT_ENABLED_APPS` is `teamact308-creator/care_wholecare_fe@localhost:47418/assets/remoteEntry.js`. Never edit core's env files to register the plugin.

Stop only this workspace's frontend/plugin terminal processes; then stop this stack with `DOCKER_CONTEXT=colima-wholecare-care "$W/.agent/compose.sh" stop`. `colima stop --profile wholecare-care` stops its VM. Preserve the named volumes; do not use destructive volume removal as routine recovery. A port conflict must be resolved explicitly rather than silently switching ports or adopting another server.

## Fresh environment reconstruction

1. Obtain the three official repositories at the recorded revisions in a separate ignored workspace. Keep care and care_fe independent. Follow upstream bootstrap, install the documented core dependencies and run `python3 scripts/configure-workspace.py`. This generates isolated saved ports/overrides; the frontend adapter in this bounded experiment permits only API port 47416, so retain these explicit ports or deliberately update and retest the plugin configuration.
2. Generate the two independent WholeCare plugin repositories. Copy this repository's backend package to the generated backend repository and frontend source/package/config to the generated frontend repository. Do not copy dist, node_modules, .git or credential/config files from another machine.
3. Copy `compose.sh`, `frontend.sh` and `plugin.compose.yaml` from this runtime folder into `.agent/`. Make both shell wrappers executable (`chmod +x .agent/compose.sh .agent/frontend.sh`). The wrappers expect that location and the scaffold-generated `care-scaffold.env`/`compose.override.yaml`. Create `.agent/paths.env` containing shell-quoted absolute `PLUGIN_BE`, `PLUGIN_FE` and `WHOLECARE_LINKS_HOST_FILE` paths. The links path must be under this workspace. Create its mode-0600 file with `{"version":1,"links":[]}` before container startup. The shipped Compose template uses that path; the existing machine's equivalent resolves it explicitly. It registers the plugin at runtime, installs it into the core image at startup and imports plugin-owned development settings.
4. Set external frontend.env as above. Run core dependency installation in care_fe, and npm ci with the plugin's lockfile in the independent frontend plugin. Keep tracked core files unchanged.
5. Build/start only through the isolated wrapper with explicit Docker context. Celery's normal development startup applies CARE migrations and synchronizes permissions/roles/value sets. Verify all five services are healthy before proceeding.
6. Run CARE's `load_fixtures` **once on the new development database**. Its API test client uses `testserver`, so this command needs the one-command environment override `DJANGO_ALLOWED_HOSTS='["localhost","127.0.0.1","backend","testserver"]'` via Compose exec `-e`. The running network service keeps its normal, narrower hosts. Do not rerun indiscriminately: the core fixture loader is not established as idempotent.
7. Run `backend/scripts/seed_care_fixture.py` through `manage.py shell` in the backend container. It reuses the standard fixture doctor/facility and prints only synthetic mapping IDs. Record these returned IDs. The example JSON documents this machine's actual IDs; a fresh fixture import will allocate different doctor/facility IDs.
8. Renew the user-delegated WholeCare link using the helper below. Start the two frontend processes and sign in to CARE using its existing standard development fixture doctor. Public upstream fixture credentials are documented in the upstream fixture source; never use them on a public deployment. Open `/patient/8bb02ec2-6b42-47d9-8ed3-700bf92a1060`, then the WholeCare action.

## Renew an expired WholeCare link

The current link contains one expiring normal clinician access token; it stores neither password nor refresh token. The browser's CARE token and backend's WholeCare token are distinct. Refreshing CARE or signing in to the original app does not renew the backend link. Never replace it with a service-role key.

Run `backend/scripts/link_account.py` from this repository with `--links-file` pointing at the ignored mounted file, the three CARE IDs and `--wholecare-patient-id`. Use `synthetic-context.example.json` for this machine's non-secret mapping values. Enter the existing authorized WholeCare clinician login interactively. The helper verifies identity/membership/synthetic scope, retains the bound-file inode and refuses to retarget an existing mapping. Reload CARE after success. Stored legacy demo-account files may be stale; use an owner-approved current credential and do not reset passwords for this task.

## What has and has not been preserved

The shared fictional report review is retained as a normal Supabase care action/audit event. CARE's synthetic patient, direct doctor assignment and encounter are retained in this isolated database. No clinical file or medical interpretation was created by this increment. No service-role credential, provider key, refresh token, password, generated environment, runtime log or full container configuration belongs in GitHub or Drive. The runtime evidence in ../VERIFICATION.md contains synthetic identifiers and outcomes only.
