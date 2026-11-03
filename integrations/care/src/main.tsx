import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import FollowUpPage from './FollowUpPage';
import {DEMO_PATIENT_ID} from './fixture-adapter';

// Standalone preview is deliberately separate from the federated manifest entry point.
const patientId = new URLSearchParams(location.search).get('patient') ?? DEMO_PATIENT_ID;
createRoot(document.getElementById('root')!).render(<StrictMode><FollowUpPage key={patientId} patientId={patientId}/></StrictMode>);
