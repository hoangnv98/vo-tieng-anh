import { useContext } from 'react'
import { DataContext, type DataContextValue } from './dataContext'

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData phải nằm trong <DataProvider>')
  return ctx
}
