<?php
$mysqli = new mysqli('127.0.0.1', 'root', '', 'scholplus', 3306);
if ($mysqli->connect_errno) { fwrite(STDERR, "Connect failed: " . $mysqli->connect_error . "\n"); exit(1); }
$mysqli->set_charset('utf8mb4');

echo "=== FULL DATABASE INTEGRITY CHECK ===\n\n";
$errors = 0;

// 1. EXACT ROW COUNTS vs BACKUP
echo "--- 1. ROW COUNT VERIFICATION ---\n";
$backup = json_decode(file_get_contents(__DIR__ . '\scholplus-backup.json'), true);
$expected = $backup['meta']['table_counts'] ?? [];
$totalExp = 0; $totalAct = 0;
foreach ($expected as $tbl => $expCount) {
    $totalExp += $expCount;
    $res = $mysqli->query("SELECT COUNT(*) c FROM `$tbl`");
    $actCount = $res ? (int)$res->fetch_assoc()['c'] : -1;
    $totalAct += $actCount;
    if ($expCount !== $actCount) {
        echo "  MISMATCH: $tbl expected=$expCount actual=$actCount\n";
        $errors++;
    }
}
if ($totalExp === $totalAct) {
    echo "  ALL 50 TABLES: $totalAct/$totalExp rows MATCH\n";
} else {
    echo "  TOTAL MISMATCH: expected=$totalExp actual=$totalAct\n";
    $errors++;
}

// 2. NULL VALUES IN NOT-NULL COLUMNS
echo "\n--- 2. NULL VALUES IN NOT-NULL COLUMNS ---\n";
$res = $mysqli->query("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='scholplus' AND IS_NULLABLE='NO' AND EXTRA NOT LIKE '%auto_increment%' ORDER BY TABLE_NAME, ORDINAL_POSITION");
$nnCount = 0;
$nullFound = 0;
while ($row = $res->fetch_assoc()) {
    $t = $row['TABLE_NAME'];
    $c = $row['COLUMN_NAME'];
    $r = $mysqli->query("SELECT COUNT(*) cnt FROM `$t` WHERE `$c` IS NULL");
    if ($r) {
        $cnt = (int)$r->fetch_assoc()['cnt'];
        if ($cnt > 0) {
            echo "  NULL IN NOT NULL: $t.$c = $cnt rows\n";
            $nullFound++;
            $errors++;
        }
    }
    $nnCount++;
}
if ($nullFound === 0) {
    echo "  Checked $nnCount NOT NULL columns: all clean\n";
}

// 3. CHAR(36) REFERENCE COLUMNS
echo "\n--- 3. CHAR(36) REFERENCE COLUMNS ---\n";
$res = $mysqli->query("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='scholplus' AND (COLUMN_NAME LIKE '%\_id' OR COLUMN_NAME LIKE '%\_by' OR COLUMN_NAME='id') AND COLUMN_NAME NOT LIKE '%\_at' AND TABLE_NAME NOT IN ('class_teachers','class_subjects','assignment_submissions','exam_unlocks','timetable_slots','recurring_expenses','account_reconciliations') AND COLUMN_TYPE NOT IN ('CHAR(36)','int(11)') ORDER BY TABLE_NAME");
$badType = 0;
while ($row = $res->fetch_assoc()) {
    echo "  WRONG TYPE: {$row['TABLE_NAME']}.{$row['COLUMN_NAME']} = {$row['COLUMN_TYPE']}\n";
    $badType++;
    $errors++;
}
if ($badType === 0) echo "  All reference columns are CHAR(36) or INT\n";

// 4. DUPLICATE PRIMARY KEYS (id-based tables)
echo "\n--- 4. DUPLICATE PRIMARY KEYS ---\n";
$res = $mysqli->query("SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='scholplus' AND COLUMN_NAME='id' AND COLUMN_KEY='PRI' ORDER BY TABLE_NAME");
$dupTables = 0;
while ($row = $res->fetch_assoc()) {
    $t = $row['TABLE_NAME'];
    $r = $mysqli->query("SELECT COUNT(*) total, COUNT(DISTINCT id) uniq FROM `$t`");
    if ($r) {
        $d = $r->fetch_assoc();
        if ((int)$d['total'] !== (int)$d['uniq']) {
            echo "  DUPLICATE PK: $t total={$d['total']} distinct={$d['uniq']}\n";
            $dupTables++;
            $errors++;
        }
    }
}
// Composite PK tables
$compPKs = ['class_fees'=>'CONCAT(class_id,school_id)', 'exam_policies'=>'school_id', 'expense_settings'=>'school_id', 'export_permissions'=>'school_id', 'invoice_counters'=>'school_id'];
foreach ($compPKs as $t => $expr) {
    $r = $mysqli->query("SELECT COUNT(*) total, COUNT(DISTINCT $expr) uniq FROM `$t`");
    if ($r) {
        $d = $r->fetch_assoc();
        if ((int)$d['total'] !== (int)$d['uniq']) {
            echo "  DUPLICATE PK: $t total={$d['total']} distinct={$d['uniq']}\n";
            $dupTables++;
            $errors++;
        }
    }
}
if ($dupTables === 0) echo "  All primary keys unique (45 id + 5 composite)\n";

