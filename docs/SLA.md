# Kaivor / ADMIA Service Level Agreement (SLA)

**Effective date:** 2026-05-25
**Version:** 1.0
**Owner:** Kaivor / ADMIA Operations

This SLA establishes the service commitments between Kaivor (the "Provider") and Customers (the "Customer") for the Kaivor platform.

---

## 1. Service Availability

### 1.1 Uptime Commitment
Kaivor commits to **99.9% monthly uptime** ("Service Level") for all Production-tier services:

| Tier | Monthly Uptime | Maximum Monthly Downtime |
|---|---|---|
| Free / Starter | Best-effort | n/a |
| Pro AI | 99.5% | ~3.6 hours |
| Business | 99.9% | ~43 minutes |
| Enterprise | 99.95% | ~22 minutes |

### 1.2 Availability Measurement
Uptime is measured at the public API endpoint `https://kaivor-api.vercel.app/health` and the public frontend `https://kaivor.vercel.app`, monitored from at least three (3) geographically distinct locations every 60 seconds.

### 1.3 Exclusions
The following are **excluded** from downtime calculations:
- Scheduled maintenance windows (announced ≥72 hours in advance)
- Force majeure events
- Customer-caused outages (misconfigured integrations, abuse of API)
- Third-party provider outages outside Provider's control (Vercel, Neon, Meta, payment gateways) — Provider will pursue remediation with the affected vendor
- Beta features explicitly labeled as such

### 1.4 Service Credits
If monthly uptime falls below the committed Service Level, Customer is entitled to a **service credit** applied to the following month's invoice:

| Monthly Uptime | Service Credit |
|---|---|
| 99.0% – 99.89% | 10% of monthly fee |
| 95.0% – 98.99% | 25% of monthly fee |
| Below 95.0% | 50% of monthly fee |

Service credits must be **requested in writing within 30 days** of the downtime event. Maximum credit per month does not exceed 50% of that month's recurring fee.

---

## 2. Support Response Times

| Severity | Definition | First Response | Update Frequency | Plan Availability |
|---|---|---|---|---|
| **P1 — Critical** | Production down; data loss risk; security breach | 1 hour | Every 2 hours | Business, Enterprise |
| **P2 — High** | Major function unusable; significant business impact | 4 hours | Every 8 hours | Pro AI+ |
| **P3 — Medium** | Function impaired with workaround | 1 business day | Daily | All paid plans |
| **P4 — Low** | Question, feature request, cosmetic issue | 3 business days | At resolution | All plans |

Support hours: Monday-Friday 08:00-18:00 (America/Bogotá, GMT-5). Enterprise tier includes 24/7 on-call for P1.

---

## 3. Data Protection & Backup

### 3.1 Backup Frequency
- **Continuous** point-in-time recovery (PITR) via Neon PostgreSQL with 7-day window minimum (Business+)
- **Daily** logical snapshots retained for 30 days (Business+)
- **Weekly** off-region snapshots retained for 90 days (Enterprise)

### 3.2 Recovery Point Objective (RPO)
- Business: ≤ 1 hour
- Enterprise: ≤ 5 minutes

### 3.3 Recovery Time Objective (RTO)
- Business: ≤ 8 hours from incident declaration
- Enterprise: ≤ 1 hour from incident declaration

### 3.4 Data Portability
Customer may export all their data at any time via:
- Excel/CSV exports (built into the UI)
- API endpoints (full programmatic access)
- Upon termination: data export window of 30 days

### 3.5 Data Deletion
Upon contract termination, all customer data is purged from production systems within 30 days, and from backups within 90 days (subject to legal retention obligations).

---

## 4. Security Commitments

- TLS 1.2+ for all data in transit
- AES-256-GCM for sensitive data at rest (tokens, credentials)
- Encrypted passwords (bcrypt 10+ rounds)
- Multi-factor authentication (MFA / TOTP) available on all plans
- Role-based access control (RBAC)
- Annual penetration testing (Enterprise)
- SOC 2 Type I attestation (target Q4 2026; see `docs/SOC2_TYPE_I_ROADMAP.md`)

---

## 5. Maintenance Windows

- **Routine maintenance:** Sundays 02:00-06:00 UTC (when Customer impact is minimal)
- **Emergency maintenance:** As required; Customers are notified via status page and email
- **Scheduled maintenance notification:** ≥ 72 hours in advance for planned downtime

---

## 6. Communication & Status

Status of all services is publicly available at:

🟢 **https://kaivor.vercel.app/status**

The status page reports real-time service health and recent incidents, with historical uptime data.

---

## 7. Limits of Liability

This SLA represents Kaivor's sole obligation regarding service availability. Service credits are the exclusive remedy for SLA breaches. Total liability under this SLA in any 12-month period shall not exceed twelve (12) months of fees paid by Customer.

This SLA is incorporated into and subject to the Master Services Agreement (MSA) between Kaivor and Customer.

---

**Contact for SLA inquiries:** support@kaivor.co
**Last updated:** 2026-05-25
