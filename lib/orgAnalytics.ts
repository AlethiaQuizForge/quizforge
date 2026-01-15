// Organization Analytics
// Provides aggregated analytics for organization admins

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getOrgMembers, getOrganization, type OrgMember } from './organizations';

// =============================================================================
// Types
// =============================================================================

export interface OrgOverview {
  totalQuizzes: number;
  totalStudents: number;
  totalClasses: number;
  totalSubmissions: number;
  avgScore: number;
  quizzesThisMonth: number;
  activeTeachers: number;
  lastUpdated: Date;
}

export interface TeacherStats {
  id: string;
  name: string;
  email: string;
  quizCount: number;
  classCount: number;
  studentCount: number;
  submissionCount: number;
  avgStudentScore: number;
  lastActive: Date | null;
}

export interface TopicStats {
  topic: string;
  questionCount: number;
  totalAttempts: number;
  correctAttempts: number;
  correctRate: number;
}

export interface OrgAnalyticsData {
  overview: OrgOverview;
  teachers: TeacherStats[];
  topics: TopicStats[];
}

// =============================================================================
// Analytics Fetching
// =============================================================================

/**
 * Get organization overview statistics
 */
export async function getOrgOverview(orgId: string): Promise<OrgOverview> {
  // Try to get cached analytics first
  const cachedRef = doc(db, 'organizations', orgId, 'analytics', 'overview');
  const cachedSnap = await getDoc(cachedRef);

  if (cachedSnap.exists()) {
    const cached = cachedSnap.data();
    const lastUpdated = cached.lastUpdated?.toDate?.() || new Date(0);
    const cacheAge = Date.now() - lastUpdated.getTime();

    // Return cached if less than 5 minutes old
    if (cacheAge < 5 * 60 * 1000) {
      return {
        ...cached,
        lastUpdated,
      } as OrgOverview;
    }
  }

  // Calculate fresh analytics
  const overview = await calculateOrgOverview(orgId);

  // Cache the results
  await setDoc(cachedRef, {
    ...overview,
    lastUpdated: serverTimestamp(),
  });

  return overview;
}

/**
 * Calculate organization overview from source data
 */
