import { useEffect, useRef, useState } from 'react'

/**
 * 카메라로 바코드 스캔하는 컴포넌트
 * onScan(code: string) 콜백으로 결과 전달
 *
 * 라이브러리: ZXing (CDN 로드 방식)
 * 실제 프로덕션에서는 @zxing/library npm 패키지 사용 권장
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef  = useRef(null)
  const [error, setError]   = useState(null)
  const [manual, setManual] = useState('')
  const [mode, setMode]     = useState('camera') // 'camera' | 'manual'

  useEffect(() => {
    if (mode !== 'camera') return
    let codeReader = null

    async function startScan() {
      try {
        // ZXing 동적 로드 (번들 크기 절약)
        const { BrowserMultiFormatReader } = await import(
          'https://unpkg.com/@zxing/library@0.19.1/esm/index.js'
        ).catch(() => ({ BrowserMultiFormatReader: null }))

        if (!BrowserMultiFormatReader) {
          // ZXing 로드 실패 시 수동 입력 모드로 전환
          setMode('manual')
          return
        }

        codeReader = new BrowserMultiFormatReader()
        const devices = await codeReader.listVideoInputDevices()
        // 후면 카메라 우선
        const device = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.includes('0,')
        ) ?? devices[0]

        if (!device) { setError('카메라를 찾을 수 없습니다'); return }

        codeReader.decodeFromVideoDevice(device.deviceId, videoRef.current, (result, err) => {
          if (result) {
            onScan(result.getText())
            codeReader.reset()
          }
        })
      } catch (e) {
        setError('카메라 접근 권한이 필요합니다')
        setMode('manual')
      }
    }

    startScan()
    return () => { codeReader?.reset() }
  }, [mode])

  function handleManualSubmit(e) {
    e.preventDefault()
    if (manual.trim()) {
      onScan(manual.trim())
      setManual('')
    }
  }

  if (mode === 'manual' || error) {
    return (
      <div className="card">
        {error && <div className="alert alert-warning" style={{ marginBottom: '12px' }}>{error}</div>}
        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
          바코드 번호를 직접 입력하세요
        </p>
        <form onSubmit={handleManualSubmit}>
          <div className="form-group">
            <input
              className="form-input"
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder="배치코드 입력 (예: 20260402-목살-001)"
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary btn-full">확인</button>
            {onClose && <button type="button" className="btn btn-full" onClick={onClose}>취소</button>}
          </div>
        </form>
        <button
          className="btn btn-full"
          style={{ marginTop: '8px' }}
          onClick={() => { setError(null); setMode('camera') }}
        >
          카메라로 전환
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', background: '#000', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: '12px' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', display: 'block', maxHeight: '280px', objectFit: 'cover' }}
          muted
          playsInline
        />
        {/* 스캔 가이드라인 */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '70%', height: '60px',
            border: '2px solid rgba(255,255,255,0.7)',
            borderRadius: '4px',
          }} />
        </div>
        <p style={{
          position: 'absolute', bottom: '10px', left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '12px',
        }}>
          바코드를 사각형 안에 맞춰주세요
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-full" onClick={() => setMode('manual')}>직접 입력</button>
        {onClose && <button className="btn btn-full" onClick={onClose}>취소</button>}
      </div>
    </div>
  )
}
