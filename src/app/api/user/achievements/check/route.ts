import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseServer";
import { notifications } from "@mantine/notifications";

// Achievement definitions
const ACHIEVEMENTS = {
  first_course: { coins: 10, name: "First Step", image: "1.png" },
  "3_courses": { coins: 25, name: "Knowledge Seeker", image: "2.png" },
  "5_courses": { coins: 50, name: "Dedicated Learner", image: "3.png" },
  quiz_master: { coins: 30, name: "Quiz Master", image: "4.png" },
  perfect_score: { coins: 50, name: "Perfect Score", image: "5.png" },
  assignment_pro: { coins: 40, name: "Assignment Pro", image: "6.png" },
  discussion_star: { coins: 20, name: "Discussion Star", image: "7.png" },
  helper: { coins: 30, name: "Helper", image: "8.png" },
  early_bird: { coins: 15, name: "Early Bird", image: "9.png" },
  consistent: { coins: 40, name: "Consistent", image: "10.png" },
  code_creator: { coins: 35, name: "Code Creator", image: "11.png" },
  rating_giver: { coins: 10, name: "Rating Giver", image: "12.png" },
  "10_courses": { coins: 100, name: "Marathon", image: "13.png" },
  tier_explorer: { coins: 150, name: "Explorer", image: "14.png" },
  tier_master: { coins: 500, name: "Master", image: "15.png" },
};

// POST /api/user/achievements/check
export async function POST(req: NextRequest) {
  try {
    const { userId, trigger } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const newAchievements: string[] = [];

    // Get existing achievements
    const { data: existingAchievements } = await supabaseAdmin
      .from("user_achievements")
      .select("achievement_key")
      .eq("user_id", userId);

    const earned = new Set(
      (existingAchievements || []).map((a) => a.achievement_key)
    );

    // Check course completion achievements
    if (trigger === "course_complete" || trigger === "all") {
      const { count: completedCourses } = await supabaseAdmin
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("progress_percentage", 100);

      const courses = completedCourses || 0;

      if (courses >= 1 && !earned.has("first_course")) {
        await awardAchievement(userId, "first_course");
        newAchievements.push("first_course");
      }
      if (courses >= 3 && !earned.has("3_courses")) {
        await awardAchievement(userId, "3_courses");
        newAchievements.push("3_courses");
      }
      if (courses >= 5 && !earned.has("5_courses")) {
        await awardAchievement(userId, "5_courses");
        newAchievements.push("5_courses");
      }
      if (courses >= 10 && !earned.has("10_courses")) {
        await awardAchievement(userId, "10_courses");
        newAchievements.push("10_courses");
      }
    }

    // Check quiz achievements
    if (trigger === "quiz_complete" || trigger === "all") {
      // Count quizzes with score >80%
      const { data: quizAttempts } = await supabaseAdmin
        .from("quiz_attempts")
        .select("score, passing_score")
        .eq("user_id", userId);

      const highScoreQuizzes =
        quizAttempts?.filter((q) => (q.score || 0) > 80).length || 0;
      const perfectScoreQuizzes =
        quizAttempts?.filter((q) => (q.score || 0) === 100).length || 0;

      if (highScoreQuizzes >= 10 && !earned.has("quiz_master")) {
        await awardAchievement(userId, "quiz_master");
        newAchievements.push("quiz_master");
      }
      if (perfectScoreQuizzes >= 1 && !earned.has("perfect_score")) {
        await awardAchievement(userId, "perfect_score");
        newAchievements.push("perfect_score");
      }
    }

    // Check assignment achievements
    if (trigger === "assignment_submit" || trigger === "all") {
      const { count: assignments } = await supabaseAdmin
        .from("assignment_submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if ((assignments || 0) >= 5 && !earned.has("assignment_pro")) {
        await awardAchievement(userId, "assignment_pro");
        newAchievements.push("assignment_pro");
      }
    }

    // Check discussion achievements
    if (trigger === "discussion_post" || trigger === "all") {
      const { count: posts } = await supabaseAdmin
        .from("discussion_posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", userId);

      if ((posts || 0) >= 10 && !earned.has("discussion_star")) {
        await awardAchievement(userId, "discussion_star");
        newAchievements.push("discussion_star");
      }
    }

    if (trigger === "discussion_comment" || trigger === "all") {
      const { count: comments } = await supabaseAdmin
        .from("discussion_comments")
        .select("id", { count: "exact", head: true })
        .eq("author_id", userId);

      if ((comments || 0) >= 20 && !earned.has("helper")) {
        await awardAchievement(userId, "helper");
        newAchievements.push("helper");
      }
    }

    // Check rating achievements
    if (trigger === "rating" || trigger === "all") {
      const { count: ratings } = await supabaseAdmin
        .from("course_ratings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if ((ratings || 0) >= 5 && !earned.has("rating_giver")) {
        await awardAchievement(userId, "rating_giver");
        newAchievements.push("rating_giver");
      }
    }

    // Check project achievements
    if (trigger === "project_save" || trigger === "all") {
      const { count: projects } = await supabaseAdmin
        .from("blockly_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if ((projects || 0) >= 5 && !earned.has("code_creator")) {
        await awardAchievement(userId, "code_creator");
        newAchievements.push("code_creator");
      }
    }

    // Check tier achievements
    if (trigger === "tier_check" || trigger === "all") {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("points")
        .eq("user_id", userId)
        .maybeSingle();

      const { count: completedCourses } = await supabaseAdmin
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("progress_percentage", 100);

      const pts = student?.points || 0;
      const xp = pts;
      const courses = completedCourses || 0;

      // Explorer tier: xp >= 10000, points >= 20000, courses >= 8
      if (
        xp >= 10000 &&
        pts >= 20000 &&
        courses >= 8 &&
        !earned.has("tier_explorer")
      ) {
        await awardAchievement(userId, "tier_explorer");
        newAchievements.push("tier_explorer");
      }

      // Master tier: xp >= 60000, points >= 120000, courses >= 50
      if (
        xp >= 60000 &&
        pts >= 120000 &&
        courses >= 50 &&
        !earned.has("tier_master")
      ) {
        await awardAchievement(userId, "tier_master");
        newAchievements.push("tier_master");
      }
    }

    return NextResponse.json({
      success: true,
      newAchievements: newAchievements.map((key) => ({
        key,
        name: ACHIEVEMENTS[key as keyof typeof ACHIEVEMENTS].name,
        coins: ACHIEVEMENTS[key as keyof typeof ACHIEVEMENTS].coins,
        image: ACHIEVEMENTS[key as keyof typeof ACHIEVEMENTS].image,
      })),
    });
  } catch (error) {
    console.error("Error checking achievements:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function awardAchievement(userId: string, achievementKey: string) {
  const achievement = ACHIEVEMENTS[achievementKey as keyof typeof ACHIEVEMENTS];
  if (!achievement) return;

  // Insert achievement
  await supabaseAdmin.from("user_achievements").insert({
    user_id: userId,
    achievement_key: achievementKey,
    coins_earned: achievement.coins,
  });

  // Update student coins
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("coins")
    .eq("user_id", userId)
    .maybeSingle();

  const currentCoins = student?.coins || 0;

  await supabaseAdmin
    .from("students")
    .update({ coins: currentCoins + achievement.coins })
    .eq("user_id", userId);
}
