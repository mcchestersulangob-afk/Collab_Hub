// ============================================================
// QUESTIONS: RENDER (feed + detail + menus)
// ============================================================

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

function renderFeedSkeleton() {
  const el = document.getElementById('feed-list');
  const count = document.getElementById('feed-count');
  if (count) count.textContent = 'Loading';
  if (!el) return;

  el.innerHTML = Array.from({ length: 3 }, (_, index) => `
    <div class="q-card skeleton-card" aria-hidden="true">
      <div class="skeleton-row">
        <span class="skeleton-block skeleton-dot"></span>
        <span class="skeleton-block skeleton-avatar"></span>
        <span class="skeleton-block skeleton-meta"></span>
        <span class="skeleton-block skeleton-menu"></span>
      </div>
      <span class="skeleton-block skeleton-title"></span>
      <span class="skeleton-block skeleton-text"></span>
      <span class="skeleton-block skeleton-text short"></span>
      ${index === 0 ? '<span class="skeleton-block skeleton-image"></span>' : ''}
      <div class="q-footer">
        <span class="skeleton-block skeleton-chip"></span>
        <span class="skeleton-block skeleton-chip"></span>
        <span class="spacer"></span>
        <span class="skeleton-block skeleton-stat"></span>
      </div>
    </div>
  `).join('');
}

function renderFeed() {
  if (questionsLoading) {
    renderFeedSkeleton();
    return;
  }

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

function toggleSave(e, id) {
  e.stopPropagation();
  const questionId = Number(id);
  if (savedIds.has(questionId)) savedIds.delete(questionId);
  else savedIds.add(questionId);
  persistSavedIds();
  renderFeed();
}

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

// expose
window.isTeacherVerifiedQuestion = isTeacherVerifiedQuestion;
window.canManageQuestion = canManageQuestion;
window.canManageAnswer = canManageAnswer;
window.loadSavedIds = loadSavedIds;
window.toggleSave = toggleSave;
window.renderFeed = renderFeed;
window.renderFeedSkeleton = renderFeedSkeleton;
window.openQuestion = openQuestion;
window.closeFeed = closeFeed;
window.bindQuestionMenuClose = bindQuestionMenuClose;
window.questionMenuHtml = questionMenuHtml;
window.answerMenuHtml = answerMenuHtml;
window.toggleQuestionMenu = toggleQuestionMenu;
window.toggleAnswerMenu = toggleAnswerMenu;
window.renderSidebarTags = renderSidebarTags;
window.renderRightPanel = renderRightPanel;
window.updateStats = updateStats;
window.recordQuestionView = recordQuestionView;

