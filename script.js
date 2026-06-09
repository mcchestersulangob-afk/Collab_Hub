// ============================================================
// script.js (legacy)
// ============================================================
// collabhub.html now loads modular JS files instead.
// Keeping this file mostly empty to avoid breaking other pages.



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
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderRightPanel();
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

window.triggerProfilePictureUpload = triggerProfilePictureUpload;
window.handleProfilePictureUpload = handleProfilePictureUpload;

// ============================================================
// LOAD FROM BACKEND
// ============================================================
function loadQuestionsFromServer() {
  return new Promise((resolve) => {
    $.ajax({
      url: 'api/questions/list.php',
      method: 'GET',
      dataType: 'json',
      success: function(res) {
        try {
          if (res && res.ok && Array.isArray(res.questions)) {
            totalMembers = Number(res.total_members || 0);
            // Replace the in-memory questions array while keeping reference used by render*.
            questions.length = 0;
            res.questions.forEach(q => {
              // Adapt API shape to existing frontend shape.
              const uploader = q.uploader || q.student || {};
              const mapped = {
                id: q.id,
                title: q.title,
                body: q.description || '',
                author: uploader.name || 'User',
                uploaderId: uploader.id || null,
                uploaderRole: uploader.role || 'student',
                studentId: (q.student && q.student.id) ? q.student.id : null,
                initials: uploader.initials || 'U',
                profilePicture: uploader.profile_picture || null,
                avatarColor: null,
                time: formatRelativeTime(q.created_at),
                tags: Array.isArray(q.tags) ? q.tags : [],
                views: Number(q.view_count || 0),
                hasImage: !!q.image_url,
                imageUrl: q.image_url || null,
                answers: Array.isArray(q.answers) ? q.answers.map(a => ({
                  id: a.id,
                  question_id: a.question_id,
                  role: a.role,
                  teacher_verified: a.teacher_verified,
                  body: a.body,
                  author: a.author,
                  initials: a.initials || 'U',
                  profilePicture: a.profile_picture || null,
                  time: formatRelativeTime(a.created_at),
                  studentId: a.student_id || null,
                  teacherId: a.teacher_id || null,
                })) : [],
                saved: savedIds.has(Number(q.id))
              };
              questions.push(mapped);
            });
          }
        } catch (e) {}
        resolve();
      },
      error: function() {
        // If not authenticated or server error, keep current in-memory questions.
        resolve();
      }
    });
  });
}

// ============================================================
// RENDER FEED
// ============================================================
function getFilteredQuestions() {
  let qs = [...questions];
  if (currentTab === 'unanswered' || currentFilter === 'unanswered') qs = qs.filter(q => q.answers.length === 0);
  if (currentTab === 'verified' || currentFilter === 'verified') qs = qs.filter(q => isTeacherVerifiedQuestion(q));
  if (currentFilter === 'mine') qs = qs.filter(q => canManageQuestion(q));
  if (currentFilter === 'saved') qs = qs.filter(q => savedIds.has(q.id));
  if (activeTag) qs = qs.filter(q => q.tags.includes(activeTag));
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    qs = qs.filter(x => x.title.toLowerCase().includes(q) || x.tags.some(t => t.includes(q)));
  }
  return qs;
}

function isTeacherVerifiedQuestion(q) {
  return Array.isArray(q.answers) && q.answers.some(a => a.role === 'teacher' || Number(a.teacher_verified) === 1);
}

function canManageQuestion(q) {
  return (currentUser.role === 'student' || currentUser.role === 'teacher')
    && currentUser.id !== null
    && q.uploaderId !== null
    && q.uploaderRole === currentUser.role
    && Number(q.uploaderId) === Number(currentUser.id);
}

function canManageAnswer(a) {
  if (!a || currentUser.id === null) return false;
  if (currentUser.role === 'teacher') return Number(a.teacherId || 0) === Number(currentUser.id);
  if (currentUser.role === 'student') return Number(a.studentId || 0) === Number(currentUser.id);
  return false;
}

