const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const schools = await prisma.school.findMany({ select: { id: true, name: true }, take: 10 });
    console.log('Schools:', schools.length);
    schools.forEach(s => console.log('  - ' + s.name + ' (' + s.id + ')'));
    
    const students = await prisma.student.findMany({
      select: { id: true, userId: true, schoolId: true, grade: true, archived_at: true, profile: { select: { fullName: true, email: true } } },
      take: 30
    });
    console.log('Students:', students.length);
    students.forEach(s => {
      console.log('  - ' + (s.profile?.fullName || 'Unnamed') + ': schoolId=' + s.schoolId + ', userId=' + s.userId + ', grade=' + s.grade + ', archived=' + (s.archived_at ? 'yes' : 'no'));
    });
    
    const studentCounts = await prisma.student.groupBy({ by: ['schoolId'], _count: true });
    console.log('Students per school:', JSON.stringify(studentCounts));
    
    const exams = await prisma.exams.findMany({ select: { id: true, student_id: true, school_id: true, score: true, max_score: true }, take: 50 });
    console.log('Exams:', exams.length);
    exams.forEach(e => {
      console.log('  - exam ' + e.id + ': student_id=' + e.student_id + ', school_id=' + e.school_id + ', score=' + e.score + '/' + e.max_score);
    });
    
    const attendance = await prisma.attendance.findMany({ select: { id: true, studentId: true, classId: true, status: true }, take: 50 });
    console.log('Attendance:', attendance.length);
    attendance.forEach(a => {
      console.log('  - attendance ' + a.id + ': studentId=' + a.studentId + ', classId=' + a.classId + ', status=' + a.status);
    });
    
    const invoices = await prisma.invoice.findMany({ select: { id: true, studentId: true, schoolId: true, amount: true, status: true, amountPaid: true }, take: 50 });
    console.log('Invoices:', invoices.length);
    invoices.forEach(i => {
      const outstanding = Number(i.amount) - Number(i.amountPaid || 0);
      console.log('  - invoice ' + i.id + ': studentId=' + i.studentId + ', schoolId=' + i.schoolId + ', amount=' + i.amount + ', paid=' + i.amountPaid + ', outstanding=' + outstanding + ', status=' + i.status);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();