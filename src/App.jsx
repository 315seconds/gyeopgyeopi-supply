import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AppLayout from './layouts/AppLayout'

import Login from './pages/Login'

// Owner
import OwnerDashboard  from './pages/owner/Dashboard'
import OwnerOrders     from './pages/owner/Orders'
import OwnerInventory  from './pages/owner/Inventory'
import PurchaseStats   from './pages/owner/PurchaseStats'
import Settlement      from './pages/owner/Settlement'

// Manager
import ManagerNewOrder  from './pages/manager/NewOrder'
import ManagerMyOrders  from './pages/manager/MyOrders'
import BranchStatus     from './pages/manager/BranchStatus'
import ManagerSettlement from './pages/owner/Settlement'  // 공용

// Staff
import StaffOrders     from './pages/staff/Orders'
import ReceivingStep1  from './pages/staff/ReceivingStep1'
import ReceivingStep2  from './pages/staff/ReceivingStep2'
import StaffInventory  from './pages/staff/Inventory'

export default function App() {
  return (
    <BrowserRouter basename="/gyeopgyeopi-supply">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

function AppRoutes() {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text3)', fontSize: '14px',
      }}>
        로딩 중...
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <AppLayout>
      <Routes>
        {/* ── 사장 ── */}
        {role === 'owner' && (
          <>
            <Route path="/owner"            element={<OwnerDashboard />} />
            <Route path="/owner/orders"     element={<OwnerOrders />} />
            <Route path="/owner/inventory"  element={<OwnerInventory />} />
            <Route path="/owner/stats"      element={<PurchaseStats />} />
            <Route path="/owner/settlement" element={<Settlement />} />
            <Route path="*"                 element={<Navigate to="/owner" replace />} />
          </>
        )}

        {/* ── 점장 ── */}
        {role === 'manager' && (
          <>
            <Route path="/manager/order-new"  element={<ManagerNewOrder />} />
            <Route path="/manager/orders"     element={<ManagerMyOrders />} />
            <Route path="/manager/branches"   element={<BranchStatus />} />
            <Route path="/manager/settlement" element={<ManagerSettlement />} />
            <Route path="*"                   element={<Navigate to="/manager/order-new" replace />} />
          </>
        )}

        {/* ── 스태프 ── */}
        {role === 'staff' && (
          <>
            <Route path="/staff/orders"    element={<StaffOrders />} />
            <Route path="/staff/receive1"  element={<ReceivingStep1 />} />
            <Route path="/staff/receive2"  element={<ReceivingStep2 />} />
            <Route path="/staff/inventory" element={<StaffInventory />} />
            <Route path="*"                element={<Navigate to="/staff/orders" replace />} />
          </>
        )}

        {/* 역할 미지정 */}
        {!role && <Route path="*" element={<div className="loading">권한을 확인 중입니다...</div>} />}
      </Routes>
    </AppLayout>
  )
}
