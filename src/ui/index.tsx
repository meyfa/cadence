import { createRoot } from 'react-dom/client'
import React from 'react'
import './index.css'
import { App } from './App.js'

const container = document.getElementById('root')
if (container == null) {
  throw new Error('container == null')
}

const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
