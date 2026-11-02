<?php
// seed_passwords.php - Sets bcrypt password hashes on existing profiles
// This is a one-time seed to enable login after Supabase -> MySQL migration.

$mysqli = new mysqli('127.0.0.1', 'root', '', 'scholplus', 3306);
if ($mysqli->connect_errno) { fwrite(STDERR, "Connect failed: " . $mysqli->connect_error . "\n"); exit(1); }
$mysqli->set_charset('utf8mb4');

// Default password for all admin/school_admin users
$defaultPassword = 'admin123';
// Generate bcrypt hash using PHP's password_hash
$hash = password_hash($defaultPassword, PASSWORD_BCRYPT);

echo "Generating bcrypt hash for password: $defaultPassword\n";
echo "Hash: $hash\n\n";

// Update school_admin and super_admin profiles
$r = $mysqli->query("UPDATE profiles SET password_hash = '$hash' WHERE id IN (SELECT user_id FROM user_roles WHERE role IN ('school_admin','super_admin'))");
echo "Updated admin/school_admin profiles: " . $mysqli->affected_rows . " rows\n";

// Also set a default password for teachers
$teacherHash = password_hash('teacher123', PASSWORD_BCRYPT);
$r = $mysqli->query("UPDATE profiles SET password_hash = '$teacherHash' WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'teacher') AND password_hash IS NULL");
echo "Updated teacher profiles: " . $mysqli->affected_rows . " rows\n";

// Set a default password for parents
$parentHash = password_hash('parent123', PASSWORD_BCRYPT);
$r = $mysqli->query("UPDATE profiles SET password_hash = '$parentHash' WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'parent') AND password_hash IS NULL");
echo "Updated parent profiles: " . $mysqli->affected_rows . " rows\n";

// Verify
$r = $mysqli->query("SELECT COUNT(*) total, SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) with_password FROM profiles");
$row = $r->fetch_assoc();
echo "\nVerification: " . $row['with_password'] . "/" . $row['total'] . " profiles have password hashes\n";

echo "\n=== LOGIN CREDENTIALS ===\n";
echo "School Admin: miftahacademy2000@gmail.com / admin123\n";
echo "School Admin: biinilaw@gmail.com / admin123\n";
echo "School Admin: hanuunacademy236@gmail.com / admin123\n";
echo "Super Admin:  miftahacademy2000@gmail.com / admin123 (super_admin role)\n";

$mysqli->close();
