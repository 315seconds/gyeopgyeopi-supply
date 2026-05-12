-- ============================================================
-- 겹겹 공급 시스템 마이그레이션
-- Supabase SQL Editor에 붙여넣어 실행하세요
-- ============================================================

-- 1. branches: 브랜드 구분 추가 (겹겹 / 적돈)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'gyeobgyeob'
  CHECK (brand IN ('gyeobgyeob', 'jeokdon'));

-- 지점별 브랜드 수동 설정 (지점명에 맞게 수정하세요)
-- UPDATE branches SET brand = 'jeokdon' WHERE name ILIKE '%적돈%';

-- 2. products: 주문 단위 추가 (점장이 개수로 주문)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS order_unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS approx_kg_per_unit numeric(8,3);

-- 고기 품목 주문 단위 예시 (실제 값으로 수정하세요)
-- UPDATE products SET order_unit = '개', approx_kg_per_unit = 1.5 WHERE name = '목살';

-- 3. purchases: 브랜드 추가
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'gyeobgyeob'
  CHECK (brand IN ('gyeobgyeob', 'jeokdon'));

-- 4. inventory_batches: 브랜드 추가
ALTER TABLE inventory_batches
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'gyeobgyeob'
  CHECK (brand IN ('gyeobgyeob', 'jeokdon'));

-- 5. order_items: 실제 출고 중량 추가 (스태프가 저울로 측정 후 입력)
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS actual_weight_kg numeric(10,3);

-- 6. v_monthly_settlement 뷰에 branch_id 추가
--    (기존 뷰를 드롭하고 재생성 — 현재 뷰 정의에 맞게 branch_id 추가)
--    아래는 예시입니다. 실제 뷰 정의를 확인 후 branch_id를 포함하도록 수정하세요.
--
-- CREATE OR REPLACE VIEW v_monthly_settlement AS
-- SELECT
--   date_trunc('month', oi.shipped_at)::date AS settlement_month,
--   o.branch_id,
--   b.name AS branch_name,
--   p.name AS product_name,
--   p.unit,
--   SUM(oi.actual_weight_kg) AS total_qty,
--   oi.charged_price AS unit_sell_price,
--   SUM(oi.actual_weight_kg * oi.charged_price) AS total_amount
-- FROM orders o
-- JOIN order_items oi ON oi.order_id = o.id
-- JOIN products p ON p.id = oi.product_id
-- JOIN branches b ON b.id = o.branch_id
-- WHERE o.status = 'shipped'
-- GROUP BY 1, 2, 3, 4, 5, 7;

-- 기존 데이터 기본값 정합성 확인 (선택)
-- SELECT brand, count(*) FROM inventory_batches GROUP BY 1;
-- SELECT brand, count(*) FROM purchases GROUP BY 1;
