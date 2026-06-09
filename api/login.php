<?php
// api/login.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (session_status() !== PHP_SESSION_ACTIVE) {
  $cookieParams = session_get_cookie_params();
  session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 7, // 7 days
    'path' => $cookieParams['path'] ?? '/',
    'domain' => $cookieParams['domain'] ?? '',
    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}

// Refresh inactivity timer if session exists
if (!isset($_SESSION['last_activity'])) {
  $_SESSION['last_activity'] = time();
} else {
  if ((time() - (int)$_SESSION['last_activity']) > 60 * 30) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
      $params = session_get_cookie_params();
      setcookie(session_name(), '', time() - 42000,
        $params['path'], $params['domain'], $params['secure'], $params['httponly']
      );
    }
    session_destroy();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Session expired']);
    exit;
  }
  $_SESSION['last_activity'] = time();
}



// (inactivity timeout handled above)



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
  // also allow json body fields in case frontend sends JSON without header
  if (empty($data) && !empty($raw)) {
    $maybe = json_decode($raw, true);
    if (is_array($maybe)) $data = $maybe;
  }
}

$email = trim((string)($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$role = strtolower(trim((string)($data['role'] ?? 'student')));

if ($email === '' || $password === '' || !in_array($role, ['student', 'teacher'], true)) {
  respond(false, ['message' => 'Missing or invalid fields.'], 400);
}

try {
  $table = $role === 'teacher' ? 'tb_teachers' : 'tb_students';
  $idCol = $role === 'teacher' ? 'teacher_id' : 'student_id';
  $nameCol = 'name';
  $emailCol = 'email';
  $pwdCol = 'password';

  $stmt = $pdo->prepare("SELECT {$idCol} AS user_id, {$nameCol} AS user_name, {$emailCol} AS user_email, {$pwdCol} AS user_password, profile_picture" . ($role === 'teacher' ? ', verified AS verified' : '') . " FROM {$table} WHERE {$emailCol} = :email LIMIT 1");
  $stmt->execute([':email' => $email]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);

  if (!$user) {
    respond(false, ['message' => 'User not found in the selected role table. Check role + email.'], 401);
  }


  $storedHash = (string)$user['user_password'];

  $isValid = false;
  // Most common: bcrypt/argon/hashed via password_hash => password_verify.
  // If storedHash is not in a recognized hash format, password_verify will fail.
  if (function_exists('password_verify')) {
    $isValid = password_verify($password, $storedHash);
  }

  // Fallback: if for some reason passwords are stored as plain text in hash column.
  if (!$isValid && hash_equals($storedHash, $password)) {
    $isValid = true;
  }

  if (!$isValid) {
    respond(false, ['message' => 'Password verification failed.'], 401);
  }


  $userId = (int)$user['user_id'];
  $userName = (string)$user['user_name'];

  $initials = strtoupper(trim(preg_replace('/\s+/', ' ', $userName)));
  $initials = implode('', array_map(fn($w) => substr($w, 0, 1), preg_split('/\s+/', $initials, -1, PREG_SPLIT_NO_EMPTY)));
  $initials = substr($initials, 0, 2);
  if ($initials === '') $initials = 'U';

  $sessionUser = [
    'id' => $userId,
    'name' => $userName,
    'role' => $role,
    'initials' => $initials,
    'profile_picture' => $user['profile_picture'] !== null ? (string)$user['profile_picture'] : null
  ];
  if ($role === 'teacher') {
    $sessionUser['verified'] = (int)($user['verified'] ?? 0);
  }

  $_SESSION['user'] = $sessionUser;

  respond(true, [
    'message' => 'Login successful',
    'user' => $sessionUser
  ], 200);
} catch (Exception $e) {
  respond(false, ['message' => 'Server error.'], 500);
}

