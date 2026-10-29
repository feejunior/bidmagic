import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireRole } from './components/RequireRole'
import { AuditPage } from './pages/AuditPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { LotPage } from './pages/LotPage'
import { MyBidsPage } from './pages/MyBidsPage'
import { NewLotPage } from './pages/NewLotPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PanelPage } from './pages/PanelPage'
import { ReceiptPage } from './pages/ReceiptPage'
import { RegisterPage } from './pages/RegisterPage'
import { WalletPage } from './pages/WalletPage'

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
