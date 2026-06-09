// ============================================================
// TAGS INPUT (ask modal)
// ============================================================

function handleTagInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(/,/g, '').trim();
    if (val && !pendingTags.includes('#' + val.replace('#', ''))) {
      pendingTags.push('#' + val.replace('#', ''));
      rerenderTags();
    }
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value && pendingTags.length) {
    pendingTags.pop();
    rerenderTags();
  }
}

function removeTag(tag) {
  pendingTags = pendingTags.filter(t => t !== tag);
  rerenderTags();
}

function rerenderTags() {
  const wrap = document.getElementById('tags-wrap');
  const existing = wrap.querySelectorAll('.tag-pill');
  existing.forEach(el => el.remove());

  pendingTags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.innerHTML = `${escapeHtml(tag)}<span class="tag-pill-remove" onclick="removeTag(${inlineJson(tag)})">×</span>`;
    wrap.insertBefore(pill, document.getElementById('tag-input'));
  });
}

window.handleTagInput = handleTagInput;
window.removeTag = removeTag;
window.rerenderTags = rerenderTags;

