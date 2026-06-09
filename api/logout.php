<?php
// api/logout.php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

// Clear session data
$_SESSION = [];

// Clear session cookie (multiple variants to be safe)
if (ini_get('session.use_cookies')) {
  $params = session_get_cookie_params();
  $path = $params['path'] ?? '/';
  $domain = $params['domain'] ?? '';
  $secure = !empty($params['secure']);
  $httponly = !empty($params['httponly']);

  // Current config
  setcookie(session_name(), '', time() - 42000, $path, $domain, $secure, $httponly);
  // Common fallback paths/domains
  setcookie(session_name(), '', time() - 42000, '/', $domain, $secure, $httponly);
  setcookie(session_name(), '', time() - 42000, $path, '', $secure, $httponly);
}

// Destroy server-side session
session_destroy();

// Ensure client receives a response and cookie is gone
echo json_encode(['ok' => true, 'message' => 'Logged out']);



