import {useEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {createFixtureAdapter} from './fixture-adapter';
import {stateLabel, summarize} from './model';
import type {FollowUp, WholeCareAdapter, Workspace} from './model';
import './style.css';

const date = (value: string) => new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'}).format(new Date(value)) + ' IST';

export default function FollowUpPage({patientId, adapter}: {patientId: string; adapter?: WholeCareAdapter}) {
  // The route key in the manifest remounts this page when patient identity changes.
  const [service] = useState(() => adapter ?? createFixtureAdapter());
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const mutation = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    setWorkspace(null); setError(''); setSelectedId(null); setNote(''); setMessage('');
    service.getWorkspace(patientId).then(data => {if (active) setWorkspace(data);}).catch(() => {if (active) setError('This patient is not mapped. No WholeCare data has been loaded.');});
    return () => {active = false;};
  }, [patientId, service]);
  useEffect(() => {if (selectedId) heading.current?.focus();}, [selectedId]);
  const selected = workspace?.items.find(i => i.id === selectedId);
  function select(item: FollowUp) {setSelectedId(item.id); setNote(''); setMessage('');}
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !selected || mutation.current) return;
    mutation.current = true; setPending(true); setMessage('');
    const command = {carePatientId: patientId, taskId: selected.id, eventKey: crypto.randomUUID(), expectedVersion: workspace.version, note};
    try {
      const data = selected.state === 'REVIEW_PENDING' ? await service.reviewEvidence(command) : await service.recordFollowUp(command);
      setWorkspace(data); setSelectedId(null); setNote('');
      setMessage(selected.state === 'REVIEW_PENDING' ? 'Demo review recorded. The fictional investigation loop is closed.' : 'Demo follow-up note recorded. The task is still awaiting the patient. No message was sent.');
    } catch (e) {setMessage(e instanceof Error ? e.message : 'Unable to record this demo action.');}
    finally {mutation.current = false; setPending(false);}
  }
  const stats = workspace ? summarize(workspace.items) : null;
  return <div className="wc-care">
    <header className="wc-topbar"><a href="/" className="wc-logo" aria-label="WholeCare prototype home"><span className="wc-mark" aria-hidden="true">✳</span> WholeCare<span className="wc-dot">.</span></a><span className="wc-top-label">CARE EXTENSION · CLINICIAN PREVIEW</span><span className="wc-person">DC <span>Demo clinician</span></span></header>
    <main className="wc-main">
      <div className="wc-notice"><strong>Synthetic demonstration</strong><span>Actions stay in this page and reset on reload. CARE and the shared WholeCare database are not connected.</span></div>
      {error ? <section className="wc-panel" role="alert"><h1>Patient connection required</h1><p>{error}</p><p>Use the dedicated synthetic patient to explore the prototype. A live patient requires verified identity mapping and permissions.</p></section> : !workspace || !stats ? <p role="status">Loading the synthetic care journey…</p> : <>
        <nav aria-label="Breadcrumb" className="wc-breadcrumb">Clinical workspace <span>/</span> Patient <span>/</span> Follow-ups</nav>
        <section className="wc-heading"><div><p className="wc-eyebrow">ONE SHARED CARE JOURNEY</p><h1>The next step, made clear.</h1><p className="wc-lead">Review what needs your attention and keep the patient’s care moving.</p></div><div className="wc-patient"><div className="wc-avatar">AS</div><div><strong>{workspace.patient.displayName}</strong><span>{workspace.patient.reference}</span><small>{workspace.patient.facility}</small></div></div></section>
        <div className="wc-stats" aria-label="Follow-up summary"><section><span>Care actions</span><strong>{stats.total}</strong><small>Across four care dimensions</small></section><section><span>Loops closed</span><strong>{stats.closed}<em> / {stats.total}</em></strong><small>Recorded completion or review</small></section><section><span>Needs your review</span><strong>{stats.review}</strong><small>Investigation review queue</small></section><section><span>Awaiting patient</span><strong>{stats.patient}</strong><small>Completion remains unconfirmed</small></section></div>
        <p className="wc-feedback" role="status" aria-live="polite">{message}</p>
        <div className="wc-columns"><section className="wc-journey"><div className="wc-section-heading"><h2>Patient follow-ups</h2><span>Next owner is always visible</span></div><div className="wc-task-list">{workspace.items.map(item => <article key={item.id} className={'wc-task wc-state-' + item.state.toLowerCase()}><div className="wc-task-top"><span className="wc-domain">{item.domain}</span><span className={'wc-status wc-status-' + item.state.toLowerCase()}>{stateLabel[item.state]}</span></div><h3>{item.label}</h3><p>{item.summary}</p><div className="wc-task-bottom"><span>Next owner <strong>{item.nextOwner}</strong></span><button type="button" className={item.state === 'REVIEW_PENDING' ? 'wc-button' : 'wc-button wc-button-quiet'} onClick={() => select(item)} disabled={pending}>{item.state === 'REVIEW_PENDING' ? 'Review source' : item.state === 'UNCONFIRMED' ? 'Record follow-up' : 'View source'}</button></div></article>)}</div></section>
        <aside className="wc-sidebar">{selected ? <section className="wc-panel wc-review"><div className="wc-section-heading"><h2 ref={heading} tabIndex={-1}>{selected.state === 'REVIEW_PENDING' ? 'Review the source' : selected.state === 'UNCONFIRMED' ? 'Plan the follow-up' : 'Source record'}</h2><button className="wc-close" type="button" aria-label="Close source panel" onClick={() => {setSelectedId(null); setNote('');}} disabled={pending}>×</button></div><p className="wc-domain">{selected.label}</p><blockquote>{selected.source}</blockquote><small>Recorded {date(selected.recordedAt)}</small>{selected.state !== 'CLOSED' ? <form onSubmit={confirm}><label htmlFor="wc-review-note">{selected.state === 'REVIEW_PENDING' ? 'Your review note' : 'Follow-up note'}</label><textarea id="wc-review-note" value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={1000} required rows={5} placeholder={selected.state === 'REVIEW_PENDING' ? 'Record what you checked in this synthetic workflow.' : 'Record the next practical step for the care team.'}/><p className="wc-form-hint">{selected.state === 'REVIEW_PENDING' ? 'This confirms a software rehearsal only. The fixture contains no clinical findings.' : 'This records a demo note. It does not send a reminder or confirm patient completion.'}</p><button className="wc-button" disabled={pending}>{pending ? 'Recording…' : selected.state === 'REVIEW_PENDING' ? 'Confirm demo review' : 'Save demo note'}</button></form> : <p className="wc-form-hint">This item is already complete. Reviewing its source does not change it.</p>}</section> : <section className="wc-panel wc-plan"><p className="wc-eyebrow">CLINICIAN-DIRECTED CARE</p><h2>One plan. A shared next step.</h2><p>{workspace.planSource}</p><div className="wc-plan-foot"><span aria-hidden="true">↗</span><p>Select a follow-up to inspect its source and rehearse the next action.</p></div></section>}
          <section className="wc-panel wc-trail"><p className="wc-eyebrow">THIS DEMONSTRATION</p><h2>Activity trail</h2>{workspace.trail.length ? <ol>{workspace.trail.map(entry => <li key={entry.id}><strong>{entry.action === 'report_reviewed' ? 'Investigation review recorded' : 'Follow-up note recorded'}</strong><p>{entry.note}</p><small>{entry.actor} · {date(entry.recordedAt)}</small></li>)}</ol> : <p>Confirmed demo actions will appear here with the actor, note and time.</p>}<p className="wc-trail-note">Only this browser page holds the rehearsal history.</p></section>
        </aside></div>
        <footer className="wc-footer"><span>WholeCare Diabetes · Team Act</span><span>Fixture snapshot {date(workspace.snapshotAt)}</span></footer>
      </>}
    </main>
  </div>;
}
