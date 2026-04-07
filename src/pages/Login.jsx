import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) setError('이메일 또는 비밀번호를 확인해주세요')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg2)',
    }}>
      {/* 로고 */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', background: 'var(--text)',
          borderRadius: '14px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 12px',
        }}>
          <span style={{ fontSize: '28px', color: '#fff' }}>겹</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>겹겹이 공급관리</h1>
        <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>본사 · 지점 통합 식재료 관리 시스템</p>
      </div>

      {/* 폼 */}
      <div className="card" style={{ width: '100%', maxWidth: '360px' }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">비밀번호</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ height: '46px', fontSize: '15px' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '20px' }}>
        계정 문의: 본사 관리자에게 연락하세요
      </p>
    </div>
  )
}
