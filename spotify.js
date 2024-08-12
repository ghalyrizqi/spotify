// Load environment variables from .env file
require('dotenv').config();

const express = require('express');

(async () => {
  const fetch = (await import('node-fetch')).default;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = 'http://localhost:3000';
  const app = express();
  const port = 3000;

  app.get('/login', (req, res) => {
    const scopes = 'user-top-read';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(authUrl);
  });

  app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const tokenData = await getSpotifyAccessTokenUsingAuthCode(code);

    const accessToken = tokenData.access_token;
    res.redirect(`/top-tracks?access_token=${accessToken}`);
  });

  async function getSpotifyAccessTokenUsingAuthCode(code) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    return data;
  }

  app.get('/top-tracks', async (req, res) => {
    const accessToken = req.query.access_token;

    const topTracks = await getTopTracks(accessToken);
    res.send(topTracks?.map(
      ({ name, artists }) =>
        `${name} by ${artists.map(artist => artist.name).join(', ')}`
    ).join('<br>'));
  });

  async function getTopTracks(accessToken) {
    const response = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const data = await response.json();
    return data.items;
  }

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Go to http://localhost:${port}/login to authorize the app`);
  });
})();
