import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Fix AuthProvider context issue

createRoot(document.getElementById("root")!).render(<App />);
