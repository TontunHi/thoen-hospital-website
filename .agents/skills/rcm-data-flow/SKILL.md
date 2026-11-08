---
name: rcm-data-flow
description: End-to-end data flow architecture for /service/dashboard-rcm clinical dashboards, fund reports, and financial ledgers (SSR prefetch, atomic client state, AbortController, SWR server cache, Zod validation, lazy modal details, CSV export, and HOSxP SQL rules). Read before building, editing, or refactoring any RCM page, client component, API route, or clinical service.
---

# RCM Dashboard Data Flow & Architecture

สถาปัตยกรรมมาตรฐานสำหรับการไหลของข้อมูลตั้งแต่ HOSxP/Gateway → Service Layer → API Route → SSR → Client State → Modal/Export ในระบบ `/service/dashboard-rcm/**` เพื่อให้หน้าเว็บตอบสนองทันที ป้องกัน Race Condition, หลีกเลี่ยง Waterfall และไม่ทำให้ฐานข้อมูลโรงพยาบาลทำงานหนักเกินไป

---

## 5 เสาหลักมาตรฐาน Performance (The 5 Pillars of RCM Performance)

ทุก Route ภายใต้ `/service/dashboard-rcm/**` (ปัจจุบันมี 50 routes) ต้องผ่านเกณฑ์มาตรฐาน 5 เสาหลักอย่างเคร่งครัด:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      5 Pillars of RCM Performance                      │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│ 1. SSR Prefetch  │ 2. Mount Guard   │ 3. AbortController│ 4. Pagination │
│  (Zero Waterfall)│ (No Double Fetch)│ (Race Defense)   │  (Bounded 50) │
├──────────────────┴──────────────────┴──────────────────┴───────────────┤
│ 5. SWR In-Memory Caching (Single-Flight Deduplication & Test Isolation) │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Zero-Waterfall SSR Prefetch (`page.tsx`):** ดึงข้อมูลรอบแรกที่ Server Component เสมอ โดยใช้ `getDefaultFiscalYearDateRange()` จาก `@/lib/clinical/rcmDashboardService` แล้วส่ง `initialData` + `initialRange` ให้ Client ทันที
2. **Double-Fetch Mount Guard (`*Client.tsx`):** Client Component ต้องมี `isFirstMount = useRef(true)` (หรือ `initialQueryKeyRef`) ข้ามการ `fetch()` ในรอบแรกหาก SSR ส่ง `initialData` มาแล้ว ป้องกันการยิง API 2 รอบติด
3. **Race Condition Prevention (`AbortController`):** ทุก Client Fetch ต้องมี `abortRef = useRef<AbortController | null>(null)` สั่ง `abort()` รอบเก่าก่อนเริ่มรอบใหม่ และส่ง `{ signal: controller.signal }` ไปยัง `fetch()` เสมอ
4. **Server-Side Bounded Pagination & Defensive State:** ล็อค `pageSize: 50` เสมอ (ห้าม Unbounded Array) พร้อมตั้งค่า Default State ครบทุกฟิลด์ตัวเลข และใช้ Defensive Rendering `(summary.authenRate ?? 0).toFixed(1)` เสมอ
5. **In-Memory SWR Cache & Test Isolation:** Service ต้องหุ้ม Query ด้วย `getCachedData` หรือ `getSwrCachedData` จาก `@/lib/cache` และใน Unit Test ต้องมี `clearMemoryCache()` ใน `beforeEach` เสมอ

---

## 1. End-to-End Flow & Tier Decision Matrix

**กฎเหล็ก: ห้ามส่งรายการผู้ป่วยทั้งปี (Unbounded Bulk Array) ไปยัง Browser เด็ดขาด** (ยกเว้นจังหวะกดส่งออกไฟล์ `exportAll=true`)

เลือกกลยุทธ์ฝั่ง Server ให้เหมาะกับขนาดข้อมูลของรายงาน:

| รูปแบบ | ใช้เมื่อ | วิธีการทำงาน |
|---|---|---|
| **Pattern A: True SQL Two-Tier** | รายงานขนาดใหญ่ทั้ง รพ. (`> 5,000` แถว/ปี เช่น OPD, IPD, REP Funds) | แยก Query 2 ชุดรันคู่ขนาน (`Promise.all`):<br>1. **Tier 1 (Summary):** SQL `GROUP BY` คำนวณ KPI + ข้อมูลกราฟ (`~2–5 KB`)<br>2. **Tier 2 (Ledger):** SQL `LIMIT ? OFFSET ?` ส่งเฉพาะหน้าปัจจุบัน (`50` แถว) |
| **Pattern B: Bounded Cohort SWR** | รายงานกองทุนเฉพาะโรค/ยา (`< 5,000` แถว/ปี) ที่ต้อง Reconcile ข้ามตารางและสลับ KPI Card Filter ทันที | ดึงเฉพาะคอลัมน์จำเป็น (Projection Pruning) เข้า `getSwrCachedData()` ใน `@/lib/cache` แล้วทำ `cardFilter` + `search` + `sort` + `slice()` บน Server เพื่อส่งกลับ **เฉพาะ 50 แถวของหน้านั้น + Summary** |

