<?php
/**
 * scholplus_migrate.php
 * ----------------------
 * One-time migration script: imports the ScholPlus Supabase backup JSON
 * into the local XAMPP MySQL database named `scholplus`.
 *
 * Usage:
 *   C:\xampp\php\php.exe scholplus_migrate.php <backup.json> <db_host> <db_user> <db_pass> <db_name>
 *
 * Example (defaults): C:\xampp\php\php.exe scholplus_migrate.php
 *
 * It:
 *   1. Creates the target database (if missing).
 *   2. Drops and recreates all 50 tables with MySQL types inferred from the data.
 *   3. Inserts every record from the backup, preserving original UUIDs and timestamps.
 *   4. Prints a per-table row-count verification report.
 *
 * This script is a MIGRATION/DELIVERY tool. It writes to the local MySQL instance
 * only. All credentials come from CLI args / constants below (never hardcoded
 * production secrets).
 */

// ===== CONFIG (override via CLI args or edit here) =====
$DB_HOST  = $argv[2] ?? '127.0.0.1';
$DB_USER  = $argv[3] ?? 'root';
$DB_PASS  = $argv[4] ?? '';
$DB_NAME  = $argv[5] ?? 'scholplus';
$ADD_CHARSET = 'utf8mb4';
$ADD_COLLATE = 'utf8mb4_unicode_ci';

$backupFile = $argv[1] ?? __DIR__ . '\scholplus-backup.json';
if (!file_exists($backupFile)) {
    fwrite(STDERR, "Backup file not found: $backupFile\n");
    exit(1);
}

echo "Reading backup: $backupFile\n";
$backup = json_decode(file_get_contents($backupFile), true);
if (!$backup || !isset($backup['tables'])) {
    fwrite(STDERR, "Invalid backup JSON (missing 'tables' key)\n");
    exit(1);
}
$tables = $backup['tables'];
echo "Backup contains " . count($tables) . " tables.\n";

// ===== MySQL connection =====
$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, '', 3306);
if ($mysqli->connect_errno) {
    fwrite(STDERR, "MySQL connect failed: " . $mysqli->connect_error . "\n");
    exit(1);
}
$mysqli->set_charset($ADD_CHARSET);

// Create database
$mysqli->query("CREATE DATABASE IF NOT EXISTS `$DB_NAME` CHARACTER SET $ADD_CHARSET COLLATE $ADD_COLLATE")
    or die("CREATE DATABASE failed: " . $mysqli->error . "\n");
$mysqli->select_db($DB_NAME) or die("USE $DB_NAME failed: " . $mysqli->error . "\n");

function mysql_type_for_values($values): ?string {
    $vals = array_values(array_filter($values, fn($v) => !is_null($v)));
    $n = count($vals);
    if ($n === 0) return null; // all null -> caller decides

    $allInt = true; $allNum = true; $allBool = true; $allDate = true;
    $allTS = true; $allStr = true; $maxLen = 0; $maxScale = 0; $maxIntDigits = 0;
    foreach ($vals as $v) {
        if (is_bool($v)) { $allNum = false; $allDate = false; $allTS = false; continue; }
        if (is_int($v)) {
            $allBool = false; $allDate = false; $allTS = false;
            $allStr = false;
            $maxIntDigits = max($maxIntDigits, strlen((string)$v));
            continue;
        }
        if (is_float($v)) {
            $allInt = false; $allBool = false; $allDate = false; $allTS = false; $allStr = false;
            $allNum = $allNum && true;
            continue;
        }
        if (is_array($v) || is_object($v)) {
            // JSON
            return 'JSON';
        }
        // string
        $allInt = false; $allBool = false;
        $s = (string)$v;
        $maxLen = max($maxLen, strlen($s));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}([T ].*)?$/', $s)) $allDate = false;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $s)) $allTS = false;
        $allNum = false;
    }

    if ($allBool && $n > 0) return 'TINYINT(1)';

    // All numeric (int/float) values
    $allNumericValues = true;
    foreach ($vals as $v) {
        if (is_array($v) || is_object($v) || is_bool($v)) { $allNumericValues = false; break; }
        if (is_string($v) && !is_numeric($v)) { $allNumericValues = false; break; }
    }
    if ($allNumericValues && !$allBool) {
        $hasFloat = false; $maxLenNumeric = 0;
        foreach ($vals as $v) {
            $s = (string)$v;
            if (strpos($s, '.') !== false) $hasFloat = true;
            $maxLenNumeric = max($maxLenNumeric, strlen($s));
        }
        if ($hasFloat) {
            return 'DECIMAL(14,2)';
        }
        if ($maxLenNumeric <= 9) return 'INT';
        return 'BIGINT';
    }

    if ($allTS) return 'DATETIME';
    if ($allDate && $n > 0) return 'DATE';

    if ($allStr) {
        if ($n === count($vals)) {
            // check for uuid-ish 36 char
            if ($maxLen === 36) {
                return 'CHAR(36)';
            }
        }
        if ($maxLen <= 255) return "VARCHAR($maxLen)";
        return 'TEXT';
    }

    return 'TEXT';
}

