// ============================================================
// QUESTION IMAGE UPLOAD (ask modal)
// ============================================================

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
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

// clearUploadPreviewUrl lives in modals.js; keep fallback.
if (typeof clearUploadPreviewUrl !== 'function') {
  window.clearUploadPreviewUrl = function clearUploadPreviewUrl() {
    if (!uploadPreviewUrl) return;
    URL.revokeObjectURL(uploadPreviewUrl);
    uploadPreviewUrl = null;
  };
}

window.handleFileUpload = handleFileUpload;
window.removeUpload = removeUpload;

