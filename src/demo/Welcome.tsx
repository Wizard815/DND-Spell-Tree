// The first-launch popup: what the app is, in about fifty words.
import { useState } from 'react';
import { APP_NAME } from '../name.ts';

const KEY = 'spelltree.welcome.v1';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export default function Welcome({ demo }: { demo: boolean }) {
  const [show, setShow] = useState(() => !seen());
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ } setShow(false); };
  return (
    <div className="welcome-back" role="presentation" onClick={close}>
      <div className="welcome card" role="dialog" aria-modal="true" aria-labelledby="welcome-h" onClick={(e) => e.stopPropagation()}>
        <h2 id="welcome-h"><span aria-hidden="true">✦</span> {APP_NAME}</h2>
        <p>{APP_NAME} swaps spell slots for a mana pool, and learning spells becomes study on downtime days. Spells sit in bubbles along each school's path: learn one to open the next. Gold you know, grey you can study, dark is out of reach. Tap a spell for its cost and what learning it takes. Ask the helper anything.</p>
        {demo && <p className="muted tiny">This demo has a party of three: Lyra (wizard 5), Brother Oren (cleric 5) and Kael (paladin 6). Switch between them at the top right. Nothing you do here leaves this device.</p>}
        <button type="button" className="primary" onClick={close} autoFocus>Start</button>
      </div>
    </div>
  );
}
