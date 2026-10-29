import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireRole } from './components/RequireRole'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { LotPage } from './pages/LotPage'
import { NewLotPage } from './pages/NewLotPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PanelPage } from './pages/PanelPage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lotes/:id" element={<LotPage />} />
        <Route
          path="painel"
          element={
            <RequireRole role="auctioneer">
              <PanelPage />
            </RequireRole>
          }
        />
        <Route
          path="painel/novo"
          element={
            <RequireRole role="auctioneer">
              <NewLotPage />
            </RequireRole>
          }
        />
        <Route path="entrar" element={<LoginPage />} />
        <Route path="cadastro" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
