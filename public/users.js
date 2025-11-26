// Admin "View Users" + Invite generation
const statusEl = document.querySelector('#status');
const usersTable = document.querySelector('#users-table');
const usersTbody = usersTable.querySelector('tbody');
const empty = document.querySelector('#empty');
const btnRefresh = document.querySelector('#btn-refresh');
const btnGen = document.querySelector('#btn-gen-invite');
const inviteOut = document.querySelector('#invite-output');

// Track current logged in user to prevent self-deletion
let currentUserId = null;

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
    // Add a Delete button in Actions column. Disable it for the current user.
    const disable = currentUserId && Number(currentUserId) === Number(u.id);
    const btn = `<button class="btn-delete px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600" data-id="${u.id}" ${disable ? 'disabled title="Cannot delete your own account"' : ''}>Delete</button>`;
    tr.innerHTML = `<td>${u.id}</td><td>${u.email}</td><td>${role}</td><td>${u.created_at}</td><td>${btn}</td>`;
    usersTbody.appendChild(tr);
  }

  // Attach delete handlers
  usersTbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      if (!id) return;
      const confirmed = confirm('Delete user #' + id + '? This action cannot be undone.');
      if (!confirmed) return;
      try {
        btn.disabled = true;
        const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
          const err = await res.json().catch(()=>({}));
          throw err;
        }
        showStatus('User deleted');
        fetchUsers();
      } catch (err) {
        showStatus(err.error || 'Failed to delete user', true);
        btn.disabled = false;
      }
    });
  });
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
// Fetch current user first so we can prevent self-delete
async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    currentUserId = data.user?.id;
  } catch (e) {
    // ignore
  }
}

fetchCurrentUser().then(fetchUsers);
// fallback: if fetchCurrentUser fails quickly, ensure users are still loaded
setTimeout(() => {
  if (currentUserId === null) fetchUsers();
}, 100);