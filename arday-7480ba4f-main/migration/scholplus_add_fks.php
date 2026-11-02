<?php
/**
 * scholplus_add_fks.php
 * ---------------------
 * Adds foreign key constraints to all populated ScholPlus MySQL tables using
 * the authoritative migration schema (converted from PostgreSQL).
 *
 * Idempotent: skips FKs that already exist, checks for orphans before adding,
 * and creates a supporting index on each referencing column first.
 *
 * Usage: C:\xampp\php\php.exe scholplus_add_fks.php
 */

$DB_HOST = $argv[1] ?? '127.0.0.1';
$DB_USER = $argv[2] ?? 'root';
$DB_PASS = $argv[3] ?? '';
$DB_NAME = $argv[4] ?? 'scholplus';

mysqli_report(MYSQLI_REPORT_OFF);
$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, 3306);
if ($mysqli->connect_errno) { fwrite(STDERR, "connect fail: " . $mysqli->connect_error . "\n"); exit(1); }
$mysqli->set_charset('utf8mb4');

// Existing FK set
$existing = [];
$res = $mysqli->query("SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='$DB_NAME' AND REFERENCED_TABLE_NAME IS NOT NULL");
while ($r = $res->fetch_assoc()) { $existing[$r['TABLE_NAME'] . '.' . $r['COLUMN_NAME']] = $r['CONSTRAINT_NAME']; }

// Candidate FKs: [child, col, parent, pcol, on_delete]
$fks = [
    ['user_roles', 'school_id', 'schools', 'id', 'CASCADE'],
    ['memberships', 'school_id', 'schools', 'id', 'CASCADE'],
    ['teachers', 'user_id', 'profiles', 'id', 'CASCADE'],
    ['teachers', 'school_id', 'schools', 'id', 'CASCADE'],
    ['students', 'user_id', 'profiles', 'id', 'CASCADE'],
    ['students', 'school_id', 'schools', 'id', 'CASCADE'],
    ['parents', 'user_id', 'profiles', 'id', 'CASCADE'],
    ['parents', 'school_id', 'schools', 'id', 'CASCADE'],
    ['classes', 'school_id', 'schools', 'id', 'CASCADE'],
    ['classes', 'teacher_id', 'teachers', 'id', 'SET NULL'],
    ['courses', 'school_id', 'schools', 'id', 'CASCADE'],
    ['courses', 'teacher_id', 'teachers', 'id', 'SET NULL'],
    ['class_students', 'class_id', 'classes', 'id', 'CASCADE'],
    ['class_students', 'student_id', 'students', 'id', 'CASCADE'],
    ['parent_students', 'student_id', 'students', 'id', 'CASCADE'],
    ['attendance', 'student_id', 'students', 'id', 'CASCADE'],
    ['attendance', 'class_id', 'classes', 'id', 'CASCADE'],
    ['attendance', 'marked_by', 'profiles', 'id', 'SET NULL'],
    ['grades', 'student_id', 'students', 'id', 'CASCADE'],
    ['grades', 'course_id', 'courses', 'id', 'CASCADE'],
    ['grades', 'graded_by', 'profiles', 'id', 'SET NULL'],
    ['invoices', 'student_id', 'students', 'id', 'CASCADE'],
    ['invoices', 'school_id', 'schools', 'id', 'CASCADE'],
    ['assignments', 'course_id', 'courses', 'id', 'CASCADE'],
    ['assignments', 'class_id', 'classes', 'id', 'CASCADE'],
    ['assignments', 'teacher_id', 'teachers', 'id', 'SET NULL'],
    ['learning_materials', 'course_id', 'courses', 'id', 'CASCADE'],
    ['learning_materials', 'teacher_id', 'teachers', 'id', 'CASCADE'],
    ['invoice_templates', 'school_id', 'schools', 'id', 'CASCADE'],
    ['audit_logs', 'school_id', 'schools', 'id', 'SET NULL'],
    ['subscription_payments', 'school_id', 'schools', 'id', 'CASCADE'],
    ['archived_users', 'school_id', 'schools', 'id', 'SET NULL'],
    ['invoice_counters', 'school_id', 'schools', 'id', 'CASCADE'],
    ['payment_history', 'invoice_id', 'invoices', 'id', 'CASCADE'],
    ['payment_history', 'recorded_by', 'profiles', 'id', 'SET NULL'],
    ['student_fee_overrides', 'student_id', 'students', 'id', 'CASCADE'],
    ['student_fee_overrides', 'school_id', 'schools', 'id', 'CASCADE'],
    ['academic_years', 'school_id', 'schools', 'id', 'CASCADE'],
    ['terms', 'school_id', 'schools', 'id', 'CASCADE'],
    ['terms', 'academic_year_id', 'academic_years', 'id', 'CASCADE'],
    ['subjects', 'school_id', 'schools', 'id', 'CASCADE'],
    ['exam_types', 'school_id', 'schools', 'id', 'CASCADE'],
    ['grading_scales', 'school_id', 'schools', 'id', 'CASCADE'],
    ['class_fees', 'class_id', 'classes', 'id', 'CASCADE'],
    ['class_fees', 'school_id', 'schools', 'id', 'CASCADE'],
    ['exams', 'school_id', 'schools', 'id', 'CASCADE'],
    ['exams', 'student_id', 'students', 'id', 'CASCADE'],
    ['exams', 'class_id', 'classes', 'id', 'CASCADE'],
    ['exams', 'subject_id', 'subjects', 'id', 'SET NULL'],
    ['exams', 'term_id', 'terms', 'id', 'SET NULL'],
    ['exams', 'exam_type_id', 'exam_types', 'id', 'SET NULL'],
    ['financial_accounts', 'school_id', 'schools', 'id', 'CASCADE'],
    ['expense_categories', 'school_id', 'schools', 'id', 'CASCADE'],
    ['expense_budgets', 'school_id', 'schools', 'id', 'CASCADE'],
    ['expense_budgets', 'category_id', 'expense_categories', 'id', 'CASCADE'],
    ['expenses', 'school_id', 'schools', 'id', 'CASCADE'],
    ['expenses', 'category_id', 'expense_categories', 'id', 'SET NULL'],
    ['expenses', 'account_id', 'financial_accounts', 'id', 'SET NULL'],
    ['account_transfers', 'school_id', 'schools', 'id', 'CASCADE'],
    ['account_transfers', 'from_account_id', 'financial_accounts', 'id', 'SET NULL'],
    ['account_transfers', 'to_account_id', 'financial_accounts', 'id', 'SET NULL'],
    ['payment_history', 'school_id', 'schools', 'id', 'CASCADE'],
    ['payment_history', 'account_id', 'financial_accounts', 'id', 'SET NULL'],
    ['monthly_closings', 'school_id', 'schools', 'id', 'CASCADE'],
    ['invoice_job_runs', 'school_id', 'schools', 'id', 'CASCADE'],
    ['messages', 'school_id', 'schools', 'id', 'CASCADE'],
    ['messages', 'sender_id', 'profiles', 'id', 'CASCADE'],
    ['expense_settings', 'school_id', 'schools', 'id', 'CASCADE'],
    ['export_permissions', 'school_id', 'schools', 'id', 'CASCADE'],
];