function questionMenuHtml(questionId) {
  const isOpen = openQuestionMenuId === questionId;
  return `
    <div class="question-menu-wrap" onclick="event.stopPropagation()">
      <button class="icon-btn question-menu-btn ${isOpen ? 'active' : ''}" onclick="toggleQuestionMenu(event, ${questionId})" title="Question actions" aria-label="Question actions" aria-expanded="${isOpen ? 'true' : 'false'}">
        <i class="ti ti-dots-vertical"></i>
      </button>
      <div class="question-menu ${isOpen ? 'open' : ''}">
        <button onclick="openEditQuestionModal(event, ${questionId})"><i class="ti ti-pencil"></i> Edit</button>
        <button class="danger" onclick="deleteQuestion(event, ${questionId})"><i class="ti ti-trash"></i> Delete</button>
      </div>
    </div>
  `;
}

function answerMenuHtml(answerId) {
  const isOpen = openAnswerMenuId === answerId;
  return `
    <div class="question-menu-wrap" onclick="event.stopPropagation()">
      <button class="icon-btn question-menu-btn ${isOpen ? 'active' : ''}" onclick="toggleAnswerMenu(event, ${answerId})" title="Answer actions" aria-label="Answer actions" aria-expanded="${isOpen ? 'true' : 'false'}">
        <i class="ti ti-dots-vertical"></i>
      </button>
      <div class="question-menu ${isOpen ? 'open' : ''}">
        <button onclick="openEditAnswerModal(event, ${answerId})"><i class="ti ti-pencil"></i> Edit</button>
        <button class="danger" onclick="deleteAnswer(event, ${answerId})"><i class="ti ti-trash"></i> Delete</button>
      </div>
    </div>
  `;
}

function toggleQuestionMenu(event, questionId) {
  event.stopPropagation();
  openAnswerMenuId = null;
  openQuestionMenuId = openQuestionMenuId === questionId ? null : questionId;
  refreshQuestionMenu(questionId);
}

function toggleAnswerMenu(event, answerId) {
  event.stopPropagation();
  openQuestionMenuId = null;
  openAnswerMenuId = openAnswerMenuId === answerId ? null : answerId;
  refreshAnswerMenu();
}

function bindQuestionMenuClose() {
  if (questionMenuCloseBound) return;
  questionMenuCloseBound = true;
  document.addEventListener('click', () => {
    if (openQuestionMenuId === null && openAnswerMenuId === null) return;
    const previousId = openQuestionMenuId;
    const hadAnswerMenu = openAnswerMenuId !== null;
    openQuestionMenuId = null;
    openAnswerMenuId = null;
    if (previousId !== null) refreshQuestionMenu(previousId);
    else if (hadAnswerMenu) refreshAnswerMenu();
  });
}

function refreshQuestionMenu(questionId) {
  renderFeed();
  const detail = document.getElementById('detail-view');
  if (detail?.classList.contains('open')) {
    const current = questions.find(q => q.id === questionId);
    if (current) openQuestion(questionId, false);
  }
}

function refreshAnswerMenu() {
  const detail = document.getElementById('detail-view');
  if (!detail?.classList.contains('open')) return;
  const currentQuestionId = Number(detail.dataset.questionId || 0);
  if (currentQuestionId > 0) openQuestion(currentQuestionId, false);
}

