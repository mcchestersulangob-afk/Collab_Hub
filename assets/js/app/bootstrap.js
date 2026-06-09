// ============================================================
// BOOTSTRAP / INIT
// ============================================================

function bootstrapSession() {
  $.ajax({
    url: 'api/me.php',
    method: 'GET',
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok || !res.user) {
        // Not authenticated -> show login UI
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        return;
      }

      const user = res.user;

      currentUser = {
        id: user.id || null,
        name: user.name || '',
        role: user.role || 'student',
        initials: user.initials || 'U',
        profilePicture: user.profile_picture || null
      };

      selectedRole = currentUser.role;

      document.getElementById('login-page').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      initApp();
    },
    error: function() {
      // not logged in -> show login screen
      document.getElementById('login-page').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  });
}

function refreshCurrentUserAvatars() {
  setAvatarContent(document.getElementById('topbar-avatar'), currentUser.initials, currentUser.profilePicture);
  setAvatarContent(document.getElementById('feed-avatar'), currentUser.initials, currentUser.profilePicture);
}

function triggerProfilePictureUpload() {
  document.getElementById('profile-picture-input')?.click();
}

function bindProfilePictureUploadControls() {
  const avatar = document.getElementById('topbar-avatar');
  const input = document.getElementById('profile-picture-input');

  if (avatar && !avatar.dataset.profileUploadBound) {
    avatar.addEventListener('click', triggerProfilePictureUpload);
    avatar.dataset.profileUploadBound = '1';
  }

  if (input && !input.dataset.profileUploadBound) {
    input.addEventListener('change', handleProfilePictureUpload);
    input.dataset.profileUploadBound = '1';
  }
}

function handleProfilePictureUpload(event) {
  const input = event.target;
  const file = input?.files?.[0];
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    showToast('Please choose an image file.');
    input.value = '';
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('Profile picture must be 5MB or smaller.');
    input.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('profile_picture', file);

  $.ajax({
    url: 'api/profile/upload.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to upload profile picture.');
        return;
      }

      currentUser.profilePicture = res.profile_picture || null;
      if (res.user) {
        currentUser.initials = res.user.initials || currentUser.initials;
        currentUser.name = res.user.name || currentUser.name;
        currentUser.role = res.user.role || currentUser.role;
      }
      refreshCurrentUserAvatars();
      refreshQuestions({ showSkeleton: false }).then(() => {
        const detail = document.getElementById('detail-view');
        const questionId = Number(detail?.dataset.questionId || 0);
        if (detail?.classList.contains('open') && questionId) {
          openQuestion(questionId, false);
        }
      });
      showToast('Profile picture updated.');
    },
    error: function(xhr) {
      let msg = 'Failed to upload profile picture.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    },
    complete: function() {
      input.value = '';
    }
  });
}

function initApp() {
  refreshCurrentUserAvatars();
  bindProfilePictureUploadControls();

  const badge = document.getElementById('topbar-role-badge');
  badge.textContent = currentUser.role === 'teacher' ? 'Teacher' : 'Student';
  badge.className = 'role-badge' + (currentUser.role === 'teacher' ? ' teacher' : '');

  loadSavedIds();

  // Always load from backend so refresh/new questions persist.
  refreshQuestions();

  bindQuestionMenuClose();
}

$(document).ready(function() {
  bootstrapSession();
});

// Expose inline-called functions
window.bootstrapSession = bootstrapSession;
window.initApp = initApp;
window.refreshCurrentUserAvatars = refreshCurrentUserAvatars;
window.triggerProfilePictureUpload = triggerProfilePictureUpload;
window.bindProfilePictureUploadControls = bindProfilePictureUploadControls;
window.handleProfilePictureUpload = handleProfilePictureUpload;

