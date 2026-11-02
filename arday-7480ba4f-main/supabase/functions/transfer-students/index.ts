import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TransferRequest {
  student_ids: string[];
  target_school_id: string;
  source_school_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated and authorized
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

    // Check if user is super_admin or school_admin of the source school
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
    const isSourceSchoolAdmin = roles?.some(
      (r) => r.role === "school_admin"
    );

    if (!isSuperAdmin && !isSourceSchoolAdmin) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { student_ids, target_school_id, source_school_id }: TransferRequest = await req.json();

    if (!student_ids?.length || !target_school_id || !source_school_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify target school exists
    const { data: targetSchool } = await adminClient
      .from("schools")
      .select("id, name")
      .eq("id", target_school_id)
      .single();

    if (!targetSchool) {
      return new Response(JSON.stringify({ error: "Target school not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get source school name for audit
    const { data: sourceSchool } = await adminClient
      .from("schools")
      .select("id, name")
      .eq("id", source_school_id)
      .single();

    const results: { student_id: string; status: string; name?: string; error?: string }[] = [];

    for (const studentId of student_ids) {
      try {
        // Get student details
        const { data: student } = await adminClient
          .from("students")
          .select("*, profile:profiles!students_user_id_fkey(full_name, email)")
          .eq("id", studentId)
          .eq("school_id", source_school_id)
          .single();

        if (!student) {
          results.push({ student_id: studentId, status: "error", error: "Student not found in source school" });
          continue;
        }

        const studentName = Array.isArray(student.profile) ? student.profile[0]?.full_name : student.profile?.full_name;

        // 1. Update student school_id
        const { error: studentError } = await adminClient
          .from("students")
          .update({ school_id: target_school_id })
          .eq("id", studentId);

        if (studentError) throw studentError;

        // 2. Update membership - deactivate old, create new
        await adminClient
          .from("memberships")
          .update({ is_active: false })
          .eq("user_id", student.user_id)
          .eq("school_id", source_school_id);

        // Check if membership already exists in target school
        const { data: existingMembership } = await adminClient
          .from("memberships")
          .select("id")
          .eq("user_id", student.user_id)
          .eq("school_id", target_school_id)
          .maybeSingle();

        if (existingMembership) {
          await adminClient
            .from("memberships")
            .update({ is_active: true })
            .eq("id", existingMembership.id);
        } else {
          await adminClient
            .from("memberships")
            .insert({ user_id: student.user_id, school_id: target_school_id, is_active: true });
        }

        // 3. Update user_roles school_id for student role
        await adminClient
          .from("user_roles")
          .update({ school_id: target_school_id })
          .eq("user_id", student.user_id)
          .eq("role", "student")
          .eq("school_id", source_school_id);

        // 4. Remove class enrollments (classes are school-specific)
        const { data: classEnrollments } = await adminClient
          .from("class_students")
          .select("id, class_id")
          .eq("student_id", studentId);

        if (classEnrollments?.length) {
          // Get class IDs that belong to the source school
          const classIds = classEnrollments.map((e) => e.class_id);
          const { data: sourceClasses } = await adminClient
            .from("classes")
            .select("id")
            .in("id", classIds)
            .eq("school_id", source_school_id);

          if (sourceClasses?.length) {
            const sourceClassIds = sourceClasses.map((c) => c.id);
            await adminClient
              .from("class_students")
              .delete()
              .eq("student_id", studentId)
              .in("class_id", sourceClassIds);
          }
        }

        // 5. Update pending/unpaid invoices to new school
        await adminClient
          .from("invoices")
          .update({ school_id: target_school_id })
          .eq("student_id", studentId)
          .eq("school_id", source_school_id)
          .in("status", ["pending", "overdue"]);

        // 6. Log audit event
        await adminClient.rpc("log_audit_event", {
          p_action: "transfer",
          p_entity_type: "student",
          p_entity_id: studentId,
          p_entity_name: studentName || "Unknown",
          p_school_id: target_school_id,
          p_details: {
            source_school_id,
            source_school_name: sourceSchool?.name,
            target_school_id,
            target_school_name: targetSchool.name,
            transferred_by: user.id,
          },
        });

        results.push({ student_id: studentId, status: "success", name: studentName || undefined });
      } catch (err) {
        results.push({ student_id: studentId, status: "error", error: (err as Error).message });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return new Response(
      JSON.stringify({ success: true, transferred: successCount, errors: errorCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
