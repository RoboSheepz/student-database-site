// Fetch and render students from /api/students
const statusEl = document.querySelector('#status');
const table = document.querySelector('#students-table');
const tbody = table.querySelector('tbody');
const empty = document.querySelector('#empty');
const btn = document.querySelector('#btn-refresh');
const form = document.querySelector('#student-form');
const btnAdd = document.querySelector('#btn-add');

let isAdmin = false;
let currentUserId = null;

function showStatus(msg, isErr = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isErr ? 'crimson' : 'green';
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
}

async function getCurrentUser() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    isAdmin = data.user?.acct_type === 1;
    currentUserId = data.user?.id || null;
    return data.user;
  } catch {
    return null;
  }
}

async function fetchStudents() {
  try {
    await getCurrentUser();
    const res = await fetch('/api/students', { credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw err;
    }
    const data = await res.json();
    renderStudents(data.students || []);
    showStatus('Loaded');
  } catch (e) {
    // If not authenticated, show message with suggestion
    if (e && e.error === 'Not authenticated') {
      showStatus('Please login to view students', true);
    } else {
      showStatus(e.error || 'Failed to load students', true);
    }
  }
}

function renderStudents(list) {
  tbody.innerHTML = '';
  if (!list.length) {
    table.style.display = 'none';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  table.style.display = '';
  for (const s of list) {
    const tr = document.createElement('tr');
    // User ID cell: if admin and profile has no linked user, show input+link button;
    // otherwise show the linked user id (or empty for non-admins)
    let userCell = '';
    if (isAdmin) {
      if (s.user_id == null || s.user_id === '') {
        userCell = `<td>
          <input class="link-user-id" data-profile-id="${s.id}" placeholder="User ID" style="width:4.5rem" />
          <button class="btn-link" data-profile-id="${s.id}">Link</button>
        </td>`;
      } else {
        userCell = `<td>${s.user_id}</td>`;
      }
    } else {
      userCell = `<td>${s.user_id ?? ''}</td>`;
    }

    tr.innerHTML = `
      <td>${s.id ?? ''}</td>
      ${userCell}
      <td>${(s.first_name || '') + ' ' + (s.last_name || '')}</td>
      <td>${s.email || ''}</td>
      <td>${s.phone || ''}</td>
      <td>${s.city || ''}</td>
      <td>${s.state || ''}</td>
      <td>${s.country || ''}</td>
      <td>${s.acct_type ?? ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

// delegate link button clicks
tbody.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.btn-link');
  if (!btn) return;
  const profileId = btn.dataset.profileId;
  const input = btn.parentElement.querySelector('.link-user-id');
  const userId = input && input.value;
  if (!profileId || !userId) {
    showStatus('Enter a user id to link', true);
    return;
  }
  try {
    btn.disabled = true;
    const res = await fetch('/api/students/link', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: Number(profileId), user_id: Number(userId) })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw err;
    }
    showStatus('Linked');
    fetchStudents();
  } catch (e) {
    showStatus(e.error || 'Link failed', true);
  } finally {
    btn.disabled = false;
  }
});

// load on open
fetchStudents();

// Handle create student form
if (form) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.checkValidity()) return;

    const payload = {
      first_name: form.first_name.value,
      last_name: form.last_name.value,
      email: form.email.value,
      phone: form.phone.value,
      street_addr: form.street_addr.value,
      city: form.city.value,
      state: form.state.value,
      country: form.country.value,
      acct_type: Number(form.acct_type.value) || 0
    };

    try {
      btnAdd.disabled = true;
      const res = await fetch('/api/students', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }

      const data = await res.json();
      showStatus('Student added');
      form.reset();
      fetchStudents();
    } catch (e) {
      if (e && e.error === 'Not authenticated') {
        showStatus('Please login to add students', true);
      } else {
        showStatus(e.error || 'Failed to add student', true);
      }
    } finally {
      btnAdd.disabled = false;
    }
  });
}