- **Parallel Server Calls:** งานอิสระ (เช่น `checkAdpMapping` กับ Query หลัก, หรือ Tier 1 กับ Tier 2) ให้รันพร้อมกันด้วย `Promise.all(...)` ห้าม `await` ต่อคิวทีละตัว
- **SWR + Single-Flight Deduplication:** ใช้ `getSwrCachedData(key, fetcher, { staleTtlMs, maxTtlMs })` หรือ `getCachedData(key, fetcher, ttlMs)` จาก `@/lib/cache` เพื่อกัน Cache Stampede (เช่น ช่วงเช้าเปิดพร้อมกันหลายคน Gateway จะถูกยิงเพียงครั้งเดียว); เมื่อผู้ใช้กดปุ่มรีเฟรช (`refresh=true`) ให้เรียก `invalidateCacheKey(key)` ก่อนเสมอ

---

## 2. Zero-Waterfall SSR & Clean Hydration Hand-off

### 1. `page.tsx` (Server Component Standard Pattern)
```tsx
import { verifyMemberSession } from '@/lib/auth/MemberAuthService'
import { redirect } from 'next/navigation'
import { logThrottledAudit } from '@/lib/audit'
import { getDefaultFiscalYearDateRange } from '@/lib/clinical/rcmDashboardService'
import { MyClinicalService } from '@/lib/clinical/myClinicalService'
import MyReportClient from './MyReportClient'

export default async function Page() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/my-report')
  }

  logThrottledAudit('READ', 'RCM_MY_REPORT', session.user.id).catch(() => {})

  const initialRange = getDefaultFiscalYearDateRange()
  let initialData = null
  let initialError: string | null = null

  try {
    initialData = await MyClinicalService.getReportData({
      ds1: initialRange.startDate,
      ds2: initialRange.endDate,
      page: 1,
      pageSize: 50,
    })
  } catch (err: unknown) {
    console.error('SSR Prefetch Error:', err)
    initialError = 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้ กรุณากดปุ่มรีเฟรชเพื่อลองใหม่'
  }

  return (
    <MyReportClient
      initialData={initialData}
      initialRange={initialRange}
      initialError={initialError}
    />
  )
}
```

> [!IMPORTANT]
> **Canonical Date Export:** ฟังก์ชัน `getDefaultFiscalYearDateRange` และ `resolveFiscalDateRange` ต้อง import จาก `@/lib/clinical/rcmDashboardService` เท่านั้น (ห้าม import จาก path อื่นที่อาจไม่มีหรือเป็น mock)

### 2. `*Client.tsx` (Double-Fetch Guard)
```tsx
const isFirstMount = useRef(true)

useEffect(() => {
  if (isFirstMount.current) {
    isFirstMount.current = false
    if (initialData) return // ข้ามการ fetch ซ้ำรอบแรก เพราะ SSR ส่งมาให้แล้ว
  }
  fetchData()
  return () => {
    abortRef.current?.abort()
  }
}, [fetchData, initialData])
```

---

## 3. Atomic Client Query State & Date Calculation

ป้องกัน Double-Fetch Cascade (เช่น `useEffect` ลูกโซ่ที่แก้ `ds1` แล้วค่อยแก้ `page = 1` ในอีกรอบจนยิง API 2 ครั้งติด):

- **Atomic Filter Updates:** รวมสถานะ Query หลัก (`dateMode`, `ds1`, `ds2`, `cardFilter`, `ucOnly`, `search`, `sortBy`, `sortOrder`, `page`, `pageSize`) หรือสร้าง Handler เดียวต่อการเปลี่ยนเงื่อนไข เพื่อรีเซ็ต `page: 1` **ใน State Transition เดียวกัน** ทันทีที่เปลี่ยนวันที่, เปลี่ยนแท็บช่วงเวลา, คลิก KPI Card, หรือ Commit คำค้นหา
- **Single Source of Truth สำหรับปีงบประมาณ:** ใช้ `getDefaultFiscalYearDateRange()` และ `resolveFiscalDateRange()` จาก `@/lib/clinical/rcmDashboardService` (1 ต.ค. ถึง 30 ก.ย.) **ห้าม Hardcode ปี** เช่น `'2025-10-01'`
- **คำนวณโหมดรายเดือนจากปีที่ผู้ใช้เลือกเสมอ:**
  ```typescript
  const ceYear = selectedBeYear - 543 // ❌ ห้ามใช้ today.getFullYear() แทนปีที่ผู้ใช้เลือก
  ```
