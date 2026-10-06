// Shared configuration used by BOTH screens (board.html and vote.html).
// Replace with a restricted Ably key for this demo. Never use a root key in browser code.
const ABLY_KEY = 'PASTE_RESTRICTED_ABLY_KEY_HERE';

// One shared channel = one shared "room". Both screens connect here.
const CHANNEL_NAME = 'workshop-poll';

// The three answer choices.
const CHOICES = ['A', 'B', 'C'];

// Small helper: initialize Ably safely (returns null if library failed to load or key is invalid)
function initAbly() {
  if (typeof Ably === 'undefined') {
    console.warn('Ably library not loaded from CDN.');
    return null;
  }
  try {
    return new Ably.Realtime({ key: ABLY_KEY, autoConnect: true });
  } catch (e) {
    console.error('Failed to initialize Ably:', e);
    return null;
  }
}

// Small helper: paint the connection dot + label the same way on both pages.
function paintConnection(dotEl, labelEl, state) {
  if (!dotEl) return;
  dotEl.classList.remove('dot-connected', 'dot-waiting', 'dot-error');
  if (state === 'connected') {
    dotEl.classList.add('dot-connected');
    if (labelEl) labelEl.textContent = 'LIVE';
  } else if (state === 'failed' || state === 'suspended' || state === 'disconnected') {
    dotEl.classList.add('dot-error');
    if (labelEl) labelEl.textContent = 'CONNECTION PROBLEM';
  } else {
    dotEl.classList.add('dot-waiting');
    if (labelEl) labelEl.textContent = 'connecting…';
  }
}
