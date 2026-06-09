// ============================================================
// QUESTIONS: API calls (AJAX to backend)
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

function refreshQuestions(options = {}) {
  const {
    showSkeleton = true,
    detailQuestionId = null,
    reopenDetail = false
  } = options;

  if (showSkeleton) {
    questionsLoading = true;
    renderFeed();
  }

  return loadQuestionsFromServer().then(() => {
    questionsLoading = false;
    renderFeed();
    renderSidebarTags();
    updateStats();

    if (reopenDetail && detailQuestionId && document.getElementById('detail-view')?.classList.contains('open')) {
      openQuestion(detailQuestionId, false);
    }
  });
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
      refreshQuestions({ detailQuestionId: qId, reopenDetail: true });
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

      refreshQuestions();

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
      refreshQuestions();
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

// expose
window.loadQuestionsFromServer = loadQuestionsFromServer;
window.refreshQuestions = refreshQuestions;
window.recordQuestionView = recordQuestionView;
window.submitAnswer = submitAnswer;
window.submitQuestion = submitQuestion;
window.quickAsk = quickAsk;

