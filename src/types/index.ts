// User Types
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: "admin" | "instructor" | "user";
  avatar?: string;
  phone?: string;
  bio?: string;
  level: number;
  points: number;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BasicStatus = "completed" | "pending" | "cancelled";

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  category: "scratch" | "roblox";
  instructorId: string;
  instructor: User;
  price: number;
  duration: number; // in minutes
  level: "beginner" | "intermediate" | "advanced";
  totalModules: number;
  enrolledCount: number;
  rating: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Module Types
export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  duration: number;
  type: "theory" | "video" | "quiz" | "project";
  content: ModuleContent;
  isCompleted?: boolean;
  createdAt: Date;
}

export interface ModuleContent {
  theory?: {
    text: string;
    images?: string[];
    pptUrl?: string;
  };
  video?: {
    url: string;
    transcript?: string;
  };
  quiz?: Quiz;
  project?: {
    title: string;
    description: string;
    requirements: string[];
    resources?: string[];
  };
}

// Quiz Types
export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  passingScore: number;
  timeLimit?: number; // in minutes
}

export interface Question {
  id: string;
  question: string;
  type: "multiple-choice" | "true-false" | "short-answer";
  options?: string[];
  correctAnswer: string | number;
  explanation?: string;
}

// Progress Types
export interface UserProgress {
  id: string;
  userId: string;
  courseId: string;
  completedModules: string[];
  currentModule: string;
  progressPercentage: number;
  lastAccessedAt: Date;
  enrolledAt: Date;
}

// Reward Types
export interface Reward {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  type: "module_completion" | "course_completion" | "streak" | "quiz_perfect";
}

export interface UserReward {
  id: string;
  userId: string;
  rewardId: string;
  reward: Reward;
  earnedAt: Date;
}

// Discussion Types
export interface DiscussionPost {
  id: string;
  userId: string;
  user: User;
  title: string;
  content: string;
  images?: string[];
  likes: number;
  comments: Comment[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: User;
  content: string;
  likes: number;
  createdAt: Date;
}

// Learning Path Types
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  courses: Course[];
  estimatedDuration: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "scratch" | "roblox";
  prerequisites?: string[];
}

// Certificate Types
export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  course: Course;
  issuedAt: Date;
  certificateUrl: string;
  verificationCode: string;
}

// Payment Types
export interface Payment {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  paymentMethod: string;
  transactionId?: string;
  createdAt: Date;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

// ============== Blockly Projects ==============
export interface BlocklyProject {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  // New canonical fields
  workspace_xml?: string | null; // Stored Blockly XML
  code_js?: string | null; // Generated JS code snapshot
  // Legacy aliases (kept for transitional compatibility when older components still reference them)
  blocks_json?: string | null;
  javascript_code?: string | null;
  is_public: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export type NewBlocklyProjectInput = {
  userId: string;
  title: string;
  description?: string;
  blocksJson?: string;
  javascriptCode?: string;
  isPublic?: boolean;
};

export type UpdateBlocklyProjectInput = {
  projectId: string;
  userId: string; // for owner validation client side (RLS protects server side)
  title?: string;
  description?: string;
  blocksJson?: string;
  javascriptCode?: string;
  isPublic?: boolean;
};

export interface SignupData {
  email: string;
  username: string;
  fullName: string;
  role: "instructor" | "user"; // 'user' represents siswa/student
  phone: string;
  bio?: string;
  password: string;
  confirmPassword: string;
}

// UI Types
export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  children?: NavigationItem[];
}

export interface DashboardStats {
  totalUsers?: number;
  totalCourses?: number;
  totalRevenue?: number;
  activeStudents?: number;
  completedCourses?: number;
  totalPoints?: number;
  currentStreak?: number;
  upcomingTasks?: number;
}

// Finance Types
export type MonthlyRevenue = {
  month: string; // YYYY-MM
  revenue: number;
  orders: number;
};

export type RoleDistribution = {
  role: "admin" | "instructor" | "user";
  value: number;
};
export type FinanceTransaction = {
  id: string;
  date: string; // ISO
  userId: string;
  userName: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  // Normalized payment method / channel. Historically values like 'Midtrans', 'Xendit', 'Manual'.
  // New Xendit flow collapses all bank channels to an accepted enum subset (e.g., 'BCA', 'BRI', 'BNI').
  // Keep as string to avoid friction with evolving enum.
  method: string;
  // Payment status normalized: completed | pending | cancelled
  status: BasicStatus;
};

export type Payout = {
  id: string;
  instructorId: string;
  instructorName: string;
  amount: number;
  date: string; // ISO
  status: "paid" | "pending";
};

// Schedule event for user calendar (dashboard)
export interface ScheduleEvent {
  id: string; // uuid
  userId: string;
  title: string;
  category?: string | null; // optional free-form category/tag
  description?: string | null;
  startDate: string; // ISO date or datetime (UTC)
  endDate?: string | null; // optional end date (inclusive)
  createdAt?: string;
  updatedAt?: string;
}
