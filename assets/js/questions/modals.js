// ============================================================
// MODALS: ask / edit question / edit answer
// ============================================================

function clearUploadPreviewUrl() {
  if (!uploadPreviewUrl) return;
  URL.revokeObjectURL(uploadPreviewUrl);
  uploadPreviewUrl = null;
}

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
      refreshQuestions({ detailQuestionId: editedId, reopenDetail: true });
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
      refreshQuestions();
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
      refreshQuestions({ detailQuestionId: questionId, reopenDetail: true });
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
      refreshQuestions({ detailQuestionId: questionId, reopenDetail: true });
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

// expose
window.openAskModal = openAskModal;
window.closeAskModal = closeAskModal;
window.openEditQuestionModal = openEditQuestionModal;
window.closeEditQuestionModal = closeEditQuestionModal;
window.submitQuestionEdit = submitQuestionEdit;
window.deleteQuestion = deleteQuestion;
window.openEditAnswerModal = openEditAnswerModal;
window.closeEditAnswerModal = closeEditAnswerModal;
window.submitAnswerEdit = submitAnswerEdit;
window.deleteAnswer = deleteAnswer;

