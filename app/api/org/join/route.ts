// API route for joining an organization
// SECURITY: Verifies user is a teacher before allowing org membership

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthFromRequest, getServerUserData, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { orgId } = await request.json();

    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user is a teacher, not a student
    const userData = await getServerUserData(auth.userId);
    if (!userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    const userRole = (userData as { role?: string }).role;
    if (userRole !== 'teacher') {
      return NextResponse.json(
        { error: 'Only teachers can join organizations. Please create a teacher account.' },
        { status: 403 }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    // Get the organization
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgData = orgDoc.data();
    if (!orgData) {
      return NextResponse.json(
        { error: 'Organization data not found' },
        { status: 404 }
      );
    }

    // Check if already a member
    const memberDoc = await db.collection('organizations').doc(orgId)
      .collection('members').doc(auth.userId).get();

    if (memberDoc.exists) {
      const memberData = memberDoc.data();
      if (memberData?.status === 'active') {
        return NextResponse.json(
          { error: 'You are already a member of this organization' },
          { status: 409 }
        );
      }
      // Reactivate if previously removed
      await db.collection('organizations').doc(orgId)
        .collection('members').doc(auth.userId).update({
          status: 'active',
          joinedAt: FieldValue.serverTimestamp(),
        });
    } else {
      // Check member limit
      const membersSnapshot = await db.collection('organizations').doc(orgId)
        .collection('members').where('status', '==', 'active').get();
      const memberCount = membersSnapshot.size;

      // Get plan limits
      const planLimits: Record<string, number> = {
        school: 25,
        university: 50,
      };
      const maxMembers = planLimits[orgData.plan as string] || 25;

      if (memberCount >= maxMembers) {
        return NextResponse.json(
          { error: `This organization has reached its limit of ${maxMembers} teachers` },
          { status: 403 }
        );
      }

      // Add new member
      await db.collection('organizations').doc(orgId)
        .collection('members').doc(auth.userId).set({
          id: auth.userId,
          orgId,
          userId: auth.userId,
          email: auth.email || (userData as { email?: string }).email || '',
          displayName: (userData as { name?: string }).name || 'Teacher',
          role: 'teacher',
          joinedAt: FieldValue.serverTimestamp(),
          status: 'active',
        });
    }

    return NextResponse.json({
      success: true,
      orgName: orgData.name,
    });
  } catch (error) {
    console.error('Error joining organization:', error);
    return NextResponse.json(
      { error: 'Failed to join organization' },
      { status: 500 }
    );
  }
}