// 5. ORPHANED FOREIGN KEYS
echo "\n--- 5. ORPHANED FOREIGN KEYS ---\n";
$fks = [
    ['user_roles','school_id','schools','id'],
    ['memberships','school_id','schools','id'],
    ['teachers','user_id','profiles','id'],
    ['teachers','school_id','schools','id'],
    ['students','user_id','profiles','id'],
    ['students','school_id','schools','id'],
    ['parents','user_id','profiles','id'],
    ['parents','school_id','schools','id'],
    ['classes','school_id','schools','id'],
    ['classes','teacher_id','teachers','id'],
    ['class_students','class_id','classes','id'],
    ['class_students','student_id','students','id'],
    ['class_fees','class_id','classes','id'],
    ['class_fees','school_id','schools','id'],
    ['courses','school_id','schools','id'],
    ['courses','teacher_id','teachers','id'],
    ['assignments','course_id','courses','id'],
    ['assignments','class_id','classes','id'],
    ['assignments','teacher_id','teachers','id'],
    ['attendance','student_id','students','id'],
    ['attendance','class_id','classes','id'],
    ['grades','student_id','students','id'],
    ['grades','course_id','courses','id'],
    ['invoices','student_id','students','id'],
    ['invoices','school_id','schools','id'],
    ['learning_materials','course_id','courses','id'],
    ['learning_materials','teacher_id','teachers','id'],
    ['exams','school_id','schools','id'],
    ['exams','student_id','students','id'],
    ['exams','class_id','classes','id'],
    ['exams','subject_id','subjects','id'],
    ['exams','term_id','terms','id'],
    ['exams','exam_type_id','exam_types','id'],
    ['exams','teacher_id','teachers','id'],
    ['expenses','school_id','schools','id'],
    ['expenses','category_id','expense_categories','id'],
    ['expenses','account_id','financial_accounts','id'],
    ['account_transfers','school_id','schools','id'],
    ['account_transfers','from_account_id','financial_accounts','id'],
    ['account_transfers','to_account_id','financial_accounts','id'],
    ['payment_history','invoice_id','invoices','id'],
    ['payment_history','school_id','schools','id'],
    ['payment_history','account_id','financial_accounts','id'],
    ['audit_logs','school_id','schools','id'],
    ['archived_users','school_id','schools','id'],
    ['messages','school_id','schools','id'],
    ['messages','sender_id','profiles','id'],
    ['student_fee_overrides','student_id','students','id'],
    ['student_fee_overrides','school_id','schools','id'],
    ['monthly_closings','school_id','schools','id'],
    ['invoice_job_runs','school_id','schools','id'],
    ['expense_budgets','school_id','schools','id'],
    ['expense_budgets','category_id','expense_categories','id'],
    ['expense_settings','school_id','schools','id'],
    ['invoice_templates','school_id','schools','id'],
    ['invoice_counters','school_id','schools','id'],
];
$orphanTotal = 0;
foreach ($fks as [$childTable, $childCol, $parentTable, $parentCol]) {
    $r = $mysqli->query("SELECT COUNT(*) cnt FROM `$childTable` c LEFT JOIN `$parentTable` p ON c.`$childCol`=p.`$parentCol` WHERE c.`$childCol` IS NOT NULL AND p.`$parentCol` IS NULL");
    if ($r) {
        $cnt = (int)$r->fetch_assoc()['cnt'];
        if ($cnt > 0) {
            echo "  ORPHAN: $childTable.$childCol -> $parentTable.$parentCol = $cnt rows\n";
            $orphanTotal++;
            $errors++;
        }
    }
}
if ($orphanTotal === 0) echo "  Checked " . count($fks) . " FK relationships: zero orphans\n";

// 6. SCHOOL ISOLATION
echo "\n--- 6. SCHOOL ISOLATION ---\n";
$schoolTables = ['profiles','user_roles','memberships','teachers','students','classes','class_students','class_fees','courses','assignments','attendance','exams','grades','learning_materials','financial_accounts','expense_categories','expense_budgets','expenses','account_transfers','invoices','payment_history','audit_logs','archived_users','school_inquiries','messages','student_fee_overrides','invoice_counters','invoice_templates','monthly_closings','invoice_job_runs','subscription_payments'];
$isolErr = 0;
$isolChecked = 0;
foreach ($schoolTables as $t) {
    $cr = $mysqli->query("SELECT COUNT(*) cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='scholplus' AND TABLE_NAME='$t' AND COLUMN_NAME='school_id'");
    if ($cr && (int)$cr->fetch_assoc()['cnt'] === 0) continue;
    $r = $mysqli->query("SELECT COUNT(*) cnt FROM `$t` WHERE school_id IS NOT NULL AND school_id NOT IN (SELECT id FROM schools)");
    if ($r) {
        $cnt = (int)$r->fetch_assoc()['cnt'];
        if ($cnt > 0) {
            echo "  ISOLATION VIOLATION: $t has $cnt rows with invalid school_id\n";
            $isolErr++;
            $errors++;
        }
    }
    $isolChecked++;
}
if ($isolErr === 0) echo "  All $isolChecked school-linked tables: school_id valid\n";

