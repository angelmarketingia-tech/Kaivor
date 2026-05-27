# SOC 2 Type I Readiness Roadmap

**Project:** Kaivor / ADMIA
**Owner:** Security & Engineering
**Status:** In-progress (Pre-audit)
**Target audit window:** Q4 2026 (Type I) → Q3 2027 (Type II)

This document tracks the technical and organizational controls required for SOC 2 Type I attestation under the AICPA Trust Services Criteria. Type I covers **Security** (mandatory) and optionally Availability, Confidentiality, Processing Integrity, and Privacy.

---

## 1. Current Posture (as of 2026-05-25)

| Control area | Status | Evidence |
|---|---|---|
| Multi-tenancy with row-level isolation | ✅ Implemented | `tenantId` on every model, `req.user.tenantId` in every handler |
| Password hashing | ✅ Implemented | bcrypt (10 rounds), users table |
| JWT authentication | ✅ Implemented | NestJS Passport + cookie + Authorization header |
| HTTPS-only | ✅ Implemented | Vercel enforces TLS 1.2+ |
| httpOnly + Secure + SameSite cookies | ✅ Implemented | `cookie-parser`, auth.controller |
| AES-256-GCM for secrets at rest | ✅ Implemented | `common/crypto.util.ts` |
| Rate limiting | ✅ Implemented | `@nestjs/throttler`, 3 tiers |
| Audit logging | ✅ Implemented | `AuditInterceptor` on all mutations |
| MFA / TOTP | ✅ Implemented | `speakeasy` + backup codes + `/auth/mfa/*` |
| Error monitoring | 🟡 Code ready | Sentry SDK installed; awaiting DSN env var |
| Backups | 🟡 Documented | Neon plan-dependent; production should be Launch tier minimum |
| DR / Restore drill | 🔴 Pending | Not yet exercised |
| Penetration test | 🔴 Pending | Schedule with external vendor before audit |
| Vulnerability scanning | 🔴 Pending | `npm audit` ad-hoc; need Dependabot + scheduled scans |
| Vendor risk management | 🔴 Pending | DPA inventory of Neon, Vercel, Sentry, Meta, SMTP provider |
| Access reviews (quarterly) | 🔴 Pending | Document and execute quarterly user/role review |
| Incident response plan | 🔴 Pending | Document, table-top exercise |
| Change management | 🟡 In-progress | Git + PR-based; needs formal approval/rollback policy |
| Logical access control | 🟡 In-progress | RBAC implemented (5 roles); need SSO/SAML for enterprise tier |

---

## 2. Trust Services Criteria Mapping

### CC1 — Control Environment
- [ ] **CC1.1** Code of Conduct (commit to repo)
- [ ] **CC1.2** Org chart with security responsibilities
- [ ] **CC1.3** Security training for engineers (annual)
- [ ] **CC1.4** Background checks documented for engineers with prod access
- [ ] **CC1.5** Disciplinary process documented

### CC2 — Communication & Information
- [x] **CC2.1** Information classification (see `docs/DATA_CLASSIFICATION.md`)
- [ ] **CC2.2** Internal communication channels documented
- [ ] **CC2.3** External communication (security@kaivor.co, status page)

### CC3 — Risk Assessment
- [ ] **CC3.1** Annual risk assessment with executive sign-off
- [ ] **CC3.2** Threat modeling for new features
- [ ] **CC3.3** Fraud risk consideration

### CC4 — Monitoring
- [x] **CC4.1** Sentry for error monitoring (env var pending)
- [x] **CC4.2** AuditLog for mutations
- [ ] **CC4.3** SIEM or log aggregation (consider Logtail/Datadog)

### CC5 — Control Activities
- [x] **CC5.1** Multi-tenant isolation
- [x] **CC5.2** RBAC enforcement (`platform_superadmin`, `admin`, etc.)
- [x] **CC5.3** Encrypted secrets (AES-256-GCM)

### CC6 — Logical Access
- [x] **CC6.1** Identification & authentication (email + password + MFA)
- [x] **CC6.2** Authorization (RBAC)
- [x] **CC6.3** Logical access provisioning (admin creates users)
- [ ] **CC6.4** Periodic access reviews (quarterly)
- [x] **CC6.5** Logical access termination (deactivate user)
- [x] **CC6.6** External access (TLS, CORS allowlist)
- [x] **CC6.7** Restriction of unauthorized software (npm allowlist via package.json lockfile)
- [ ] **CC6.8** Physical access (Vercel + Neon = SOC 2 attested data centers)