function renderFeed() {
  const qs = getFilteredQuestions();
  const el = document.getElementById('feed-list');
  document.getElementById('feed-count').textContent = qs.length + ' question' + (qs.length !== 1 ? 's' : '');

  if (qs.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="ti ti-message-off"></i><p>No questions found</p></div>`;
    return;
  }

  el.innerHTML = qs.map(q => {
    const answered = q.answers.length > 0;
    const teacherVerified = isTeacherVerifiedQuestion(q);
    const latestAnswer = q.answers[0];
    const isSaved = savedIds.has(q.id);
    const isOwner = canManageQuestion(q);

    const tagsHtml = q.tags.map(t => `<span class="tag-chip" style="margin:0" onclick="filterByTag(event, ${inlineJson(t)})">${escapeHtml(t)}</span>`).join('');

    let answerPreview = '';
    if (latestAnswer) {
      answerPreview = `
        <div class="answer-preview">
          <div class="answer-preview-head">
            ${avatarHtml(latestAnswer.initials, latestAnswer.profilePicture, `width:18px;height:18px;font-size:8px;${latestAnswer.role==='teacher'?'background:var(--green-light);color:var(--green-dark)':''}`)}
            <span class="answer-preview-name">${escapeHtml(latestAnswer.author)}</span>
            ${latestAnswer.role === 'teacher' || Number(latestAnswer.teacher_verified) === 1 ? `<span class="verified-badge"><i class="ti ti-rosette-discount-check" style="font-size:11px"></i> Teacher verified</span>` : ''}
          </div>
          ${escapeHtml(latestAnswer.body.substring(0, 140))}${latestAnswer.body.length > 140 ? '…' : ''}
        </div>`;
    }

    return `
      <div class="q-card" onclick="openQuestion(${q.id})">
        <div class="q-meta">
          <div class="q-dot ${answered ? 'answered' : 'unanswered'}"></div>
          ${avatarHtml(q.initials, q.profilePicture, `width:22px;height:22px;font-size:9px;${getAvatarStyle(q.avatarColor)}`)}
          <span class="q-author">${escapeHtml(q.author)}</span>
          <span class="q-time">· ${escapeHtml(q.time)}</span>
          ${teacherVerified ? `<span class="verified-badge" style="margin-left:auto;font-size:9px"><i class="ti ti-rosette-discount-check" style="font-size:10px"></i> Verified</span>` : ''}
          ${isOwner ? questionMenuHtml(q.id) : ''}
        </div>
        <div class="q-body">
          <div class="q-body-main">
            <p class="q-title">${escapeHtml(q.title)}</p>
            <p class="q-preview">${escapeHtml(q.body.substring(0, 120))}${q.body.length > 120 ? '…' : ''}</p>
            ${answerPreview}
            ${q.imageUrl ? `<img class="feed-question-image" src="${escapeHtml(q.imageUrl)}" alt="Question attachment" loading="lazy">` : (q.hasImage ? `<div class="feed-image-placeholder"><i class="ti ti-photo"></i> Image attachment</div>` : '')}
            <div class="q-footer" style="margin-top:${latestAnswer?'10px':'0'}">
              ${tagsHtml}
              <span class="spacer"></span>
              <span class="q-stat"><i class="ti ti-eye"></i> ${q.views}</span>
              <span class="q-stat"><i class="ti ti-message"></i> ${q.answers.length} answer${q.answers.length !== 1 ? 's' : ''}</span>
              <span class="q-stat" onclick="toggleSave(event,${q.id})" style="cursor:pointer;color:${isSaved?'var(--amber)':''}">
                <i class="ti ti-${isSaved?'bookmark-filled':'bookmark'}"></i>
              </span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ============================================================
// QUESTION DETAIL
// ============================================================
function openQuestion(id, incrementViews = true) {
  const q = questions.find(x => x.id === id);
  if (!q) return;
  if (incrementViews) recordQuestionView(id);
  document.getElementById('main-feed').classList.add('hidden');
  const dv = document.getElementById('detail-view');
  dv.classList.add('open');
  dv.dataset.questionId = String(id);

  const tagsHtml = q.tags.map(t => `<span class="tag-chip" style="margin:0">${escapeHtml(t)}</span>`).join('');
  const answersHtml = q.answers.length === 0 ? `
    <div class="empty-state" style="padding:24px"><i class="ti ti-message-off"></i><p>No answers yet — be the first to help!</p></div>
  ` : q.answers.map(a => `
    <div class="answer-card ${a.role === 'teacher' ? 'teacher-answer' : ''}">
      <div class="answer-head">
        <div class="answer-author-info">
          ${avatarHtml(a.initials, a.profilePicture, `width:28px;height:28px;font-size:11px;${a.role==='teacher'?'background:var(--green-light);color:var(--green-dark)':''}`)}
          <div>
            <p class="answer-author-name">${escapeHtml(a.author)}</p>
            <p class="answer-time">${escapeHtml(a.time)}</p>
          </div>
        </div>
        ${a.role === 'teacher' || Number(a.teacher_verified) === 1 ? `<span class="verified-badge"><i class="ti ti-rosette-discount-check" style="font-size:11px"></i> Teacher verified</span>` : ''}
        ${canManageAnswer(a) ? answerMenuHtml(a.id) : ''}
      </div>
      <p class="answer-body">${escapeHtml(a.body)}</p>
    </div>
  `).join('');

  const canVerify = currentUser.role === 'teacher';

  dv.querySelector('#detail-content').innerHTML = `
    <div class="detail-card">
      <div class="detail-title-row">
        <p class="detail-title">${escapeHtml(q.title)}</p>
        ${canManageQuestion(q) ? questionMenuHtml(q.id) : ''}
      </div>
      <div class="flex-gap" style="margin-bottom:12px">
        ${avatarHtml(q.initials, q.profilePicture, `width:24px;height:24px;font-size:10px;${getAvatarStyle(q.avatarColor)}`)}
        <span style="font-size:12px;color:var(--text-secondary)">${escapeHtml(q.author)}</span>
        <span style="font-size:11px;color:var(--text-tertiary)">· ${escapeHtml(q.time)}</span>
        <span class="spacer"></span>
        <span class="q-stat" id="detail-view-count-${q.id}"><i class="ti ti-eye"></i> ${q.views} views</span>
      </div>
      <p class="detail-body">${escapeHtml(q.body)}</p>
      ${q.imageUrl ? `<img class="detail-image" src="${escapeHtml(q.imageUrl)}" alt="Question attachment">` : (q.hasImage ? `<div style="margin-bottom:12px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-md);text-align:center;color:var(--text-tertiary);font-size:13px"><i class="ti ti-photo" style="font-size:28px;display:block;margin-bottom:6px"></i>Image attachment</div>` : '')}
      <div class="flex-gap">${tagsHtml}</div>
    </div>

    <div class="section-header">
      <span class="answers-section-title">${q.answers.length} Answer${q.answers.length !== 1 ? 's' : ''}</span>
    </div>

    ${answersHtml}

    <div class="answer-write-box">
      <p class="answer-write-title">${canVerify ? 'Post a verified answer' : 'Write your answer'}</p>
      <textarea class="form-input" id="answer-input-${q.id}" placeholder="Share your knowledge…" style="margin-bottom:10px"></textarea>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn primary sm" onclick="submitAnswer(${q.id})">
          ${canVerify ? '<i class="ti ti-rosette-discount-check"></i> Post verified answer' : '<i class="ti ti-send"></i> Post answer'}
        </button>
      </div>
    </div>
  `;
}

function recordQuestionView(questionId) {
  const q = questions.find(x => x.id === questionId);
  if (!q) return;

  const formData = new FormData();
  formData.append('action', 'view_question');
  formData.append('question_id', questionId);

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) return;
      q.views = Number(res.view_count || 0);
      const detailCount = document.getElementById('detail-view-count-' + questionId);
      if (detailCount) {
        detailCount.innerHTML = `<i class="ti ti-eye"></i> ${q.views} views`;
      }
    }
  });
}

