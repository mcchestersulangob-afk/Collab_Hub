<?php
// db_connect.php
// Update credentials to match your environment.

$DB_HOST = '127.0.0.1';
$DB_NAME = 'db_collabhub';
$DB_USER = 'root';
$DB_PASS = ''; 

// If you use a different MySQL user/password, update them above.
// Credentials mismatch is a common cause of login failures.


try {
  $pdo = new PDO(
    "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
    $DB_USER,
    $DB_PASS,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]
  );

  // Keep older local imports compatible with code that reads profile pictures.
  $pdo->exec("ALTER TABLE tb_students ADD COLUMN IF NOT EXISTS profile_picture varchar(255) DEFAULT NULL AFTER password");
  $pdo->exec("ALTER TABLE tb_teachers ADD COLUMN IF NOT EXISTS profile_picture varchar(255) DEFAULT NULL AFTER verified");
} catch (Exception $e) {
  // In production you would not reveal details.
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['ok' => false, 'message' => 'Database connection failed.']);
  exit;
}