$added = 0; $skipped = [];
foreach ($fks as [$child, $col, $parent, $pcol, $onDel]) {
    $key = "$child.$col";
    if (isset($existing[$key])) { $skipped[] = "$key (ALREADY EXISTS)"; continue; }

    $cCol = $mysqli->query("SHOW COLUMNS FROM `$child` LIKE '$col'");
    $pCol = $mysqli->query("SHOW COLUMNS FROM `$parent` LIKE '$pcol'");
    if (!$cCol || !$pCol || $cCol->num_rows === 0 || $pCol->num_rows === 0) {
        $skipped[] = "$key -> $parent.$pcol (COLUMN MISSING)"; continue;
    }

    // Orphan check
    $or = $mysqli->query("SELECT COUNT(*) AS c FROM `$child` c LEFT JOIN `$parent` p ON p.`$pcol`=c.`$col` WHERE c.`$col` IS NOT NULL AND p.`$pcol` IS NULL");
    $orphans = $or ? (int)$or->fetch_assoc()['c'] : -1;
    if ($orphans > 0) { $skipped[] = "$key -> $parent.$pcol (ORPHANS: $orphans)"; continue; }

    // Ensure index on referencing column (ignore duplicate/missing errors)
    $idxName = "idx_{$child}_{$col}";
    $hasIdx = $mysqli->query("SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='$child' AND INDEX_NAME='$idxName'");
    if (!$hasIdx || (int)$hasIdx->fetch_assoc()['c'] === 0) {
        $mysqli->query("ALTER TABLE `$child` ADD INDEX `$idxName` (`$col`)");
    }

    $name = "fk_" . $child . "_" . $col;
    $sql = "ALTER TABLE `$child` ADD CONSTRAINT `$name` FOREIGN KEY (`$col`) REFERENCES `$parent`(`$pcol`) ON DELETE $onDel";
    if ($mysqli->query($sql)) {
        $added++; echo "Added: $key\n";
    } else {
        $skipped[] = "$key -> $parent.$pcol (ERR: " . $mysqli->error . ")";
    }
}

echo "\nFKs added this run: $added\n";
echo "Skipped (" . count($skipped) . "):\n";
foreach ($skipped as $s) echo "  - $s\n";

$res = $mysqli->query("SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='$DB_NAME' AND REFERENCED_TABLE_NAME IS NOT NULL");
echo "Total FKs now: " . ($res ? $res->fetch_assoc()['c'] : '?') . "\n";
$mysqli->close();
