// public/app.js
const $ = sel => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {

  const status         = $('#status');
  const notLogged      = $('#not-logged-in');
  const logged         = $('#logged-in');
  const profileDiv     = $('#profile');
  const secretOut      = $('#secret-output');
  const adminLink      = $('#admin-link');
  const studentsLink   = $('#students-link');
  const pwInput        = $('#reg-password');
  const pwLabel        = $('#pw-label');
  const pwTime         = $('#pw-time');
  const acctSelect     = $('#reg-acct-type');
  const studentIdInput = $('#reg-student-id');
  const inviteInput    = $('#reg-invite-code');

  function showStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? 'crimson' : 'green';
    setTimeout(() => { status.textContent = ''; }, 4000);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  // ====================== REGISTER ======================
  $('#btn-register').addEventListener('click', async () => {
    const email       = $('#reg-email').value.trim();
    const password    = $('#reg-password').value;
    const acct_type   = Number($('#reg-acct-type').value || 0);
    const student_id  = $('#reg-student-id')?.value || undefined;
    const invite_code = $('#reg-invite-code')?.value || undefined;

    if (!email || !password) {
      showStatus('Please fill email and password', true);
      return;
    }
    if (acct_type === 1 && !invite_code) {
      showStatus('Invite code required for admin registration', true);
      return;
    }

    try {
      const payload = { email, password, acct_type };
      if (acct_type === 0 && student_id) payload.student_id = student_id;
      if (acct_type === 1 && invite_code) payload.invite_code = invite_code;

      await api('/api/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showStatus('Registered & logged in!');
      await refreshMe();
    } catch (e) {
      showStatus(e.data?.error || 'Register failed', true);
    }
  });

  // ====================== PASSWORD STRENGTH ======================
  function estimateEntropy(pw) {
    if (!pw) return 0;
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^A-Za-z0-9]/.test(pw)) pool += 33;

    const uniqueChars = new Set(pw).size;
    const length = pw.length;
    const bitsPerChar = pool > 0 ? Math.log2(pool) : 0;
    let entropy = bitsPerChar * length;

    if (uniqueChars / length < 0.5) entropy *= 0.8;
    if (length >= 12) entropy *= 1.05;
    if (length >= 20) entropy *= 1.1;

    return Math.max(0, Math.round(entropy));
  }

  function timeToCrackSeconds(entropy) {
    const guesses = Math.pow(2, entropy);
    return guesses / 1e10; // 10 billion guesses/sec
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec > 3.154e16) return 'centuries';
    if (sec < 1) return `${Math.round(sec * 1000)} ms`;
    if (sec < 60) return `${Math.round(sec)} s`;
    const mins = sec / 60;
    if (mins < 60) return `${Math.round(mins)} m`;
    const hours = mins / 60;
    if (hours < 24) return `${Math.round(hours)} h`;
    const days = hours / 24;
    if (days < 365) return `${Math.round(days)} d`;
    const years = days / 365;
    if (years < 1000) return `${Math.round(years)} y`;
    return 'centuries';
  }

  function strengthLabel(entropy) {
    if (entropy < 28)  return { label: 'Very Weak',   color: 'crimson' };
    if (entropy < 36)  return { label: 'Weak',       color: 'orangered' };
    if (entropy < 60)  return { label: 'Reasonable', color: 'orange' };
    if (entropy < 128) return { label: 'Strong',     color: 'green' };
    return                     { label: 'Very Strong',color: 'darkgreen' };
  }

  function updatePasswordUI() {
    const pw = pwInput?.value || '';
    const entropy = estimateEntropy(pw);
    const tt = timeToCrackSeconds(entropy);
    const result = strengthLabel(entropy);   // ← fixed: now we actually get the object

    if (pwLabel) {
      pwLabel.textContent = pw ? `Strength: ${result.label}` : '';
      pwLabel.style.color = result.color;
      pwLabel.classList.toggle('hidden', !pw);
    }
    if (pwTime) {
      pwTime.textContent = pw ? `Time to crack: ${formatTime(tt)}` : '';
      pwTime.classList.toggle('hidden', !pw);
    }
  }

  if (pwInput) pwInput.addEventListener('input', updatePasswordUI);
  updatePasswordUI();

  // ====================== ACCOUNT TYPE TOGGLE ======================
  function updateRegisterFields() {
    const val = Number(acctSelect?.value || 0);
    if (val === 1) {
      studentIdInput?.classList.add('hidden');
      inviteInput?.classList.remove('hidden');
    } else {
      studentIdInput?.classList.remove('hidden');
      inviteInput?.classList.add('hidden');
    }
  }
  if (acctSelect) {
    acctSelect.addEventListener('change', updateRegisterFields);
    updateRegisterFields();
  }

  // ====================== LOGIN ======================
  $('#btn-login').addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;

    if (!email || !password) {
      showStatus('Please fill all fields', true);
      return;
    }

    try {
      await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      showStatus('Logged in');
      await refreshMe();
    } catch (e) {
      showStatus(e.data?.error || 'Login failed', true);
    }
  });

  // ====================== LOGOUT ======================
  $('#btn-logout').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      showStatus('Logged out');
      await refreshMe();
    } catch {
      showStatus('Logout failed', true);
    }
  });

  // ====================== SECRET ======================
  $('#btn-secret').addEventListener('click', async () => {
    try {
      const r = await api('/api/secret');
      secretOut.textContent = JSON.stringify(r, null, 2);
    } catch (e) {
      secretOut.textContent = e.data?.error || 'Failed to fetch secret';
    }
  });

  // ====================== REFRESH ME ======================
  async function refreshMe() {
    try {
      const res = await api('/api/me');
      logged.classList.remove('hidden');
      notLogged.classList.add('hidden');
      const role = res.user.acct_type === 1 ? 'admin' : 'student';
      profileDiv.textContent = `Email: ${res.user.email}\nRole: ${role}\nCreated: ${res.user.created_at}`;

      if (studentsLink) studentsLink.classList.remove('hidden');
      if (res.user.acct_type === 1 && adminLink) adminLink.classList.remove('hidden');
    } catch {
      logged.classList.add('hidden');
      notLogged.classList.remove('hidden');
      profileDiv.textContent = '';
      if (adminLink) adminLink.classList.add('hidden');
      if (studentsLink) studentsLink.classList.add('hidden');
    }
  }

  // Initial check
  refreshMe();
});