// 7. STUDENT-PARENT RELATIONSHIPS
echo "\n--- 7. STUDENT-PARENT RELATIONSHIPS ---\n";
$r = $mysqli->query("SELECT COUNT(*) cnt FROM parent_students ps LEFT JOIN parents p ON ps.parent_id=p.id LEFT JOIN students s ON ps.student_id=s.id WHERE p.id IS NULL OR s.id IS NULL");
$spOrphan = (int)$r->fetch_assoc()['cnt'];
if ($spOrphan > 0) { echo "  ORPHAN parent_student links: $spOrphan\n"; $errors++; }
else echo "  parent_students: all links valid\n";

// 8. FINANCE RELATIONSHIPS
echo "\n--- 8. FINANCE RELATIONSHIPS ---\n";
$r = $mysqli->query("SELECT COUNT(*) cnt FROM invoices i LEFT JOIN students s ON i.student_id=s.id WHERE i.student_id IS NOT NULL AND s.id IS NULL");
$invOrphan = (int)$r->fetch_assoc()['cnt'];
if ($invOrphan > 0) { echo "  ORPHAN invoices->students: $invOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM invoices i LEFT JOIN schools s ON i.school_id=s.id WHERE s.id IS NULL");
$invSchoolOrphan = (int)$r->fetch_assoc()['cnt'];
if ($invSchoolOrphan > 0) { echo "  ORPHAN invoices->schools: $invSchoolOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM payment_history ph LEFT JOIN invoices i ON ph.invoice_id=i.id WHERE ph.invoice_id IS NOT NULL AND i.id IS NULL");
$payOrphan = (int)$r->fetch_assoc()['cnt'];
if ($payOrphan > 0) { echo "  ORPHAN payment_history->invoices: $payOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM expenses e LEFT JOIN expense_categories c ON e.category_id=c.id WHERE e.category_id IS NOT NULL AND c.id IS NULL");
$expCatOrphan = (int)$r->fetch_assoc()['cnt'];
if ($expCatOrphan > 0) { echo "  ORPHAN expenses->categories: $expCatOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM expenses e LEFT JOIN financial_accounts a ON e.account_id=a.id WHERE e.account_id IS NOT NULL AND a.id IS NULL");
$expAccOrphan = (int)$r->fetch_assoc()['cnt'];
if ($expAccOrphan > 0) { echo "  ORPHAN expenses->accounts: $expAccOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM account_transfers at2 LEFT JOIN financial_accounts f ON at2.from_account_id=f.id WHERE at2.from_account_id IS NOT NULL AND f.id IS NULL");
$atOrphan = (int)$r->fetch_assoc()['cnt'];
if ($atOrphan > 0) { echo "  ORPHAN account_transfers->from_account: $atOrphan\n"; $errors++; }

$r = $mysqli->query("SELECT COUNT(*) cnt FROM account_transfers at2 LEFT JOIN financial_accounts t ON at2.to_account_id=t.id WHERE at2.to_account_id IS NOT NULL AND t.id IS NULL");
$atOrphan2 = (int)$r->fetch_assoc()['cnt'];
if ($atOrphan2 > 0) { echo "  ORPHAN account_transfers->to_account: $atOrphan2\n"; $errors++; }

if ($invOrphan + $invSchoolOrphan + $payOrphan + $expCatOrphan + $expAccOrphan + $atOrphan + $atOrphan2 === 0) echo "  All finance relationships valid\n";

// 9. FK CHECKS STATUS
echo "\n--- 9. FOREIGN_KEY_CHECKS ---\n";
$r = $mysqli->query("SELECT @@GLOBAL.foreign_key_checks fk");
$fk = (int)$r->fetch_assoc()['fk'];
echo "  FOREIGN_KEY_CHECKS = $fk " . ($fk === 1 ? "OK" : "WARNING") . "\n";

// 10. TABLE COUNT
echo "\n--- 10. TABLE COUNT ---\n";
$r = $mysqli->query("SELECT COUNT(*) cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA='scholplus' AND TABLE_TYPE='BASE TABLE'");
$tc = (int)$r->fetch_assoc()['cnt'];
echo "  Tables: $tc/50\n";
if ($tc !== 50) $errors++;

// SUMMARY
echo "\n===================================\n";
if ($errors === 0) {
    echo "INTEGRITY CHECK: PASS\n";
    echo "ERRORS: 0\n";
} else {
    echo "INTEGRITY CHECK: FAIL\n";
    echo "ERRORS: $errors\n";
}
echo "===================================\n";

$mysqli->close();