// ============================================================
// COLUMN DEFINITIONS FOR THE 7 EMPTY TABLES (no data rows)
// ============================================================
$emptyTableDefs = [
    'class_teachers' => [
        'id' => 'CHAR(36) NOT NULL',
        'class_id' => 'CHAR(36) NOT NULL',
        'teacher_id' => 'CHAR(36) NOT NULL',
        'role' => 'VARCHAR(50) NULL',
        'assigned_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => ['class_teacher_uniq' => '(class_id, teacher_id)'],
        'INDEX' => [],
        'FK' => [
            'fk_class_teachers_class' => "FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE",
            'fk_class_teachers_teacher' => "FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE",
        ],
    ],
    'assignment_submissions' => [
        'id' => 'CHAR(36) NOT NULL',
        'assignment_id' => 'CHAR(36) NOT NULL',
        'student_id' => 'CHAR(36) NOT NULL',
        'submission_text' => 'TEXT NULL',
        'attachments' => 'JSON NULL',
        'score' => 'DECIMAL(10,2) NULL',
        'feedback' => 'TEXT NULL',
        'submitted_at' => 'DATETIME NULL',
        'graded_at' => 'DATETIME NULL',
        'graded_by' => 'CHAR(36) NULL',
        'status' => 'VARCHAR(20) NOT NULL DEFAULT \'pending\'',
        'created_at' => 'DATETIME NULL',
        'updated_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => ['assignment_student_uniq' => '(assignment_id, student_id)'],
        'INDEX' => [],
        'FK' => [
            'fk_assignment_submissions_assign' => "FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE",
            'fk_assignment_submissions_student' => "FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE",
            'fk_assignment_submissions_gradedby' => "FOREIGN KEY (graded_by) REFERENCES profiles(id) ON DELETE SET NULL",
        ],
    ],
    'exam_unlocks' => [
        'id' => 'CHAR(36) NOT NULL',
        'exam_id' => 'CHAR(36) NOT NULL',
        'student_id' => 'CHAR(36) NOT NULL',
        'requested_by' => 'CHAR(36) NULL',
        'approved_by' => 'CHAR(36) NULL',
        'reason' => 'TEXT NULL',
        'status' => 'VARCHAR(20) NOT NULL DEFAULT \'pending\'',
        'created_at' => 'DATETIME NULL',
        'updated_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => [],
        'INDEX' => ['exam_unlocks_exam_idx' => '(exam_id)', 'exam_unlocks_student_idx' => '(student_id)'],
        'FK' => [
            'fk_exam_unlocks_exam' => "FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE",
            'fk_exam_unlocks_student' => "FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE",
        ],
    ],
    'class_subjects' => [
        'id' => 'CHAR(36) NOT NULL',
        'class_id' => 'CHAR(36) NOT NULL',
        'subject_id' => 'CHAR(36) NOT NULL',
        'created_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => ['class_subject_uniq' => '(class_id, subject_id)'],
        'INDEX' => [],
        'FK' => [
            'fk_class_subjects_class' => "FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE",
            'fk_class_subjects_subject' => "FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE",
        ],
    ],
    'timetable_slots' => [
        'id' => 'CHAR(36) NOT NULL',
        'class_id' => 'CHAR(36) NOT NULL',
        'course_id' => 'CHAR(36) NULL',
        'teacher_id' => 'CHAR(36) NULL',
        'day_of_week' => 'INT NULL',
        'start_time' => 'TIME NULL',
        'end_time' => 'TIME NULL',
        'room' => 'VARCHAR(100) NULL',
        'created_at' => 'DATETIME NULL',
        'updated_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => [],
        'INDEX' => ['timetable_class_idx' => '(class_id)', 'timetable_day_idx' => '(day_of_week)'],
        'FK' => [
            'fk_timetable_class' => "FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE",
            'fk_timetable_course' => "FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL",
            'fk_timetable_teacher' => "FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL",
        ],
    ],
    'recurring_expenses' => [
        'id' => 'CHAR(36) NOT NULL',
        'school_id' => 'CHAR(36) NOT NULL',
        'category_id' => 'CHAR(36) NULL',
        'description' => 'TEXT NULL',
        'amount' => 'DECIMAL(12,2) NULL',
        'currency' => 'CHAR(3) NULL',
        'frequency' => 'VARCHAR(20) NULL',
        'start_date' => 'DATE NULL',
        'next_run_date' => 'DATE NULL',
        'is_active' => 'TINYINT(1) NOT NULL DEFAULT 1',
        'created_at' => 'DATETIME NULL',
        'updated_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => [],
        'INDEX' => ['recurring_exp_school_idx' => '(school_id)', 'recurring_exp_cat_idx' => '(category_id)'],
        'FK' => [
            'fk_recurring_expenses_school' => "FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE",
            'fk_recurring_expenses_cat' => "FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL",
        ],
    ],
    'account_reconciliations' => [
        'id' => 'CHAR(36) NOT NULL',
        'school_id' => 'CHAR(36) NOT NULL',
        'account_id' => 'CHAR(36) NULL',
        'period' => 'CHAR(7) NULL',
        'statement_balance' => 'DECIMAL(14,2) NULL',
        'system_balance' => 'DECIMAL(14,2) NULL',
        'difference' => 'DECIMAL(14,2) NULL',
        'notes' => 'TEXT NULL',
        'reconciled_by' => 'CHAR(36) NULL',
        'reconciled_at' => 'DATETIME NULL',
        'created_at' => 'DATETIME NULL',
        'updated_at' => 'DATETIME NULL',
        'PRIMARY' => 'PRIMARY KEY (id)',
        'UNIQUE' => [],
        'INDEX' => ['recon_school_idx' => '(school_id)', 'recon_account_idx' => '(account_id)'],
        'FK' => [
            'fk_recon_school' => "FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE",
            'fk_recon_account' => "FOREIGN KEY (account_id) REFERENCES financial_accounts(id) ON DELETE SET NULL",
        ],
    ],
];

