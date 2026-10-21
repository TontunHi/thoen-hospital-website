# 11. NHSO MIS HOS Central Dashboard Integration

Date: 2026-10-21
Status: Accepted

## Context
Thoen Hospital operates within the National Health Security Office (NHSO) ecosystem. Management and finance teams monitor budget transfers, claims, and service statements via NHSO's national monitoring portal (`https://mishos.nhso.go.th/mis_hos/#/dashboard`). Previously, staff had to access this platform separately, navigating complex menu trees with scattered credentials and disparate report templates.

To provide unified, single-pane hospital analytics alongside Region 1 (RH1) compensation benchmarks and SMT disbursement tracking, we require a native integration of MIS HOS inside `/service/budget-tracker/mishos`.

## Decision
1. **Upstream Architecture & Reverse Engineering:**
   - Connect directly to NHSO MIS HOS API: `https://mishos.nhso.go.th/mis_hos_apixam/simplestudio/ss_statement.php` and `l_hospital_see.php`.
   - The upstream API supports public querying parameterized by `hcode`, `year`, `province`, and statement IDs (`ssid`).
   - Implement `MisHosService` (`@/lib/budget/misHosService.ts`) with an in-memory cache (TTL 10 minutes) and automatic Buddhist Era / Common Era year handling.

2. **Defensive API Adapter:**
   - Expose thin route `/api/budget/mishos` with `verifyMemberSession()` server-side authentication check.
   - Enforce Tier 1 Audit logging via `logAudit('READ', 'budget_mishos', description, session)`.

3. **User Interface & Navigation:**
   - Integrate as Tab 3 in `BudgetTrackerNav.tsx`: "MIS HOS สปสช. (ส่วนกลาง)".
   - Implement responsive Sidebar Accordion representing all 10 core categories (0 to 9) from the national system:
     - 0: การโอนเงิน (0.1 รายการรับเงิน, 0.2 Statement-UC 84 กองทุนย่อย, 0.3 E-Claim Data)
     - 1: บริการผู้ป่วยนอก OP (OPAE, OP-Refer, ค่าพาหนะ, OP Walkin, On-Top)
     - 2: บริการผู้ป่วยใน IP (IP Service, ส่งข้อมูล IP & Error ติด C / Deny)
     - 3: บริการนอกเครือข่าย
     - 4: บริการค่าใช้จ่ายสูง High Cost (STEMI, เคมีบำบัดมะเร็ง, ต้อกระจก, อวัยวะเทียม, นิ่ว, Palliative)
     - 5: ส่งเสริมป้องกันโรค PP (ANC, คัดกรองมะเร็ง, ปัจจัยเสี่ยง, ทันตกรรม, วัคซีนไข้หวัดใหญ่)
     - 7: นโยบายสำคัญ (Cancer Anywhere, 30 บาทรักษาทุกที่, Telemedicine, Digital Health ID)
     - 8: บริการเฉพาะ DMIS (CKD, MOPH, KTP)
     - 9: บริการสิทธิอื่น (CSMBS ข้าราชการ, LGO อปท.)
   - Dynamic report viewer with 4 KPI summary cards, Recharts visualizations, paginated/searchable data table, and Excel (.xlsx) export via `exceljs`.
   - Header focus banner supporting CUP Thoen network presets (11152 รพ.เถิน + 11 รพ.สต.) and fiscal year selection (2560–2569).

## Consequences
- **Positive:** Hospital executives and medical claims teams can monitor national budget transfers, statement compensation, and clinical error metrics in real-time within the intranet hospital portal.
- **Positive:** Eliminates manual multi-step navigation and enables instant Excel exports with customized styling.
- **Mitigation:** Self-signed upstream government SSL handled cleanly via Node.js HTTPS agent. In-memory caching prevents request flooding to NHSO infrastructure.
