<?php
// api/questions/views.php
// Handles VIEW COUNT update for action=view_question.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

require_once __DIR__ . '/../../db_connect.php';

if (!function_exists('respond')) {
  function respond($ok, $payload = [], $httpCode = 200) {
    http_response_code($httpCode);
    echo json_encode(array_merge(['ok' => $ok], $payload));
    exit;
  }
}

if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
  respond(false, ['message' => 'Not authenticated'], 401);
}

$user = $_SESSION['user'];
$userId = (int)($user['id'] ?? 0);
$role = strtolower((string)($user['role'] ?? 'student'));

$raw = file_get_contents('php://input');
$data = [];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (stripos($contentType, 'application/json') !== false && !empty($raw)) {
  $data = json_decode($raw, true) ?: [];
} else {
  $data = $_POST;
  if (empty($data) && !empty($raw)) {
    $maybe = json_decode($raw, true);
    if (is_array($maybe)) $data = $maybe;
  }
}

$action = strtolower(trim((string)($data['action'] ?? '')));
if ($action !== 'view_question') {
  respond(false, ['message' => 'Unsupported action for views.php'], 400);
}

try {
  if (!in_array($role, ['student', 'teacher'], true)) {
    respond(false, ['message' => 'Invalid role.'], 403);
  }

  $questionId = (int)($data['question_id'] ?? 0);
  if ($questionId <= 0) respond(false, ['message' => 'Missing question_id.'], 400);

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS tb_question_views (
      view_id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
      question_id bigint(20) UNSIGNED NOT NULL,
      viewer_role varchar(20) NOT NULL,
      viewer_id bigint(20) UNSIGNED NOT NULL,
      viewed_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (view_id),
      UNIQUE KEY uq_question_viewer (question_id, viewer_role, viewer_id),
      KEY idx_question_views_question (question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ");

  $chk = $pdo->prepare('SELECT question_id FROM tb_questions WHERE question_id = :id LIMIT 1');
  $chk->execute([':id' => $questionId]);
  if (!$chk->fetch()) respond(false, ['message' => 'Question not found.'], 404);

  $stmt = $pdo->prepare('INSERT IGNORE INTO tb_question_views (question_id, viewer_role, viewer_id) VALUES (:question_id, :viewer_role, :viewer_id)');
  $stmt->execute([
    ':question_id' => $questionId,
    ':viewer_role' => $role,
    ':viewer_id' => $userId
  ]);

  $countStmt = $pdo->prepare('SELECT COUNT(*) FROM tb_question_views WHERE question_id = :question_id');
  $countStmt->execute([':question_id' => $questionId]);

  respond(true, ['view_count' => (int)$countStmt->fetchColumn()], 200);
} catch (PDOException $e) {
  respond(false, ['message' => 'Database error.'], 500);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error.'], 500);
}

