// app/api/vision/route.ts
// This API route handles image-based PDF text extraction via Claude Vision
// SECURITY: Requires authentication to prevent API credit abuse

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitAsync } from '@/lib/rate-limit';
import { verifyAuthFromRequest } from '@/lib/firebase-admin';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Rate limit: 30 vision requests per hour per authenticated user
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30,
};

// SECURITY: Image size limits to prevent DoS
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
const MAX_TOTAL_SIZE_BYTES = 20 * 1024 * 1024; // 20MB total for all images

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify authentication first
    const auth = await verifyAuthFromRequest(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required. Please sign in to process images.' },
        { status: 401 }
      );
    }

    // Apply rate limiting per authenticated user (more reliable than IP)
    const rateLimitResult = await rateLimitAsync(`vision:${auth.userId}`, RATE_LIMIT_CONFIG);

    if (!rateLimitResult.success) {
      const resetMinutes = Math.ceil(rateLimitResult.resetIn / 60000);
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again in ${resetMinutes} minutes.`,
          retryAfter: rateLimitResult.resetIn
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetIn / 1000)),
          }
        }
      );
    }

    const { images } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    if (images.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 images allowed' },
        { status: 400 }
      );
    }

    // SECURITY: Validate image sizes to prevent DoS attacks
    let totalSize = 0;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      // Validate that each image is a string (base64)
      if (typeof img !== 'string') {
        return NextResponse.json(
          { error: `Image ${i + 1} is not a valid base64 string` },
          { status: 400 }
        );
      }

      // Calculate approximate decoded size (base64 is ~4/3 of original)
      const estimatedSize = Math.ceil((img.length * 3) / 4);

      if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Image ${i + 1} exceeds maximum size of 5MB` },
          { status: 400 }
        );
      }

      totalSize += estimatedSize;
    }

    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Total image size exceeds maximum of 20MB' },
        { status: 400 }
      );
    }

    // Build the content array with images
    const imageContent = images.map((img: string) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: img,
      },
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: 'Extract ALL text content from these PDF page images. Also describe any important visual elements like graphs, charts, diagrams, or figures. Output as clean, readable text organized by page.',
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Vision API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process images' },
      { status: 500 }
    );
  }
}
