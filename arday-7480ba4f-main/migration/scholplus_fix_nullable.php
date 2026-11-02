<?php
/**
 * scholplus_fix_nullable.php
 * ---------------------------
 * Alters FK-reference columns to be NULLABLE where the schema declares them
 * nullable (because the data happened to have no NULLs and the auto-inferrer
 * marked them NOT NULL, which blocks SET NULL foreign keys).
 *
 * Usage: C:\xampp\php\php.exe scholplus_fix_nullable.php
 */

$DB_HOST = $argv[1] ?? '127.0.0.1';
$DB_USER = $argv[2] ?? 'root';
$DB_PASS = $argv[3] ?? '';
$DB_NAME = $argv[4] ?? 'scholplus';

$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME, 3306);
if ($mysqli->connect_errno) { fwrite(STDERR, "connect fail: " . $mysqli->connect_error . "\n"); exit(1); }
$mysqli->set_charset('utf8mb4');

// [table, column] pairs that MUST be nullable (schema-faithful)
$nullable = [
    ['courses', 'teacher_id'],
    ['assignments', 'class_id'],
    ['assignments', 'teacher_id'],
    ['grades', 'graded_by'],
    ['attendance', 'marked_by'],
    ['payment_history', 'recorded_by'],
    ['payment_history', 'account_id'],
    ['exams', 'teacher_id'],
    ['exams', 'created_by'],
    ['exams', 'subject_id'],
    ['exams', 'term_id'],
    ['exams', 'exam_type_id'],
    ['classes', 'teacher_id'],
    ['students', 'parent_id'],
    ['archived_users', 'school_id'],
    ['archived_users', 'user_id'],
    ['expenses', 'category_id'],
    ['expenses', 'approved_by'],
    ['expenses', 'updated_by'],
    ['expenses', 'deleted_by'],
    ['expenses', 'recurring_id'],
    ['expenses', 'account_id'],
    ['account_transfers', 'from_account_id'],
    ['account_transfers', 'to_account_id'],
    ['messages', 'recipient_id'],
    ['monthly_closings', 'reopened_by'],
    ['subscription_payments', 'paid_date'],
    ['subscription_payments', 'created_by'],
    ['financial_accounts', 'created_by'],
    ['school_inquiries', 'reviewed_by'],
    ['schools', 'created_by'],
    ['teachers', 'archived_by'],
    ['teachers', 'academic_year_id'],
    ['parents', 'archived_by'],
    ['students', 'archived_by'],
    ['students', 'academic_year_id'],
    ['students', 'date_of_birth'],
    ['invoice_job_runs', 'finished_at'],
];

$fixed = 0;
foreach ($nullable as [$t, $c]) {
    // Determine current type
    $col = $mysqli->query("SHOW COLUMNS FROM `$t` LIKE '$c'");
    if (!$col || $col->num_rows === 0) continue;
    $row = $col->fetch_assoc();
    $type = $row['Type'];
    $notnull = $row['Null'] === 'NO';
    if (!$notnull) continue;
    $mysqli->query("ALTER TABLE `$t` MODIFY COLUMN `$c` $type NULL") or print("  FAIL $t.$c: " . $mysqli->error . "\n");
    $fixed++;
    echo "Made nullable: $t.$c\n";
}
echo "Fixed $fixed columns to nullable.\n";
$mysqli->close();
