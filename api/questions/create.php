<?php
// api/questions/create.php
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

// Read request data (JSON or form)
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
if ($action === '') {
  // Default keeps legacy behavior.
  $action = 'question';
}


// ------------------------------------------------------------
// Dispatcher (keep old endpoint name for backward compatibility)
// ------------------------------------------------------------
// Route to the new action-specific handlers.
// Behavior is kept the same.

$routes = [
  'view_question' => __DIR__ . '/views.php',

  // question CRUD
  'question' => __DIR__ . '/questions.php',
  'update_question' => __DIR__ . '/questions.php',
  'delete_question' => __DIR__ . '/questions.php',

  // answer CRUD + create
  'answer' => __DIR__ . '/answers.php',
  'update_answer' => __DIR__ . '/answers.php',
  'delete_answer' => __DIR__ . '/answers.php'
];

if (isset($routes[$action])) {
  // Include the specific handler, which will echo JSON and exit.
  require_once $routes[$action];
  exit;
}

respond(false, ['message' => 'Invalid action.'], 400);