### CC7 — System Operations
- [ ] **CC7.1** Vulnerability management (Dependabot + monthly scans)
- [ ] **CC7.2** System monitoring (Sentry + Vercel logs + uptime ping)
- [ ] **CC7.3** Incident response plan
- [ ] **CC7.4** Disaster recovery plan
- [ ] **CC7.5** Restore drills (quarterly)

### CC8 — Change Management
- [x] **CC8.1** Code changes via PR review
- [ ] **CC8.2** Production deployment approval workflow
- [x] **CC8.3** Source code repository (GitHub `angelmarketingia-tech/Kaivor`)

### CC9 — Risk Mitigation
- [ ] **CC9.1** Business continuity plan
- [ ] **CC9.2** Vendor management program

---

## 3. 90-Day Plan to Audit Readiness

### Sprint 1 (Weeks 1-2): Foundational Documentation
- [ ] Information Security Policy (high-level)
- [ ] Acceptable Use Policy
- [ ] Data Classification Policy
- [ ] Incident Response Plan
- [ ] Change Management Policy

### Sprint 2 (Weeks 3-4): Technical Controls
- [ ] Activate Sentry in production (set `SENTRY_DSN`)
- [ ] Activate Logtail/Datadog for log aggregation
- [ ] Configure Dependabot alerts on GitHub
- [ ] Document password complexity rules (already enforced: bcrypt + min length via class-validator)
- [ ] Enable Neon PITR (upgrade from Free → Launch tier)
- [ ] Document backup retention policy (Neon Launch: 7-day PITR)

### Sprint 3 (Weeks 5-6): Vendor Management
- [ ] Inventory of subprocessors: Neon, Vercel, Sentry, Meta (WhatsApp), SMTP provider, payment gateway
- [ ] Obtain SOC 2 reports from each subprocessor
- [ ] Sign DPAs (Data Processing Agreements)
- [ ] Document data flow diagram

### Sprint 4 (Weeks 7-8): Access & HR Controls
- [ ] Quarterly access review process documented
- [ ] Onboarding/offboarding checklists for engineers
- [ ] Background check process for prod access
- [ ] Security awareness training (annual)

### Sprint 5 (Weeks 9-10): Testing & Validation
- [ ] External penetration test
- [ ] Vulnerability scan
- [ ] Disaster recovery tabletop exercise
- [ ] Restore drill from backup

### Sprint 6 (Weeks 11-12): Audit Preparation
- [ ] Select SOC 2 auditor (Vanta, Drata, Strike Graph, or direct CPA firm)
- [ ] Collect evidence in audit repository
- [ ] Map evidence to controls
- [ ] Schedule Type I observation window

---

## 4. Tooling Recommendations

| Need | Recommended | Cost (approx.) |
|---|---|---|
| Compliance automation | Vanta or Drata | $7K-$15K/yr |
| Penetration test | Cobalt or Synack | $5K-$15K/test |
| Vulnerability scanning | Snyk or GitHub Advanced Security | $0-$500/month |
| SIEM / log aggregation | Logtail, Datadog, or Better Stack | $50-$300/month |
| Uptime monitoring | Better Stack or UptimeRobot | $0-$50/month |

**Total Year 1 estimate:** $25K-$45K (auditor + tooling + pen test)

---

## 5. Definition of "Audit Ready"

The product is SOC 2 Type I audit ready when:

1. All technical controls in Section 1 are ✅
2. All policies in Section 3 Sprint 1 are written and approved
3. Vendor inventory is documented with DPAs in place
4. Pen test has been conducted with critical issues resolved
5. Evidence is centralized (Vanta/Drata or `/audit/evidence`)
6. Auditor has been engaged and observation window confirmed

---

## 6. Type II Differences (for forward planning)

SOC 2 Type II evaluates operating effectiveness over a **6-12 month period**. To reach Type II:
- Maintain logs and evidence continuously
- Execute access reviews on schedule
- Demonstrate that incident response was triggered (or run tabletops)
- Re-test controls quarterly

Type II audits typically run 6-12 months after Type I.

---

**Last updated:** 2026-05-25
**Reviewers:** Engineering Lead, Security, Legal
