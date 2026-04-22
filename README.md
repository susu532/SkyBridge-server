# SkyBridge Server - Render Deployment

This is the server component for Skybridge game, configured for deployment on Render.com.

## Deployment Instructions

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command to: `npm install`
4. Set the start command to: `npm start`
5. Set the environment variable `PORT` to be auto-detected by Render
6. Add any required environment variables (like GEMINI_API_KEY if needed)

## Local Development

To run locally:

```bash
npm install
npm start
```

The server will run on port 3000 by default.
