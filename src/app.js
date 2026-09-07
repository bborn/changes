import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './react/App.jsx';

const container=document.querySelector('#app');
if(!container)throw new Error('Application root not found.');
createRoot(container).render(React.createElement(React.StrictMode,null,React.createElement(App)));
