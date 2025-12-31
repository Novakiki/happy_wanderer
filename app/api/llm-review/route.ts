import { NextRequest, NextResponse } from 'next/server';
import { runLlmReview } from '@/lib/llm-review';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const why = typeof body.why === 'string' ? body.why : '';

    if (!content.trim()) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }

    const { approve, reasons } = await runLlmReview({ title, content, why });
    return NextResponse.json({
      approve,
      reasons,
      llm_used: true,
    });
  } catch (error) {
    console.error('llm-review error', error);
    return NextResponse.json(
      {
        error: 'Internal error',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
