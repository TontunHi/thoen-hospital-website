import React from 'react'

export function SkeletonLine({ width = '100%', height = '1rem', style = {} }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#e2e8f0',
        borderRadius: '6px',
        animation: 'skeletonPulse 1.5s infinite ease-in-out',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ height = '120px' }: { height?: string }) {
  return (
    <div
      style={{
        height,
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        animation: 'skeletonPulse 1.5s infinite ease-in-out',
      }}
    >
      <SkeletonLine width="40%" height="0.9rem" />
      <SkeletonLine width="60%" height="1.8rem" />
      <SkeletonLine width="30%" height="0.8rem" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <style>{`
        @keyframes skeletonPulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: '0.75rem 1rem' }}>
                <SkeletonLine height="1rem" width="80%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} style={{ padding: '1rem' }}>
                  <SkeletonLine height="1rem" width={colIdx === 0 ? '60%' : colIdx === 2 ? '90%' : '75%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