function closeFeed() {
  document.getElementById('main-feed').classList.remove('hidden');
  const detail = document.getElementById('detail-view');
  detail.classList.remove('open');
  delete detail.dataset.questionId;
  renderFeed();
  updateStats();
}

// ============================================================
// SUBMIT ANSWER
// ============================================================
function submitAnswer(qId) {
  const input = document.getElementById('answer-input-' + qId);
  const body = (input?.value || '').trim();
  if (!body) { showToast('Please write an answer first.'); return; }

  // Persist answer to backend so it appears for all users (other tabs/sessions).
  const formData = new FormData();
  formData.append('action', 'answer');
  formData.append('question_id', qId);
  formData.append('content', body);

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to post answer.');
        return;
      }

      if (input) input.value = '';

      showToast(currentUser.role === 'teacher' ? '✓ Verified answer posted!' : '✓ Answer posted!');

      // Reload from backend so both teacher & student tabs get the same DB state.
      loadQuestionsFromServer().then(() => {
        // If detail view is open for the same question, re-open to refresh answers UI.
        const dv = document.getElementById('detail-view');
        if (dv?.classList.contains('open')) {
          openQuestion(qId);
        }
        renderFeed();
        renderRightPanel();
        updateStats();
      });
    },
    error: function(xhr) {
      let msg = 'Failed to post answer.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}


// ============================================================
// SUBMIT QUESTION
// ============================================================
function submitQuestion() {
  const title = document.getElementById('q-title').value.trim();
  const body = document.getElementById('q-body').value.trim();
  const tagsToSend = [...pendingTags];

  if (!title) { showToast('Please add a question title.'); return; }

  // Use backend for persistence.
  const formData = new FormData();
  formData.append('action', 'question');
  formData.append('title', title);
  formData.append('description', body || '');

  // backend create.php currently does not handle tags, so we send them anyway in case you add later.
  // It should be safe to ignore.
  formData.append('tags', JSON.stringify(tagsToSend));

  if (uploadedFile) {
    formData.append('image', uploadedFile);
  }

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to post question.');
        return;
      }

      pendingTags = [];
      uploadedFile = null;
      closeAskModal();

      // Reload feed from backend so it persists on refresh.
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderSidebarTags();
        updateStats();
      });

      showToast('✓ Question posted!');
    },
    error: function(xhr) {
      let msg = 'Failed to post question.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

function quickAsk() {
  const val = document.getElementById('quick-ask').value.trim();
  if (!val) { openAskModal(); return; }

  const formData = new FormData();
  formData.append('action', 'question');
  formData.append('title', val);
  formData.append('description', 'No additional details.');
  formData.append('tags', JSON.stringify([]));

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to post question.');
        return;
      }

      document.getElementById('quick-ask').value = '';
      loadQuestionsFromServer().then(() => {
        renderFeed();
        updateStats();
        renderSidebarTags();
      });
      showToast('✓ Question posted!');
    },
    error: function(xhr) {
      let msg = 'Failed to post question.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

// ============================================================
// FILTERS & TABS
// ============================================================
function setTab(tab) {
  currentTab = tab;
  ['all','unanswered','verified'].forEach(t => {
    document.getElementById('tab-'+t).classList.toggle('active', t === tab);
  });
  renderFeed();
}

function filterFeed(filter) {
  currentFilter = filter;
  activeTag = null;
  currentTab = 'all';
  setTab('all');
  ['nav-home','nav-unanswered','nav-myq','nav-saved','nav-verified'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  const map = { all:'nav-home', unanswered:'nav-unanswered', mine:'nav-myq', saved:'nav-saved', verified:'nav-verified' };
  if (map[filter]) document.getElementById(map[filter]).classList.add('active');

  const titles = { all:'Recent questions', unanswered:'Unanswered questions', mine:'My questions', saved:'Saved questions', verified:'Teacher verified' };
  document.getElementById('feed-title').textContent = titles[filter] || 'Questions';
  renderFeed();
}

function filterByTag(e, tag) {
  e.stopPropagation();
  activeTag = activeTag === tag ? null : tag;
  currentFilter = 'all';
  renderFeed();
  renderSidebarTags();
}

function handleSearch(val) {
  searchQuery = val;
  renderFeed();
}

// ============================================================
// SAVE
// ============================================================
function toggleSave(e, id) {
  e.stopPropagation();
  const questionId = Number(id);
  if (savedIds.has(questionId)) savedIds.delete(questionId); else savedIds.add(questionId);
  persistSavedIds();
  renderFeed();
}

function savedStorageKey() {
  const role = currentUser.role || 'guest';
  const id = currentUser.id || 'guest';
  return `collabHub.savedQuestions.${role}.${id}`;
}

function loadSavedIds() {
  try {
    const raw = localStorage.getItem(savedStorageKey());
    const ids = JSON.parse(raw || '[]');
    savedIds = new Set(Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : []);
  } catch (e) {
    savedIds = new Set();
  }
}

function persistSavedIds() {
  try {
    localStorage.setItem(savedStorageKey(), JSON.stringify([...savedIds]));
  } catch (e) {}
}

// ============================================================
// SIDEBAR / RIGHT PANEL
// ============================================================
function renderSidebarTags() {
  const allTags = [...new Set(questions.flatMap(q => q.tags))].sort();
  const el = document.getElementById('sidebar-tags');
  el.innerHTML = allTags.map(t =>
    `<span class="tag-chip ${activeTag === t ? 'active' : ''}" onclick="filterByTag(event, ${inlineJson(t)})">${escapeHtml(t)}</span>`
  ).join('');
}

function renderRightPanel() {
  const contributors = {};
  questions.forEach(q => q.answers.forEach(a => {
    contributors[a.author] = contributors[a.author] || { initials: a.initials, role: a.role, profilePicture: a.profilePicture, count: 0 };
    contributors[a.author].count++;
  }));
  const sorted = Object.entries(contributors).sort((a,b) => b[1].count - a[1].count).slice(0, 5);

  document.getElementById('top-contributors').innerHTML = sorted.map(([name, info]) => `
    <div class="top-user">
      ${avatarHtml(info.initials, info.profilePicture, `width:26px;height:26px;font-size:10px;${info.role==='teacher'?'background:var(--green-light);color:var(--green-dark)':''}`)}
      <div>
        <p class="top-user-name">${escapeHtml(name)} ${info.role==='teacher'?`<span class="verified-badge" style="font-size:9px;padding:1px 5px"><i class="ti ti-rosette-discount-check" style="font-size:10px"></i></span>`:''}</p>
        <p class="top-user-count">${info.count} answer${info.count!==1?'s':''}</p>
      </div>
    </div>
  `).join('');

  const tagCounts = {};
  questions.forEach(q => q.tags.forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));
  const sortedTags = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,6);

  document.getElementById('trending-tags').innerHTML = sortedTags.map(([tag, count]) => `
    <div class="trending-row">
      <span class="tag-chip" style="margin:0" onclick="filterByTag(event, ${inlineJson(tag)})">${escapeHtml(tag)}</span>
      <span class="trending-count">${count} post${count!==1?'s':''}</span>
    </div>
  `).join('');
}

