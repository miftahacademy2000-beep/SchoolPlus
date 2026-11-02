import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[month];
    const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-15`;

    // Previous month date ranges
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthName = monthNames[prevMonth];
    const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
    const prevNextMonth = prevMonth === 11 ? 0 : prevMonth + 1;
    const prevNextYear = prevMonth === 11 ? prevYear + 1 : prevYear;
    const prevMonthEnd = `${prevNextYear}-${String(prevNextMonth + 1).padStart(2, "0")}-01`;

    // Get all active schools (even those without monthly_fee — they may have class/student overrides)
    const { data: schools, error: schoolsError } = await supabase
      .from("schools")
      .select("id, name, monthly_fee")
      .eq("status", "active");

    if (schoolsError) {
      console.error("Error fetching schools:", schoolsError);
      return new Response(JSON.stringify({ error: schoolsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!schools || schools.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active schools", generated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalGenerated = 0;
    let totalWithCarryForward = 0;

    for (const school of schools) {
      const schoolDefaultFee = Number(school.monthly_fee) || 0;

      // Fetch students
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, enrollment_number")
        .eq("school_id", school.id);

      if (studentsError) {
        console.error(`Error fetching students for school ${school.id}:`, studentsError);
        continue;
      }
      if (!students || students.length === 0) continue;

      // Fetch student fee overrides for this school
      const { data: studentOverrides } = await supabase
        .from("student_fee_overrides")
        .select("student_id, monthly_fee")
        .eq("school_id", school.id);

      const studentFeeMap = new Map<string, number>();
      if (studentOverrides) {
        for (const o of studentOverrides) {
          studentFeeMap.set(o.student_id, Number(o.monthly_fee));
        }
      }

      // Fetch classes with fee overrides and their enrolled students
      const { data: classesWithFees } = await supabase
        .from("classes")
        .select("id, monthly_fee")
        .eq("school_id", school.id)
        .not("monthly_fee", "is", null)
        .gt("monthly_fee", 0);

      const classFeeMap = new Map<string, number>();
      if (classesWithFees && classesWithFees.length > 0) {
        const classIds = classesWithFees.map((c: any) => c.id);
        const classFeeById = new Map(classesWithFees.map((c: any) => [c.id, Number(c.monthly_fee)]));

        const { data: enrollments } = await supabase
          .from("class_students")
          .select("student_id, class_id")
          .in("class_id", classIds);

        if (enrollments) {
          for (const e of enrollments) {
            const fee = classFeeById.get(e.class_id);
            if (fee !== undefined) {
              // If student is in multiple classes with fees, use the highest
              const existing = classFeeMap.get(e.student_id) || 0;
              if (fee > existing) {
                classFeeMap.set(e.student_id, fee);
              }
            }
          }
        }
      }

      // Check existing invoices for this month
      const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const monthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("student_id")
        .eq("school_id", school.id)
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd)
        .like("title", `%Monthly Fee - ${monthName} ${year}%`);

      const existingStudentIds = new Set(
        (existingInvoices || []).map((inv: any) => inv.student_id)
      );

      // Get previous month's unpaid invoices for carry-forward
      const studentIds = students.map((s) => s.id);
      const { data: prevInvoices } = await supabase
        .from("invoices")
        .select("student_id, amount, status")
        .eq("school_id", school.id)
        .in("student_id", studentIds)
        .gte("due_date", prevMonthStart)
        .lt("due_date", prevMonthEnd);

      const prevBalanceMap = new Map<string, number>();
      if (prevInvoices) {
        for (const inv of prevInvoices) {
          if (inv.status !== "paid" && inv.status !== "cancelled") {
            const current = prevBalanceMap.get(inv.student_id) || 0;
            prevBalanceMap.set(inv.student_id, current + Number(inv.amount));
          }
        }
      }

      // Generate invoices — determine fee per student using priority:
      // 1. Student override → 2. Class fee → 3. School default
      const invoicesToCreate = students
        .filter((s) => !existingStudentIds.has(s.id))
        .map((student) => {
          let baseFee: number;

          if (studentFeeMap.has(student.id)) {
            baseFee = studentFeeMap.get(student.id)!;
          } else if (classFeeMap.has(student.id)) {
            baseFee = classFeeMap.get(student.id)!;
          } else {
            baseFee = schoolDefaultFee;
          }

          // Skip if no fee applies
          if (baseFee <= 0) return null;

          const prevBalance = prevBalanceMap.get(student.id) || 0;
          const totalAmount = baseFee + prevBalance;

          let title = `Monthly Fee - ${monthName} ${year}`;
          let description = `Monthly fee: $${baseFee.toFixed(2)}`;

          if (prevBalance > 0) {
            title += ` (incl. carry-forward)`;
            description += ` | Carry-forward from ${prevMonthName} ${prevYear}: $${prevBalance.toFixed(2)}`;
          }

          return {
            invoice_number: "auto",
            title,
            description,
            amount: totalAmount,
            due_date: dueDate,
            student_id: student.id,
            school_id: school.id,
            status: "pending",
          };
        })
        .filter(Boolean);

      if (invoicesToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("invoices")
          .insert(invoicesToCreate);

        if (insertError) {
          console.error(`Error creating invoices for school ${school.id}:`, insertError);
          continue;
        }

        const withBalance = invoicesToCreate.filter((inv: any) =>
          inv.description.includes("Carry-forward")
        );
        totalGenerated += invoicesToCreate.length;
        totalWithCarryForward += withBalance.length;
        console.log(
          `Generated ${invoicesToCreate.length} invoices for school "${school.name}" (${withBalance.length} with carry-forward)`
        );
      }
    }

    console.log(`Total invoices generated: ${totalGenerated}, with carry-forward: ${totalWithCarryForward}`);

    return new Response(
      JSON.stringify({
        success: true,
        generated: totalGenerated,
        withCarryForward: totalWithCarryForward,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
