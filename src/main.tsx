import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/theme.css'

const root = document.getElementById('root')

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

// Tell preload script to remove loading screen
postMessage({ payload: 'removeLoading' }, '*') 