// ============================================================
// MAIN: DROP + CREATE all tables
// ============================================================

// Columns that MUST be nullable because they are child sides of SET NULL
// foreign keys (or nullable reference columns in the authoritative schema).
// Foreign keys with ON DELETE SET NULL require a NULLABLE child column. These
// are derived from the real FK/relation metadata (the migration schema), not
// from hard-coded guesses.
$nullableRefCols = [
    // child columns of SET NULL foreign keys
    'classes.teacher_id', 'courses.teacher_id', 'assignments.teacher_id',
    'attendance.marked_by', 'grades.graded_by',
    'payment_history.recorded_by', 'payment_history.account_id',
    'exams.subject_id', 'exams.term_id', 'exams.exam_type_id',
    'exams.teacher_id', 'exams.created_by',
    'expenses.category_id', 'expenses.account_id',
    'account_transfers.from_account_id', 'account_transfers.to_account_id',
    'audit_logs.school_id', 'archived_users.school_id',
    // nullable reference columns (not FK-backed, but schema-nullable)
    'assignments.class_id', 'students.parent_id',
    'messages.recipient_id', 'financial_accounts.created_by',
    'subscription_payments.created_by', 'platform_settings.updated_by',
    'school_inquiries.reviewed_by', 'teachers.academic_year_id',
    'teachers.archived_by', 'parents.archived_by', 'students.archived_by',
    'students.academic_year_id', 'schools.created_by', 'students.date_of_birth',
    'expenses.approved_by', 'expenses.updated_by', 'expenses.deleted_by',
    'expenses.recurring_id', 'monthly_closings.reopened_by',
    'subscription_payments.paid_date', 'invoice_job_runs.finished_at',
    'archived_users.user_id', 'students.gender', 'teachers.salary',
];

// Disable FK checks for the whole migration. For robustness, we register a
// shutdown handler so that FOREIGN_KEY_CHECKS is ALWAYS restored to 1, even
// if a fatal error or exception interrupts the script mid-migration.
$GLOBALS['__mysqliOpen'] = true;
$mysqli->query("SET FOREIGN_KEY_CHECKS=0");
register_shutdown_function(function () use ($mysqli) {
    // Only act while the connection is still open (it is closed near the end
    // of the script only AFTER FOREIGN_KEY_CHECKS has already been restored).
    if (!empty($GLOBALS['__mysqliOpen'])) {
        @$mysqli->query("SET FOREIGN_KEY_CHECKS=1");
    }
});

