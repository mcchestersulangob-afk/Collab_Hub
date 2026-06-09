<?php
// api/signup.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

require_once __DIR__ . '/../db_connect.php';

function respond($ok, $payload = [], $httpCode = 200) {
  http_response_code($httpCode);
  echo json_encode(array_merge(['ok' => $ok], $payload));
  exit;
}

// Read POST (supports both JSON and form-encoded)
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

$name = trim((string)($data['name'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$role = strtolower(trim((string)($data['role'] ?? 'student')));

if ($name === '' || $email === '' || $password === '' || !in_array($role, ['student', 'teacher'], true)) {
  respond(false, ['message' => 'Missing or invalid fields.'], 400);
}

// Basic email sanity
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(false, ['message' => 'Invalid email address.'], 400);
}

// Basic password policy
if (strlen($password) < 4) {
  respond(false, ['message' => 'Password is too short.'], 400);
}

try {
  $table = $role === 'teacher' ? 'tb_teachers' : 'tb_students';
  $idCol = $role === 'teacher' ? 'teacher_id' : 'student_id';
  $nameCol = 'name';
  $emailCol = 'email';
  $pwdCol = 'password';

  // Check existing email
  $stmt = $pdo->prepare("SELECT {$idCol} FROM {$table} WHERE {$emailCol} = :email LIMIT 1");
  $stmt->execute([':email' => $email]);
  $existing = $stmt->fetch(PDO::FETCH_ASSOC);
  if ($existing) {
    respond(false, ['message' => 'Email already exists. Please log in instead.'], 409);
  }

  // Hash password (recommended)
  $hash = password_hash($password, PASSWORD_DEFAULT);
  if ($hash === false) {
    respond(false, ['message' => 'Could not hash password.'], 500);
  }

  $ins = $pdo->prepare("INSERT INTO {$table} ({$nameCol}, {$emailCol}, {$pwdCol}) VALUES (:name, :email, :password)");
  $ins->execute([
    ':name' => $name,
    ':email' => $email,
    ':password' => $hash,
  ]);

  $userId = (int)$pdo->lastInsertId();

  $initials = strtoupper(trim(preg_replace('/\s+/', ' ', $name)));
  $initials = implode('', array_map(fn($w) => substr($w, 0, 1), preg_split('/\s+/', $initials, -1, PREG_SPLIT_NO_EMPTY)));
  $initials = substr($initials, 0, 2);
  if ($initials === '') $initials = 'U';

  $sessionUser = [
    'id' => $userId,
    'name' => $name,
    'role' => $role,
    'initials' => $initials,
    'profile_picture' => null
  ];

  if ($role === 'teacher') {
    // teachers table has verified column; newly created teachers default to 0
    $sessionUser['verified'] = 0;
  }

  $_SESSION['user'] = $sessionUser;

  respond(true, [
    'message' => 'Account created successfully',
    'user' => $sessionUser
  ], 201);
} catch (PDOException $e) {
  respond(false, ['message' => 'Database error during signup.'], 500);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error during signup.'], 500);
}

