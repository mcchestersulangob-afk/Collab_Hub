<?php
// api/questions/list.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
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

function getSessionUserIdRole() {
  if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) return null;
  return [
    'id' => (int)($_SESSION['user']['id'] ?? 0),
    'role' => strtolower((string)($_SESSION['user']['role'] ?? 'student'))
  ];
}

$user = getSessionUserIdRole();

try {
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

  // Fetch questions + student + answers.
  // For student answers, we need the answer author's student name (not the literal "Student").
  $sql = "
SELECT 
      q.question_id,
      q.title,
      q.description,
      q.image_url,
      q.created_at,
      COALESCE(qv.view_count, 0) AS view_count,
      q.student_id,
      q.teacher_id AS question_teacher_id,
      s.name AS student_name,
      s.profile_picture AS student_profile_picture,
      qt.name AS question_teacher_name,
      qt.profile_picture AS question_teacher_profile_picture,
      a.answer_id,
      a.content AS answer_content,
      a.teacher_id,
      a.student_id AS answer_student_id,
      a.teacher_verified,
      a.created_at AS answer_created_at,
      ta.name AS teacher_name,
      ta.profile_picture AS teacher_profile_picture,
      sa.name AS student_answer_name,
      sa.profile_picture AS student_answer_profile_picture
    FROM tb_questions q
    LEFT JOIN tb_students s ON s.student_id = q.student_id
    LEFT JOIN tb_teachers qt ON qt.teacher_id = q.teacher_id
    LEFT JOIN tb_answers a ON a.question_id = q.question_id
    LEFT JOIN tb_teachers ta ON ta.teacher_id = a.teacher_id
    LEFT JOIN tb_students sa ON sa.student_id = a.student_id
    LEFT JOIN (
      SELECT question_id, COUNT(*) AS view_count
      FROM tb_question_views
      GROUP BY question_id
    ) qv ON qv.question_id = q.question_id
    ORDER BY q.created_at DESC, a.created_at DESC
  ";


  $stmt = $pdo->query($sql);
  $studentCount = (int)$pdo->query('SELECT COUNT(*) FROM tb_students')->fetchColumn();
  $teacherCount = (int)$pdo->query('SELECT COUNT(*) FROM tb_teachers')->fetchColumn();
  $totalMembers = $studentCount + $teacherCount;

  $questions = [];

  // ------------------------------------------------------------
  // Aggregate questions + answers
  // ------------------------------------------------------------
  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $qid = (int)$row['question_id'];
    if (!isset($questions[$qid])) {
      $questionTeacherId = $row['question_teacher_id'] !== null ? (int)$row['question_teacher_id'] : null;
      $questionStudentId = $row['student_id'] !== null ? (int)$row['student_id'] : null;
      $uploaderRole = $questionTeacherId !== null ? 'teacher' : 'student';
      $uploaderId = $uploaderRole === 'teacher' ? $questionTeacherId : $questionStudentId;
      $uploaderName = $uploaderRole === 'teacher'
        ? (string)($row['question_teacher_name'] ?? '')
        : (string)($row['student_name'] ?? '');
      if ($uploaderName === '') $uploaderName = $uploaderRole === 'teacher' ? 'Teacher' : 'Student';
      $uploaderProfile = $uploaderRole === 'teacher'
        ? ($row['question_teacher_profile_picture'] !== null ? (string)$row['question_teacher_profile_picture'] : null)
        : ($row['student_profile_picture'] !== null ? (string)$row['student_profile_picture'] : null);

      $initials = strtoupper(trim(preg_replace('/\s+/', ' ', $uploaderName)));
      $initials = implode('', array_map(fn($w) => substr($w, 0, 1), preg_split('/\s+/', $initials, -1, PREG_SPLIT_NO_EMPTY)));
      $initials = substr($initials, 0, 2);
      if ($initials === '') $initials = 'U';

      $questions[$qid] = [
        'id' => $qid,
        'title' => (string)$row['title'],
        'description' => $row['description'] !== null ? (string)$row['description'] : null,
        'image_url' => $row['image_url'] !== null ? (string)$row['image_url'] : null,
        'created_at' => $row['created_at'],
        'view_count' => (int)($row['view_count'] ?? 0),
        'student' => [
          'id' => $questionStudentId ?? 0,
          'name' => (string)($row['student_name'] ?? ''),
          'initials' => $initials,
          'profile_picture' => $row['student_profile_picture'] !== null ? (string)$row['student_profile_picture'] : null,
        ],
        'uploader' => [
          'id' => $uploaderId ?? 0,
          'role' => $uploaderRole,
          'name' => $uploaderName,
          'initials' => $initials,
          'profile_picture' => $uploaderProfile,
        ],
        'answers' => [],
        // placeholder; we'll load from tb_question_tags after loop
        'tags' => []
      ];
    }

    // Answer row may be NULL due to LEFT JOIN
    if ($row['answer_id'] === null) continue;

    $answerId = (int)$row['answer_id'];
    $content = (string)$row['answer_content'];

    $isTeacher = $row['teacher_id'] !== null;

    $authorName = $isTeacher ? (string)$row['teacher_name'] : null;
    if (!$isTeacher) {
      // student answer -> use joined student name for that answer author
      $authorName = (string)($row['student_answer_name'] ?? 'Student');
      if ($authorName === '') $authorName = 'Student';

    }

    $initials = strtoupper(trim(preg_replace('/\s++/', ' ', $authorName)));


    $initials = implode('', array_map(fn($w) => substr($w, 0, 1), preg_split('/\s+/', $initials, -1, PREG_SPLIT_NO_EMPTY)));
    $initials = substr($initials, 0, 2);
    if ($initials === '') $initials = 'U';

    $questions[$qid]['answers'][] = [
      'id' => $answerId,
      'question_id' => $qid,
      'role' => $isTeacher ? 'teacher' : 'student',
      'teacher_verified' => (int)($row['teacher_verified'] ?? 0),
      'body' => $content,
      'author' => $authorName,
      'initials' => $initials,
      'created_at' => $row['answer_created_at'],
      'teacher_id' => $row['teacher_id'] !== null ? (int)$row['teacher_id'] : null,
      'student_id' => $row['answer_student_id'] !== null ? (int)$row['answer_student_id'] : null,
      'profile_picture' => $isTeacher
        ? ($row['teacher_profile_picture'] !== null ? (string)$row['teacher_profile_picture'] : null)
        : ($row['student_answer_profile_picture'] !== null ? (string)$row['student_answer_profile_picture'] : null)
    ];
  }

  // ------------------------------------------------------------
  // Load tags via junction table tb_question_tags + tb_tags
  // ------------------------------------------------------------
  $questionIds = array_keys($questions);
  if (!empty($questionIds)) {
    $placeholders = implode(',', array_fill(0, count($questionIds), '?'));
    $sqlTags = "
      SELECT qt.question_id, t.tag_name
      FROM tb_question_tags qt
      INNER JOIN tb_tags t ON t.tag_id = qt.tag_id
      WHERE qt.question_id IN ($placeholders)
      ORDER BY qt.question_id ASC, t.tag_name ASC
    ";

    $stmtTags = $pdo->prepare($sqlTags);
    $stmtTags->execute(array_map('intval', $questionIds));

    $tagMap = [];
    while ($r = $stmtTags->fetch(PDO::FETCH_ASSOC)) {
      $qid = (int)$r['question_id'];
      $tagName = (string)($r['tag_name'] ?? '');
      if ($tagName === '') continue;
      if (!isset($tagMap[$qid])) $tagMap[$qid] = [];
      $tagMap[$qid][] = $tagName;
    }

    foreach ($tagMap as $qid => $tags) {
      // frontend expects tags like ['#math', '#algebra']
      $questions[(int)$qid]['tags'] = array_values(array_unique($tags));
    }
  }

  // Convert to list
  $out = array_values($questions);

  respond(true, ['questions' => $out, 'total_members' => $totalMembers]);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error.'], 500);
}

