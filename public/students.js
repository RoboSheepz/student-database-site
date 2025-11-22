// public/students.js
document.addEventListener('DOMContentLoaded', () => {
  // === ELEMENTS ===
  const $ = sel => document.querySelector(sel);
  const statusEl        = $('#status');
  const table           = $('#students-table');
  const tbody           = table?.querySelector('tbody');
  const empty           = $('#empty');
  const btnRefresh      = $('#btn-refresh');
  const form            = $('#student-form');
  const btnAdd          = $('#btn-add');

  // Other sections
  const coursesTbody    = $('#courses-table')?.querySelector('tbody');
  const coursesEmpty    = $('#courses-empty');
  const enrollTbody     = $('#enroll-table')?.querySelector('tbody');
  const enrollEmpty     = $('#enroll-empty');
  const gradesTbody     = $('#grades-table')?.querySelector('tbody');
  const gradesEmpty     = $('#grades-empty');
  const booksTbody      = $('#books-table')?.querySelector('tbody');
  const booksEmpty      = $('#books-empty');

  let isAdmin = false;
  let currentUserId = null;

  // === UTILS ===
  function showStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'crimson' : 'green';
    setTimeout(() => statusEl.textContent = '', 4000);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json().catch(() => ({}))
      : await res.text();

    if (!res.ok) throw { error: data.error || data || `HTTP ${res.status}` };
    return data;
  }

  async function getCurrentUser() {
    try {
      const user = await api('/api/me');
      isAdmin = user.user?.acct_type === 1;
      currentUserId = user.user?.id || null;
      return user.user;
    } catch {
      isAdmin = false;
      currentUserId = null;
      return null;
    }
  }

  // === STUDENTS ===
  async function fetchStudents() {
    try {
      await getCurrentUser();
      const data = await api('/api/students');
      renderStudents(data.students || []);
      showStatus('Students loaded', false);
    } catch (err) {
      renderStudents([]);
      showStatus(err.error || 'Failed to load students', true);
    }
  }

  function renderStudents(list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    table.style.display = 'table';

    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition';

      let userCell = '';
      if (isAdmin && (!s.user_id || s.user_id === 'null')) {
        userCell = `
          <td class="py-3">
            <div class="flex items-center gap-2">
              <input class="link-user-id w-20 px-2 py-1 border rounded" data-profile-id="${s.id}" placeholder="User ID">
              <button class="btn-link text-xs bg-brand text-white px-3 py-1 rounded hover:bg-brand-strong" data-profile-id="${s.id}">Link</button>
            </div>
          </td>`;
      } else {
        userCell = `<td>${s.user_id || ''}</td>`;
      }

      tr.innerHTML = `
        <td class="px-6 py-4">${s.id || ''}</td>
        ${userCell}
        <td class="px-6 py-4">${(s.first_name || '') + ' ' + (s.last_name || '')}</td>
        <td class="px-6 py-4">${s.email || ''}</td>
        <td class="px-6 py-4">${s.phone || ''}</td>
        <td class="px-6 py-4">${s.city || ''}</td>
        <td class="px-6 py-4">${s.state || ''}</td>
        <td class="px-6 py-4">${s.country || ''}</td>
        <td class="px-6 py-4">${s.acct_type ?? ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Link user ID (admin only)
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-link');
    if (!btn) return;

    const profileId = btn.dataset.profileId;
    const input = btn.closest('div').querySelector('.link-user-id');
    const userId = input?.value.trim();

    if (!userId || !profileId) {
      showStatus('Enter a valid User ID', true);
      return;
    }

    try {
      btn.disabled = true;
      await api('/api/students/link', {
        method: 'POST',
        body: JSON.stringify({ profile_id: Number(profileId), user_id: Number(userId) })
      });
      showStatus('Linked successfully!');
      fetchStudents();
    } catch (err) {
      showStatus(err.error || 'Link failed', true);
    } finally {
      btn.disabled = false;
    }
  });

  // Add student
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return;

    const payload = Object.fromEntries(new FormData(form));
    payload.acct_type = Number(payload.acct_type) || 0;

    try {
      btnAdd.disabled = true;
      await api('/api/students', { method: 'POST', body: JSON.stringify(payload) });
      showStatus('Student added!');
      form.reset();
      fetchStudents();
    } catch (err) {
      showStatus(err.error || 'Failed to add student', true);
    } finally {
      btnAdd.disabled = false;
    }
  });

  // === OTHER SECTIONS (Courses, Enrollments, Grades, Books) ===
  async function fetchAndRender(url, tbodyEl, emptyEl, fields) {
    try {
      const data = await api(url);
      const list = Array.isArray(data) ? data : Object.values(data)[0] || [];
      renderTable(list, tbodyEl, emptyEl, fields);
    }czek (err) {
      if (emptyEl) emptyEl.textContent = err.error || 'Failed to load';
    }
  }

  function renderTable(list, tbodyEl, emptyEl, fieldMap) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = '';
    if (!list.length) {
      tbodyEl.closest('table').style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    tbodyEl.closest('table').style.display = 'table';

    list.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50';
      tr.innerHTML = fieldMap.map(f => `<td class="px-6 py-4">${item[f] ?? ''}</td>`).join('');
      tbodyEl.appendChild(tr);
    });
  }

  // Load all extra tables
  async function loadAll() {
    await Promise.allSettled([
      fetchAndRender('/api/courses', coursesTbody, coursesEmpty, ['id', 'title', 'units', 'start_date', 'end_date', 'instructor_id']),
      fetchAndRender('/api/courses_enrolled', enrollTbody, enrollEmpty, ['course_id', 'student_id', 'status']),
      fetchAndRender('/api/final_grades', gradesTbody, gradesEmpty, ['course_id', 'student_id', 'term', 'grade']),
      fetchAndRender('/api/textbooks', booksTbody, booksEmpty, ['id', 'title', 'price', 'quantity', 'course_id'])
    ]);
  }

  // === TOGGLE FORMS ===
  function setupToggle(btnId, containerId) {
    const btn = $(btnId);
    const container = $(containerId);
    const form = container?.querySelector('.add-form');
    if (!btn || !form) return;

    btn.textContent = 'Show';
    btn.addEventListener('click', () => {
      const hidden = form.style.display === 'none' || !form.style.display;
      form.style.display = hidden ? 'block' : 'none';
      btn.textContent = hidden ? 'Hide' : 'Show';
    });
  }

  setupToggle('#toggle-add-btn', '#add-container');
  setupToggle('#toggle-courses-btn', '#courses-content');
  setupToggle('#toggle-enroll-btn', '#enroll-content');
  setupToggle('#toggle-grades-btn', '#grades-content');
  setupToggle('#toggle-books-btn', '#books-content');

  // === ADD BUTTONS (Courses, Enrollments, etc.) ===
  function addItem(buttonId, url, fields) {
    const btn = $(buttonId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const payload = {};
      let valid = true;
      fields.forEach(f => {
        const el = $(f.id);
        if (el?.value === '' && f.required) valid = false;
        payload[f.key] = f.transform ? f.transform(el?.value) : el?.value;
      });
      if (!valid) return showStatus('Fill all fields', true);

      try {
        btn.disabled = true;
        await api(url, { method: 'POST', body: JSON.stringify(payload) });
        showStatus('Added!');
        loadAll();
      } catch (err) {
        showStatus(err.error || 'Failed', true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  addItem('#btn-add-course', '/api/courses', [
    { id: '#course-title', key: 'title' },
    { id: '#course-units', key: 'units', transform: Number },
    { id: '#course-start', key: 'start_date', transform: Number },
    { id: '#course-end', key: 'end_date', transform: Number },
    { id: '#course-instructor', key: 'instructor_id', transform: Number },
    { id: '#course-meeting-days', key: 'meeting_days' },
    { id: '#course-add-code', key: 'add_code' }
  ]);

  addItem('#btn-add-enroll', '/api/courses_enrolled', [
    { id: '#enroll-course-id', key: 'course_id', transform: Number, required: true },
    { id: '#enroll-student-id', key: 'student_id', transform: Number, required: true },
    { id: '#enroll-status', key: 'status', transform: Number }
  ]);

  addItem('#btn-add-grade', '/api/final_grades', [
    { id: '#grade-course-id', key: 'course_id', transform: Number, required: true },
    { id: '#grade-student-id', key: 'student_id', transform: Number, required: true },
    { id: '#grade-term', key: 'term', transform: Number },
    { id: '#grade-grade', key: 'grade' }
  ]);

  addItem('#btn-add-book', '/api/textbooks', [
    { id: '#book-title', key: 'title' },
    { id: '#book-price', key: 'price', transform: Number },
    { id: '#book-qty', key: 'quantity', transform: Number },
    { id: '#book-course-id', key: 'course_id', transform: v => v ? Number(v) : null }
  ]);

  // === INITIAL LOAD ===
  fetchStudents();
  loadAll();

  // Refresh button
  btnRefresh?.addEventListener('click', () => {
    showStatus('Refreshing...');
    fetchStudents();
    loadAll();
  });
});