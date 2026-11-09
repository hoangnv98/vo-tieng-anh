import { Link } from 'react-router-dom'
import { buttonClass } from '../components/buttonClass'
import { EmptyState } from '../components/EmptyState'
import '../components/Button.css'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Không có trang này')
  return (
    <EmptyState
      headingLevel={1}
      title="Không có trang này."
      action={
        <Link to="/" className={buttonClass('primary')}>
          Về Hôm nay
        </Link>
      }
    />
  )
}
