# BoldSign Document Send — Master Pre-Flight Checklist
**Version:** 1.0 | **Created:** 2026-03-06 | **VTiger:** TT901 | **Airtable:** rec2T98NGORWcE89z

---

## Pre-Flight Checklist (Run Before Every Send)

### 1. WORD DOCUMENT
- [ ] Text tags embedded on Authorization page (white/invisible font):
  - `{{sign|1|*|Client Signature|sig_client}}`
  - `{{date|1|*|Date Signed|date_client}}`
  - `{{text|1|*|Printed Name|name_client}}`
  - `{{sign|2|*|ASI 360 Authorized Signature|sig_asi360}}`
  - `{{date|2|*|Date|date_asi360}}`
- [ ] Tag text color = WHITE (FFFFFF) — invisible to reader
- [ ] Authorization page has visible signature lines/table above the tags
- [ ] Document reviewed for accuracy (pricing, dates, client name, quote number)
- [ ] Images render correctly (Luminys products, diagrams)

### 2. API CALL PARAMETERS
- [ ] `UseTextTags=true` included
- [ ] `BrandId` set to correct company:
  - ASI 360: `4c0c84c2-8f81-4825-91c3-884f153800ed`
  - 500 Grand Live: `38c06913-4be9-408f-9aae-de85fbfd3d81`
  - 500 Grand Parking: `be8472fe-ffc3-46c8-a715-b1edfd5fdd07`
  - ASEAGI/Ashe Foundation: `8e6fb19f-d23f-4020-acf8-d01566fe63d0`
  - Tesla EV Rentals: **NOT YET CREATED**
- [ ] `EnableSigningOrder=true` (client signs first, ASI 360 countersigns)
- [ ] `ExpiryDays=30` for client, `7` for tests
- [ ] Signer 1 = client, Signer 2 = don@asi360.co

### 3. TEST FIRST (REQUIRED)
- [ ] Test send to `don@asi360.co` (client role) + `don@500gp.io` (countersign)
- [ ] Title prefixed with `[TEST]`
- [ ] Open email at don@asi360.co — confirm sig/date/name fields are pre-placed
- [ ] Sign as client — confirm don@500gp.io receives countersign notification
- [ ] Countersign — confirm completed PDF received
- [ ] Revoke test document after verification

### 4. SEND TO CLIENT
- [ ] Remove `[TEST]` prefix from title
- [ ] Update signer email to client
- [ ] Confirm correct brand for sending company
- [ ] Send and log documentId in VTiger opportunity / project notes

---

## Tag Syntax Reference

```
Format: {{fieldtype|signerIndex|required|label|fieldId}}

Field types:
  sign   = signature box
  date   = auto-populated date field
  text   = typed text input (for printed name)
  init   = initials field
  checkbox = checkbox

Signer index: 1 = first signer (client), 2 = second signer (ASI 360/Don)
Required:    * = mandatory, leave blank = optional
```

---

## Subskill Breakdown

| Skill | Trigger | Action |
|---|---|---|
| `boldsign-embed-tags` | Building any Word proposal/contract | Add white text tags to Authorization page |
| `boldsign-test-send` | Before any client send | Send to don@asi360.co + don@500gp.io, verify fields |
| `boldsign-client-send` | After test verified | Send with correct brand, expiry 30d, log documentId |
| `boldsign-revoke` | Error or test cleanup | Call revoke API with documentId |
| `boldsign-brand-select` | Sending from any company | Look up brandId from this doc |

---

## Known Issues / Open Items
- [ ] Tesla EV Rentals brand not yet created in BoldSign UI
- [ ] Proposal missing sections: Cover Letter, Needs Assessment, Risk Analysis, Deliverables
- [ ] Full proposals need Proposal Kit framework (Security Services sample = reference)
