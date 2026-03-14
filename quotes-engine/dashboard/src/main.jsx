import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './lib/ThemeContext'
import './index.css'
import ProjectList from './pages/ProjectList'
import ProjectHUD from './pages/ProjectHUD'
import HelpPage from './pages/HelpPage'
import StatusPage from './pages/StatusPage'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/:slugHUD" element={<ProjectHUD />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
