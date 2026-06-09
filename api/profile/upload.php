<?php
// api/profile/upload.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

require_once __DIR__ . '/../../db_connect.php';

function respond($ok, $payload = [], $httpCode = 200) {
  http_response_code($httpCode);
  echo json_encode(array_merge(['ok' => $ok], $payload));
  exit;
}

if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
  respond(false, ['message' => 'Not authenticated.'], 401);
}

$user = $_SESSION['user'];
$userId = (int)($user['id'] ?? 0);
$role = strtolower((string)($user['role'] ?? 'student'));

if ($userId <= 0 || !in_array($role, ['student', 'teacher'], true)) {
  respond(false, ['message' => 'Invalid session.'], 401);
}

if (empty($_FILES['profile_picture']) || $_FILES['profile_picture']['error'] !== UPLOAD_ERR_OK) {
  respond(false, ['message' => 'Please choose an image to upload.'], 400);
}

$file = $_FILES['profile_picture'];
$maxBytes = 5 * 1024 * 1024;
if ((int)$file['size'] > $maxBytes) {
  respond(false, ['message' => 'Profile picture must be 5MB or smaller.'], 400);
}

$imageInfo = @getimagesize($file['tmp_name']);
if ($imageInfo === false) {
  respond(false, ['message' => 'Uploaded file is not a valid image.'], 400);
}

$mimeToExt = [
  'image/png' => 'png',
  'image/jpeg' => 'jpg',
  'image/gif' => 'gif',
  'image/webp' => 'webp',
];

$mime = (string)($imageInfo['mime'] ?? '');
if (!isset($mimeToExt[$mime])) {
  respond(false, ['message' => 'Invalid image type. Use PNG, JPG, GIF, or WEBP.'], 400);
}

$uploadDir = __DIR__ . '/../../uploads/profile';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true)) {
  respond(false, ['message' => 'Failed to create upload folder.'], 500);
}

$ext = $mimeToExt[$mime];
$newName = 'profile_' . $role . '_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$target = $uploadDir . '/' . $newName;

if (!move_uploaded_file($file['tmp_name'], $target)) {
  respond(false, ['message' => 'Failed to save uploaded image.'], 500);
}

$profilePicture = 'uploads/profile/' . $newName;
$table = $role === 'teacher' ? 'tb_teachers' : 'tb_students';
$idCol = $role === 'teacher' ? 'teacher_id' : 'student_id';

try {
  $stmt = $pdo->prepare("UPDATE {$table} SET profile_picture = :profile_picture WHERE {$idCol} = :id");
  $stmt->execute([
    ':profile_picture' => $profilePicture,
    ':id' => $userId,
  ]);

  $_SESSION['user']['profile_picture'] = $profilePicture;

  respond(true, [
    'message' => 'Profile picture updated.',
    'profile_picture' => $profilePicture,
    'user' => $_SESSION['user'],
  ]);
} catch (Exception $e) {
  respond(false, ['message' => 'Failed to update profile picture.'], 500);
}
