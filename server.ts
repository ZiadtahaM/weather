import express from 'express';
import Redis from 'ioredis';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const API_KEY = process.env.OPENWEATHER_API_KEY || 'dummy_key';

app.get('/weather/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const city = req.query.city as string || 'London';

  const sendWeather = async () => {
    try {
      const cacheKey = `weather:${city}`;
      let data = await redis.get(cacheKey);

      if (!data) {
        // Fetch from OpenWeather
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}`;
        const response = await axios.get(url);
        data = JSON.stringify(response.data);
        await redis.setex(cacheKey, 600, data); // 10 min TTL
      }

      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error(err);
    }
  };

  sendWeather();
  const interval = setInterval(sendWeather, 60000); // Send update every minute

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
