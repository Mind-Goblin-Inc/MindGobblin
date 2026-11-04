// All catalogue links work without JavaScript. These enhancements are independent.
function initializeSearch() {
  const input = document.getElementById('projectSearch');
  const projects = [...document.querySelectorAll('[data-project]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const sections = [...document.querySelectorAll('[data-section]')];
  const featured = document.getElementById('Highlights');
  const navigation = document.getElementById('categoryNav');
  const count = document.getElementById('searchCount');
  const clear = document.getElementById('clearSearch');
  const normalize = value => value.normalize('NFKD').toLocaleLowerCase().replace(/[’‘]/g, "'");
  const searchable = new Map(projects.map(project => [project, normalize(project.textContent)]));
  let announcement;

  function filter() {
    const query = normalize(input.value.trim());
    let matches = 0;
    for (const project of projects) {
      project.hidden = !searchable.get(project).includes(query);
      if (!project.hidden) matches++;
    }
    for (const group of groups) group.hidden = !group.querySelector('[data-project]:not([hidden])');
    for (const section of sections) {
      const visible = section.querySelectorAll('[data-project]:not([hidden])').length;
      section.hidden = visible === 0;
      const noun = section.id === 'Games' ? 'game' : 'project';
      section.querySelector('[data-section-count]').textContent = `${visible} ${noun}${visible === 1 ? '' : 's'}`;
    }
    featured.hidden = Boolean(query);
    navigation.hidden = Boolean(query);
    clear.hidden = !input.value;
    document.getElementById('emptySearch').hidden = matches > 0;
    clearTimeout(announcement);
    announcement = setTimeout(() => {
      count.textContent = query ? `${matches} ${matches === 1 ? 'result' : 'results'}` : `${projects.length} games & projects`;
    }, 180);
  }
  function reset() { input.value = ''; filter(); input.focus(); }
  input.addEventListener('input', filter);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) { event.preventDefault(); reset(); }
  });
  clear.addEventListener('click', reset);
  document.getElementById('resetSearch').addEventListener('click', reset);
  document.getElementById('searchPanel').hidden = false;
  window.addEventListener('pageshow', filter);
  filter();
}

function initializeAccount() {
  const dialog = document.getElementById('authDialog');
  const trigger = document.getElementById('authMenuBtn');
  const status = document.getElementById('authStatus');
  const currency = document.getElementById('currencyWrap');
  const balance = document.getElementById('clinkbitsValue');
  const claim = document.getElementById('claimClinkbitsBtn');
  const logout = document.getElementById('logoutBtn');
  const message = document.getElementById('accountMessage');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('showLoginTab');
  const registerTab = document.getElementById('showRegisterTab');
  let refreshVersion = 0;
  let nextClaimAt = null;
  let claimTimer;

  function report(text) { message.textContent = text; message.hidden = !text; }
  async function request(url, payload) {
    const response = await fetch(url, payload === undefined ? { credentials: 'same-origin' } : {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    let data = null;
    try { data = await response.json(); } catch { /* Report an unavailable service below. */ }
    if (!response.ok) throw new Error(data?.error || (response.status === 401 ? 'Invalid username or password.' : 'The account service is unavailable. Please try again.'));
    if (!data || typeof data !== 'object') throw new Error('The account service is unavailable. Please try again.');
    return data;
  }
  function updateClaim() {
    clearTimeout(claimTimer);
    if (nextClaimAt === null) return;
    const remaining = nextClaimAt - Date.now();
    claim.disabled = remaining > 0;
    claim.textContent = remaining > 0 ? 'Claimed today' : 'Claim daily';
    if (remaining > 0) claimTimer = setTimeout(updateClaim, Math.min(remaining + 50, 2147483647));
  }
  async function refresh() {
    const version = ++refreshVersion;
    try {
      const data = await request('/api/auth/me');
      if (version !== refreshVersion) return;
      document.getElementById('previewNotice').hidden = !data.preview;
      const signedIn = Boolean(data.loggedIn && data.user);
      status.hidden = !signedIn;
      status.textContent = signedIn ? data.user.username : '';
      trigger.hidden = signedIn;
      logout.hidden = !signedIn;
      currency.hidden = !signedIn;
      clearTimeout(claimTimer);
      nextClaimAt = null;
      if (!signedIn) return;
      balance.textContent = '—';
      claim.disabled = true;
      claim.textContent = 'Claim daily';
      try {
        const coins = await request('/api/clinkbits/me');
        if (version !== refreshVersion) return;
        balance.textContent = Number(coins.balance).toLocaleString();
        nextClaimAt = coins.canClaimNow ? 0 : Date.parse(coins.nextClaimUtc);
        if (!Number.isFinite(nextClaimAt)) nextClaimAt = null;
        updateClaim();
      } catch {
        if (version === refreshVersion) report('Your balance could not be loaded. Please try again later.');
      }
    } catch {
      if (version === refreshVersion) report('Account service unavailable. You can still browse and play.');
    }
  }
  function setForm(register, focus = false) {
    loginForm.hidden = register;
    registerForm.hidden = !register;
    loginTab.setAttribute('aria-pressed', String(!register));
    registerTab.setAttribute('aria-pressed', String(register));
    for (const id of ['loginMsg', 'registerMsg']) document.getElementById(id).textContent = '';
    if (focus) document.getElementById(register ? 'registerUser' : 'loginUser').focus();
  }
  if (typeof dialog.showModal === 'function') {
    trigger.addEventListener('click', event => {
      event.preventDefault(); report(''); setForm(false); dialog.showModal();
    });
  }
  document.getElementById('closeAuth').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')]
      .filter(control => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  dialog.addEventListener('close', () => {
    loginForm.querySelector('[type=password]').value = '';
    registerForm.querySelector('[type=password]').value = '';
    if (!trigger.hidden) trigger.focus();
  });
  loginTab.addEventListener('click', () => setForm(false, true));
  registerTab.addEventListener('click', () => setForm(true, true));
  for (const [form, endpoint, prefix] of [[loginForm, 'login', 'login'], [registerForm, 'register', 'register']]) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('[type=submit]');
      const feedback = document.getElementById(`${prefix}Msg`);
      submit.disabled = true;
      feedback.classList.remove('ok');
      feedback.textContent = endpoint === 'login' ? 'Logging in…' : 'Creating your account…';
      try {
        await request(`/api/auth/${endpoint}`, {
          username: document.getElementById(`${prefix}User`).value.trim(),
          password: document.getElementById(`${prefix}Pass`).value
        });
        report(''); await refresh();
        if (trigger.hidden) { dialog.close(); logout.focus(); }
        else { feedback.classList.add('ok'); feedback.textContent = 'Account updated. Please try logging in again.'; }
      } catch (error) { feedback.textContent = error.message; }
      finally { submit.disabled = false; }
    });
  }
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try { await request('/api/auth/logout', {}); report(''); await refresh(); if (!trigger.hidden) trigger.focus(); }
    catch (error) { report(error.message); }
    finally { logout.disabled = false; }
  });
  claim.addEventListener('click', async () => {
    claim.disabled = true;
    try { const data = await request('/api/clinkbits/claim-daily', {}); await refresh(); report(`Claimed ${data.awarded} clinkbits.`); }
    catch (error) { await refresh(); report(error.message); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && nextClaimAt !== null) updateClaim(); });
  void refresh();
}

initializeSearch();
initializeAccount();
