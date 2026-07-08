<?php
$output = [];
$return_var = 0;
exec('php -l api/admin.php 2>&1', $output, $return_var);
echo implode("\n", $output);
