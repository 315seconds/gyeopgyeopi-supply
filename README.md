# 겹겹이 공급관리 시스템

고기집 겹겹이 본사-지점 식재료 공급관리 웹앱  
React + Supabase + GitHub Pages

---

## 시작하기

### 1. 레포지토리 클론 후 의존성 설치
```bash
git clone https://github.com/[계정]/gyeopgyeopi-supply.git
cd gyeopgyeopi-supply
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env
```
`.env` 파일을 열어 Supabase URL과 anon key를 입력  
(Supabase Dashboard > Settings > API)

### 3. Supabase DB 세팅
Supabase Dashboard > SQL Editor 에서 `gyeopgyeopi_schema.sql` 전체 실행

### 4. 개발 서버 실행
```bash
npm run dev
```

---

## 배포 (GitHub Pages)

```bash
# vite.config.js의 base를 실제 repo 이름으로 변경 후:
npm run deploy
```

---

## 사용자 계정 생성

Supabase Dashboard > Authentication > Users 에서 이메일/비밀번호로 생성 후,  
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

## 파일 구조

```
src/
├── contexts/
│   └── AuthContext.jsx        # 로그인 상태, 역할 관리
├── layouts/
│   └── AppLayout.jsx          # 하단 네비게이션 (역할별)
├── pages/
│   ├── Login.jsx
│   ├── owner/
│   │   ├── Dashboard.jsx      # 메인 대시보드
│   │   ├── Orders.jsx         # 주문 승인
│   │   ├── Inventory.jsx      # 재고 현황 (FIFO)
│   │   ├── PurchaseStats.jsx  # 매입 통계
│   │   └── Settlement.jsx     # 월말 정산
│   ├── manager/
│   │   ├── NewOrder.jsx       # 신규 주문 요청
│   │   ├── MyOrders.jsx       # 내 주문 현황
│   │   └── BranchStatus.jsx   # 타지점 현황
│   └── staff/
│       ├── Orders.jsx         # 주문 출고 (FIFO 자동차감)
│       ├── ReceivingStep1.jsx # 매입 등록 (원물)
│       ├── ReceivingStep2.jsx # 가공 완료 + 라벨 출력
│       └── Inventory.jsx      # 재고 확인 + 바코드 스캔
├── components/
│   ├── LabelPrint.jsx         # 라벨 출력 (브라더 QL-820NWB)
│   └── BarcodeScanner.jsx     # 카메라 바코드 스캔
└── utils/
    ├── fifo.js                # FIFO 재고 차감 로직
    ├── excel.js               # 엑셀 내보내기 (SheetJS)
    └── notifications.js       # 알림 전송 헬퍼
```

---

## 주요 기능

| 기능 | 사장 | 점장 | 스태프 |
|------|:---:|:---:|:------:|
| 대시보드 (재고/미승인 현황) | ✓ | | |
| 주문 승인 | ✓ | | |
| 신규 주문 요청 | | ✓ | |
| 내 주문 현황 | | ✓ | |
| 타지점 현황 | | ✓ | |
| 출고 처리 (FIFO 자동차감) | | | ✓ |
| 매입 등록 (원물) | | | ✓ |
| 가공 완료 + 라벨 출력 | | | ✓ |
| 재고 현황 | ✓ | | ✓ |
| 매입 통계 | ✓ | | |
| 월말 정산 | ✓ | ✓ | |
| 바코드 스캔 | ✓ | | ✓ |
| 엑셀 다운로드 | ✓ | | |

---

## 라벨 프린터 설정

브라더 QL-820NWB (WiFi 연결 필요)  
- 라벨 용지: 62mm 연속 테이프  
- 본사 WiFi에 연결 후 브라우저 기본 인쇄로 출력  
- 프린터 드라이버: 브라더 공식 사이트에서 설치
