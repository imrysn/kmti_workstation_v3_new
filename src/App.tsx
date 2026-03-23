import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitleBar from './components/TitleBar'
import PurchasedParts from './pages/PurchasedParts'
import CharacterSearch from './pages/CharacterSearch'
import HeatTreatment from './pages/HeatTreatment'
import MaterialCalculator from './pages/MaterialCalculator'
import Settings from './pages/Settings'
import { ModalProvider } from './components/ModalContext'
import { ModalContainer } from './components/Modals'
import './styles/App.css'

function App() {
  return (
    <ModalProvider>
      <BrowserRouter>
        <div className="app-shell">
          <TitleBar />
          <div className="app-body">
            <main className="app-content">
              <Routes>
                <Route path="/" element={<Navigate to="/parts" replace />} />
                <Route path="/parts" element={<PurchasedParts />} />
                <Route path="/characters" element={<CharacterSearch />} />
                <Route path="/heat-treatment" element={<HeatTreatment />} />
                <Route path="/calculator" element={<MaterialCalculator />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </div>
        <ModalContainer />
      </BrowserRouter>
    </ModalProvider>
  )
}

export default App
