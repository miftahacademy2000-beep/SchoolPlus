import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check permissions
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
    const isSchoolAdmin = roles?.some((r) => r.role === "school_admin");
    if (!isSuperAdmin && !isSchoolAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { school_id, student_ids, types } = await req.json();
    if (!school_id) {
      return new Response(JSON.stringify({ error: "school_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exportTypes: string[] = types || ["students", "attendance", "grades", "class_enrollments"];
    const result: Record<string, unknown[]> = {};

    // Helper to fetch all rows (bypasses 1000 limit)
    async function fetchAll(query: ReturnType<ReturnType<typeof adminClient.from>["select"]>) {
      const allRows: unknown[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allRows;
    }

    // 1. Students
    let studentQuery = adminClient
      .from("students")
      .select("id, enrollment_number, grade, date_of_birth, parent_id, profile:profiles!students_user_id_fkey(full_name, email, phone)")
      .eq("school_id", school_id);

    if (student_ids?.length) {
      studentQuery = studentQuery.in("id", student_ids);
    }

    const { data: studentsRaw, error: sErr } = await studentQuery;
    if (sErr) throw sErr;

    const students = (studentsRaw || []).map((s: any) => ({
      ...s,
      profile: Array.isArray(s.profile) ? s.profile[0] : s.profile,
    }));

    const studentIdList = students.map((s: any) => s.id);
    if (studentIdList.length === 0) {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build lookup maps
    const studentMap: Record<string, any> = {};
    for (const s of students) {
      (studentMap as any)[(s as any).id] = s;
    }
    const batchSize = 50;

    // Build class lookup for students export
    const classMap: Record<string, any> = {};
    if (exportTypes.includes("students") || exportTypes.includes("class_enrollments")) {
      const { data: classes } = await adminClient
        .from("classes")
        .select("id, name, grade, section")
        .eq("school_id", school_id);
      for (const c of (classes || [])) {
        classMap[c.id] = c;
      }
    }

    // Build student->class enrollments lookup
    const studentClassMap: Record<string, string[]> = {};
    if (exportTypes.includes("students") || exportTypes.includes("class_enrollments")) {
      const allEnrollments: any[] = [];
      for (let i = 0; i < studentIdList.length; i += batchSize) {
        const batch = studentIdList.slice(i, i + batchSize);
        const { data, error } = await adminClient
          .from("class_students")
          .select("student_id, class_id")
          .in("student_id", batch);
        if (error) throw error;
        if (data) allEnrollments.push(...data);
      }
      for (const e of allEnrollments) {
        const className = classMap[e.class_id]?.name || "";
        if (className) {
          if (!studentClassMap[e.student_id]) studentClassMap[e.student_id] = [];
          studentClassMap[e.student_id].push(className);
        }
      }
    }

    if (exportTypes.includes("students")) {
      result.students = students.map((s: any) => ({
        full_name: s.profile?.full_name || "",
        email: s.profile?.email || "",
        phone: s.profile?.phone || "",
        enrollment_number: s.enrollment_number || "",
        className: (studentClassMap[s.id] || []).join(", ") || "",
        grade: s.grade || "",
        date_of_birth: s.date_of_birth || "",
      }));
    }

    // 2. Attendance
    if (exportTypes.includes("attendance")) {
      // Get classes for the school
      const { data: classes } = await adminClient
        .from("classes")
        .select("id, name, grade, section")
        .eq("school_id", school_id);
      const classMap: Record<string, any> = {};
      for (const c of (classes || [])) {
        classMap[c.id] = c;
      }

      const allAttendance: any[] = [];
      for (let i = 0; i < studentIdList.length; i += batchSize) {
        const batch = studentIdList.slice(i, i + batchSize);
        const { data, error } = await adminClient
          .from("attendance")
          .select("student_id, class_id, date, status, notes")
          .in("student_id", batch)
          .order("date", { ascending: true });
        if (error) throw error;
        if (data) allAttendance.push(...data);
      }

      result.attendance = allAttendance.map((a: any) => ({
        enrollment_number: (studentMap[a.student_id] as any)?.enrollment_number || "",
        student_name: (studentMap[a.student_id] as any)?.profile?.full_name || "",
        class_name: classMap[a.class_id]?.name || "",
        date: a.date,
        status: a.status,
        notes: a.notes || "",
      }));
    }

    // 3. Grades
    if (exportTypes.includes("grades")) {
      const { data: courses } = await adminClient
        .from("courses")
        .select("id, code, name")
        .eq("school_id", school_id);
      const courseMap: Record<string, any> = {};
      for (const c of (courses || [])) {
        courseMap[c.id] = c;
      }

      const allGrades: any[] = [];
      for (let i = 0; i < studentIdList.length; i += batchSize) {
        const batch = studentIdList.slice(i, i + batchSize);
        const { data, error } = await adminClient
          .from("grades")
          .select("student_id, course_id, title, grade_type, score, max_score, weight, notes, graded_at")
          .in("student_id", batch);
        if (error) throw error;
        if (data) allGrades.push(...data);
      }

      result.grades = allGrades.map((g: any) => ({
        enrollment_number: (studentMap[g.student_id] as any)?.enrollment_number || "",
        student_name: (studentMap[g.student_id] as any)?.profile?.full_name || "",
        course_code: courseMap[g.course_id]?.code || "",
        course_name: courseMap[g.course_id]?.name || "",
        title: g.title,
        grade_type: g.grade_type,
        score: g.score,
        max_score: g.max_score,
        weight: g.weight || "",
        notes: g.notes || "",
        graded_at: g.graded_at || "",
      }));
    }

    // 4. Class enrollments
    if (exportTypes.includes("class_enrollments")) {
      const allEnrollments: any[] = [];
      for (let i = 0; i < studentIdList.length; i += batchSize) {
        const batch = studentIdList.slice(i, i + batchSize);
        const { data, error } = await adminClient
          .from("class_students")
          .select("student_id, class_id")
          .in("student_id", batch);
        if (error) throw error;
        if (data) allEnrollments.push(...data);
      }

      result.class_enrollments = allEnrollments.map((e: any) => ({
        enrollment_number: (studentMap[e.student_id] as any)?.enrollment_number || "",
        student_name: (studentMap[e.student_id] as any)?.profile?.full_name || "",
        class_name: classMap[e.class_id]?.name || "",
        class_grade: classMap[e.class_id]?.grade || "",
        class_section: classMap[e.class_id]?.section || "",
      }));
    }

    // 5. Courses (student course associations via grades or class->course)
    if (exportTypes.includes("courses")) {
      const { data: courses } = await adminClient
        .from("courses")
        .select("id, code, name, description, credits")
        .eq("school_id", school_id);

      result.courses = (courses || []).map((c: any) => ({
        code: c.code,
        name: c.name,
        description: c.description || "",
        credits: c.credits || "",
      }));
    }


    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
