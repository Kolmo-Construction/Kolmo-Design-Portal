# LLM Image Analysis POC - Testing Guide

## Phase 0: Proof of Concept

This POC tests the AI-powered construction progress analysis using Claude Vision API.

## Setup Complete ✓

### What's Been Implemented:

1. **ImageAnalysisService** (`server/services/ImageAnalysisService.ts`)
   - Claude 3.5 Sonnet Vision integration
   - Project context fetching
   - Smart image sampling (max 8 per batch)
   - Structured JSON output with confidence scoring
   - Cost calculation utilities

2. **POC API Endpoint** (`server/routes/progressUpdate.routes.ts`)
   - `POST /api/projects/:projectId/updates/analyze-images-poc`
   - Admin-only access
   - Accepts: imageIds array, optional previousReportSummary
   - Returns: Analysis results + cost estimate

3. **Admin Test Interface** (`/admin/image-analysis-poc`)
   - Visual image selection
   - Previous report context input
   - Real-time analysis results display
   - Cost tracking

## Before Testing

### 1. Set Your Anthropic API Key

Edit `.env` and replace the placeholder:

```bash
ANTHROPIC_API_KEY=your-actual-anthropic-api-key-here
```

Get your API key from: https://console.anthropic.com/

### 2. Restart the Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## How to Test

### Step 1: Access the POC Interface

1. Log in as an admin user
2. Navigate to: `http://localhost:5000/admin/image-analysis-poc`

### Step 2: Select Project and Images

1. **Project ID**: Default is `7` (deck painting project)
   - Project 7 has 5 real images from Drive ingestion
   - You can test with any project that has images

2. **Select Images**: Click on images to select them
   - Selected images will have a blue border and checkmark
   - Use "Select All" or "Clear" buttons for convenience

3. **Previous Report** (Optional):
   - Leave empty for first-time analysis
   - For comparative analysis, paste a previous report summary

### Step 3: Run Analysis

1. Click **"Analyze X Images"** button
2. Wait for Claude to process (typically 5-10 seconds)
3. Review the results:
   - Executive Summary
   - Key Observations
   - Progress Estimate by phase
   - Concerns or Issues
   - Recommended Actions
   - Token usage and cost

### Step 4: Evaluate Results

Look for:
- **Accuracy**: Does the analysis match what you see in the images?
- **Specificity**: Is the analysis specific or too generic?
- **Confidence**: What's the confidence score?
- **Cost**: Is the API cost reasonable per analysis?

## Test Data

### Project 7: Deck Painting
- **Location**: 19233 98th Avenue South, Renton, WA
- **Description**: Paint backyard deck from dark brown to rusty red
- **Status**: Planning (0% progress)
- **Images**: 5 progress photos
- **Image IDs**: 8, 9, 10, 11, 12

## Expected Output Structure

```json
{
  "success": true,
  "analysis": {
    "executiveSummary": "2-3 sentence summary...",
    "keyObservations": [
      "Specific observation 1",
      "Specific observation 2"
    ],
    "progressEstimate": {
      "preparation": 50,
      "priming": 25,
      "painting": 10
    },
    "concernsOrIssues": [],
    "recommendedActions": [
      "Suggested next step"
    ],
    "confidence": 0.85,
    "tokensUsed": {
      "input": 15234,
      "output": 512
    }
  },
  "estimatedCost": {
    "inputCost": 0.045,
    "outputCost": 0.008,
    "total": 0.053
  },
  "metadata": {
    "projectId": 7,
    "imagesAnalyzed": 5,
    "timestamp": "2025-12-06T..."
  }
}
```

## Cost Estimates

Based on Claude 3.5 Sonnet pricing:
- Input: $3 per million tokens
- Output: $15 per million tokens

**Per Analysis (5 images)**:
- Estimated input: ~8,000 tokens
- Estimated output: ~1,000 tokens
- **Total cost**: ~$0.04 - $0.06 per analysis

## Troubleshooting

### Error: "Failed to analyze images"
- Check ANTHROPIC_API_KEY is set correctly
- Verify the API key is valid and has credits
- Check server logs for detailed error

### Error: "No images found for project X"
- Verify the project ID exists
- Check that images are assigned to the project
- Query database: `SELECT * FROM admin_images WHERE project_id = X;`

### Images not loading
- Check R2 storage configuration
- Verify BASE_URL environment variable
- Check browser console for CORS errors

## Next Steps (After POC Validation)

If the POC results are satisfactory:

1. **Phase 1**: Production Implementation
   - Extend progressUpdates schema
   - Add progressReportSummaries table
   - Implement batch grouping by date
   - Add prompt/response auditability

2. **Phase 2**: Admin Review Workflow
   - Build review dashboard
   - Add approve/reject/edit functionality
   - Implement publishing mechanism

3. **Phase 3**: Client Portal Integration
   - Filter by visibility status
   - Display approved reports to clients
   - Add client notifications

## Success Criteria

The POC is successful if:
- ✓ Analysis accurately describes visible work
- ✓ Observations are specific, not generic
- ✓ Confidence scores are reasonable (>0.7)
- ✓ Cost per analysis is acceptable (~$0.05)
- ✓ Response time is acceptable (<15 seconds)
- ✓ JSON parsing is reliable (no format errors)

## Feedback

After testing, evaluate:
1. Quality of analysis vs manual reports
2. Time saved compared to manual report writing
3. Value of comparative analysis (with previous reports)
4. Client-readiness of generated summaries
5. Cost-effectiveness at scale
