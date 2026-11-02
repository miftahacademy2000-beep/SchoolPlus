<?php
// Round-trip validation: drop scholplus, import scholplus.sql, verify counts.
$host='127.0.0.1'; $user='root'; $pass='';
$dump = __DIR__ . '\scholplus.sql';

$m = new mysqli($host,$user,$pass,'',3306);
if ($m->connect_errno) { die("connect: ".$m->connect_error."\n"); }

echo "Dropping scholplus...\n";
$m->query("DROP DATABASE IF EXISTS scholplus") or die("drop: ".$m->error."\n");

echo "Importing dump...\n";
$sql = file_get_contents($dump);
if ($sql === false) die("cannot read dump\n");
$m->multi_query($sql);
do {
    if ($m->errno) { echo "  SQL error: ".$m->error."\n"; }
} while ($m->more_results() && $m->next_result());
echo "Import done.\n";

// Verify counts
$expected = [
 'schools'=>6,'platform_settings'=>7,'profiles'=>686,'user_roles'=>627,'memberships'=>650,
 'academic_years'=>1,'terms'=>1,'subjects'=>54,'exam_types'=>15,'exam_policies'=>4,'grading_scales'=>15,
 'teachers'=>4,'parents'=>1,'students'=>471,'parent_students'=>2,'classes'=>14,'class_students'=>260,
 'class_teachers'=>0,'class_subjects'=>0,'class_fees'=>14,'student_fee_overrides'=>2,'courses'=>2,
 'assignments'=>1,'assignment_submissions'=>0,'attendance'=>11455,'exams'=>9,'exam_unlocks'=>0,
 'grades'=>7,'timetable_slots'=>0,'learning_materials'=>1,'financial_accounts'=>18,
 'expense_categories'=>113,'expense_settings'=>1,'expense_budgets'=>4,'expenses'=>11,
 'recurring_expenses'=>0,'account_transfers'=>1,'account_reconciliations'=>0,'invoice_counters'=>4,
 'invoice_templates'=>1,'invoices'=>1056,'payment_history'=>167,'monthly_closings'=>1,
 'invoice_job_runs'=>20,'subscription_payments'=>1,'messages'=>3,'audit_logs'=>603,
 'archived_users'=>90,'school_inquiries'=>7,'export_permissions'=>3,
];
$m->select_db('scholplus');
$mismatch=0; $line=[];
$line[]=str_pad('TABLE',28).str_pad('EXPECTED',10).str_pad('ACTUAL',10).'STATUS';
foreach ($expected as $t=>$exp){
  $r=$m->query("SELECT COUNT(*) AS c FROM `$t`");
  $act=$r? (int)$r->fetch_assoc()['c'] : -1;
  $st=($exp===$act)?'MATCH':'MISMATCH';
  if($exp!==$act)$mismatch++;
  $line[]=str_pad($t,28).str_pad((string)$exp,10).str_pad((string)$act,10).$st;
}
// FK count
$r=$m->query("SELECT COUNT(*) AS c FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='scholplus' AND REFERENCED_TABLE_NAME IS NOT NULL");
$line[]='';
$line[]="Foreign keys present after reimport: ".($r?$r->fetch_assoc()['c']:'?');
$line[]= $mismatch===0 ? "ROUND-TRIP OK: all tables import correctly." : "MISMATCHES: $mismatch";

echo implode("\n",$line)."\n";
$m->close();