function updateStats() {
  document.getElementById('stat-total').textContent = questions.length;
  const unanswered = questions.filter(q => q.answers.length === 0).length;
  document.getElementById('stat-unanswered').textContent = unanswered;
  document.getElementById('unanswered-nav-count').textContent = unanswered;
  document.getElementById('stat-verified').textContent = questions.filter(q => isTeacherVerifiedQuestion(q)).length;
  document.getElementById('stat-members').textContent = totalMembers;
  renderRightPanel();
}

// ============================================================
// MODAL
// ============================================================
function openAskModal() {
  document.getElementById('ask-modal').classList.add('open');
  document.getElementById('q-title').focus();
}
function closeAskModal() {
  document.getElementById('ask-modal').classList.remove('open');
  document.getElementById('q-title').value = '';
  document.getElementById('q-body').value = '';
  document.getElementById('tag-input').value = '';
  pendingTags = [];
  uploadedFile = null;
  clearUploadPreviewUrl();
  document.getElementById('upload-preview').style.display = 'none';
  rerenderTags();
}

function openEditQuestionModal(event, questionId) {
  event.stopPropagation();
  const q = questions.find(x => x.id === questionId);
  if (!q || !canManageQuestion(q)) {
    showToast('You can only edit your own question.');
    return;
  }

  openQuestionMenuId = null;
  editingQuestionId = questionId;
  const modal = document.getElementById('edit-question-modal');
  document.getElementById('edit-q-title').value = q.title || '';
  document.getElementById('edit-q-body').value = q.body || '';
  document.getElementById('edit-q-tags').value = (q.tags || []).join(', ');
  modal?.classList.add('open');
  document.getElementById('edit-q-title')?.focus();
  renderFeed();
}

