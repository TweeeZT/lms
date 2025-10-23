import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";
import { sendCertificateEmail } from "../../../../lib/mailer";

export const runtime = "nodejs";

// POST /api/user/certificates - Generate certificate OR submit rating
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, courseId, rating } = body;

    if (!userId || !courseId) {
      return NextResponse.json(
        { success: false, error: "userId and courseId are required" },
        { status: 400 }
      );
    }

    // If rating is provided, handle rating submission
    if (rating !== undefined && rating !== null) {
      // Validate rating (1-5)
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { success: false, error: "Rating must be between 1 and 5" },
          { status: 400 }
        );
      }

      // Check if rating already exists
      const { data: existingRating } = await supabaseAdmin
        .from("course_ratings")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (existingRating) {
        // Update existing rating
        const { error: updateError } = await supabaseAdmin
          .from("course_ratings")
          .update({
            rating: rating,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRating.id);

        if (updateError) {
          return NextResponse.json(
            { success: false, error: "Failed to update rating" },
            { status: 500 }
          );
        }
      } else {
        // Insert new rating
        const { error: insertError } = await supabaseAdmin
          .from("course_ratings")
          .insert({
            user_id: userId,
            course_id: courseId,
            rating: rating,
          });

        if (insertError) {
          return NextResponse.json(
            { success: false, error: "Failed to save rating" },
            { status: 500 }
          );
        }
      }

      // Update course average rating
      const { data: ratings } = await supabaseAdmin
        .from("course_ratings")
        .select("rating")
        .eq("course_id", courseId);

      if (ratings && ratings.length > 0) {
        const avgRating =
          ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length;

        await supabaseAdmin
          .from("courses")
          .update({ rating: avgRating })
          .eq("id", courseId);
      }

      return NextResponse.json({
        success: true,
        message: "Rating saved successfully",
        rating: rating,
      });
    }

    // Otherwise, handle certificate generation
    // Check user role to determine which progress table to use
    const { data: userRoleData } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    const isSchool = userRoleData?.role === "school";

    // Check if user completed the course (100% progress)
    const { data: progress, error: progressError } = await supabaseAdmin
      .from(isSchool ? "school_progress" : "user_progress")
      .select("progress_percentage, completed_modules")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (progressError) {
      return NextResponse.json(
        { success: false, error: "Error checking course progress" },
        { status: 500 }
      );
    }

    if (!progress || progress.progress_percentage < 100) {
      return NextResponse.json(
        { success: false, error: "Course not completed yet" },
        { status: 400 }
      );
    }

    // Check if certificate already exists
    const { data: existingCert, error: certError } = await supabaseAdmin
      .from("certificates")
      .select("id, certificate_url")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (certError && certError.code !== "PGRST116") {
      return NextResponse.json(
        { success: false, error: "Error checking existing certificate" },
        { status: 500 }
      );
    }

    // If certificate already exists, return it
    if (existingCert && existingCert.certificate_url) {
      return NextResponse.json({
        success: true,
        certificateUrl: existingCert.certificate_url,
        message: "Certificate already exists",
      });
    }

    // Get user and course information
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    if (userError) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const { data: course, error: courseError } = await supabaseAdmin
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();

    if (courseError) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    // Generate PDF certificate
    const templatePath = join(
      process.cwd(),
      "public",
      "certificate_template.pdf"
    );
    const templateBytes = readFileSync(templatePath);

    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Get current date
    const currentDate = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const pageHeight = firstPage.getSize().height;
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // name
    const nameY = pageHeight - 214.646 - 39.069 + 8; // naik dikit
    const nameTextWidth = helveticaBold.widthOfTextAtSize(user.full_name, 32);
    firstPage.drawText(user.full_name, {
      x: 352.676 - 10 + 136.834 / 2 - nameTextWidth / 2, // geser agak kiri & tengah
      y: nameY,
      size: 32,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    // course
    const courseY = pageHeight - 307.968 - 24.942 + 6; // naik dikit
    const courseTextWidth = helveticaBold.widthOfTextAtSize(course.title, 20);
    firstPage.drawText(course.title, {
      x: 368.945 - 5 + 103.976 / 2 - courseTextWidth / 2, // geser agak kiri & tengah
      y: courseY,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    // date
    const dateY = pageHeight - 553.575 - 17.207 + 4; // naik dikit
    firstPage.drawText(currentDate, {
      x: 20.189, // biarkan sesuai awal
      y: dateY,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase Storage
    const fileName = `${userId}.pdf`;
    const filePath = `${courseId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("certificate")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload certificate" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("certificate")
      .getPublicUrl(filePath);

    const certificateUrl = urlData.publicUrl;

    // Save certificate record to database
    if (existingCert) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from("certificates")
        .update({
          certificate_url: certificateUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCert.id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: "Failed to update certificate record" },
          { status: 500 }
        );
      }
    } else {
      // Create new record
      const { error: insertError } = await supabaseAdmin
        .from("certificates")
        .insert({
          user_id: userId,
          course_id: courseId,
          certificate_url: certificateUrl,
          issued_date: new Date().toISOString(),
        });

      if (insertError) {
        return NextResponse.json(
          { success: false, error: "Failed to save certificate record" },
          { status: 500 }
        );
      }
    }

    // Kirim email sertifikat setelah berhasil generate
    try {
      await sendCertificateEmail({
        to: user.email,
        fullName: user.full_name,
        courseTitle: course.title,
        certificateUrl,
        isRegenerate: !!existingCert, // true jika sudah ada sertifikat sebelumnya
      });
      console.log("[certificates] Email sertifikat terkirim ke:", user.email);
    } catch (emailErr) {
      // Jangan fail request jika email gagal
      console.error("[certificates] Gagal kirim email sertifikat:", emailErr);
    }

    return NextResponse.json({
      success: true,
      certificateUrl,
      message: "Certificate generated successfully",
    });
  } catch (error) {
    console.error("Certificate generation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/user/certificates?userId=...&courseId=... (single certificate) or ?userId=...&page=1&limit=10&search=... (list)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = (searchParams.get("userId") || "").trim();
  const courseId = (searchParams.get("courseId") || "").trim();

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    // Check if user exists and is authorized
    const { data: actor, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !actor) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // If courseId is provided, return specific certificate
    if (courseId) {
      const sendEmail = searchParams.get("sendEmail") === "true"; // Query param untuk kirim email

      const { data: certificate, error } = await supabaseAdmin
        .from("certificates")
        .select("id, certificate_url, issued_date")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Error fetching certificate" },
          { status: 500 }
        );
      }

      // Get user rating for this course
      const { data: ratingData } = await supabaseAdmin
        .from("course_ratings")
        .select("rating")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!certificate) {
        return NextResponse.json({
          success: true,
          certificate: null,
          rating: ratingData?.rating || null,
          message: "No certificate found",
        });
      }

      // Kirim email jika diminta
      if (sendEmail) {
        try {
          // Ambil user dan course info
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("email, full_name")
            .eq("id", userId)
            .single();

          const { data: course } = await supabaseAdmin
            .from("courses")
            .select("title")
            .eq("id", courseId)
            .single();

          if (user && course) {
            await sendCertificateEmail({
              to: user.email,
              fullName: user.full_name,
              courseTitle: course.title,
              certificateUrl: certificate.certificate_url,
              isRegenerate: false,
            });
            console.log(
              "[certificates] Email sertifikat terkirim (download) ke:",
              user.email
            );
          }
        } catch (emailErr) {
          console.error(
            "[certificates] Gagal kirim email saat download:",
            emailErr
          );
        }
      }

      return NextResponse.json({
        success: true,
        certificate: {
          id: certificate.id,
          url: certificate.certificate_url,
          issuedDate: certificate.issued_date,
        },
        rating: ratingData?.rating || null,
        certificateUrl: certificate.certificate_url, // for backwards compatibility
      });
    }

    // Otherwise, return list of certificates with pagination
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") || 10))
    );
    const search = (searchParams.get("search") || "").trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Query certificates with course information
    let q = supabaseAdmin
      .from("certificates")
      .select(
        `
        id,
        user_id,
        course_id,
        certificate_url,
        issued_date,
        courses:course_id (
          title
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", userId);

    if (search) {
      const term = search.replace(/%/g, "");
      q = q.or(`courses.title.ilike.%${term}%`);
    }

    q = q.order("issued_date", { ascending: false });

    const { data, error, count } = await q.range(from, to);

    if (error) {
      // Fallback: derive certificates from completed courses
      // Check user role
      const { data: userRoleData } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();
      const isSchool = userRoleData?.role === "school";

      const { data: progData, error: pErr } = await supabaseAdmin
        .from(isSchool ? "school_progress" : "user_progress")
        .select("course_id, completed_modules, progress_percentage")
        .eq("user_id", userId)
        .eq("progress_percentage", 100);

      if (pErr) throw pErr;

      const progress: Array<{
        course_id: string;
        completed_modules: string[] | null;
        progress_percentage: number;
      }> = progData || [];

      const courseIds = Array.from(
        new Set(progress.map((p) => p.course_id).filter(Boolean))
      );

      if (!courseIds.length) {
        return NextResponse.json({
          success: true,
          items: [],
          total: 0,
          page,
          limit,
        });
      }

      const { data: courseRows, error: cErr } = await supabaseAdmin
        .from("courses")
        .select("id, title")
        .in("id", courseIds);

      if (cErr) throw cErr;

      const courseMap = new Map(
        (courseRows || []).map((c: { id: string; title: string }) => [
          c.id,
          c.title,
        ])
      );

      let items = progress.map((p) => ({
        id: `virtual_${p.course_id}`,
        user_id: userId,
        course_id: p.course_id,
        course_title: courseMap.get(p.course_id) || "Kursus",
        certificate_url: null,
        issued_date: new Date().toISOString(),
      }));

      if (search) {
        const term = search.toLowerCase();
        items = items.filter((i) =>
          i.course_title.toLowerCase().includes(term)
        );
      }

      const total = items.length;
      const paged = items.slice(from, from + limit);

      return NextResponse.json({
        success: true,
        items: paged,
        total,
        page,
        limit,
      });
    }

    // Format response data (handle relation possibly returned as single object or array)
    const formattedItems = (data || []).map(
      (cert: {
        id: string;
        user_id: string;
        course_id: string;
        certificate_url: string;
        issued_date: string;
        courses?: { title?: string } | { title?: string }[];
      }) => {
        const courseTitle = Array.isArray(cert.courses)
          ? cert.courses[0]?.title
          : cert.courses?.title;
        return {
          id: cert.id,
          user_id: cert.user_id,
          course_id: cert.course_id,
          course_title: courseTitle || "Kursus",
          certificate_url: cert.certificate_url,
          issued_date: cert.issued_date,
        };
      }
    );

    return NextResponse.json({
      success: true,
      items: formattedItems,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to load certificates";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
