// Admin "View Users" + Invite generation
const statusEl = document.querySelector('#status');
const usersTable = document.querySelector('#users-table');
const usersTbody = usersTable.querySelector('tbody');
const empty = document.querySelector('#empty');
const btnRefresh = document.querySelector('#btn-refresh');
const btnGen = document.querySelector('#btn-gen-invite');
const inviteOut = document.querySelector('#invite-output');

function showStatus(msg, isErr=false) {
  statusEl.textContent = msg;
  statusEl.style.color = isErr ? 'crimson' : 'green';
  setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

async function fetchUsers() {
  try {
    const res = await fetch('/api/users', { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw err;
    }
    const data = await res.json();
    renderUsers(data.users || []);
    showStatus('Loaded');
  } catch (e) {
    showStatus(e.error || 'Failed to load users', true);
  }
}

function renderUsers(list) {
  usersTbody.innerHTML = '';
  if (!list.length) {
    usersTable.style.display = 'none';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  usersTable.style.display = '';
  for (const u of list) {
    const tr = document.createElement('tr');
    const role = u.acct_type === 1 ? 'admin' : 'student';
    tr.innerHTML = `<td>${u.id}</td><td>${u.email}</td><td>${role}</td><td>${u.created_at}</td>`;
    usersTbody.appendChild(tr);
  }
}

btnRefresh.addEventListener('click', fetchUsers);

btnGen.addEventListener('click', async () => {
  try {
    btnGen.disabled = true;
    inviteOut.textContent = '';
    const res = await fetch('/api/invites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw err;
    }
    const data = await res.json();
    inviteOut.innerHTML = `Invite code: <code class="invite">${data.code}</code>`;
    showStatus('Invite generated');
  } catch (e) {
    showStatus(e.error || 'Failed to generate invite', true);
  } finally {
    btnGen.disabled = false;
  }
});

// load on open
fetchUsers();