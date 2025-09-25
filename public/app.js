// public/app.js
const $ = sel => document.querySelector(sel);
const status = $('#status');
const notLogged = $('#not-logged-in');
const logged = $('#logged-in');
const profileDiv = $('#profile');
const secretOut = $('#secret-output');

function showStatus(msg, isError=false) {
  status.textContent = msg;
  status.style.color = isError ? 'crimson' : 'green';
  setTimeout(() => { status.textContent = ''; }, 4000);
}

async function api(path, opts = {}) {
  // include credentials so cookies are sent
  const res = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function refreshMe() {
  try {
    const res = await api('/api/me', { method: 'GET' });
    logged.style.display = '';
    notLogged.style.display = 'none';
    profileDiv.textContent = `Email: ${res.user.email}\nCreated: ${res.user.created_at}`;
  } catch (err) {
    logged.style.display = 'none';
    notLogged.style.display = '';
    profileDiv.textContent = '';
  }
}

$('#btn-register').addEventListener('click', async () => {
  const email = $('#reg-email').value;
  const password = $('#reg-password').value;
  try {
    const res = await api('/api/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    showStatus('Registered & logged in!');
    await refreshMe();
  } catch (e) {
    showStatus(e.data?.error || 'Register failed', true);
  }
});

$('#btn-login').addEventListener('click', async () => {
  const email = $('#login-email').value;
  const password = $('#login-password').value;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    showStatus('Logged in');
    await refreshMe();
  } catch (e) {
    showStatus(e.data?.error || 'Login failed', true);
  }
});

$('#btn-logout').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
    showStatus('Logged out');
    await refreshMe();
  } catch {
    showStatus('Logout failed', true);
  }
});

$('#btn-secret').addEventListener('click', async () => {
  try {
    const r = await api('/api/secret', { method: 'GET' });
    secretOut.textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    secretOut.textContent = (e.data?.error || 'Failed to fetch secret');
  }
});

// on load, check if logged in
refreshMe();
