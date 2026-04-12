import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { registerPush } from '../utils/pushNotification'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)  // users 테이블 row
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(uid) {
    const { data } = await supabase
      .from('users')
      .select('*, branches(name)')
      .eq('id', uid)
      .single()
    setProfile(data)
    setLoading(false)
    // 로그인 시 푸시 알림 자동 등록 (백그라운드)
    if (data) registerPush(uid).catch(() => {})
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    profile,
    loading,
    role: profile?.role ?? null,        // 'owner' | 'staff' | 'manager'
    branchId: profile?.branch_id ?? null,
    branchName: profile?.branches?.name ?? null,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
