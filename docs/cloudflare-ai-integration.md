# Cloudflare AI Integration Guide
## Free Tier - Forever

---

## Overview

Cloudflare offers several AI services that can be used **completely free** within the hobby tier limits. This guide explains how to integrate these services into the Smile Savers website.

---

## Available AI Services (Free Tier)

| Service | Free Limit | Best Use Case |
|---------|------------|---------------|
| **Workers AI** | 10,000 requests/day | Chatbot, content generation |
| **Vectorize** | 1M queries/month | Semantic search, recommendations |
| **R2 Storage** | 10GB/month | File storage, images |
| **D1 Database** | 5M rows read/day | User data, appointments |

---

## 1. Dental Chatbot (Workers AI)

### Business Benefits

1. **24/7 Availability**: Patients can get answers anytime
2. **Reduced Phone Calls**: Frees up staff time
3. **Instant Answers**: No waiting on hold
4. **Cost Savings**: $0 vs. $500+/month for commercial chatbots
5. **Lead Generation**: Captures potential patients

### Implementation

#### Step 1: Create Cloudflare Worker

```javascript
// workers/chatbot.js
export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { message, history = [] } = await request.json();

      // System prompt for dental assistant
      const systemPrompt = `You are a helpful dental assistant for Smile Savers Dental Clinic in Woodside, Queens, NY.

CLINIC INFORMATION:
- Location: 50-02 43rd Ave, Woodside, NY 11377
- Phone: (718) 205-3333
- Hours: Mon-Thu 9AM-6PM, Fri 9AM-4PM, Sat 9AM-2PM
- Services: General Dentistry, Teeth Cleaning, Teeth Whitening, Dental Implants, Crowns, Emergency Dentistry
- Insurance: Accepts most major insurance plans
- Experience: 35+ years serving the community

GUIDELINES:
- Be friendly, professional, and helpful
- Answer general dental questions
- For emergencies, advise calling (718) 205-3333 immediately
- For appointments, direct to the booking page
- Do NOT provide medical diagnoses
- Always include a disclaimer for medical advice
- Keep responses concise (2-3 sentences max)

DISCLAIMER: Always include: "This information is for educational purposes only. For medical advice, please consult with our dentist."
`;

      // Call Workers AI
      const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return new Response(JSON.stringify({
        response: response.response,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to process request',
        details: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
```

#### Step 2: Deploy Worker

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create worker
wrangler init smile-savers-chatbot

# Deploy
wrangler deploy
```

#### Step 3: Add Chatbot UI Component

```astro
---
// src/components/Chatbot.astro
---

<div class="chatbot-container" id="chatbot">
  <button class="chatbot-toggle" id="chatbot-toggle" aria-label="Open chat">
    <svg><!-- Chat icon --></svg>
  </button>
  
  <div class="chatbot-panel" id="chatbot-panel" hidden>
    <div class="chatbot-header">
      <h3>Smile Savers Assistant</h3>
      <button class="chatbot-close" aria-label="Close chat">×</button>
    </div>
    
    <div class="chatbot-messages" id="chatbot-messages">
      <div class="chatbot-message chatbot-message-bot">
        <p>Hi! I'm here to help with dental questions. How can I assist you today?</p>
        <span class="chatbot-disclaimer">This is for educational purposes only.</span>
      </div>
    </div>
    
    <form class="chatbot-form" id="chatbot-form">
      <input
        type="text"
        class="chatbot-input"
        id="chatbot-input"
        placeholder="Type your question..."
        aria-label="Your message"
      />
      <button type="submit" class="chatbot-send" aria-label="Send message">
        <svg><!-- Send icon --></svg>
      </button>
    </form>
  </div>
</div>

<script>
  const chatbot = {
    history: [],
    apiUrl: 'https://smile-savers-chatbot.your-account.workers.dev',
    
    async sendMessage(message) {
      try {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            history: this.history
          })
        });
        
        const data = await response.json();
        
        // Add to history
        this.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: data.response }
        );
        
        // Keep history manageable (last 10 messages)
        if (this.history.length > 20) {
          this.history = this.history.slice(-20);
        }
        
        return data.response;
      } catch (error) {
        console.error('Chatbot error:', error);
        return 'Sorry, I\'m having trouble connecting. Please call us at (718) 205-3333.';
      }
    }
  };
  
  // UI handlers...