// Drop existing tables in this DB
$res = $mysqli->query("SHOW TABLES");
$existing = [];
if ($res) { while ($row = $res->fetch_array()) { $existing[] = $row[0]; } }
foreach ($existing as $t) {
    $mysqli->query("DROP TABLE IF EXISTS `$t`");
}

// Dependency-ordered table list (parents before children)
$order = [
    'schools', 'profiles', 'user_roles', 'memberships',
    'academic_years', 'terms', 'subjects', 'exam_types', 'exam_policies',
    'grading_scales', 'teachers', 'parents', 'students', 'parent_students',
    'classes', 'class_students', 'class_teachers', 'class_subjects', 'class_fees',
    'courses', 'assignments', 'assignment_submissions', 'attendance',
    'exams', 'exam_unlocks', 'grades', 'timetable_slots', 'learning_materials',
    'financial_accounts', 'expense_categories', 'expense_settings', 'expense_budgets',
    'expenses', 'recurring_expenses', 'account_transfers', 'account_reconciliations',
    'invoice_counters', 'invoice_templates', 'invoices', 'payment_history',
    'monthly_closings', 'invoice_job_runs', 'subscription_payments', 'messages',
    'audit_logs', 'archived_users', 'school_inquiries', 'export_permissions',
    'platform_settings', 'student_fee_overrides',
];

$created = [];
$header_comment = "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n"
 . "/*!40101 SET NAMES " . $ADD_CHARSET . " */;\n"
 . "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n"
 . "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n";

function sql_val($v) {
    if (is_null($v)) return 'NULL';
    if (is_bool($v)) return $v ? '1' : '0';
    if (is_int($v)) return (string)$v;
    if (is_float($v)) return str_replace(',', '.', (string)$v);
    if (is_array($v) || is_object($v)) {
        $json = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) return 'NULL';
        return "'" . mysqli_real_escape_string_safe($json) . "'";
    }
    return "'" . mysqli_real_escape_string_safe((string)$v) . "'";
}

function mysqli_real_escape_string_safe($s) {
    global $mysqli;
    return $mysqli->real_escape_string($s);
}

// Build CREATE statements
$ddl = [];
foreach ($order as $tname) {
    if (isset($emptyTableDefs[$tname])) {
        $def = $emptyTableDefs[$tname];
        $cols = [];
        foreach ($def as $key => $value) {
            if ($key === 'PRIMARY' || $key === 'UNIQUE' || $key === 'INDEX' || $key === 'FK') continue;
            $cols[] = "`$key` $value";
        }
        if (isset($def['PRIMARY'])) $cols[] = $def['PRIMARY'];
        if (isset($def['UNIQUE'])) {
            foreach ($def['UNIQUE'] as $nm => $cols_str) $cols[] = "CONSTRAINT `$nm` UNIQUE $cols_str";
        }
        if (isset($def['INDEX'])) {
            foreach ($def['INDEX'] as $nm => $cols_str) $cols[] = "INDEX `$nm` $cols_str";
        }
        if (isset($def['FK'])) {
            foreach ($def['FK'] as $nm => $fk_sql) $cols[] = "CONSTRAINT `$nm` $fk_sql";
        }
        $ddl[$tname] = "CREATE TABLE `$tname` (\n  " . implode(",\n  ", $cols) . "\n) ENGINE=InnoDB DEFAULT CHARSET=$ADD_CHARSET COLLATE=$ADD_COLLATE;";
        $created[$tname] = true;
        continue;
    }

    $rows = $tables[$tname] ?? [];
    if (!is_array($rows) || count($rows) === 0) {
        fwrite(STDERR, "WARNING: no def or data for table $tname\n");
        continue;
    }

    // Determine columns: union of keys across all rows
    $colNames = [];
    foreach ($rows as $row) {
        if (is_array($row)) { foreach (array_keys($row) as $k) $colNames[$k] = true; }
    }
    $colNames = array_keys($colNames);
    if (count($colNames) === 0) continue;

    // Gather values per column for type inference
    $colValues = [];
    foreach ($colNames as $cn) {
        $colValues[$cn] = [];
        foreach ($rows as $row) {
            $colValues[$cn][] = $row[$cn] ?? null;
        }
    }

    $cols = [];
    $pkCol = 'id';
    $hasPk = in_array('id', $colNames) && $colValues['id'][0] !== null;
    foreach ($colNames as $cn) {
        $t = mysql_type_for_values($colValues[$cn]);
        if ($cn === 'id' && $t === null) $t = 'CHAR(36)';
        if ($cn === 'id') $t = 'CHAR(36)';
        // Reference columns (FK targets) -> CHAR(36) so foreign keys can be added.
        if (preg_match('/^(id|.*_id|.*_by)$/', $cn)) {
            $t = 'CHAR(36)';
        }
        if ($t === null) $t = 'TEXT';
        $nullable = '';
        if ($cn !== 'id') {
            $isNullableRef = in_array($tname . '.' . $cn, $nullableRefCols, true);
            $hasNull = in_array(null, $colValues[$cn], true);
            $nullable = ($hasNull || $isNullableRef) ? '' : ' NOT NULL';
        }
        $cols[] = "`$cn` $t$nullable";
    }
    if ($hasPk) {
        $cols[] = "PRIMARY KEY (`id`)";
    }

    $ddl[$tname] = "CREATE TABLE `$tname` (\n  " . implode(",\n  ", $cols) . "\n) ENGINE=InnoDB DEFAULT CHARSET=$ADD_CHARSET COLLATE=$ADD_COLLATE;";
    $created[$tname] = true;
}

