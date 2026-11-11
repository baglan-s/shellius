package auth

const oauthSuccessHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shellcat - Authorization Complete</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1b2e;
    color: #e4e4e7;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
  }
  .card {
    text-align: center;
    padding: 40px;
    background: #141524;
    border: 1px solid #2a2b3d;
    border-radius: 16px;
    max-width: 400px;
  }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #71717a; font-size: 14px; margin: 0; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">&#10003;</div>
  <h1>Authorization successful</h1>
  <p>You can close this tab and return to Shellcat.</p>
</div>
</body>
</html>`