</script>
```

---

## 2. Smart Appointment Booking

### Business Benefits

1. **Natural Language**: "Book me a cleaning next Tuesday morning"
2. **Reduced Friction**: No complex forms
3. **Better Conversion**: Easier = more bookings
4. **Time Savings**: AI suggests available slots

### Implementation

```javascript
// workers/appointment-ai.js
export default {
  async fetch(request, env) {
    const { message } = await request.json();
    
    // Parse natural language to structured data
    const parsePrompt = `Extract appointment details from this message:
"${message}"

Return JSON with:
- service: (cleaning, whitening, implant, crown, emergency, consultation)
- date: (YYYY-MM-DD or relative like "next Tuesday")
- time: (morning, afternoon, evening, or specific time)
- urgency: (routine, soon, emergency)

Example: "I need a cleaning next Tuesday morning" →
{"service": "cleaning", "date": "next Tuesday", "time": "morning", "urgency": "routine"}`;

    const parsed = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
      messages: [{ role: 'user', content: parsePrompt }],
      max_tokens: 200
    });
    
    // Parse the JSON response
    const details = JSON.parse(parsed.response);
    
    // Check availability (query your database)
    const availableSlots = await checkAvailability(details);
    
    return new Response(JSON.stringify({
      understood: details,
      suggestions: availableSlots,
      nextStep: 'select-slot'
    }));
  }
};
```

---

## 3. Content Generation (Blog/SEO)

### Business Benefits

1. **SEO Content**: Fresh blog posts for search rankings
2. **Time Savings**: Generate drafts in seconds
3. **Consistency**: Regular content updates
4. **Cost Savings**: $0 vs. $100+/article for writers

### Implementation

```javascript
// workers/content-generator.js
export default {
  async fetch(request, env) {
    const { topic, type = 'blog' } = await request.json();
    
    const prompts = {
      blog: `Write a 500-word dental blog post about "${topic}" for Smile Savers Dental Clinic.

Requirements:
- Professional but approachable tone
- Include practical tips
- Mention the clinic's 35+ years of experience
- End with a call to action to book an appointment
- SEO-friendly with headers and bullet points`,
      
      faq: `Write a concise FAQ answer for: "${topic}"

Requirements:
- 2-3 sentences
- Easy to understand
- Include when to see a dentist`,
      
      social: `Write a social media post about "${topic}" for Smile Savers Dental Clinic.

Requirements:
- Engaging and friendly
- Include relevant emoji
- Call to action
- Under 280 characters for Twitter`
    };
    
    const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
      messages: [{ role: 'user', content: prompts[type] }],
      max_tokens: 800,
      temperature: 0.8
    });
    
    return new Response(JSON.stringify({
      content: response.response,
      topic,
      type,
      generatedAt: new Date().toISOString()
    }));
  }
};
```

---

## 4. Semantic Search (Vectorize)

### Business Benefits

1. **Better Search**: Find relevant content even with different words
2. **Recommendations**: "Related services" based on content similarity
3. **FAQ Matching**: Match questions to answers intelligently

### Implementation

```javascript
// workers/semantic-search.js
export default {
  async fetch(request, env) {
    const { query } = await request.json();
    
    // Generate embedding for query
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: query
    });
    
    // Search Vectorize index
    const results = await env.VECTORIZE_INDEX.query(embedding.data[0], {
      topK: 5,
      returnMetadata: true
    });
    
    return new Response(JSON.stringify({
      query,
      results: results.matches.map(match => ({
        title: match.metadata.title,
        url: match.metadata.url,
        score: match.score
      }))
    }));
  }
};
```

---

## Cost Analysis

### Current Commercial Solutions

| Service | Monthly Cost |
|---------|-------------|
| Intercom Chatbot | $74-$499 |
| Drift Chatbot | $50-$500 |
| Zendesk Chat | $19-$99 |
| Content Writer | $500-$2000 |
| **Total** | **$643-$3098** |

### Cloudflare AI (Free Tier)

| Service | Monthly Cost |
|---------|-------------|
| Workers AI | $0 (10k/day) |
| Vectorize | $0 (1M queries) |
| R2 Storage | $0 (10GB) |
| **Total** | **$0** |

**Savings: $643-$3,098/month = $7,716-$37,176/year**

---

## Usage Monitoring

### Track Daily Usage

```javascript
// Add to each worker
async function logUsage(env, service, requests) {
  await env.USAGE_KV.put(
    `${service}:${new Date().toISOString().split('T')[0]}`,
    JSON.stringify({ requests, timestamp: Date.now() })
  );
}
```

### Dashboard

Create a simple dashboard to monitor:
- Daily AI requests
- Remaining quota
- Popular queries
- Error rates

---

## Best Practices

### 1. Rate Limiting

```javascript
// Add rate limiting per IP
const rateLimit = new Map();

async function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  const requests = rateLimit.get(ip) || [];
  const recentRequests = requests.filter(t => t > windowStart);
  
  if (recentRequests.length > 10) {
    return false; // Rate limited
  }
  
  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);
  return true;
}
```

### 2. Caching

```javascript
// Cache common responses
const cache = new Map();

async function getCachedResponse(key, fetcher) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const response = await fetcher();
  cache.set(key, response);
  
  // Expire after 1 hour
  setTimeout(() => cache.delete(key), 3600000);
  
  return response;
}
```

### 3. Error Handling

```javascript
// Always provide fallback
async function safeAIRequest(env, prompt) {
  try {
    return await env.AI.run('@cf/meta/llama-2-7b-chat-int8', prompt);
  } catch (error) {
    console.error('AI Error:', error);
    return {
      response: 'I apologize, but I\'m having trouble right now. Please call us at (718) 205-3333 for immediate assistance.'
    };
  }
}
```

### 4. Privacy

```javascript
// Don't store PII
function sanitizeInput(input) {
  return input
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // SSN
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]') // Credit card
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'); // Email
}
```

---

## Deployment Checklist

- [ ] Create Cloudflare account
- [ ] Set up Workers AI
- [ ] Deploy chatbot worker
- [ ] Add chatbot UI component
- [ ] Test on staging
- [ ] Monitor usage
- [ ] Set up alerts for quota
- [ ] Document for team

---

## Next Steps

1. **Week 1**: Deploy basic chatbot
2. **Week 2**: Add appointment AI
3. **Week 3**: Implement content generation
4. **Week 4**: Add semantic search

---

*Guide created: 2026-03-29*
*Cloudflare AI Free Tier Limits subject to change*
