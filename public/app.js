// public/app.js
const $ = sel => document.querySelector(sel);
const status = $('#status');
const notLogged = $('#not-logged-in');
const logged = $('#logged-in');
const profileDiv = $('#profile');
const secretOut = $('#secret-output');
const adminLink = $('#admin-link');
const studentsLink = $('#students-link');

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

$('#btn-register').addEventListener('click', async () => {
  const email = $('#reg-email').value;
  const password = $('#reg-password').value;
  const acct_type = Number($('#reg-acct-type').value || 0);
  const student_id = $('#reg-student-id') ? $('#reg-student-id').value : undefined;
  const invite_code = $('#reg-invite-code') ? $('#reg-invite-code').value : undefined;

  // If admin selected, require invite code client-side for better UX
  if (acct_type === 1 && !invite_code) {
    showStatus('Invite code required for admin registration', true);
    return;
  }

  try {
    const payload = { email, password, acct_type };
    if (acct_type === 0 && student_id) payload.student_id = student_id;
    if (acct_type === 1 && invite_code) payload.invite_code = invite_code;

    const res = await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
    showStatus('Registered & logged in!');
    await refreshMe();
  } catch (e) {
    showStatus(e.data?.error || 'Register failed', true);
  }
});

// Toggle visibility of student id vs invite code based on acct type
const acctSelect = $('#reg-acct-type');
const studentIdInput = $('#reg-student-id');
const inviteInput = $('#reg-invite-code');

function updateRegisterFields() {
  const val = Number(acctSelect.value || 0);
  if (val === 1) { // admin
    studentIdInput.style.display = 'none';
    inviteInput.style.display = '';
  } else {
    studentIdInput.style.display = '';
    inviteInput.style.display = 'none';
  }
}
acctSelect.addEventListener('change', updateRegisterFields);
updateRegisterFields();

async function refreshMe() {
  try {
    const res = await api('/api/me', { method: 'GET' });
    logged.style.display = '';
    notLogged.style.display = 'none';
    const role = res.user.acct_type === 1 ? 'admin' : 'student';
    profileDiv.textContent = `Email: ${res.user.email}\nRole: ${role}\nCreated: ${res.user.created_at}`;
    // show links: students for all logged-in users, admin link only for admins
    if (studentsLink) studentsLink.style.display = '';
    if (adminLink) adminLink.style.display = res.user.acct_type === 1 ? '' : 'none';
  } catch (err) {
    logged.style.display = 'none';
    notLogged.style.display = '';
    profileDiv.textContent = '';
    if (adminLink) adminLink.style.display = 'none';
    if (studentsLink) studentsLink.style.display = 'none';
  }
}

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