- **ลำดับแท็บช่วงเวลา (Date Selector):** `กำหนดเอง` | `เดือน` | `ปีงบประมาณ` (ไม่มีเลขลำดับนำหน้าและไม่มีวงเล็บช่วงวันที่)
- **Unified Global Search:** ส่งพารามิเตอร์ `search` เดี่ยว (Debounce `300–350ms`) ค้นครอบคลุม HN, CID, ชื่อ-สกุล, VN/AN, `pdx`, สิทธิ, `authencode` พร้อมกันโดยไม่ต้องมีดรอปดาวน์เลือกฟิลด์ใน UI

---

## 4. Stale-While-Revalidate UX & Race Condition Defense

### 1. การจัดการ AbortController ใน Client
```tsx
const abortRef = useRef<AbortController | null>(null)
const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialData))

const fetchData = useCallback(async (forceRefresh = false) => {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  setLoading(true)
  setError(null)
  try {
    const q = new URLSearchParams({
      ds1,
      ds2,
      page: String(currentPage),
      pageSize: String(pageSize),
      // ... filters
    })
    if (forceRefresh) q.set('refresh', 'true')

    const res = await fetch(`/api/service/dashboard-rcm/my-report?${q.toString()}`, {
      signal: controller.signal,
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || json.error || 'ไม่สามารถดึงข้อมูลรายงานได้')
    }
    setData(json.data)
    setHasLoadedOnce(true)
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') return
    setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
  } finally {
    if (!controller.signal.aborted) {
      setLoading(false)
      setIsRefreshing(false)
    }
  }
}, [ds1, ds2, currentPage, pageSize, /* other dependencies */])
```

### 2. ข้อควรระวังในการเขียน Unit Test สำหรับ Fetch With AbortController
เมื่อ Client Component เรียก `fetch(url, { signal: controller.signal })` ตัว Mock ใน Vitest/Jest จะได้รับ **2 Arguments**:
- **การทดสอบ `fetchData` หลัก:**
  ```tsx
  // ✅ ถูกต้อง: ใส่ expect.anything() เป็น argument ที่ 2
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('page=1'),
    expect.anything()
  )
  // ❌ ผิด: toHaveBeenCalledWith(singleArg) จะ fail ทันทีเพราะมี 2 arguments
  ```
- **การทดสอบ Endpoint ย่อย (`vn-details` / `an-details`):**
  ฟังก์ชัน Modal รายละเอียดที่เรียก `fetch(url)` แบบ argument เดียว (ไม่มี signal) ให้ assert ด้วย argument เดียวตามเดิม

---

## 5. Defensive State & Rendering Standards

เพื่อป้องกัน `TypeError: Cannot read properties of undefined (reading 'toFixed')` หรือ `Cannot read properties of undefined (reading 'toLocaleString')`:

1. **Default State ต้องมีฟิลด์ตัวเลขครบทุกตัว:**
   ```tsx
   const [summary, setSummary] = useState<ReportSummary>(
     initialData?.summary || {
       totalCases: 0,
       compensatedCases: 0,
       compensationRate: 0,
       totalCompensated: 0,
       totalIncome: 0,
       withAuthenCount: 0,
       authenRate: 0,
     }
   )
   ```
2. **Defensive Rendering ใน JSX:**
   - ใช้ `(summary.authenRate ?? 0).toFixed(1)` หรือ `summary.authenRate?.toFixed(1) ?? '0.0'`
   - ใช้ `(summary.totalCases ?? 0).toLocaleString('th-TH')`
   - ห้ามเรียก `.toFixed()` หรือ `.toLocaleString()` บนฟิลด์ที่อาจเป็น `undefined` โดยไม่มี Fallback

---

## 6. Lazy Detail Modal & Client Cache

