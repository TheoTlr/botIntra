import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import QRScannerApp from "./qrScanner.tsx";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QRScannerApp />
  </StrictMode>,
)
