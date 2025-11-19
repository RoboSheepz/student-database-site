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

// Sections for additional tables
const coursesTable = document.querySelector('#courses-table');
const coursesTbody = coursesTable && coursesTable.querySelector('tbody');
const coursesEmpty = document.querySelector('#courses-empty');

const enrollTable = document.querySelector('#enroll-table');
const enrollTbody = enrollTable && enrollTable.querySelector('tbody');
const enrollEmpty = document.querySelector('#enroll-empty');

const gradesTable = document.querySelector('#grades-table');
const gradesTbody = gradesTable && gradesTable.querySelector('tbody');
const gradesEmpty = document.querySelector('#grades-empty');

const booksTable = document.querySelector('#books-table');
const booksTbody = booksTable && booksTable.querySelector('tbody');
const booksEmpty = document.querySelector('#books-empty');

// Toggle buttons
const toggleAddBtn = document.querySelector('#toggle-add-btn');
const addContainer = document.querySelector('#add-container');
const toggleCoursesBtn = document.querySelector('#toggle-courses-btn');
const coursesContent = document.querySelector('#courses-content');
const toggleEnrollBtn = document.querySelector('#toggle-enroll-btn');
const enrollContent = document.querySelector('#enroll-content');
const toggleGradesBtn = document.querySelector('#toggle-grades-btn');
const gradesContent = document.querySelector('#grades-content');
const toggleBooksBtn = document.querySelector('#toggle-books-btn');
const booksContent = document.querySelector('#books-content');

// Fetch courses
async function fetchCourses() {
  try {
    const res = await fetch('/api/courses', { credentials: 'include' });
    if (!res.ok) throw await res.json().catch(()=>({error:'Failed'}));
    const data = await res.json();
    renderCourses(data.courses || []);
  } catch (e) {
    if (coursesEmpty) coursesEmpty.textContent = e.error || 'Failed to load courses';
  }
}

function renderCourses(list) {
  if (!coursesTbody) return;
  coursesTbody.innerHTML = '';
  if (!list.length) {
    coursesTable.style.display = 'none';
    coursesEmpty.style.display = '';
    return;
  }
  coursesEmpty.style.display = 'none';
  coursesTable.style.display = '';
  for (const c of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id ?? ''}</td>
      <td>${c.title || ''}</td>
      <td>${c.units ?? ''}</td>
      <td>${c.start_date ?? ''}</td>
      <td>${c.end_date ?? ''}</td>
      <td>${c.instructor_id ?? ''}</td>
    `;
    coursesTbody.appendChild(tr);
  }
}

// Fetch enrollments
async function fetchEnrollments() {
  try {
    const res = await fetch('/api/courses_enrolled', { credentials: 'include' });
    if (!res.ok) throw await res.json().catch(()=>({error:'Failed'}));
    const data = await res.json();
    renderEnrollments(data.courses_enrolled || []);
  } catch (e) {
    if (enrollEmpty) enrollEmpty.textContent = e.error || 'Failed to load enrollments';
  }
}

function renderEnrollments(list) {
  if (!enrollTbody) return;
  enrollTbody.innerHTML = '';
  if (!list.length) {
    enrollTable.style.display = 'none';
    enrollEmpty.style.display = '';
    return;
  }
  enrollEmpty.style.display = 'none';
  enrollTable.style.display = '';
  for (const r of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.course_id ?? ''}</td>
      <td>${r.student_id ?? ''}</td>
      <td>${r.status ?? ''}</td>
    `;
    enrollTbody.appendChild(tr);
  }
}

// Fetch final grades
async function fetchGrades() {
  try {
    const res = await fetch('/api/final_grades', { credentials: 'include' });
    if (!res.ok) throw await res.json().catch(()=>({error:'Failed'}));
    const data = await res.json();
    renderGrades(data.final_grades || []);
  } catch (e) {
    if (gradesEmpty) gradesEmpty.textContent = e.error || 'Failed to load grades';
  }
}

function renderGrades(list) {
  if (!gradesTbody) return;
  gradesTbody.innerHTML = '';
  if (!list.length) {
    gradesTable.style.display = 'none';
    gradesEmpty.style.display = '';
    return;
  }
  gradesEmpty.style.display = 'none';
  gradesTable.style.display = '';
  for (const g of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.course_id ?? ''}</td>
      <td>${g.student_id ?? ''}</td>
      <td>${g.term ?? ''}</td>
      <td>${g.grade || ''}</td>
    `;
    gradesTbody.appendChild(tr);
  }
}

// Fetch textbooks
async function fetchBooks() {
  try {
    const res = await fetch('/api/textbooks', { credentials: 'include' });
    if (!res.ok) throw await res.json().catch(()=>({error:'Failed'}));
    const data = await res.json();
    renderBooks(data.textbooks || []);
  } catch (e) {
    if (booksEmpty) booksEmpty.textContent = e.error || 'Failed to load textbooks';
  }
}

function renderBooks(list) {
  if (!booksTbody) return;
  booksTbody.innerHTML = '';
  if (!list.length) {
    booksTable.style.display = 'none';
    booksEmpty.style.display = '';
    return;
  }
  booksEmpty.style.display = 'none';
  booksTable.style.display = '';
  for (const b of list) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.id ?? ''}</td>
      <td>${b.title || ''}</td>
      <td>${b.price ?? ''}</td>
      <td>${b.quantity ?? ''}</td>
      <td>${b.course_id ?? ''}</td>
    `;
    booksTbody.appendChild(tr);
  }
}

