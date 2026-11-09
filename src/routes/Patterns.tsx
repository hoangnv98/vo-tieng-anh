import { BedDouble, Briefcase, Hand, MapPin, MessageCircle, Phone, Plane, ShoppingBag, User, Utensils, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../components/PageTitle'
import type { Situation } from '../data/patterns'
import { asStudyLanguage, LANG_TAG, LANGUAGE_LABELS } from '../domain/language'
import { usePageTitle } from '../hooks/usePageTitle'
import { useData } from '../state/useData'
import { situationGroups, situationTargetName } from './situationGroups'
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
  // (T20) Lọc theo "Ngôn ngữ đang học"; Tất cả → nhóm theo ngôn ngữ, mỗi nhóm một card có heading.
  const filter = asStudyLanguage(snapshot?.settings.study_language)
  const groups = situationGroups(filter)
  const grouped = filter === 'all' && groups.length > 1

  return (
    <section className="patterns" aria-labelledby="patterns-title">
      <header className="patterns-head">
        <PageTitle id="patterns-title">Mẫu câu tình huống</PageTitle>
        <p className="patterns-desc">
          Câu ngắn theo tình huống thật, bằng ngôn ngữ bạn đang học. Thêm câu bạn cần vào thẻ ôn, hoặc luyện shadowing ngay.
        </p>
      </header>
      {grouped ? (
        groups.map((g) => (
          <section key={g.language} className="card patterns-group" aria-labelledby={`patterns-${g.language}`}>
            <h2 id={`patterns-${g.language}`} className="patterns-group-title">
              {LANGUAGE_LABELS[g.language]}
            </h2>
            <SituationList situations={g.situations} added={added} />
          </section>
        ))
      ) : (
        <div className="card patterns-group">
          <SituationList situations={groups[0]?.situations ?? []} added={added} />
        </div>
      )}
    </section>
  )
}

function SituationList({ situations, added }: { situations: Situation[]; added: Set<string> }) {
  return (
    <ul className="patterns-list">
      {situations.map((s) => {
        const Icon = situationIcon(s.icon)
        const total = s.patterns.length
        const done = s.patterns.filter((p) => added.has(p.id)).length
        return (
          <li key={s.id}>
            <Link to={`/patterns/${s.id}`} className="pattern-row">
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" className="pattern-row-icon" />
              <span className="pattern-row-names">
                <span className="pattern-row-vi">{s.nameVi}</span>
                <span className="pattern-row-en" lang={LANG_TAG[s.language]}>
                  {situationTargetName(s)}
                </span>
              </span>
              <span className="pattern-row-count">{done > 0 ? `${done}/${total} đã thêm` : `${total} câu`}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
