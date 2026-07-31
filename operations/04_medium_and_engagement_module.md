# Medium & Recurring Engagement Prompt Module

## 1. Medium Engagement Workflow

Employees manually discover two relevant Medium articles daily within assigned categories (Markets, Crypto, Investing, Trading psychology, Financial ambition, Professional frustration, Income growth, Financial freedom).

### Medium Engagement Telegram Instruction Message
```text
MEDIUM DAILY ENGAGEMENT

Account:
@creatorname

Today’s requirement:

Find two recent Medium articles related to:

• Markets
• Cryptocurrency
• Investing
• Trading psychology
• Financial ambition
• Professional frustration
• Income growth
• Financial freedom

For each article:

1. Read the article properly.
2. Copy the full article or the relevant sections.
3. Give the article to GPT using the prompt below.
4. Review the response.
5. Correct anything that feels unnatural or inaccurate.
6. Publish the response from the assigned Medium account.
7. Submit the public response link to this bot.

GPT PROMPT

Read the Medium article provided below and write a thoughtful response that I can publish under it.

The response must:

• Address one specific argument, observation or example from the article  
• Add a useful market observation, interpretation or perspective  
• Add personal experience only when it is true and relevant  
• Sound like a natural market observer and experienced writer  
• Show knowledge without sounding arrogant or excessively technical  
• Avoid generic praise such as “Great article” or “Very informative”  
• Avoid directly promoting Yaga Calls  
• Avoid asking readers to join a group or click a link  
• Avoid guaranteed-return language or exaggerated financial claims  
• Create enough intellectual curiosity for readers to naturally visit the writer’s profile  
• Be between 100 and 180 words  
• Return only the finished response  

ARTICLE:

[Paste the article or relevant sections here]

After publishing both responses:

[Submit Response 1]
[Submit Response 2]
[Report a Problem]
```

### Conversion Funnel Path
```text
Useful response
    ↓
Profile visit
    ↓
Creator articles
    ↓
Understanding Yaga
    ↓
Free Yaga community
```

---

## 2. Platform GPT Prompt Library

The Master File contains platform-specific GPT prompts dispatched dynamically by the bot according to platform, activity type, creator, and strategy. Employees use ChatGPT manually with these supplied prompts:

1. **Medium Responses:** (Prompt text detailed above).
2. **LinkedIn Comments:** Highlighting professional ambition/class mobility without overt self-promotion.
3. **X Replies:** Concise, high-signal market analysis/observation.
4. **CoinMarketCap Comments:** Crypto-native sentiment and token-specific technical insights.
5. **Binance Square Comments:** Market data interpretations and trader commentary.
6. **Reddit Comments:** Community-native advice without promotional link-dropping.
7. **Quora Answers:** Structured educational explanations.
8. **Creator-Specific Caption Rewriting:** Rewriting base captions into individual creator tones.
9. **Article Personalization:** Adapting master articles into creator-specific narratives.
