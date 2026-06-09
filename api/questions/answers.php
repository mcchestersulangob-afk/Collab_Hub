<?php
// api/questions/answers.php
// Handles ANSWER CRUD (update/delete) via action parameter.

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

try {
  if ($action === 'answer') {
    // This endpoint also supports answer creation
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $questionId = (int)($data['question_id'] ?? 0);
    $content = trim((string)($data['content'] ?? ''));

    if ($questionId <= 0) respond(false, ['message' => 'Missing question_id.'], 400);
    if ($content === '') respond(false, ['message' => 'Missing content.'], 400);

    $chk = $pdo->prepare('SELECT question_id FROM tb_questions WHERE question_id = :id LIMIT 1');
    $chk->execute([':id' => $questionId]);
    if (!$chk->fetch()) respond(false, ['message' => 'Question not found.'], 404);

    $teacherId = null;
    $studentId = null;
    $teacherVerified = 0;

    if ($role === 'teacher') {
      $teacherId = $userId;
      $studentId = null;
      $teacherVerified = 1;
    } elseif ($role === 'student') {
      $studentId = $userId;
      $teacherId = null;
      $teacherVerified = 0;
    } else {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $stmt = $pdo->prepare('INSERT INTO tb_answers (question_id, student_id, teacher_id, content, teacher_verified) VALUES (:question_id, :student_id, :teacher_id, :content, :teacher_verified)');
    $stmt->execute([
      ':question_id' => $questionId,
      ':student_id' => $studentId,
      ':teacher_id' => $teacherId,
      ':content' => $content,
      ':teacher_verified' => $teacherVerified
    ]);

    $answerId = (int)$pdo->lastInsertId();

    respond(true, [
      'message' => 'Answer created',
      'answer_id' => $answerId,
      'teacher_verified' => $teacherVerified
    ], 201);
  }

  if ($action === 'update_answer') {
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $answerId = (int)($data['answer_id'] ?? 0);
    $content = trim((string)($data['content'] ?? ''));

    if ($answerId <= 0) respond(false, ['message' => 'Missing answer_id.'], 400);
    if ($content === '') respond(false, ['message' => 'Missing content.'], 400);

    $chk = $pdo->prepare('SELECT student_id, teacher_id FROM tb_answers WHERE answer_id = :id LIMIT 1');
    $chk->execute([':id' => $answerId]);
    $answer = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$answer) respond(false, ['message' => 'Answer not found.'], 404);

    $ownsAnswer = ($role === 'student' && (int)($answer['student_id'] ?? 0) === $userId)
      || ($role === 'teacher' && (int)($answer['teacher_id'] ?? 0) === $userId);

    if (!$ownsAnswer) {
      respond(false, ['message' => 'You can only edit your own answer.'], 403);
    }

    $ownerColumn = $role === 'teacher' ? 'teacher_id' : 'student_id';
    $stmt = $pdo->prepare("UPDATE tb_answers SET content = :content WHERE answer_id = :answer_id AND {$ownerColumn} = :owner_id");
    $stmt->execute([
      ':content' => $content,
      ':answer_id' => $answerId,
      ':owner_id' => $userId
    ]);

    respond(true, ['message' => 'Answer updated'], 200);
  }

  if ($action === 'delete_answer') {
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $answerId = (int)($data['answer_id'] ?? 0);
    if ($answerId <= 0) respond(false, ['message' => 'Missing answer_id.'], 400);

    $chk = $pdo->prepare('SELECT student_id, teacher_id FROM tb_answers WHERE answer_id = :id LIMIT 1');
    $chk->execute([':id' => $answerId]);
    $answer = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$answer) respond(false, ['message' => 'Answer not found.'], 404);

    $ownsAnswer = ($role === 'student' && (int)($answer['student_id'] ?? 0) === $userId)
      || ($role === 'teacher' && (int)($answer['teacher_id'] ?? 0) === $userId);

    if (!$ownsAnswer) {
      respond(false, ['message' => 'You can only delete your own answer.'], 403);
    }

    $ownerColumn = $role === 'teacher' ? 'teacher_id' : 'student_id';
    $stmt = $pdo->prepare("DELETE FROM tb_answers WHERE answer_id = :answer_id AND {$ownerColumn} = :owner_id");
    $stmt->execute([
      ':answer_id' => $answerId,
      ':owner_id' => $userId
    ]);

    respond(true, ['message' => 'Answer deleted'], 200);
  }

  respond(false, ['message' => 'Unsupported action for answers.php'], 400);
} catch (PDOException $e) {
  respond(false, ['message' => 'Database error.'], 500);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error.'], 500);
}

