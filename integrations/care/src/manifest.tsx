import {lazy, Suspense} from 'react';
import PluginBoundary from './PluginBoundary';

const FollowUpPage = lazy(() => import('./FollowUpPage'));
const manifest = {
  plugin: 'care_wholecare_fe',
  routes: {
    '/wholecare/patient/:patientId': ({patientId}: {patientId: string}) => <PluginBoundary key={patientId}><Suspense fallback={<p>Loading WholeCare…</p>}><FollowUpPage key={patientId} patientId={patientId}/></Suspense></PluginBoundary>,
  },
  extends: [],
  components: {PatientHomeActions: lazy(() => import('./PatientHomeAction'))},
  navItems: [], userNavItems: [], adminNavItems: [], devices: [],
};
export default manifest;
