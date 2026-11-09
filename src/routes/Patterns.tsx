import { BedDouble, Briefcase, Hand, MapPin, MessageCircle, Phone, Plane, ShoppingBag, User, Utensils, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../components/PageTitle'
import { SITUATIONS } from '../data/patterns'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../state/useData'
import './Patterns.css'

const ICONS: Record<string, LucideIcon> = { Hand, User, Utensils, MapPin, ShoppingBag, Briefcase, Phone, Plane, BedDouble }

function situationIcon(name: string): LucideIcon {
  return ICONS[name] ?? MessageCircle
}

export default function Patterns() {
  usePageTitle('Mẫu câu')
  const { snapshot } = useData()
  const added = new Set<string>()
  for (const i of snapshot?.items ?? []) if (i.pattern_id) added.add(i.pattern_id)

  return (
    <section className="patterns" aria-labelledby="patterns-title">
      <header className="patterns-head">
        <PageTitle id="patterns-title">Mẫu câu tình huống</PageTitle>
        <p className="patterns-desc">
          Câu ngắn A1–A2 theo tình huống thật. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay.
        </p>
      </header>
      <ul className="card patterns-list">
        {SITUATIONS.map((s) => {
          const Icon = situationIcon(s.icon)
          const total = s.patterns.length
          const done = s.patterns.filter((p) => added.has(p.id)).length
          return (
            <li key={s.id}>
              <Link to={`/patterns/${s.id}`} className="pattern-row">
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" className="pattern-row-icon" />
                <span className="pattern-row-names">
                  <span className="pattern-row-vi">{s.nameVi}</span>
                  <span className="pattern-row-en" lang="en">
                    {s.nameEn}
                  </span>
                </span>
                <span className="pattern-row-count">{done > 0 ? `${done}/${total} đã thêm` : `${total} câu`}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
