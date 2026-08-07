import { useState } from 'react'
import { PROP_DEFS, type PropKind } from '../scene/propFx'

interface SideFxRailProps {
  side: 'left' | 'right'
  disabled?: boolean
  onLaunch: (kind: PropKind, side: 'left' | 'right') => void
}

function storageKey(side: 'left' | 'right') {
  return `night-booth-fx-rail-collapsed-${side}`
}

function readCollapsed(side: 'left' | 'right'): boolean {
  try {
    return sessionStorage.getItem(storageKey(side)) === '1'
  } catch {
    return false
  }
}

export function SideFxRail({ side, disabled, onLaunch }: SideFxRailProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(side))

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        sessionStorage.setItem(storageKey(side), next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside
      className={`fx-rail fx-rail--${side}${collapsed ? ' is-collapsed' : ''}`}
      aria-label={`${side} stage props`}
    >
      <button
        type="button"
        className="fx-rail__toggle"
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand Toss' : 'Collapse Toss'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle()
        }}
      >
        <span className="fx-rail__label">Toss</span>
        <span className="fx-rail__chevron" aria-hidden>
          {collapsed ? (side === 'left' ? '›' : '‹') : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div className="fx-rail__stack">
          {PROP_DEFS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="fx-rail__btn"
              title={p.hint}
              disabled={disabled}
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onLaunch(p.id, side)
              }}
            >
              <span className="fx-rail__glyph" aria-hidden>
                {glyph(p.id)}
              </span>
              <span className="fx-rail__name">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

function glyph(kind: PropKind): string {
  switch (kind) {
    case 'champagne':
      return 'Bt'
    case 'vinyl':
      return '◎'
    case 'cocktail':
      return '∪'
    case 'can':
      return '▣'
    case 'mic':
      return '♩'
    case 'phone':
      return '▭'
    case 'cash':
      return '$'
    case 'shades':
      return '▓▓'
    case 'hat':
      return '∩'
    case 'ball':
      return '○'
    case 'horn':
      return '≫'
    case 'glowstick':
      return '|'
    case 'disco':
      return '✦'
    case 'bass':
      return '))))'
    case 'lighter':
      return '·'
    case 'confetti':
      return '∴'
  }
}
