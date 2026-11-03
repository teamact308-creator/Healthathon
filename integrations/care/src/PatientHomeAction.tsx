import {DEMO_PATIENT_ID} from './fixture-adapter';
import './style.css';

// Structural mirror of care_fe PatientHomeActionsComponentType; never import host source.
export default function PatientHomeAction({patient, className}: {patient: {id: string}; facilityId?: string; className?: string}) {
  if (patient.id !== DEMO_PATIENT_ID) return <div className={'wc-care ' + (className ?? '')}><button className="wc-button wc-button-quiet" type="button" disabled title="A verified patient mapping is required">WholeCare setup required</button></div>;
  return <div className={'wc-care ' + (className ?? '')}><a className="wc-button" href={'/wholecare/patient/' + encodeURIComponent(patient.id)}>Open WholeCare follow-ups</a></div>;
}
