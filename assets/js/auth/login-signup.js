// ============================================================
// LOGIN / SIGNUP / LOGOUT
// ============================================================

function selectRole(role) {
  selectedRole = role;
  document.getElementById('role-student').classList.toggle('selected', role === 'student');
  document.getElementById('role-teacher').classList.toggle('selected', role === 'teacher');
  document.getElementById('role-student').classList.remove('teacher');
  document.getElementById('role-teacher').classList.remove('teacher');
  if (role === 'teacher') document.getElementById('role-teacher').classList.add('teacher');
}

function doLogin() {
  const name = document.getElementById('login-name').value.trim();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Please fill in your email and password.');
    return;
  }

  $.ajax({
    url: 'api/login.php',
    method: 'POST',
    dataType: 'json',
    data: {
      email,
      password,
      role: selectedRole
    },
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Login failed.');
        return;
      }

      const user = res.user || {};
      currentUser = {
        id: user.id || null,
        name: user.name || name,
        role: user.role || selectedRole,
        initials: user.initials || 'U',
        profilePicture: user.profile_picture || null
      };

      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      initApp();
    },
    error: function() {
      showToast('Server error during login.');
    }
  });
}

function openSignupModal() {
  document.getElementById('signup-modal')?.classList.add('open');
  const email = document.getElementById('signup-email');
  if (email) email.focus();
}

function closeSignupModal() {
  document.getElementById('signup-modal')?.classList.remove('open');
  // clear fields
  const ids = ['signup-name', 'signup-email', 'signup-password', 'signup-role'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
}

function selectSignupRole(role) {
  const student = document.getElementById('signup-role-student');
  const teacher = document.getElementById('signup-role-teacher');
  const hidden = document.getElementById('signup-role');

  if (hidden) hidden.value = role;

  student?.classList.toggle('selected', role === 'student');
  teacher?.classList.toggle('selected', role === 'teacher');

  student?.classList.toggle('teacher', false);
  teacher?.classList.toggle('teacher', role === 'teacher');
}

function submitSignup() {
  const name = (document.getElementById('signup-name')?.value || '').trim();
  const email = (document.getElementById('signup-email')?.value || '').trim();
  const password = (document.getElementById('signup-password')?.value || '');
  const role = (document.getElementById('signup-role')?.value || 'student').toLowerCase();

  if (!name || !email || !password) {
    showToast('Please fill in name, email, and password.');
    return;
  }

  $.ajax({
    url: 'api/signup.php',
    method: 'POST',
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify({
      name,
      email,
      password,
      role
    }),
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Signup failed.');
        return;
      }

      const user = res.user || {};
      currentUser = {
        id: user.id || null,
        name: user.name || name,
        role: user.role || role,
        initials: user.initials || 'U',
        profilePicture: user.profile_picture || null
      };

      closeSignupModal();
      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      initApp();
    },
    error: function(xhr) {
      let msg = 'Server error during signup.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

function logout() {
  $.ajax({
    url: 'api/logout.php',
    method: 'POST',
    dataType: 'json',
    async: false,
    success: function() {},
    error: function() {}
  });

  // Reset in-memory state (front-end only)
  currentUser = { id: null, name: '', role: 'student', initials: '', profilePicture: null };
  selectedRole = 'student';
  currentTab = 'all';
  currentFilter = 'all';
  activeTag = null;
  searchQuery = '';
  pendingTags = [];
  uploadedFile = null;
  clearUploadPreviewUrl();
  openQuestionMenuId = null;
  openAnswerMenuId = null;
  editingQuestionId = null;
  editingAnswerId = null;
  savedIds = new Set();
  isDark = false;

  closeAskModal();
  closeEditQuestionModal();
  closeEditAnswerModal();
  const dv = document.getElementById('detail-view');
  if (dv) {
    dv.classList.remove('open');
    delete dv.dataset.questionId;
  }
  document.getElementById('main-feed')?.classList.remove('hidden');

  document.documentElement.setAttribute('data-theme', '');
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.className = 'ti ti-moon';

  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('ask-modal')) closeAskModal();
  if (e.target === document.getElementById('signup-modal')) closeSignupModal();
  if (e.target === document.getElementById('edit-question-modal')) closeEditQuestionModal();
  if (e.target === document.getElementById('edit-answer-modal')) closeEditAnswerModal();
}

// Expose inline-called functions
window.selectRole = selectRole;
window.doLogin = doLogin;
window.openSignupModal = openSignupModal;
window.closeSignupModal = closeSignupModal;
window.selectSignupRole = selectSignupRole;
window.submitSignup = submitSignup;
window.logout = logout;
window.handleOverlayClick = handleOverlayClick;

