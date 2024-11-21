import { HashRouter, BrowserRouter, Routes, Route } from 'react-router-dom'
import CognitiveMotorTask from './Task'
import SecretPage from './SecretPage'

function App() {
  // Check if we're in production (GitHub Pages)
  const isProduction = window.location.hostname.includes('github.io');
  
  // Use HashRouter for GitHub Pages, BrowserRouter for local development
  const Router = isProduction ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<CognitiveMotorTask />} />
        <Route path="/secret" element={<SecretPage />} />
      </Routes>
    </Router>
  )
}

export default App