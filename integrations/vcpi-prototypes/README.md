# Isolated VCPI experiments

No current application imports these files. No network, credentials, uploads or care-plan writes.

## Increment 3: bounded minimization rehearsal

Run `node integrations/vcpi-prototypes/run-privacy-comparison.mjs --opt-in-synthetic-only` from the repository root. Without this exact opt-in the runner refuses execution. It accepts only its bundled fictional source. Tests also exercise refusal of arbitrary content and invalid spans.

The experiment selects instruction spans, retains their source offsets and checks preservation of a decimal dose, weekday, clock time and hold instruction. Deliberately corrupted derivatives demonstrate why identifier removal alone is insufficient. The original is authoritative. No automatic redaction safety or OCR accuracy is claimed.

An actual OCR-versus-vision comparison remains blocked on a selected local OCR runtime and a frozen synthetic image corpus with independently transcribed truth. Tesseract was not installed in the inspected environment. This increment therefore provides a fixture comparison harness, not a completed OCR benchmark. No provider settings changed and no OCR was introduced into intake.

Next experiment: at least printed, rotated, low-resolution, handwritten, Hindi, fractional-dose, multi-page and hold/stop fixtures; paired original-vision, local-OCR, and human-selected-minimized inputs. Freeze engine/model versions and record per-field exact-match errors, omissions, unsupported instructions, identifier exposure, latency and cost. Require zero unreviewed activation in every arm. Any missing instruction or altered decimal blocks the derivative. Vendor disclosure/retention and local installation choices must be settled before broader testing; real patient data remains prohibited.

## Increment 4: CARE MedicationRequest adapter plan

Plan only; no connected adapter or CARE authentication bridge is enabled. The locally available CARE resource specification (`care/emr/resources/medication/request/spec.py`) defines status, dosage instruction text, timing repeat, bounded periods, as-needed flags, route and dose/rate structures. It is a deployment-specific CARE API, not an assumption of a generic FHIR wire payload. Its observed TimingRepeat has frequency/period/unit and bounds; that alone does not supply clock times or explicit weekdays.

1. Pin the CARE revision and fixture payload to a reviewed version of that resource specification. Capture record ID/version, source JSON pointer, source digest, patient/facility mapping and retrieval time. Retain immutable source JSON separately from the proposed operational fields.
2. Accept only preapproved synthetic fixtures initially. Preserve medication identity, wording, quantities/units, route, status and dosage sequence. Every populated field links to its JSON pointer. Do not convert strength to dose or infer a clock time from frequency.
3. Map only representable once/daily/weekly schedules with explicit dates, times and (for weekly) weekdays. Missing scheduling data stays unresolved. Multiple dosage stages, ambiguous units, duration-only dates, conditional/PRN, on-hold, stopped, cancelled, erroneous or unknown status cannot create fixed scheduled actions. Preserve these as exceptions requiring reconciliation; never automatically stop an existing WholeCare plan.
4. Feed proposals into the same VCPI verification, exclusion and clinician-confirmation boundary. A CARE active order does not equal a WholeCare confirmed plan. Enforce assigned-clinician authorization, source version checks and idempotent import keys server-side.
5. Test changed/discontinued prescriptions, duplicate versions, foreign patient/facility IDs, stale updates, unsupported timing, fractions and multiple dosage instructions. Preserve old care-loop completion/evidence history. Require the identity and permission denial tests in `integrations/care/CONNECTION_CONTRACT.md` before any live bridge.

Safe feasibility limit: a pure fixture adapter can follow once a target CARE revision and representative wire fixtures are pinned. A live adapter cannot safely follow from this source inspection alone; cross-system identity/delegation and actual payload/version contracts remain unverified.
