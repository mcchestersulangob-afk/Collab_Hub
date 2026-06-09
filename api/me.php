<?php
// api/me.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
  http_response_code(401);
  echo json_encode(['ok' => false, 'message' => 'Not authenticated']);
  exit;
}

echo json_encode(['ok' => true, 'user' => $_SESSION['user']]);