async function calculateOrgOverview(orgId: string): Promise<OrgOverview> {
  const org = await getOrganization(orgId);
  if (!org) {
    return getEmptyOverview();
  }

  // Get all members
  const members = await getOrgMembers(orgId);
  const activeMembers = members.filter(m => m.status === 'active');
  const memberIds = activeMembers.map(m => m.userId);

  // Initialize counters
  let totalQuizzes = 0;
  let totalClasses = 0;
  let totalStudents = 0;
  let totalSubmissions = 0;
  let totalScore = 0;
  let quizzesThisMonth = 0;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Aggregate data for each member
  for (const memberId of memberIds) {
    try {
      // Get user's quizzes
      const userDataRef = doc(db, 'userData', `quizforge-data-${memberId}`);
      const userDataSnap = await getDoc(userDataRef);

      if (userDataSnap.exists()) {
        const userData = userDataSnap.data();
        const quizzes = userData.quizzes || [];
        totalQuizzes += quizzes.length;

        // Count quizzes this month
        quizzesThisMonth += quizzes.filter(
          (q: { createdAt: string }) => q.createdAt >= startOfMonth
        ).length;
      }

      // Get user's classes from global classes collection
      const classesQuery = query(
        collection(db, 'classes'),
        where('teacherId', '==', memberId)
      );
      const classesSnap = await getDocs(classesQuery);
      totalClasses += classesSnap.size;

      // Count students in classes
      for (const classDoc of classesSnap.docs) {
        const classData = classDoc.data();
        totalStudents += classData.students?.length || 0;
      }

      // Get submissions for this teacher's assignments
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('teacherId', '==', memberId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);
      const assignmentIds = assignmentsSnap.docs.map(d => d.id);

      // Get submissions for these assignments
      for (const assignmentId of assignmentIds) {
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignmentId)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        totalSubmissions += submissionsSnap.size;

        // Calculate average score
        for (const subDoc of submissionsSnap.docs) {
          const sub = subDoc.data();
          if (typeof sub.score === 'number') {
            totalScore += sub.score;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching data for member ${memberId}:`, error);
    }
  }

  const avgScore = totalSubmissions > 0 ? Math.round(totalScore / totalSubmissions) : 0;

  return {
    totalQuizzes,
    totalStudents,
    totalClasses,
    totalSubmissions,
    avgScore,
    quizzesThisMonth,
    activeTeachers: activeMembers.length,
    lastUpdated: new Date(),
  };
}

/**
 * Get per-teacher statistics
 */
export async function getTeacherStats(orgId: string): Promise<TeacherStats[]> {
  const members = await getOrgMembers(orgId);
  const activeMembers = members.filter(m => m.status === 'active');

  const stats: TeacherStats[] = [];

  for (const member of activeMembers) {
    try {
      let quizCount = 0;
      let classCount = 0;
      let studentCount = 0;
      let submissionCount = 0;
      let totalScore = 0;
      let lastActive: Date | null = null;

      // Get quizzes
      const userDataRef = doc(db, 'userData', `quizforge-data-${member.userId}`);
      const userDataSnap = await getDoc(userDataRef);

      if (userDataSnap.exists()) {
        const userData = userDataSnap.data();
        const quizzes = userData.quizzes || [];
        quizCount = quizzes.length;

        // Find most recent quiz date
        if (quizzes.length > 0) {
          const dates = quizzes
            .map((q: { createdAt: string }) => new Date(q.createdAt))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (dates.length > 0) {
            lastActive = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
          }
        }
      }

      // Get classes
      const classesQuery = query(
        collection(db, 'classes'),
        where('teacherId', '==', member.userId)
      );
      const classesSnap = await getDocs(classesQuery);
      classCount = classesSnap.size;

      for (const classDoc of classesSnap.docs) {
        const classData = classDoc.data();
        studentCount += classData.students?.length || 0;
      }

      // Get submissions
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('teacherId', '==', member.userId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);

      for (const assignmentDoc of assignmentsSnap.docs) {
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignmentDoc.id)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        submissionCount += submissionsSnap.size;

        for (const subDoc of submissionsSnap.docs) {
          const sub = subDoc.data();
          if (typeof sub.score === 'number') {
            totalScore += sub.score;
          }
        }
      }

      const avgStudentScore = submissionCount > 0 ? Math.round(totalScore / submissionCount) : 0;

      stats.push({
        id: member.userId,
        name: member.displayName,
        email: member.email,
        quizCount,
        classCount,
        studentCount,
        submissionCount,
        avgStudentScore,
        lastActive,
      });
    } catch (error) {
      console.error(`Error fetching stats for teacher ${member.userId}:`, error);
    }
  }

  // Sort by quiz count (most active first)
  return stats.sort((a, b) => b.quizCount - a.quizCount);
}

/**
 * Get topic performance statistics across the organization
 */
export async function getTopicStats(orgId: string): Promise<TopicStats[]> {
  const members = await getOrgMembers(orgId);
  const activeMembers = members.filter(m => m.status === 'active');

  const topicMap = new Map<string, { questionCount: number; totalAttempts: number; correctAttempts: number }>();

  for (const member of activeMembers) {
    try {
      // Get assignments for this teacher
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('teacherId', '==', member.userId)
      );
      const assignmentsSnap = await getDocs(assignmentsQuery);

      for (const assignmentDoc of assignmentsSnap.docs) {
        const assignment = assignmentDoc.data();
        const questions = assignment.questions || [];

        // Count questions by topic
        for (const q of questions) {
          const topic = q.topic || 'General';
          if (!topicMap.has(topic)) {
            topicMap.set(topic, { questionCount: 0, totalAttempts: 0, correctAttempts: 0 });
          }
          const entry = topicMap.get(topic)!;
          entry.questionCount++;
        }

        // Get submissions and analyze performance
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignmentDoc.id)
        );
        const submissionsSnap = await getDocs(submissionsQuery);

        for (const subDoc of submissionsSnap.docs) {
          const submission = subDoc.data();
          const answers = submission.answers || [];

          // Analyze each answer
          for (let i = 0; i < Math.min(answers.length, questions.length); i++) {
            const question = questions[i];
            const answer = answers[i];
            const topic = question.topic || 'General';

            if (!topicMap.has(topic)) {
              topicMap.set(topic, { questionCount: 0, totalAttempts: 0, correctAttempts: 0 });
            }
            const entry = topicMap.get(topic)!;
            entry.totalAttempts++;

            // Check if answer was correct
            const correctOption = question.options?.find((o: { isCorrect: boolean }) => o.isCorrect);
            if (correctOption && answer === correctOption.text) {
              entry.correctAttempts++;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching topic stats for ${member.userId}:`, error);
    }
  }

  // Convert to array and calculate rates
  const stats: TopicStats[] = [];
  for (const [topic, data] of topicMap.entries()) {
    stats.push({
      topic,
      questionCount: data.questionCount,
      totalAttempts: data.totalAttempts,
      correctAttempts: data.correctAttempts,
      correctRate: data.totalAttempts > 0 ? Math.round((data.correctAttempts / data.totalAttempts) * 100) : 0,
    });
  }

  // Sort by total attempts (most tested topics first)
  return stats.sort((a, b) => b.totalAttempts - a.totalAttempts);
}

/**
 * Get full analytics data for an organization
 */
export async function getFullOrgAnalytics(orgId: string): Promise<OrgAnalyticsData> {
  const [overview, teachers, topics] = await Promise.all([
    getOrgOverview(orgId),
    getTeacherStats(orgId),
    getTopicStats(orgId),
  ]);

  return { overview, teachers, topics };
}

// =============================================================================
// Real-time Updates
// =============================================================================

/**
 * Increment quiz count in analytics when a quiz is created
 */
export async function incrementOrgQuizCount(orgId: string): Promise<void> {
  const cachedRef = doc(db, 'organizations', orgId, 'analytics', 'overview');
  const cachedSnap = await getDoc(cachedRef);

  if (cachedSnap.exists()) {
    const data = cachedSnap.data();
    await setDoc(cachedRef, {
      ...data,
      totalQuizzes: (data.totalQuizzes || 0) + 1,
      quizzesThisMonth: (data.quizzesThisMonth || 0) + 1,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Update analytics when a submission is completed
 */
export async function updateOrgSubmissionStats(orgId: string, score: number): Promise<void> {
  const cachedRef = doc(db, 'organizations', orgId, 'analytics', 'overview');
  const cachedSnap = await getDoc(cachedRef);

  if (cachedSnap.exists()) {
    const data = cachedSnap.data();
    const currentTotal = data.totalSubmissions || 0;
    const currentAvg = data.avgScore || 0;

    // Calculate new average
    const newTotal = currentTotal + 1;
    const newAvg = Math.round(((currentAvg * currentTotal) + score) / newTotal);

    await setDoc(cachedRef, {
      ...data,
      totalSubmissions: newTotal,
      avgScore: newAvg,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  }
}

// =============================================================================
// Helpers
// =============================================================================

function getEmptyOverview(): OrgOverview {
  return {
    totalQuizzes: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalSubmissions: 0,
    avgScore: 0,
    quizzesThisMonth: 0,
    activeTeachers: 0,
    lastUpdated: new Date(),
  };
}

/**
 * Force refresh analytics cache
 */
export async function refreshOrgAnalytics(orgId: string): Promise<OrgOverview> {
  const overview = await calculateOrgOverview(orgId);

  // Update cache
  const cachedRef = doc(db, 'organizations', orgId, 'analytics', 'overview');
  await setDoc(cachedRef, {
    ...overview,
    lastUpdated: serverTimestamp(),
  });

  return overview;
}
