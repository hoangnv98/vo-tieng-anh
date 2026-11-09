import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from './router'
import { AuthProvider } from './state/AuthProvider'
import { DataProvider } from './state/DataProvider'

/** Providers (Auth → Data) bọc RouterProvider; router tạo một lần. */
export default function App() {
  const [router] = useState(createAppRouter)
  return (
    <AuthProvider>
      <DataProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </DataProvider>
    </AuthProvider>
  )
}
