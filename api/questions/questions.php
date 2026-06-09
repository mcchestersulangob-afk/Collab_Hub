<?php
// api/questions/questions.php
// Handles QUESTION CRUD (create/update/delete) via action parameter.

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
  if ($action === 'question') {
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $title = trim((string)($data['title'] ?? ''));
    $description = isset($data['description']) ? (string)$data['description'] : null;

    if ($title === '') respond(false, ['message' => 'Missing title.'], 400);

    $imageUrl = null;

    if (!empty($_FILES['image']) && isset($_FILES['image'])) {
      $file = $_FILES['image'];
      if ($file['error'] !== UPLOAD_ERR_OK) {
        $uploadErrors = [
          UPLOAD_ERR_INI_SIZE => 'The image is larger than the server allows.',
          UPLOAD_ERR_FORM_SIZE => 'The image is too large.',
          UPLOAD_ERR_PARTIAL => 'The image only uploaded partially. Please try again.',
          UPLOAD_ERR_NO_FILE => 'No image was uploaded.',
          UPLOAD_ERR_NO_TMP_DIR => 'Server upload folder is missing.',
          UPLOAD_ERR_CANT_WRITE => 'Server could not write the uploaded image.',
          UPLOAD_ERR_EXTENSION => 'A PHP extension blocked the upload.',
        ];
        respond(false, ['message' => $uploadErrors[$file['error']] ?? 'Image upload failed.'], 400);
      }

      $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
      $allowed = ['png','jpg','jpeg','jfif','gif','webp'];
      if (!in_array($ext, $allowed, true)) {
        respond(false, ['message' => 'Invalid image type. Please upload PNG, JPG, GIF, or WebP.'], 400);
      }

      $mime = '';
      if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
          $mime = (string)finfo_file($finfo, $file['tmp_name']);
          finfo_close($finfo);
        }
      }

      $allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      if ($mime !== '' && !in_array($mime, $allowedMimes, true)) {
        respond(false, ['message' => 'Invalid image type. Please upload PNG, JPG, GIF, or WebP.'], 400);
      }

      $uploadDir = __DIR__ . '/../../uploads/questions';
      if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
      }

      $newName = 'q_' . $userId . '_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
      $target = $uploadDir . '/' . $newName;

      if (!move_uploaded_file($file['tmp_name'], $target)) {
        respond(false, ['message' => 'Failed to save uploaded image.'], 500);
      }

      $imageUrl = 'uploads/questions/' . $newName;
    }

    $studentId = $role === 'student' ? $userId : null;
    $teacherId = $role === 'teacher' ? $userId : null;

    $stmt = $pdo->prepare("INSERT INTO tb_questions (student_id, teacher_id, title, description, image_url) VALUES (:student_id, :teacher_id, :title, :description, :image_url)");
    $stmt->execute([
      ':student_id' => $studentId,
      ':teacher_id' => $teacherId,
      ':title' => $title,
      ':description' => $description,
      ':image_url' => $imageUrl
    ]);

    $questionId = (int)$pdo->lastInsertId();

    // Tags (junction)
    $rawTags = $data['tags'] ?? '[]';
    $tags = [];

    if (is_string($rawTags)) {
      $decoded = json_decode($rawTags, true);
      if (is_array($decoded)) $tags = $decoded;
    } elseif (is_array($rawTags)) {
      $tags = $rawTags;
    }

    $normalized = [];
    foreach ($tags as $t) {
      $t = trim((string)$t);
      if ($t === '') continue;
      if ($t[0] !== '#') $t = '#' . $t;
      $t = preg_replace('/\s+/', '', $t);
      if ($t === '#') continue;
      $normalized[$t] = true;
    }

    if ($normalized) {
      $pdo->beginTransaction();
      try {
        $insTag = $pdo->prepare("INSERT IGNORE INTO tb_tags (tag_name) VALUES (:tag_name)");
        $getTagId = $pdo->prepare("SELECT tag_id FROM tb_tags WHERE tag_name = :tag_name LIMIT 1");
        $insLink = $pdo->prepare("INSERT INTO tb_question_tags (question_id, tag_id) VALUES (:question_id, :tag_id) ON DUPLICATE KEY UPDATE question_id = question_id");

        foreach (array_keys($normalized) as $tagName) {
          $insTag->execute([':tag_name' => $tagName]);
          $getTagId->execute([':tag_name' => $tagName]);
          $tagRow = $getTagId->fetch(PDO::FETCH_ASSOC);
          if (!$tagRow) continue;
          $tagId = (int)$tagRow['tag_id'];
          if ($tagId <= 0) continue;
          $insLink->execute([
            ':question_id' => $questionId,
            ':tag_id' => $tagId
          ]);
        }

        $pdo->commit();
      } catch (Exception $e) {
        $pdo->rollBack();
        // ignore tag failures
      }
    }

    respond(true, ['message' => 'Question created', 'question_id' => $questionId], 201);
  }

  if ($action === 'update_question') {
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $questionId = (int)($data['question_id'] ?? 0);
    $title = trim((string)($data['title'] ?? ''));
    $description = isset($data['description']) ? (string)$data['description'] : '';

    if ($questionId <= 0) respond(false, ['message' => 'Missing question_id.'], 400);
    if ($title === '') respond(false, ['message' => 'Missing title.'], 400);

    $chk = $pdo->prepare('SELECT student_id, teacher_id FROM tb_questions WHERE question_id = :id LIMIT 1');
    $chk->execute([':id' => $questionId]);
    $question = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$question) respond(false, ['message' => 'Question not found.'], 404);

    $ownsQuestion = ($role === 'student' && (int)($question['student_id'] ?? 0) === $userId)
      || ($role === 'teacher' && (int)($question['teacher_id'] ?? 0) === $userId);

    if (!$ownsQuestion) {
      respond(false, ['message' => 'You can only edit your own question.'], 403);
    }

    $ownerColumn = $role === 'teacher' ? 'teacher_id' : 'student_id';
    $stmt = $pdo->prepare("UPDATE tb_questions SET title = :title, description = :description WHERE question_id = :id AND {$ownerColumn} = :owner_id");
    $stmt->execute([
      ':title' => $title,
      ':description' => $description,
      ':id' => $questionId,
      ':owner_id' => $userId
    ]);

    $rawTags = $data['tags'] ?? null;
    if ($rawTags !== null) {
      $tags = [];
      if (is_string($rawTags)) {
        $decoded = json_decode($rawTags, true);
        if (is_array($decoded)) $tags = $decoded;
      } elseif (is_array($rawTags)) {
        $tags = $rawTags;
      }

      $normalized = [];
      foreach ($tags as $t) {
        $t = trim((string)$t);
        if ($t === '') continue;
        if ($t[0] !== '#') $t = '#' . $t;
        $t = preg_replace('/\s+/', '', $t);
        if ($t === '#') continue;
        $normalized[$t] = true;
      }

      $pdo->beginTransaction();
      try {
        $delLinks = $pdo->prepare('DELETE FROM tb_question_tags WHERE question_id = :question_id');
        $delLinks->execute([':question_id' => $questionId]);

        if ($normalized) {
          $insTag = $pdo->prepare('INSERT IGNORE INTO tb_tags (tag_name) VALUES (:tag_name)');
          $getTagId = $pdo->prepare('SELECT tag_id FROM tb_tags WHERE tag_name = :tag_name LIMIT 1');
          $insLink = $pdo->prepare('INSERT INTO tb_question_tags (question_id, tag_id) VALUES (:question_id, :tag_id) ON DUPLICATE KEY UPDATE question_id = question_id');

          foreach (array_keys($normalized) as $tagName) {
            $insTag->execute([':tag_name' => $tagName]);
            $getTagId->execute([':tag_name' => $tagName]);
            $tagRow = $getTagId->fetch(PDO::FETCH_ASSOC);
            if (!$tagRow) continue;
            $tagId = (int)$tagRow['tag_id'];
            if ($tagId <= 0) continue;
            $insLink->execute([
              ':question_id' => $questionId,
              ':tag_id' => $tagId
            ]);
          }
        }

        $pdo->commit();
      } catch (Exception $e) {
        $pdo->rollBack();
        respond(false, ['message' => 'Failed to update tags.'], 500);
      }
    }

    respond(true, ['message' => 'Question updated'], 200);
  }

  if ($action === 'delete_question') {
    if (!in_array($role, ['student', 'teacher'], true)) {
      respond(false, ['message' => 'Invalid role.'], 403);
    }

    $questionId = (int)($data['question_id'] ?? 0);
    if ($questionId <= 0) respond(false, ['message' => 'Missing question_id.'], 400);

    $chk = $pdo->prepare('SELECT student_id, teacher_id FROM tb_questions WHERE question_id = :id LIMIT 1');
    $chk->execute([':id' => $questionId]);
    $question = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$question) respond(false, ['message' => 'Question not found.'], 404);

    $ownsQuestion = ($role === 'student' && (int)($question['student_id'] ?? 0) === $userId)
      || ($role === 'teacher' && (int)($question['teacher_id'] ?? 0) === $userId);

    if (!$ownsQuestion) {
      respond(false, ['message' => 'You can only delete your own question.'], 403);
    }

    $pdo->beginTransaction();
    try {
      $delTags = $pdo->prepare('DELETE FROM tb_question_tags WHERE question_id = :question_id');
      $delTags->execute([':question_id' => $questionId]);

      $delAnswers = $pdo->prepare('DELETE FROM tb_answers WHERE question_id = :question_id');
      $delAnswers->execute([':question_id' => $questionId]);

      $ownerColumn = $role === 'teacher' ? 'teacher_id' : 'student_id';
      $delQuestion = $pdo->prepare("DELETE FROM tb_questions WHERE question_id = :question_id AND {$ownerColumn} = :owner_id");
      $delQuestion->execute([
        ':question_id' => $questionId,
        ':owner_id' => $userId
      ]);

      $pdo->commit();
    } catch (Exception $e) {
      $pdo->rollBack();
      respond(false, ['message' => 'Failed to delete question.'], 500);
    }

    respond(true, ['message' => 'Question deleted'], 200);
  }

  respond(false, ['message' => 'Unsupported action for questions.php'], 400);
} catch (PDOException $e) {
  respond(false, ['message' => 'Database error.'], 500);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error.'], 500);
}

