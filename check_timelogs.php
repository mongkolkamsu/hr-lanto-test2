<?php
require_once 'api/config.php';
try {
    $stmt = $pdo->query("DESCRIBE time_logs");
    $schema = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($schema, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