// Execute DDL in order
foreach ($order as $tname) {
    if (!isset($ddl[$tname])) continue;
    $mysqli->query($ddl[$tname]) or die("CREATE TABLE $tname failed: " . $mysqli->error . "\nDDL:\n" . $ddl[$tname] . "\n");
    echo "Created table: $tname\n";
}

// ============================================================
// INSERT DATA
// ============================================================
echo "\n--- Inserting data ---\n";
$report = [];
foreach ($order as $tname) {
    $rows = $tables[$tname] ?? [];
    if (!is_array($rows) || count($rows) === 0) {
        $report[$tname] = 0;
        continue;
    }
    $colNames = [];
    foreach ($rows as $row) { if (is_array($row)) { foreach (array_keys($row) as $k) $colNames[$k] = true; } }
    $colNames = array_keys($colNames);
    $colList = '`' . implode('`,`', $colNames) . '`';
    $inserted = 0;
    foreach ($rows as $row) {
        $vals = [];
        foreach ($colNames as $cn) {
            $vals[] = sql_val($row[$cn] ?? null);
        }
        $sql = "INSERT INTO `$tname` ($colList) VALUES (" . implode(',', $vals) . ")";
        $mysqli->query($sql) or die("INSERT INTO $tname failed: " . $mysqli->error . "\nSQL: $sql\n");
        $inserted++;
    }
    $report[$tname] = $inserted;
    echo "Inserted $inserted into $tname\n";
}

$mysqli->query("SET FOREIGN_KEY_CHECKS=1");

// ============================================================
// VERIFICATION REPORT
// ============================================================
echo "\n=== VERIFICATION REPORT ===\n";
$expected = $backup['meta']['table_counts'] ?? [];
$totalExpected = 0; $totalActual = 0; $mismatches = [];
echo str_pad('TABLE', 30) . str_pad('EXPECTED', 12) . str_pad('ACTUAL', 12) . "STATUS\n";
foreach ($order as $tname) {
    $exp = $expected[$tname] ?? 0;
    $res = $mysqli->query("SELECT COUNT(*) AS c FROM `$tname`");
    $act = $res ? (int)$res->fetch_assoc()['c'] : -1;
    $totalExpected += $exp; $totalActual += $act;
    $status = ($exp === $act) ? 'MATCH' : 'MISMATCH';
    if ($exp !== $act) $mismatches[] = $tname;
    echo str_pad($tname, 30) . str_pad((string)$exp, 12) . str_pad((string)$act, 12) . "$status\n";
}
echo str_pad('TOTAL', 30) . str_pad((string)$totalExpected, 12) . str_pad((string)$totalActual, 12) . "\n";
if (count($mismatches)) {
    echo "\nMISMATCHED TABLES: " . implode(', ', $mismatches) . "\n";
} else {
    echo "\nAll " . count($order) . " tables match.\n";
}

$GLOBALS['__mysqliOpen'] = false;
$mysqli->close();
echo "\nMigration complete.\n";