function closeEditQuestionModal() {
  document.getElementById('edit-question-modal')?.classList.remove('open');
  editingQuestionId = null;
}

function submitQuestionEdit() {
  if (!editingQuestionId) return;
  const q = questions.find(x => x.id === editingQuestionId);
  if (!q || !canManageQuestion(q)) {
    closeEditQuestionModal();
    showToast('You can only edit your own question.');
    return;
  }

  const title = document.getElementById('edit-q-title').value.trim();
  const body = document.getElementById('edit-q-body').value.trim();
  const tags = document.getElementById('edit-q-tags').value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t[0] === '#' ? t : '#' + t);

  if (!title) {
    showToast('Please add a question title.');
    return;
  }

  const formData = new FormData();
  formData.append('action', 'update_question');
  formData.append('question_id', editingQuestionId);
  formData.append('title', title);
  formData.append('description', body);
  formData.append('tags', JSON.stringify(tags));

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to update question.');
        return;
      }

      const editedId = editingQuestionId;
      closeEditQuestionModal();
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderSidebarTags();
        updateStats();
        if (document.getElementById('detail-view')?.classList.contains('open')) openQuestion(editedId, false);
      });
      showToast('Question updated.');
    },
    error: function(xhr) {
      let msg = 'Failed to update question.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

function deleteQuestion(event, questionId) {
  event.stopPropagation();
  const q = questions.find(x => x.id === questionId);
  if (!q || !canManageQuestion(q)) {
    showToast('You can only delete your own question.');
    return;
  }

  openQuestionMenuId = null;
  if (!confirm('Delete this question? This will also remove its answers.')) return;

  const formData = new FormData();
  formData.append('action', 'delete_question');
  formData.append('question_id', questionId);

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to delete question.');
        return;
      }

      const detail = document.getElementById('detail-view');
      if (detail?.classList.contains('open')) closeFeed();
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderSidebarTags();
        updateStats();
      });
      showToast('Question deleted.');
    },
    error: function(xhr) {
      let msg = 'Failed to delete question.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

function findAnswerById(answerId) {
  for (const q of questions) {
    const answer = q.answers.find(a => Number(a.id) === Number(answerId));
    if (answer) return { question: q, answer };
  }
  return null;
}

function openEditAnswerModal(event, answerId) {
  event.stopPropagation();
  const found = findAnswerById(answerId);
  if (!found || !canManageAnswer(found.answer)) {
    showToast('You can only edit your own answer.');
    return;
  }

  openAnswerMenuId = null;
  editingAnswerId = answerId;
  const modal = document.getElementById('edit-answer-modal');
  document.getElementById('edit-answer-body').value = found.answer.body || '';
  modal?.classList.add('open');
  document.getElementById('edit-answer-body')?.focus();
  openQuestion(found.question.id, false);
}

function closeEditAnswerModal() {
  document.getElementById('edit-answer-modal')?.classList.remove('open');
  editingAnswerId = null;
}

function submitAnswerEdit() {
  if (!editingAnswerId) return;
  const found = findAnswerById(editingAnswerId);
  if (!found || !canManageAnswer(found.answer)) {
    closeEditAnswerModal();
    showToast('You can only edit your own answer.');
    return;
  }

  const body = document.getElementById('edit-answer-body').value.trim();
  if (!body) {
    showToast('Please write an answer first.');
    return;
  }

  const formData = new FormData();
  formData.append('action', 'update_answer');
  formData.append('answer_id', editingAnswerId);
  formData.append('content', body);

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to update answer.');
        return;
      }

      const questionId = found.question.id;
      closeEditAnswerModal();
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderRightPanel();
        updateStats();
        if (document.getElementById('detail-view')?.classList.contains('open')) openQuestion(questionId, false);
      });
      showToast('Answer updated.');
    },
    error: function(xhr) {
      let msg = 'Failed to update answer.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
    }
  });
}

