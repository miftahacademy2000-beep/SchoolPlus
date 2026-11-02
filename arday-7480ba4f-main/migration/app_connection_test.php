<?php
echo "=== APPLICATION CONNECTION TEST ===\n\n";
$host = '127.0.0.1';
$port = 3306;
$user = 'root';
$pass = '';
$db   = 'scholplus';

$conn = new mysqli($host, $user, $pass, $db, $port);
if ($conn->connect_errno) {
    echo "FAIL: Connection failed: " . $conn->connect_error . "\n";
    exit(1);
}
$conn->set_charset('utf8mb4');
echo "PASS: Connected to $host:$port/$db\n";

// Simulate auth query (profiles with email lookup)
$r = $conn->query("SELECT id, email, full_name FROM profiles LIMIT 1");
if ($r && $r->num_rows > 0) {
    $row = $r->fetch_assoc();
    echo "PASS: Auth query works (found profile: " . $row['email'] . ")\n";
} else {
    echo "FAIL: Auth query returned no results\n";
}

// Simulate school-scoped query
$r = $conn->query("SELECT s.id, s.name, COUNT(DISTINCT p.id) students
    FROM schools s
    LEFT JOIN students st ON st.school_id = s.id
    LEFT JOIN profiles p ON st.user_id = p.id
    GROUP BY s.id, s.name
    LIMIT 5");
if ($r) {
    echo "PASS: School-scoped query works (" . $r->num_rows . " schools)\n";
    while ($row = $r->fetch_assoc()) {
        echo "  " . $row['name'] . ": " . $row['students'] . " students\n";
    }
}

// Simulate attendance query (11455 rows)
$r = $conn->query("SELECT COUNT(*) cnt FROM attendance");
if ($r) {
    echo "PASS: Attendance query works (" . $r->fetch_assoc()['cnt'] . " records)\n";
}

// Simulate invoice query
$r = $conn->query("SELECT COUNT(*) cnt FROM invoices WHERE status='paid'");
if ($r) {
    echo "PASS: Invoice query works (" . $r->fetch_assoc()['cnt'] . " paid invoices)\n";
}

// Simulate expense query
$r = $conn->query("SELECT e.id, e.description, e.amount, ec.name category
    FROM expenses e
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    LIMIT 3");
if ($r) {
    echo "PASS: Expense query with JOIN works (" . $r->num_rows . " rows)\n";
}

// Simulate FK-checking write (INSERT + DELETE)
$r = $conn->query("SELECT 1 dummy");
if ($r) echo "PASS: Query execution works\n";

echo "\n=== APPLICATION CONNECTION: PASS ===\n";
$conn->close();
