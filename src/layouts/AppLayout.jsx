import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'

const NAV = {
  owner: [
    { path: '/owner',            label: '대시보드', icon: IconHome },
    { path: '/owner/orders',     label: '주문승인', icon: IconOrder, badge: true },
    { path: '/owner/inventory',  label: '재고현황', icon: IconBox },
    { path: '/owner/stats',      label: '매입통계', icon: IconChart },
    { path: '/owner/settlement', label: '정산',     icon: IconReceipt },
  ],
  manager: [
    { path: '/manager/order-new',    label: '신규주문',    icon: IconPlus },
    { path: '/manager/orders',       label: '내 주문',     icon: IconOrder },
    { path: '/manager/branches',     label: '타지점현황',  icon: IconBranch },
    { path: '/manager/settlement',   label: '정산내역',    icon: IconReceipt },
  ],
  staff: [
    { path: '/staff/orders',         label: '주문출고',    icon: IconOrder, badge: true },
    { path: '/staff/receive1',       label: '매입등록',    icon: IconInbox },
    { path: '/staff/receive2',       label: '가공완료',    icon: IconTag },
    { path: '/staff/inventory',      label: '재고확인',    icon: IconBox },
  ],
}

export default function AppLayout({ children }) {
  const { profile, role, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [unread, setUnread] = useState(0)
  const [pendingOrders, setPendingOrders] = useState(0)

  useEffect(() => {
    if (!profile) return
    fetchCounts()

    // 실시간 알림 구독
    const ch = supabase
      .channel('notifications')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchCounts()
      )
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [profile])

  async function fetchCounts() {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setUnread(count ?? 0)

    if (role === 'owner') {
      const { count: pc } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      setPendingOrders(pc ?? 0)
    }
    if (role === 'staff') {
      const { count: pc } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
      setPendingOrders(pc ?? 0)
    }
  }

  const navItems = NAV[role] ?? []

  return (
    <div className="app-shell">
      {/* 상단 영역: 페이지가 자체 top-bar를 가지면 여기선 렌더 안함 */}
      <main>{children}</main>

      {/* 하단 네비게이션 */}
      <nav className="bottom-nav">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/owner' && item.path !== '/manager' && location.pathname.startsWith(item.path))
          const showBadge = item.badge && pendingOrders > 0
          return (
            <button
              key={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {showBadge && <span className="nav-badge" />}
              <item.icon />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ── SVG 아이콘들 ──────────────────────────────────────────
function IconHome() {
  return <svg viewBox="0 0 24 24"><path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconOrder() {
  return <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconBox() {
  return <svg viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14L4 17m8-10v14" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconChart() {
  return <svg viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconReceipt() {
  return <svg viewBox="0 0 24 24"><path d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconPlus() {
  return <svg viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconBranch() {
  return <svg viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-3a1 1 0 011-1h2a1 1 0 011 1v3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconInbox() {
  return <svg viewBox="0 0 24 24"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconTag() {
  return <svg viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
