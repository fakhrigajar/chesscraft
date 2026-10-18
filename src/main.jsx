import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource-variable/nunito';
import '@fontsource-variable/dm-sans';
import './index.css';
import './play-layout.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
