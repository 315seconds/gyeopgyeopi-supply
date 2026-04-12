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
    <div className="login-screen">
      <div style={{ textAlign: 'center' }}>
        <div className="login-logo-box">
          <img src="/gyeopgyeopi-supply/logo.png" alt="겹겹" />
        </div>
        <p className="login-tagline">
          가족처럼, 편안하게<br />
          공급관리 시스템
        </p>
      </div>

      <div className="login-card">
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
            style={{ height: '48px', fontSize: '15px' }}
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
