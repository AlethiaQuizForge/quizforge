// app/api/generate/route.ts
// This API route securely proxies requests to Claude API
// Your API key stays on the server, never exposed to clients

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { content, subject, numQuestions, difficulty, topicFocus, questionStyle } = await request.json();

    if (!content || content.length < 100) {
      return NextResponse.json(
        { error: 'Content must be at least 100 characters' },
        { status: 400 }
      );
    }

    const difficultyGuide = {
      basic: 'Focus on recall and basic understanding. Questions should test fundamental concepts.',
      mixed: 'Mix of basic recall (40%), application (40%), and analysis (20%) questions.',
      advanced: 'Focus on analysis, evaluation, and application. Require deep understanding.',
    };

    const questionStyleGuide = {
      concept: `IMPORTANT - CONCEPT-FOCUSED QUESTIONS:
- Extract and test the UNDERLYING THEORIES, FRAMEWORKS, and CONCEPTS from the material
- Do NOT ask about specific company names, dates, or case study details
- Convert case examples into general principle questions
- Example: Instead of "What did Company X do in 2021?", ask "What strategic principle does this scenario illustrate?"
- Focus on transferable knowledge that applies beyond specific examples`,
      case: `CASE-BASED QUESTIONS:
- Test specific details from the cases and examples provided
- Include company names, dates, and specific outcomes
- Ask about what happened in particular scenarios`,
      mixed: `MIX OF CONCEPT AND CASE QUESTIONS:
- 70% concept-focused questions about underlying theories and frameworks
- 30% case-based questions about specific examples`
    };

    const topicFocusInstruction = topicFocus 
      ? `\nTOPIC FOCUS: Generate questions ONLY about: ${topicFocus}. Ignore any content not related to this topic.`
      : '';

    const questionStyleInstruction = questionStyleGuide[questionStyle as keyof typeof questionStyleGuide] || questionStyleGuide.concept;

    const prompt = `You are an expert educational assessment designer. Generate ${numQuestions} high-quality multiple-choice questions based on the following content.

SUBJECT: ${subject || 'General'}
DIFFICULTY: ${difficulty} - ${difficultyGuide[difficulty as keyof typeof difficultyGuide] || difficultyGuide.mixed}${topicFocusInstruction}

QUESTION STYLE:
${questionStyleInstruction}

CONTENT TO ASSESS:
${content.substring(0, 15000)}

REQUIREMENTS:
1. Each question must test understanding, not just memorization
2. All 4 options must be plausible (no obvious wrong answers)
3. Exactly ONE correct answer per question
4. Include brief explanation for the correct answer
5. Tag each question with its main topic
6. Vary difficulty appropriately

OUTPUT FORMAT (valid JSON only):
{
  "questions": [
    {
      "question": "Clear, specific question text?",
      "options": [
        {"text": "Option A text", "isCorrect": false},
        {"text": "Option B text", "isCorrect": true},
        {"text": "Option C text", "isCorrect": false},
        {"text": "Option D text", "isCorrect": false}
      ],
      "explanation": "Brief explanation of why B is correct and common misconceptions",
      "topic": "Main Topic",
      "difficulty": "Basic|Intermediate|Advanced"
    }
  ]
}

Generate exactly ${numQuestions} questions. Return ONLY valid JSON, no markdown.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse and validate the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse quiz response');
    }

    const quizData = JSON.parse(jsonMatch[0]);

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz format');
    }

    return NextResponse.json(quizData);
  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
