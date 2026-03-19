import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import PurchasedParts from './pages/PurchasedParts'
import CharacterSearch from './pages/CharacterSearch'
import HeatTreatment from './pages/HeatTreatment'
import Settings from './pages/Settings'
import './styles/App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TitleBar />
        <div className="app-body">
          <Sidebar />
          <main className="app-content">
            <Routes>
              <Route path="/" element={<Navigate to="/parts" replace />} />
              <Route path="/parts" element={<PurchasedParts />} />
              <Route path="/characters" element={<CharacterSearch />} />
              <Route path="/heat-treatment" element={<HeatTreatment />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
