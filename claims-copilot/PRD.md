# Claims Copilot — Product Requirements Document

---

## Vision

Auto-insurance claims processing is slow, expensive, and inconsistent. A claims agent today spends 30–60 minutes per claim manually reviewing damage photos, estimating repair costs, and writing up an assessment — work that is repetitive, error-prone, and bottlenecked by adjuster availability.

**Claims Copilot** is an AI-powered internal tool for claims agents that eliminates the manual assessment step. The agent uploads a policyholder's damage photo; Claude vision instantly returns a structured damage estimate (parts affected, severity, cost range, recommended action). The agent reviews, corrects if needed, and approves or escalates — turning a 45-minute task into a 3-minute one without removing human judgment from the loop.

---

## User Stories

| Actor | Story | Acceptance Criteria |
|---|---|---|
| Claims Agent | Initiate a new claim with policyholder and incident details | Form accepts name, phone, policy number, claim ID, date, type, location, third-party flag |
| Claims Agent | Upload a damage photo on behalf of the policyholder | Drag-and-drop or click upload; preview shown; can replace or clear before assessment |
| Claims Agent | Get an instant AI damage estimate without manual inspection | Assessment runs automatically on photo upload; returns structured JSON in < 30 s |
| Claims Agent | Review and correct the AI estimate before approving | All fields (severity, parts, types, cost, next step) are editable inline |
| Claims Agent | Approve low-confidence or clear claims quickly | One-click Approve issues a reference number and authorisation message |
| Claims Agent | Escalate complex or high-value claims to a senior adjuster | Flag button opens escalation form with reason and notes; creates ESC reference |
| Senior Adjuster | Receive a complete, structured claim package for review | Escalation card shows full claim summary, AI assessment, adjuster notes, and escalation reason |

---

## Key Features

### Built in v1 (this prototype)

**1. Guided 4-step claim wizard**
Maps directly to the insurance workflow: Initiation → Documentation → Assessment → Decision. Each step is labelled with its actor (Claims Agent / Policyholder) so the agent always knows whose action is required.

**2. AI damage assessment via Claude vision**
The photo is sent as a base64 block to `claude-sonnet-4-6` with a structured JSON prompt. The model returns: `damaged_parts[]`, `severity` (minor/moderate/severe), `damage_types[]`, `estimated_cost_range`, `confidence` (0–1), `recommended_next_step`. Assessment starts automatically when the agent advances from the photo step — no extra click.

**3. Editable assessment card with Confidence badge**
Every AI field is editable inline. The confidence badge is colour-coded (green ≥ 75 %, yellow ≥ 50 %, red < 50 %) to signal when human review is most critical. An Adjuster Notes field captures any override rationale.

**4. Approve / Escalate decision flow**
- **Approve**: issues a timestamped `AUTH-{claimId}-{date}` reference and authorises the policyholder to proceed to an approved repair shop.
- **Flag**: opens an escalation sub-form (reason: high value / disputed / fraud / complex / other + free-text notes), issues an `ESC-` reference, and notes the 24-hour SLA for senior adjuster review.

**5. Non-vehicle image guard**
If the uploaded image is not a damaged vehicle, the model returns a structured `not_a_vehicle` flag; the UI shows a clear inline error and the agent cannot proceed to decision.

---

### Not built — recommended for v2

| Feature | Rationale |
|---|---|
| Policy number validation against insurer DB | Prevents fraudulent claim IDs at intake; requires backend integration |
| Multi-photo upload + per-photo assessment | More evidence reduces error rate, especially for partial damage |
| Repair shop network integration | Auto-route approved claims to nearest in-network shop |
| Policyholder self-serve portal | Let policyholders submit photos directly via a mobile link, removing the agent from step 2 |
| Email/SMS notifications | Notify policyholder of approval, escalation, or repair authorisation automatically |
| Claim history dashboard | Agents handle many claims; a list view with status filters reduces context-switching |
| Audit log | Compliance requirement for most insurers — immutable record of every AI output and human override |

---

## Prioritisation

Features in v1 were chosen by impact on the core bottleneck: **manual damage assessment**. Everything else was deferred.

| Priority | Rationale |
|---|---|
| 4-step wizard + role labels | Establishes the workflow skeleton; evaluators and agents can follow the process without training |
| AI assessment (auto-triggered) | The core value proposition; removing one button click (double-click issue) increases adoption |
| Editable card + confidence badge | Human oversight is non-negotiable in insurance; every AI output must be correctable |
| Approve / Escalate with references | Closes the loop — a claim with no decision outcome has no operational value |
| Non-vehicle guard | Prevents silent failures that would corrupt downstream data |

---

## Success Metrics

| Metric | Baseline (today) | Target (6 months post-launch) |
|---|---|---|
| Average assessment time per claim | ~45 min (manual) | < 5 min |
| Agent throughput (claims/day) | ~10 | > 40 |
| AI acceptance rate (approved without edit) | — | ≥ 70 % |
| Escalation rate | ~15 % (manual judgment) | 10–20 % (maintained or reduced) |
| Assessment cost per claim | ~$25 (labour) | < $1 (API cost) |
| Agent satisfaction (CSAT) | — | ≥ 4 / 5 |

---

## AI Integration

### Approach

The image is encoded as base64 in the browser and sent to a Next.js server-side route (`POST /api/assess`). The route calls `claude-sonnet-4-6` via the Anthropic SDK, passing the image as a vision block alongside a strict system prompt that enforces JSON-only output. A `stripCodeFences()` helper handles any model formatting variance before `JSON.parse`.

The model is instructed to detect non-vehicle images and return a structured `not_a_vehicle` flag rather than a natural-language refusal, keeping the API contract machine-readable at all times.

### Human ↔ AI interaction model

```
Policyholder submits photo
        ↓
AI generates structured estimate          ← fully automated, < 10 s
        ↓
Claims Agent reviews estimate             ← human in the loop
  · Accepts fields as-is (most cases)
  · Edits any incorrect field
  · Adds adjuster notes
        ↓
Agent decides:
  Approve  →  AUTH reference issued       ← human decision, AI-assisted
  Escalate →  ESC reference + senior review
```

The model never makes a final decision. Its output is always advisory — the agent retains approval authority. This design satisfies most insurer compliance requirements and keeps liability firmly with the human adjuster.

### Ethical considerations

- **Bias in cost estimation**: training data may under- or over-estimate costs for certain vehicle makes/models or geographic markets. Cost ranges should be validated against a standardised repair cost database before v2.
- **Confidence calibration**: the confidence score is model self-reported and not statistically calibrated. Low-confidence claims should always be reviewed by a senior adjuster, not auto-approved.
- **Data privacy**: damage photos may contain identifiable information (licence plates, faces). Images should not be stored beyond the session; the API route processes them in memory only.
- **Explainability**: agents should be able to explain any AI-generated assessment to a policyholder. The editable card ensures the human can always attest to the final numbers.