// Refresh all tables (students already fetched by fetchStudents)
async function refreshAll() {
  await Promise.allSettled([fetchCourses(), fetchEnrollments(), fetchGrades(), fetchBooks()]);
}

// Refresh extra tables on refresh button
btn.addEventListener('click', refreshAll);

// initial load of extras
refreshAll();

// Toggle helpers: toggle only the .add-form inside the container. Do not
// touch the tables or the "No ... found" messages; those are controlled
// by the data renderers.
function toggleSection(btn, container, name) {
  if (!btn || !container) return;
  const formEl = container.querySelector('.add-form');
  if (!formEl) return;
  const initiallyHidden = getComputedStyle(formEl).display === 'none';
  btn.textContent = initiallyHidden ? 'Show' : 'Hide';
  btn.setAttribute('aria-expanded', String(!initiallyHidden));
  btn.addEventListener('click', () => {
    const isHidden = getComputedStyle(formEl).display === 'none';
    formEl.style.display = isHidden ? '' : 'none';
    btn.textContent = isHidden ? 'Hide' : 'Show';
    btn.setAttribute('aria-expanded', String(!isHidden));
  });
}

toggleSection(toggleAddBtn, addContainer, 'Student');
toggleSection(toggleCoursesBtn, coursesContent, 'Courses');
toggleSection(toggleEnrollBtn, enrollContent, 'Enrollments');
toggleSection(toggleGradesBtn, gradesContent, 'Grades');
toggleSection(toggleBooksBtn, booksContent, 'Textbooks');

// Form submit handlers for new entities
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw data || { error: 'Failed' };
  return data;
}

// Courses
const btnAddCourse = document.querySelector('#btn-add-course');
if (btnAddCourse) {
  btnAddCourse.addEventListener('click', async () => {
    try {
      btnAddCourse.disabled = true;
      const payload = {
        title: document.querySelector('#course-title').value,
        units: Number(document.querySelector('#course-units').value) || 0,
        start_date: Number(document.querySelector('#course-start').value) || 0,
        end_date: Number(document.querySelector('#course-end').value) || 0,
        instructor_id: Number(document.querySelector('#course-instructor').value) || 0,
        meeting_days: document.querySelector('#course-meeting-days').value || '',
        add_code: document.querySelector('#course-add-code').value || ''
      };
      await postJson('/api/courses', payload);
      showStatus('Course added');
      fetchCourses();
    } catch (e) {
      showStatus(e.error || 'Failed to add course', true);
    } finally { btnAddCourse.disabled = false; }
  });
}

// Enrollments
const btnAddEnroll = document.querySelector('#btn-add-enroll');
if (btnAddEnroll) {
  btnAddEnroll.addEventListener('click', async () => {
    try {
      btnAddEnroll.disabled = true;
      const payload = {
        course_id: Number(document.querySelector('#enroll-course-id').value),
        student_id: Number(document.querySelector('#enroll-student-id').value),
        status: Number(document.querySelector('#enroll-status').value) || 0
      };
      await postJson('/api/courses_enrolled', payload);
      showStatus('Enrollment added');
      fetchEnrollments();
    } catch (e) {
      showStatus(e.error || 'Failed to add enrollment', true);
    } finally { btnAddEnroll.disabled = false; }
  });
}

// Grades
const btnAddGrade = document.querySelector('#btn-add-grade');
if (btnAddGrade) {
  btnAddGrade.addEventListener('click', async () => {
    try {
      btnAddGrade.disabled = true;
      const payload = {
        course_id: Number(document.querySelector('#grade-course-id').value),
        student_id: Number(document.querySelector('#grade-student-id').value),
        term: Number(document.querySelector('#grade-term').value) || 0,
        grade: document.querySelector('#grade-grade').value || ''
      };
      await postJson('/api/final_grades', payload);
      showStatus('Grade added');
      fetchGrades();
    } catch (e) {
      showStatus(e.error || 'Failed to add grade', true);
    } finally { btnAddGrade.disabled = false; }
  });
}

// Books
const btnAddBook = document.querySelector('#btn-add-book');
if (btnAddBook) {
  btnAddBook.addEventListener('click', async () => {
    try {
      btnAddBook.disabled = true;
      const payload = {
        title: document.querySelector('#book-title').value || '',
        price: Number(document.querySelector('#book-price').value) || 0,
        quantity: Number(document.querySelector('#book-qty').value) || 0,
        course_id: Number(document.querySelector('#book-course-id').value) || null
      };
      await postJson('/api/textbooks', payload);
      showStatus('Book added');
      fetchBooks();
    } catch (e) {
      showStatus(e.error || 'Failed to add book', true);
    } finally { btnAddBook.disabled = false; }
  });
}

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