function deleteAnswer(event, answerId) {
  event.stopPropagation();
  const found = findAnswerById(answerId);
  if (!found || !canManageAnswer(found.answer)) {
    showToast('You can only delete your own answer.');
    return;
  }

  openAnswerMenuId = null;
  if (!confirm('Delete this answer?')) return;

  const formData = new FormData();
  formData.append('action', 'delete_answer');
  formData.append('answer_id', answerId);

  $.ajax({
    url: 'api/questions/create.php',
    method: 'POST',
    data: formData,
    processData: false,
    contentType: false,
    dataType: 'json',
    success: function(res) {
      if (!res || !res.ok) {
        showToast((res && res.message) ? res.message : 'Failed to delete answer.');
        return;
      }

      const questionId = found.question.id;
      loadQuestionsFromServer().then(() => {
        renderFeed();
        renderRightPanel();
        updateStats();
        if (document.getElementById('detail-view')?.classList.contains('open')) openQuestion(questionId, false);
      });
      showToast('Answer deleted.');
    },
    error: function(xhr) {
      let msg = 'Failed to delete answer.';
      try {
        const res = xhr.responseJSON;
        if (res && res.message) msg = res.message;
      } catch (e) {}
      showToast(msg);
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

function handleOverlayClick(e) {
  if (e.target === document.getElementById('ask-modal')) closeAskModal();
  if (e.target === document.getElementById('signup-modal')) closeSignupModal();
  if (e.target === document.getElementById('edit-question-modal')) closeEditQuestionModal();
  if (e.target === document.getElementById('edit-answer-modal')) closeEditAnswerModal();
}


// ============================================================
// TAGS INPUT
// ============================================================
function handleTagInput(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(/,/g,'').trim();
    if (val && !pendingTags.includes('#'+val.replace('#',''))) {
      pendingTags.push('#'+val.replace('#',''));
      rerenderTags();
    }
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value && pendingTags.length) {
    pendingTags.pop(); rerenderTags();
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

// ============================================================
// FILE UPLOAD
// ============================================================
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const allowedExtensions = /\.(png|jpe?g|jfif|gif|webp)$/i;
  if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
    showToast('Please choose a PNG, JPG, GIF, or WebP image.');
    e.target.value = '';
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('Question image must be 5MB or smaller.');
    e.target.value = '';
    return;
  }

  uploadedFile = file;
  clearUploadPreviewUrl();
  uploadPreviewUrl = URL.createObjectURL(file);
  document.getElementById('upload-filename').textContent = file.name;
  document.getElementById('upload-image-preview').src = uploadPreviewUrl;
  document.getElementById('upload-preview').style.display = 'block';
}
function removeUpload() {
  uploadedFile = null;
  clearUploadPreviewUrl();
  document.getElementById('file-input').value = '';
  document.getElementById('upload-image-preview').removeAttribute('src');
  document.getElementById('upload-preview').style.display = 'none';
}

function clearUploadPreviewUrl() {
  if (!uploadPreviewUrl) return;
  URL.revokeObjectURL(uploadPreviewUrl);
  uploadPreviewUrl = null;
}

// ============================================================
// UTILS
// ============================================================
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function inlineJson(value) {
  return escapeHtml(JSON.stringify(value));
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

// ============================================================
// LOGOUT
// ============================================================
function logout() {
  // Always tell backend to clear PHP session cookie/server session.
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

  // Close UI pieces
  closeAskModal();
  closeEditQuestionModal();
  closeEditAnswerModal();
  const dv = document.getElementById('detail-view');
  if (dv) {
    dv.classList.remove('open');
    delete dv.dataset.questionId;
  }
  document.getElementById('main-feed')?.classList.remove('hidden');

  // Theme reset
  document.documentElement.setAttribute('data-theme', '');
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.className = 'ti ti-moon';

  // Swap views
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

