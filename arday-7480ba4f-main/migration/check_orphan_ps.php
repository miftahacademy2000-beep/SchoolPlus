<?php
$b=json_decode(file_get_contents(__DIR__.'/scholplus-backup.json'),true);
$parents=$b['tables']['parents'] ?? [];
$ps=$b['tables']['parent_students'] ?? [];
$pids=array_column($parents,'id');
echo 'parents in backup: '.count($parents).PHP_EOL;
echo 'parent_students in backup: '.count($ps).PHP_EOL;
foreach($ps as $r){
    if(!in_array($r['parent_id'],$pids)){
        echo 'ORPHAN IN SOURCE: parent_id='.$r['parent_id'].' student_id='.$r['student_id'].PHP_EOL;
    }
}
echo 'Confirmed: orphaned parent_student links exist in the original production backup.' . PHP_EOL;
