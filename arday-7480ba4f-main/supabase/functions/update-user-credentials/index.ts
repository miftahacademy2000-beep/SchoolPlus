import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateCredentialsRequest {
  user_id: string;
  school_id: string;
  role: "teacher" | "student" | "school_admin";
  new_login_id?: string;
  new_password?: string;
  new_email?: string;
  // Profile fields
  full_name?: string;
  phone?: string;
  // Student fields
  enrollment_number?: string;
  grade?: string;
  date_of_birth?: string;
  parent_id?: string;
  // Teacher fields
  employee_id?: string;
  department?: string;
  subjects?: string[];
}

function generateEmailFromLoginId(loginId: string, schoolId: string, role: string): string {
  const sanitizedLoginId = loginId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const shortSchoolId = schoolId.substring(0, 8);
  return `${sanitizedLoginId}.${shortSchoolId}@${role}.internal`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !currentUser) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check permissions
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", currentUser.id);

    const body: UpdateCredentialsRequest = await req.json();
    const { user_id, school_id, role, new_login_id, new_password, new_email,
      full_name, phone, enrollment_number, grade, date_of_birth, parent_id,
      employee_id, department, subjects } = body;

    const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
    const isSchoolAdmin = roles?.some(
      (r) => r.role === "school_admin" && r.school_id === school_id
    );

    if (!isSuperAdmin && !isSchoolAdmin) {
      throw new Error("You don't have permission to update credentials for this school");
    }

    const hasCredentialChanges = new_login_id || new_password || new_email;
    const hasProfileChanges = full_name !== undefined || phone !== undefined;
    const hasRoleChanges = enrollment_number !== undefined || grade !== undefined || 
      date_of_birth !== undefined || parent_id !== undefined ||
      employee_id !== undefined || department !== undefined || subjects !== undefined;

    if (!hasCredentialChanges && !hasProfileChanges && !hasRoleChanges) {
      throw new Error("Nothing to update.");
    }

    const updates: Record<string, unknown> = {};

    // Update password
    if (new_password) {
      if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
      
      const { error: pwError } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });
      if (pwError) throw new Error(`Failed to update password: ${pwError.message}`);
      
      // Set must_change_password flag
      await adminClient.from("profiles").update({ must_change_password: true }).eq("id", user_id);
      
      updates.password = "updated";
    }

    // Update login ID
    if (new_login_id) {
      if (new_login_id.length < 3 || new_login_id.length > 20) {
        throw new Error("Login ID must be between 3 and 20 characters");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(new_login_id)) {
        throw new Error("Login ID can only contain letters, numbers, hyphens, and underscores");
      }

      const newEmail = generateEmailFromLoginId(new_login_id, school_id, role);

      // Update auth email
      const { error: emailError } = await adminClient.auth.admin.updateUserById(user_id, {
        email: newEmail,
        user_metadata: { login_id: new_login_id },
      });
      if (emailError) throw new Error(`Failed to update login ID: ${emailError.message}`);

      // Update profile email
      await adminClient.from("profiles").update({ email: newEmail }).eq("id", user_id);

      // Update role-specific ID
      if (role === "teacher") {
        await adminClient
          .from("teachers")
          .update({ employee_id: new_login_id })
          .eq("user_id", user_id);
      } else if (role === "student") {
        await adminClient
          .from("students")
          .update({ enrollment_number: new_login_id })
          .eq("user_id", user_id);
      }

      updates.login_id = new_login_id;
      updates.email = newEmail;
    }

    // Update email directly (for school_admin)
    if (new_email && !new_login_id) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(new_email)) {
        throw new Error("Please enter a valid email address");
      }

      const { error: emailError } = await adminClient.auth.admin.updateUserById(user_id, {
        email: new_email,
      });
      if (emailError) throw new Error(`Failed to update email: ${emailError.message}`);

      await adminClient.from("profiles").update({ email: new_email }).eq("id", user_id);

      updates.email = new_email;
    }

    // Update profile fields
    if (hasProfileChanges) {
      const profileUpdate: Record<string, string> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (phone !== undefined) profileUpdate.phone = phone;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profError } = await adminClient
          .from("profiles")
          .update(profileUpdate)
          .eq("id", user_id);
        if (profError) throw new Error(`Failed to update profile: ${profError.message}`);
        updates.profile = profileUpdate;
      }
    }

    // Update role-specific fields
    if (hasRoleChanges) {
      if (role === "student") {
        const studentUpdate: Record<string, unknown> = {};
        if (enrollment_number !== undefined) studentUpdate.enrollment_number = enrollment_number;
        if (grade !== undefined) studentUpdate.grade = grade;
        if (date_of_birth !== undefined) studentUpdate.date_of_birth = date_of_birth || null;
        if (parent_id !== undefined) studentUpdate.parent_id = parent_id;

        if (Object.keys(studentUpdate).length > 0) {
          const { error: stuError } = await adminClient
            .from("students")
            .update(studentUpdate)
            .eq("user_id", user_id)
            .eq("school_id", school_id);
          if (stuError) throw new Error(`Failed to update student: ${stuError.message}`);
          updates.student = studentUpdate;
        }
      } else if (role === "teacher") {
        const teacherUpdate: Record<string, unknown> = {};
        if (employee_id !== undefined) teacherUpdate.employee_id = employee_id;
        if (department !== undefined) teacherUpdate.department = department;
        if (subjects !== undefined) teacherUpdate.subjects = subjects;

        if (Object.keys(teacherUpdate).length > 0) {
          const { error: tchError } = await adminClient
            .from("teachers")
            .update(teacherUpdate)
            .eq("user_id", user_id)
            .eq("school_id", school_id);
          if (tchError) throw new Error(`Failed to update teacher: ${tchError.message}`);
          updates.teacher = teacherUpdate;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updates }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in update-user-credentials:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
