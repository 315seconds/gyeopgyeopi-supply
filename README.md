# 겹겹이 공급관리 시스템

고기집 겹겹/적돈 본사-지점 식재료 공급관리 웹앱  
React + Vite + Supabase + GitHub Pages

---

## 브랜드 구조

| 브랜드 | 지점 수 | 재고 처리 방식 |
|--------|--------|--------------|
| 겹겹 | 1개 | 원물 매입 → 건조 숙성 → 가공완료 등록 → 출고 |
| 적돈 | 2개 | 원물 매입 → 즉시 컷팅/진공포장 → 출고 |

- 재고 풀이 브랜드별로 분리됩니다 (겹겹 주문 → 겹겹 재고, 적돈 주문 → 적돈 재고)
- 점장은 kg 단위가 아닌 **개수** 단위로 주문하고, 스태프가 출고 시 저울로 실중량을 입력합니다

---

## 시작하기

### 1. 레포지토리 클론 후 의존성 설치
```bash
git clone https://github.com/315seconds/gyeopgyeopi-supply.git
cd gyeopgyeopi-supply
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env
```
`.env` 파일에 아래 값 입력 (Supabase Dashboard → Settings → API):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BL...
```

### 3. Supabase DB 세팅
Supabase Dashboard → SQL Editor에서 순서대로 실행:
1. 기존 스키마 SQL 실행
2. `supabase/migrations.sql` 실행 (브랜드 분리, 주문단위 컬럼 추가)

### 4. 지점 브랜드 설정
앱 로그인 → 설정 → **지점 관리** 탭에서 각 지점에 겹겹/적돈 브랜드 지정

### 5. 개발 서버 실행
```bash
npm run dev
```

---

## 배포 (GitHub Pages)

소스 파일을 수정한 뒤 아래 명령어로 빌드 + 배포합니다.  
GitHub에서 파일을 직접 수정해도 이 명령어를 실행해야 실제 사이트에 반영됩니다.

```bash
npm run deploy
```

> **구조**: `src/*.jsx` → (빌드) → `dist/` → `gh-pages` 브랜치 → 라이브 사이트  
> GitHub에서 소스를 수정하고 머지한 뒤 반드시 `npm run deploy`를 실행하세요.

---

## 사용자 계정 생성

Supabase Dashboard → Authentication → Users에서 이메일/비밀번호로 생성 후,  
SQL Editor에서 users 테이블에 row 추가:

```sql
INSERT INTO public.users (id, email, name, role, branch_id)
VALUES (
  '[auth.users의 UUID]',
  '[이메일]',
  '[이름]',
  'owner',   -- 'owner' | 'staff' | 'manager'
  null       -- manager는 branches 테이블의 UUID 입력
);
```

---

## Edge Function 배포 (웹 푸시)

```bash
supabase functions deploy send-push
```

Supabase Dashboard → Settings → Edge Functions에서 시크릿 설정:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Dashboard > Settings > API > service_role
```

---

## 파일 구조

```
src/
├── contexts/
│   └── AuthContext.jsx         # 로그인 상태, 역할·지점 관리
├── layouts/
│   └── AppLayout.jsx           # 하단 네비게이션 (역할별), 알림 뱃지
├── pages/
│   ├── Login.jsx
│   ├── owner/
│   │   ├── Dashboard.jsx       # 대시보드 (재고가치·미승인·경과경고)
│   │   ├── Orders.jsx          # 주문 승인·취소
│   │   ├── Inventory.jsx       # 재고 현황 (FIFO 배치)
│   │   ├── PurchaseStats.jsx   # 매입 통계
│   │   ├── Settlement.jsx      # 월말 정산 확정·입금처리
│   │   └── Settings.jsx        # 거래처·상품·지점 관리
│   ├── manager/
│   │   ├── NewOrder.jsx        # 신규 주문 (개수 단위 입력)
│   │   ├── MyOrders.jsx        # 내 주문 현황
│   │   └── BranchStatus.jsx    # 타지점 현황 (읽기 전용)
│   └── staff/
│       ├── Orders.jsx          # 주문 출고 (실중량 입력 + FIFO 스캔)
│       ├── ReceivingStep1.jsx  # 매입 등록 (겹겹: 원물 / 적돈: 즉시 가공)
│       ├── ReceivingStep2.jsx  # 가공 완료 + 라벨 출력 (겹겹 숙성 후)
│       └── Inventory.jsx       # 재고 확인·수정·삭제 + 바코드 스캔
├── components/
│   ├── LabelPrint.jsx          # 라벨 출력 (브라더 QL-820NWB)
│   └── BarcodeScanner.jsx      # 카메라 바코드 스캔
└── utils/
    ├── fifo.js                 # FIFO 재고 차감 (브랜드 필터 + 실중량 기반)
    ├── excel.js                # 엑셀 내보내기 (SheetJS)
    ├── notifications.js        # 인앱 알림 전송
    ├── sendPush.js             # 웹 푸시 알림 (Edge Function 호출)
    └── pushNotification.js     # 브라우저 푸시 구독 등록/해제

supabase/
├── functions/
│   └── send-push/index.ts     # 웹 푸시 Edge Function (Deno)
└── migrations.sql             # DB 마이그레이션 (브랜드·주문단위 컬럼)
```

---

## 주요 DB 테이블

| 테이블 | 용도 |
|--------|------|
| `users` | 사용자 (role: owner·manager·staff) |
| `branches` | 지점 (brand: gyeobgyeob·jeokdon) |
| `products` | 상품 (order_unit: 주문단위, approx_kg_per_unit: 참고kg) |
| `suppliers` | 거래처 |
| `orders` | 주문 (pending→approved→shipped) |
| `order_items` | 주문 품목 (requested_qty: 개수, actual_weight_kg: 실중량) |
| `order_item_allocations` | FIFO 배치 할당 기록 |
| `purchases` | 매입 기록 (brand 포함) |
| `inventory_batches` | 재고 배치 (brand, status: processing·available·depleted) |
| `push_subscriptions` | 웹 푸시 구독 정보 |
| `notifications` | 인앱 알림 |
| `settlement_headers` | 정산 헤더 (draft·confirmed·paid) |
| `settlements` | 정산 라인 아이템 |

### 주요 뷰
| 뷰 | 용도 |
|----|------|
| `v_orders` | 주문 + 지점명 + 집계 |
| `v_inventory_current` | 현재 재고 + 신선도(freshness) + 경과일 |
| `v_weighted_avg_price` | 품목별 가중평균 매입단가 |
| `v_monthly_settlement` | 월별 지점 출고금액 미리보기 |
| `v_purchase_stats` | 거래처×품목별 매입 통계 |

---

## 주요 기능

| 기능 | 사장 | 점장 | 스태프 |
|------|:---:|:---:|:------:|
| 대시보드 (재고·미승인·경과경고) | ✓ | | |
| 주문 승인·취소 | ✓ | | |
| 신규 주문 (개수 단위) | | ✓ | |
| 내 주문 현황 | | ✓ | |
| 타지점 현황 | | ✓ | |
| 정산 내역 | ✓ | ✓ | |
| 정산 확정·입금처리 | ✓ | | |
| 출고 처리 (실중량 입력 + FIFO 스캔) | | | ✓ |
| 매입 등록 | | | ✓ |
| 가공 완료 + 라벨 출력 | | | ✓ |
| 재고 현황·수정 | ✓ | | ✓ |
| 매입 통계 | ✓ | | |
| 거래처·상품·지점 관리 | ✓ | | |
| 바코드 스캔 | ✓ | | ✓ |
| 엑셀 다운로드 | ✓ | | |
| 웹 푸시 알림 | ✓ | ✓ | ✓ |

---

## 라벨 프린터 설정

브라더 QL-820NWB (WiFi 연결 필요)
- 라벨 용지: 62mm 연속 테이프
- 본사 WiFi에 연결 후 브라우저 기본 인쇄로 출력
- 프린터 드라이버: 브라더 공식 사이트에서 설치
