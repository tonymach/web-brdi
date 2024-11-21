import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import CognitiveMotorTask from './Task'
import SecretPage from './SecretPage'

function App() {
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