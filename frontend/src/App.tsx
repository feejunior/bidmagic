import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireRole } from './components/RequireRole'
import { HomePage } from './pages/HomePage'
import { LotRoute } from './pages/LotPage'

const AuditPage = lazy(() => import('./pages/AuditPage').then((module) => ({ default: module.AuditPage })))
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((module) => ({ default: module.HowItWorksPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const MyBidsPage = lazy(() => import('./pages/MyBidsPage').then((module) => ({ default: module.MyBidsPage })))
const NewLotPage = lazy(() => import('./pages/NewLotPage').then((module) => ({ default: module.NewLotPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const PanelPage = lazy(() => import('./pages/PanelPage').then((module) => ({ default: module.PanelPage })))
const ReceiptPage = lazy(() => import('./pages/ReceiptPage').then((module) => ({ default: module.ReceiptPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const WalletPage = lazy(() => import('./pages/WalletPage').then((module) => ({ default: module.WalletPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="lotes/:id" element={<LotRoute />} />
        <Route path="como-funciona" element={<HowItWorksPage />} />
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
        <Route
          path="carteira"
          element={
            <RequireRole role="bidder">
              <WalletPage />
            </RequireRole>
          }
        />
        <Route
          path="meus-lances"
          element={
            <RequireRole role="bidder">
              <MyBidsPage />
            </RequireRole>
          }
        />
        <Route path="comprovante/:code" element={<ReceiptPage />} />
        <Route path="auditoria/:id" element={<AuditPage />} />
        <Route path="entrar" element={<LoginPage />} />
        <Route path="cadastro" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