เมื่อผู้ใช้คลิกแถว (`<tr>`) เพื่อเปิดดูรายละเอียดใน Modal:
1. **0ms First Paint:** แสดงข้อมูลสรุปของแถวนั้นทันทีจาก State ตารางที่มีอยู่แล้ว
2. **Lazy Clinical Fetch + Map Cache:** ดึงข้อมูลเชิงลึก (`/api/.../vn-details?vn=...` หรือ `an-details`) เฉพาะตอนเปิด Modal หรือเปลี่ยนแท็บข้อมูลคลินิก โดย:
   - ใช้ `detailAbortRef` แยกต่างหาก (ยกเลิกทันทีเมื่อปิด Modal หรือกดเลื่อนไปคนถัดไป)
   - เก็บผลลัพธ์ลง `useRef(new Map<string, VnClinicalDetails>())` (จำกัดขนาดไม่เกิน ~50 รายการ) เพื่อให้การกดย้อนดูคนเดิม (Prev/Next) ไม่ยิง API ซ้ำ

---

## 7. Thin API Route, Zod Validation & Error Contract

Route Handler (`src/app/api/service/dashboard-rcm/**/route.ts`) ต้องบาง (`~25–40` บรรทัด) ทำเฉพาะ:
1. `verifyMemberSession()` → 401 ถ้าไม่มี Session, 403 ถ้า Role ไม่ใช่ `admin | staff | member`
2. `validateSearchParams(schema, searchParams)` จาก `@/lib/clinical/rcmValidation.ts` (ตรวจ `rcmDateRegex`, `page >= 1`, `pageSize` 10–500, enum) → 400 ถ้าไม่ผ่าน (หมายเหตุ: `searchField` ให้เป็น optional/deprecated เพื่อรองรับ Unified Global Search)
3. `logThrottledAudit('READ', ...)` (non-blocking)
4. เรียก Domain Service ใน `src/lib/clinical/` และคืนรูปทรงมาตรฐาน:
   - `200`: `{ success: true, data }` (หรือ field ตามสัญญาเดิมของ endpoint นั้น)
   - `503`: `GatewayUnavailableError` → `"ไม่สามารถเชื่อมต่อ API Gateway ของโรงพยาบาลได้ในขณะนี้"`
   - `504` / Timeout → `"การดึงข้อมูลใช้เวลานานเกินกำหนด กรุณาลองเลือกช่วงเวลาเป็นรายเดือน"`
   - `500`: Log รายละเอียดผ่าน `logger.error()` เท่านั้น **ห้ามส่ง Raw SQL Error หรือ PHI ออกไปใน JSON**

---

## 8. Safe CSV Export (`exportAll=true`)

- ดึงข้อมูลเต็มเฉพาะเมื่อกดส่งออก (`exportAll=true`) โดยใช้สถานะ `isExporting` แยกต่างหาก
- ใส่ UTF-8 BOM (`\uFEFF`) นำหน้าไฟล์เสมอ เพื่อให้เปิดใน Excel บน Windows ภาษาไทยได้ไม่เพี้ยน
- **CSV Formula Injection Guard:** ค่าข้อความที่ขึ้นต้นด้วย `=`, `+`, `-`, `@`, `\t`, `\r` ต้องเติม `'` นำหน้าก่อน Quote เป็น CSV cell เพื่อป้องกัน Excel Macro/Formula Injection

---

## 9. Internal RCM Full-Data & Testability Contract

