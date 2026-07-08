<?php
/**
 * Helper Functions for HR System
 */

/**
 * Get company setting value from system_settings
 */
function getCompanySetting($key, $pdo) {
    try {
        $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $result = $stmt->fetch();
        
        return $result ? $result['setting_value'] : null;
    } catch (PDOException $e) {
        error_log("Error getting company setting '$key': " . $e->getMessage());
        return null;
    }
}
?>
