import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/auth/RequireAuth'
import { PublicHomePage } from './pages/PublicHomePage'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './pages/dashboard/DashboardLayout'
import { DashboardAccessGate } from './pages/dashboard/DashboardAccessGate'
import { DashboardHome } from './pages/dashboard/DashboardHome'
import {
  AccessView,
  AiView,
  AnalyticsView,
  CollectionsView,
  EventsView,
  GovernanceView,
  InstitutionsView,
  NetworksView,
  OwlView,
  PersonsView,
  ResourcesView,
} from './pages/dashboard/dashboardViews'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route element={<DashboardAccessGate />}>
            <Route index element={<DashboardHome />} />
            <Route path="resources" element={<ResourcesView />} />
            <Route path="collections" element={<CollectionsView />} />
            <Route path="institutions" element={<InstitutionsView />} />
            <Route path="networks" element={<NetworksView />} />
            <Route path="events" element={<EventsView />} />
            <Route path="persons" element={<PersonsView />} />
            <Route path="ai" element={<AiView />} />
            <Route path="owl" element={<OwlView />} />
            <Route path="analytics" element={<AnalyticsView />} />
            <Route path="governance" element={<GovernanceView />} />
            <Route path="access" element={<AccessView />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
