require('dotenv').config();
const express = require('express');

(async () => {
  const fetch = (await import('node-fetch')).default;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = 'http://localhost:3000';

  const app = express();
  const port = 3000;

  app.get('/', async (req, res) => {
    const code = req.query.code;
    if (code) {
      try {
        const tokenData = await getSpotifyAccessTokenUsingAuthCode(code);
        const accessToken = tokenData.access_token;
        res.redirect(`/tracks?access_token=${accessToken}`);
      } catch (error) {
        console.error('Error getting access token:', error);
        res.send('An error occurred during authentication. Please try again.');
      }
    } else {
      res.send('Welcome to the Spotify Tracks App. <a href="/login">Login with Spotify</a>');
    }
  });

  app.get('/login', (req, res) => {
    const scopes = 'user-top-read';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(authUrl);
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
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    return data;
  }

  app.get('/tracks', async (req, res) => {
    const accessToken = req.query.access_token;
    if (!accessToken) {
      return res.redirect('/');
    }

    try {
      const topTracks = await getTopTracks(accessToken);
      const recommendedTracks = await getRecommendations(accessToken, topTracks);

      const topTracksList = topTracks.map(
        ({ name, artists }) =>
          `${name} by ${artists.map(artist => artist.name).join(', ')}`
      ).join('</li><li>');

      const recommendedTracksList = recommendedTracks.map(
        ({ name, artists }) =>
          `${name} by ${artists.map(artist => artist.name).join(', ')}`
      ).join('</li><li>');

      res.send(`
        <h1>Your Top Tracks</h1>
        <ul>
          <li>${topTracksList}</li>
        </ul>
        <h1>Recommended Tracks</h1>
        <ul>
          <li>${recommendedTracksList}</li>
        </ul>
        <a href="/">Back to Home</a>
      `);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      res.send('An error occurred while fetching your tracks. Please try logging in again.');
    }
  });

  async function fetchSpotifyApi(accessToken, endpoint, method = 'GET', body = null) {
    const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || `Failed to fetch ${endpoint}`);
    }
    return data;
  }

  async function getTopTracks(accessToken) {
    const data = await fetchSpotifyApi(accessToken, 'me/top/tracks?time_range=long_term&limit=5');
    return data.items;
  }

  async function getRecommendations(accessToken, topTracks) {
    const topTracksIds = topTracks.map(track => track.id);
    const data = await fetchSpotifyApi(accessToken, `recommendations?limit=10&seed_tracks=${topTracksIds.join(',')}`);
    return data.tracks;
  }

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Go to http://localhost:${port}/login to authorize the app`);
  });
})();