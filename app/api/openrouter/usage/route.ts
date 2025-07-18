import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    console.log('Fetching real-time usage from OpenRouter API...');

    // Get credits data (primary source of real data)
    let creditsData = null;
    try {
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/credits', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (creditsResponse.ok) {
        creditsData = await creditsResponse.json();
        console.log('Real credits data:', creditsData);
      }
    } catch (creditsError) {
      console.log('Credits endpoint failed');
    }

    // Get current API key info
    let keyData = null;
    try {
      const keyResponse = await fetch('https://openrouter.ai/api/v1/api-keys/current', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (keyResponse.ok) {
        keyData = await keyResponse.json();
        console.log('Key data:', keyData);
      }
    } catch (keyError) {
      console.log('Key endpoint failed');
    }

    // If we have no real data, return error
    if (!creditsData && !keyData) {
      return NextResponse.json({
        error: 'Failed to fetch any real data from OpenRouter API'
      }, { status: 500 });
    }

    // Extract real values from API responses
    const realBalance = creditsData?.data?.total_credits || creditsData?.balance || creditsData?.credits || 0;
    const realUsage = creditsData?.data?.total_usage || creditsData?.usage || 0;
    const realLimit = creditsData?.data?.limit || keyData?.limit || 25.00;
    
    // Build response with only real data
    const formattedData = {
      currentSession: {
        totalCost: realUsage,
        totalRequests: keyData?.total_requests || 0,
        totalTokens: keyData?.total_tokens || 0,
        inputTokens: keyData?.input_tokens || 0,
        outputTokens: keyData?.output_tokens || 0,
        activeModels: keyData?.models?.length || 0,
        primaryModel: keyData?.models?.[0] || 'unknown',
        lastUsed: new Date().toLocaleTimeString('ko-KR'),
        requestsPerMinute: keyData?.requests_per_minute || 0
      },
      modelUsage: (keyData?.models || []).map((model: any) => ({
        model: model,
        cost: realUsage,
        requests: keyData?.total_requests || 0,
        inputTokens: keyData?.input_tokens || 0,
        outputTokens: keyData?.output_tokens || 0,
        lastUsed: new Date().toLocaleTimeString('ko-KR'),
        isActive: realUsage > 0,
        efficiencyScore: 0,
        usageTrend: [],
        tier: determineModelTier(model)
      })),
      monthly: {
        total_cost: realUsage,
        total_requests: keyData?.total_requests || 0,
        total_tokens: keyData?.total_tokens || 0
      },
      dailyStats: {
        today: realUsage,
        yesterday: 0,
        thisWeek: realUsage,
        thisMonth: realUsage,
      },
      accountInfo: {
        isFreeTier: creditsData?.is_free_tier || keyData?.is_free_tier || false,
        limit: realLimit,
        limitRemaining: realLimit - realUsage,
        rateLimit: keyData?.rate_limit || {},
      },
      // Add real usage statistics for the overview section
      total_cost: realUsage,
      total_requests: keyData?.total_requests || 0,
      top_models: (keyData?.models || []).map((model: any) => ({
        model: model,
        cost: realUsage,
        requests: keyData?.total_requests || 0
      })),
      daily_usage: [{
        date: new Date().toLocaleDateString('ko-KR'),
        cost: realUsage,
        requests: keyData?.total_requests || 0
      }],
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('OpenRouter API error:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch real-time data from OpenRouter',
      lastUpdated: new Date().toISOString()
    });
  }
}

function calculateEfficiencyScore(cost: number, requests: number): number {
  if (requests === 0) return 0;
  const costPerRequest = cost / requests;
  // 효율성 점수 계산 (낮은 비용일수록 높은 점수)
  return Math.max(0, Math.min(10, 10 - (costPerRequest * 1000)));
}

function determineModelTier(modelId: string): 'budget' | 'balanced' | 'premium' {
  if (modelId.includes('claude-3-haiku') || modelId.includes('gpt-3.5') || modelId.includes('mistral')) {
    return 'budget';
  } else if (modelId.includes('claude-3-sonnet') || modelId.includes('gpt-4') || modelId.includes('llama')) {
    return 'balanced';
  } else {
    return 'premium';
  }
}