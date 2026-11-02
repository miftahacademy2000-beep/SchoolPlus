import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email?: string;
  login_id?: string; // For ID-based login (students, teachers)
  password: string;
  full_name: string;
  role: "school_admin" | "teacher" | "student" | "parent";
  school_id: string;
  // Role-specific fields
  employee_id?: string;
  department?: string;
  subjects?: string[];
  enrollment_number?: string;
  grade?: string;
  date_of_birth?: string;
  phone?: string;
  occupation?: string;
  address?: string;
}

// Generate a pseudo-email for ID-based login
function generateEmailFromLoginId(loginId: string, schoolId: string, role: string): string {
  // Create a unique email that won't conflict with real emails
  // Format: loginId.schoolId@role.internal
  const sanitizedLoginId = loginId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const shortSchoolId = schoolId.substring(0, 8);
  return `${sanitizedLoginId}.${shortSchoolId}@${role}.internal`;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client with user's token to check permissions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const {
      data: { user: currentUser },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !currentUser) {
      throw new Error("Unauthorized");
    }

    // Create admin client for user creation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if current user is super_admin or school_admin for the target school
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", currentUser.id);

    const isSuperAdmin = roles?.some((r) => r.role === "super_admin");
    
    const body: CreateUserRequest = await req.json();
    const { password, full_name, role, school_id, login_id } = body;
    let { email } = body;

    // Check authorization
    const isSchoolAdmin = roles?.some(
      (r) => r.role === "school_admin" && r.school_id === school_id
    );

    if (!isSuperAdmin && !isSchoolAdmin) {
      throw new Error("You don't have permission to create users for this school");
    }

    // Handle ID-based login for students and teachers
    if ((role === "student" || role === "teacher") && login_id && !email) {
      email = generateEmailFromLoginId(login_id, school_id, role);
      console.log(`Generated email for ${role} login ID ${login_id}: ${email}`);
    }

    // Validate required fields
    if (!email || !password || !full_name || !role || !school_id) {
      throw new Error("Missing required fields: email or login_id, password, full_name, role, school_id");
    }

    if (!["school_admin", "teacher", "student", "parent"].includes(role)) {
      throw new Error("Invalid role. Must be school_admin, teacher, student, or parent");
    }

    // Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name,
        login_id: login_id || null, // Store login_id in metadata for reference
      },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    const userId = newUser.user.id;

    // Update the profile with full_name, phone, and set must_change_password = true
    await adminClient
      .from("profiles")
      .update({ 
        full_name, 
        email,
        phone: body.phone || null,
        must_change_password: true  // Force password change on first login
      })
      .eq("id", userId);

    // Add user role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
      school_id,
    });

    if (roleError) {
      console.error("Error adding role:", roleError);
    }

    // Add to school membership
    const { error: membershipError } = await adminClient.from("memberships").insert({
      user_id: userId,
      school_id,
      is_active: true,
    });

    if (membershipError) {
      console.error("Error adding membership:", membershipError);
    }

    // Create role-specific record
    if (role === "teacher") {
      const { error: teacherError } = await adminClient.from("teachers").insert({
        user_id: userId,
        school_id,
        employee_id: body.employee_id || login_id || null,
        department: body.department || null,
        subjects: body.subjects || null,
      });

      if (teacherError) {
        throw new Error(`Failed to create teacher record: ${teacherError.message}`);
      }
    } else if (role === "student") {
      // Use explicit enrollment_number, then login_id, then auto-generate
      let enrollmentNumber = body.enrollment_number || login_id;
      if (!enrollmentNumber) {
        const { data: maxStudent } = await adminClient
          .from("students")
          .select("enrollment_number")
          .eq("school_id", school_id)
          .not("enrollment_number", "is", null)
          .order("created_at", { ascending: false });

        let nextNum = 1;
        if (maxStudent && maxStudent.length > 0) {
          // Find the highest numeric enrollment number
          for (const s of maxStudent) {
            const num = parseInt(s.enrollment_number || "0", 10);
            if (!isNaN(num) && num >= nextNum) {
              nextNum = num + 1;
            }
          }
        }
        enrollmentNumber = String(nextNum).padStart(2, "0");
      }

      const { error: studentError } = await adminClient.from("students").insert({
        user_id: userId,
        school_id,
        enrollment_number: enrollmentNumber,
        grade: body.grade || null,
        date_of_birth: body.date_of_birth || null,
      });

      if (studentError) {
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }
    } else if (role === "parent") {
      const { error: parentError } = await adminClient.from("parents").insert({
        user_id: userId,
        school_id,
        phone: body.phone || null,
        occupation: body.occupation || null,
        address: body.address || null,
      });

      if (parentError) {
        throw new Error(`Failed to create parent record: ${parentError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: `${role} created successfully`,
        login_id: login_id || null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in create-user function:", message);
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});