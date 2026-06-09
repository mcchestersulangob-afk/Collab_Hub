// ============================================================
// UTILS
// ============================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function inlineJson(value) {
  return escapeHtml(JSON.stringify(value));
}

function avatarHtml(initials, profilePicture, style = '') {
  const src = profilePicture ? escapeHtml(profilePicture) : '';
  const safeInitials = escapeHtml(initials || 'U');
  const safeStyle = style ? ` style="${escapeHtml(style)}"` : '';
  return `<div class="avatar"${safeStyle}>${src ? `<img src="${src}" alt="" style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:inherit;display:block;">` : safeInitials}</div>`;
}

function setAvatarContent(el, initials, profilePicture) {
  if (!el) return;
  el.innerHTML = profilePicture
    ? `<img src="${escapeHtml(profilePicture)}" alt="" style="width:100%;height:100%;max-width:100%;max-height:100%;object-fit:cover;border-radius:inherit;display:block;">`
    : escapeHtml(initials || 'U');
}

function formatRelativeTime(value) {
  if (!value) return 'just now';

  const normalized = String(value).trim().replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'just now';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return 'just now';

  const units = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hr', seconds: 3600 },
    { label: 'min', seconds: 60 }
  ];

  for (const unit of units) {
    const count = Math.floor(diffSeconds / unit.seconds);
    if (count >= 1) {
      const plural = count === 1 || unit.label === 'hr' ? '' : 's';
      return `${count} ${unit.label}${plural} ago`;
    }
  }

  return 'just now';
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const btn = input.closest('.password-input-wrap')?.querySelector('.password-toggle');

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isPassword ? 'ti ti-eye' : 'ti ti-eye-off';
    }
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  document.getElementById('theme-icon').className = isDark ? 'ti ti-sun' : 'ti ti-moon';
}

function showFeed() {
  closeFeed();
  filterFeed('all');
}

function toggleThemeSafe() {
  // wrapper in case theme button is clicked before state exists
  if (typeof toggleTheme === 'function') return toggleTheme();
}

// Expose for inline handlers
window.escapeHtml = escapeHtml;
window.inlineJson = inlineJson;
window.avatarHtml = avatarHtml;
window.setAvatarContent = setAvatarContent;
window.formatRelativeTime = formatRelativeTime;
window.showToast = showToast;
window.togglePasswordVisibility = togglePasswordVisibility;
window.autoResize = autoResize;
window.toggleTheme = toggleTheme;
window.showFeed = showFeed;
window.toggleThemeSafe = toggleThemeSafe;

