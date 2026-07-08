<?php
require_once 'config.php';
$stmt = $pdo->query("DESCRIBE shifts");
$schema = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($schema, JSON_PRETTY_PRINT);
unlink(__FILE__);