- **แสดงผลข้อมูลเต็มในพอร์ทัล RCM:** หน้า `/service/dashboard-rcm/**` เป็นระบบงานภายในที่คุมสิทธิ์ด้วย Member Role Auth และ `logThrottledAudit('READ', ...)` แล้ว — **แสดงเลขบัตรประชาชนครบ 13 หลัก** และ HN/VN/ชื่อ-สกุลเต็มเพื่อใช้กระทบยอด e-Claim/REP สปสช. ได้ทันที โดยไม่ต้อง Mask ดอกจันหรือทำปุ่มสลับซ่อน/แสดง
- **Zero-DB & Dependency Injection:** ห้ามต่อ MySQL ตรงจาก Next.js; ทุก Service Function ต้องรับ `executor: QueryExecutor = queryClinicalDb` เป็นพารามิเตอร์ตัวสุดท้าย เพื่อให้เขียน Unit Test บน Vitest ได้ 100% โดยไม่ต้องต่อ DB จริง
- **Test Isolation Rule สำหรับ In-Memory Cache:**
  Service ทุกตัวที่มีการหุ้ม Cache (`getCachedData`) ใน Unit Test (`*.test.ts`) **ต้องเรียก `clearMemoryCache()` ใน `beforeEach` เสมอ**:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { clearMemoryCache } from '@/lib/cache'

  describe('MyClinicalService', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      clearMemoryCache() // ป้องกัน Cache ค้างข้าม Test cases
    })
  })
  ```

---

## 10. กฎ SQL, FoxPro Migration & Performance SLA

เมื่อต้องเขียนหรือแก้ไข SQL ใน Service Layer (`src/lib/clinical/**`) ให้เปิดอ่านคู่มือเฉพาะทางใน [references/sql-optimization.md](references/sql-optimization.md) ทุกครั้ง — ครอบคลุม:
- `cc.AuthenCode` (ห้ามใช้ `cc.claimcode`), Lookup Join และลำดับ `COALESCE` ของ NHSO/REP/eClaim
- TIS-620 Safety (`formatThaiSex` ใน TypeScript แทนข้อความไทยใน SQL)
- Driving Subquery Pattern สำหรับ `opitemrece` (ห้าม `OR` ข้ามตาราง, ห้ามสแกน `opitemrece` ซ้ำหลายรอบใน Query เดียว)
- Checklist Refactor SQL ต้นทาง 6 ข้อ และเกณฑ์ SLA (`< 500ms` Tier 1, `< 1,000ms` Tier 2, `{ timeoutMs: 90000 }` สำหรับรายงานกองทุนข้ามเดือน)

---

## 11. Automated Verification Checklist

ก่อนส่งมอบงานหรือเปิด PR ทุกครั้ง ให้รันคำสั่งตรวจสอบ:
1. **Audit 5 เสาหลักทั่วทั้ง 50 Routes:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/rcm-data-flow/scripts/audit_rcm_performance.ps1
   ```
   *ต้องได้ผลลัพธ์ **PASS 100%** ครบทั้ง 50 routes*
2. **Vitest Unit Test Suite:**
   ```powershell
   cmd.exe /c "npm run test -- --run"
   ```
   *ต้องผ่าน 100% ทุกไฟล์ (ปัจจุบัน 235 test files / 1,569 tests)*
3. **Next.js Production Build:**
   ```powershell
   cmd.exe /c "npm run build"
   ```
   *ต้องผ่านฉลุย Exit Code 0 พร้อม TypeScript strict check*

---

## 12. หลักการพัฒนาและแก้ไขโค้ดอย่างมีเสถียรภาพ (AI Reliability & Atomic Protocol)

เพื่อป้องกันการหลุดโฟกัสหรือแก้ไขโค้ดผิดพลาด (Hallucination) เมื่อทำงานกับระบบ RCM ขนาดใหญ่:

1. **Analyze First, Edit Later (วิเคราะห์ตรรกะก่อนลงมือ):**
   - อ่านทำความเข้าใจ Data Flow ครบวงจร (Service → API → SSR → Client) ก่อนลงมือแตะต้องไฟล์
   - ระบุสาเหตุที่แท้จริงและประเมินผลกระทบต่อ 5 เสาหลักเสมอ ห้ามแก้แบบลองสุ่ม
2. **Atomic Layered Changes (แก้ทีละเลเยอร์ ไม่ข้ามขั้น):**
   - ลำดับการทำอย่างเป็นระเบียบ:
     1. Service Layer & Type Definition (`src/lib/clinical/**`)
     2. API Route & Zod Validation (`src/app/api/service/dashboard-rcm/**`)
     3. SSR Page & Prefetch (`src/app/service/dashboard-rcm/**/page.tsx`)
     4. Client State & Double-Fetch Guard (`*Client.tsx`)
     5. Lazy Modal / Table UI Presentation
   - หลีกเลี่ยงการแก้ทุกเลเยอร์พร้อมกันในคำสั่งเดียว ให้ตรวจเช็คความถูกต้องทีละชั้น
3. **Strict Scope Pinning (ล็อคไฟล์เป้าหมายให้ชัดเจน):**
   - เจาะจงทำงานเฉพาะไฟล์ที่เกี่ยวข้องโดยตรง หลีกเลี่ยงการสแกนหรือแก้ไฟล์อื่นนอกเหนือ scope เพื่อรักษา Context ให้สะอาด
4. **Preserve Business Logic & Defensive Guards (รักษาตรรกะเดิม):**
   - ห้ามลบ comment คำอธิบายทางธุรกิจ, ห้ามตัดเงื่อนไข SQL ของ HOSxP ที่ถูกต้องอยู่แล้ว, และคง Defensive Rendering (`?? 0`, `?.toFixed(1)`) ไว้อย่างเคร่งครัด
5. **Continuous Verification (ตรวจสอบผลลัพธ์ทันที):**
   - หลังแก้ไข ให้รัน Unit Test เฉพาะไฟล์นั้นทันทีก่อนข้ามไปทำจุดถัดไป เพื่อตรวจจับข้อผิดพลาดตั้งแต่เนิ่นๆ
