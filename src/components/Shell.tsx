import {
  CircleAlert,
  CloudOff,
  Flame,
  HardDrive,
  Home,
  Layers,
  MessageSquareText,
  Mic,
  NotebookPen,
  Settings,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { streak } from '../domain/stats'
import type { StudyDay } from '../domain/types'
import { APP_NAME } from '../hooks/usePageTitle'
import { localDay } from '../lib/dates'
import { useAuth } from '../state/useAuth'
import { useData } from '../state/useData'
import { MSG_LOAD_ERROR } from '../state/messages'
import { Button } from './Button'
import { ShellContext, type ShellContextValue } from './shellContext'
import { Spinner } from './Spinner'
import './Shell.css'

const ICON = { size: 20, strokeWidth: 1.75, 'aria-hidden': true } as const

const TOP_NAV = [
  { to: '/', label: 'Hôm nay', short: 'Hôm nay', end: true },
  { to: '/lessons', label: 'Nhật ký buổi học', short: 'Buổi học', end: false },
  { to: '/review', label: 'Thẻ ôn', short: 'Thẻ ôn', end: false },
  { to: '/patterns', label: 'Mẫu câu', short: 'Mẫu câu', end: false },
  { to: '/shadowing', label: 'Shadowing', short: 'Shadowing', end: false },
  { to: '/progress', label: 'Tiến độ', short: 'Tiến độ', end: false },
] as const

const BOTTOM_NAV = [
  { to: '/', label: 'Hôm nay', Icon: Home, end: true },
  { to: '/lessons', label: 'Buổi học', Icon: NotebookPen, end: false },
  { to: '/review', label: 'Ôn thẻ', Icon: Layers, end: false },
  { to: '/patterns', label: 'Mẫu câu', Icon: MessageSquareText, end: false },
  { to: '/shadowing', label: 'Shadowing', Icon: Mic, end: false },
] as const

function currentStreak(studyDays: StudyDay[]): number {
  return streak(studyDays, localDay(new Date())).current
}

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'shell-nav-link is-current' : 'shell-nav-link'
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'shell-tab is-current' : 'shell-tab'
}

export function Shell() {
  const { mode, user, loading } = useAuth()
  const { status, snapshot, pending, online, retry } = useData()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const prevPath = useRef(location.pathname)
  const [bottomHidden, setBottomHidden] = useState(false)
  const shellCtx = useMemo<ShellContextValue>(() => ({ setBottomBarHidden: setBottomHidden }), [])

  // Đổi route → focus main + cuộn lên đầu. So với path trước (StrictMode chạy effect 2 lần lúc mount).
  useEffect(() => {
    if (prevPath.current === location.pathname) return
    prevPath.current = location.pathname
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Toast nằm ngoài Shell (DataProvider) → báo qua biến CSS trên <html> để không chừa chỗ thanh dưới đã ẩn.
  useEffect(() => {
    const root = document.documentElement.style
    if (bottomHidden) root.setProperty('--toast-bottom-offset', '0px')
    else root.removeProperty('--toast-bottom-offset')
    return () => {
      root.removeProperty('--toast-bottom-offset')
    }
  }, [bottomHidden])

  const streakDays = useMemo(() => (snapshot ? currentStreak(snapshot.studyDays) : 0), [snapshot])

  if (mode === 'supabase' && !loading && !user) {
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  const name =
    snapshot?.settings.display_name.trim() ||
    (user?.email ? (user.email.split('@')[0] ?? '') : '') ||
    'Bạn'

  const chips = (
    <>
      {mode === 'local' && (
        <span className="shell-chip shell-chip--narrow" title="Cục bộ">
          <HardDrive {...ICON} size={16} />
          <span className="shell-chip-text">Cục bộ</span>
        </span>
      )}
      {mode === 'supabase' && !online && (
        <span className="shell-chip shell-chip--compact" title="Ngoại tuyến">
          <WifiOff {...ICON} size={16} />
          <span className="shell-chip-text">Ngoại tuyến</span>
        </span>
      )}
      {mode === 'supabase' && pending.size > 0 && (
        <span className="shell-chip shell-chip--compact" title={`Chưa đồng bộ · ${pending.size}`}>
          <CloudOff {...ICON} size={16} />
          <span className="shell-chip-text">Chưa đồng bộ · {pending.size}</span>
          <span className="shell-chip-short" aria-hidden="true">
            {pending.size}
          </span>
        </span>
      )}
    </>
  )

  let content
  if (status === 'loading') {
    content = (
      <div className="shell-state">
        <Spinner label="Đang mở vở…" />
      </div>
    )
  } else if (status === 'error') {
    content = (
      <div className="shell-state">
        <div className="card shell-error">
          <p className="shell-error-text">
            <CircleAlert {...ICON} className="shell-error-icon" />
            <span>{MSG_LOAD_ERROR}</span>
          </p>
          <Button onClick={retry}>Thử lại</Button>
        </div>
      </div>
    )
  } else {
    content = <Outlet />
  }

  return (
    <ShellContext.Provider value={shellCtx}>
      <div className="shell" data-review-active={bottomHidden ? '' : undefined}>
        <a href="#main" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        <header className="shell-top">
          <div className="shell-top-inner">
            <Link to="/" className="shell-brand">
              {APP_NAME}
            </Link>
            <nav className="shell-nav" aria-label="Điều hướng chính">
              <ul>
                {TOP_NAV.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end} className={navClass}>
                      <span className="shell-label-full">{n.label}</span>
                      <span className="shell-label-short">{n.short}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="shell-right">
              <div className="shell-chips">{chips}</div>
              <Link to="/progress" className="shell-streak">
                <span className="shell-streak-full">
                  <span className="shell-streak-name">{name}</span>
                  <span className="shell-streak-days"> · chuỗi {streakDays} ngày</span>
                </span>
                <span className="shell-streak-short">
                  <Flame {...ICON} size={16} />
                  <span>
                    <span className="shell-streak-word">chuỗi </span>
                    {streakDays}
                  </span>
                </span>
              </Link>
              <Link to="/settings" className="shell-icon-btn" aria-label="Cài đặt">
                <Settings {...ICON} />
              </Link>
            </div>
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="shell-main">
          {content}
        </main>
        <nav className="shell-bottom" aria-label="Điều hướng chính">
          <ul>
            {BOTTOM_NAV.map(({ to, label, Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={tabClass}>
                  <Icon {...ICON} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ShellContext.Provider>
  )
}
