// server/index.js
console.log("🟢 Starting Express server…");

const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const clientPath = path.join(__dirname, 'client');
app.use(express.static(clientPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

const uri = process.env.MONGO_URI; // Store your MongoDB URI in .env
const client = new MongoClient(uri);
let db;

function usersCollection() {
  return db.collection('users');
}

// Add champion name mapping for database normalization
const champNameMap = {
  Wukong: "MonkeyKing",
  FiddleSticks: "Fiddlesticks",
  Kaisa: "Kaisa",
  Kogmaw: "KogMaw",
  Belveth: "Belveth",
  AurelionSol: "AurelionSol"
};
const normalizeChampion = name => champNameMap[name] || name;

// Add lane mapping for database queries
const laneMap = {
  top: "TOP",
  jungle: "JUNGLE",
  mid: "MIDDLE",
  middle: "MIDDLE",
  bottom: "BOTTOM",
  support: "UTILITY",
  utility: "UTILITY"
};



app.get('/api/match-history', (req, res) => {
  const rawData = fs.readFileSync('./data/match.json'); // adjust path
  const match = JSON.parse(rawData);

  // Simplify match object here
  const participant = match.info.participants.find(p => p.summonerName === 'lolarmon1');

  const summary = {
    gameMode: match.info.gameMode,
    outcome: participant.win ? 'Win' : 'Loss',
    duration: `${Math.floor(match.info.gameDuration / 60)}:${String(match.info.gameDuration % 60).padStart(2, '0')}`,
    kda: `${participant.kills} / ${participant.deaths} / ${participant.assists}`,
    cs: `${participant.totalMinionsKilled} (${(participant.totalMinionsKilled / (match.info.gameDuration / 60)).toFixed(1)})`,
    champLevel: participant.champLevel,
    championId: participant.championId,
    itemIds: [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5],
    summonerSpells: [participant.summoner1Id, participant.summoner2Id],
    runes: participant.perks.styles.map(style => style.selections[0].perk),
    visionScore: participant.visionScore,
    tags: [] // fill in if you want like 'MVP', 'ACE', etc.
  };

  res.json(summary);
});

/**
 * Route 1: Get PUUID from Riot ID
 */
app.get('/api/summoner/:gameName/:tagLine', async (req, res) => {
  const { gameName, tagLine } = req.params;

  try {
    const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
    console.log('➡️ Requesting:', url);

    const response = await fetch(url, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
    });

    const text = await response.text();
    console.log('📥 Riot API Status:', response.status);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch data from Riot API' });
    }

    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Route 2: Get Match IDs from PUUID
 */
app.get('/api/matches/:puuid', async (req, res) => {
  const { puuid } = req.params;
  const count = req.query.count || 20;

  try {
    const matchIdRes = await fetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`,
      {
        headers: { 'X-Riot-Token': process.env.RIOT_API_KEY },
      }
    );

    const matchIds = await matchIdRes.json();
    const matchDetails = [];

    for (const id of matchIds) {
      try {
        // Use our own backend to get match details, which caches in 'matchData'
        const response = await fetch(`${req.protocol}://${req.get('host')}/api/match/${id}`);
        const data = await response.json();
        matchDetails.push(data);
      } catch (err) {
        console.error(`⚠️ Failed to fetch match ${id}:`, err.message);
      }
    }

    const filteredMatches = req.query.mode
      ? matchDetails.filter(m => m.info.gameMode === req.query.mode)
      : matchDetails;

    res.json(filteredMatches);
  } catch (err) {
    console.error('❌ Match fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});



/**
 * Route 3: Get Match Details from Match ID
 */
app.get('/api/match/:matchId', async (req, res) => {
  const { matchId } = req.params;

  try {
    // Use 'matchData' collection for user match data
    const cached = await db.collection('matchData').findOne({ matchId });
    if (cached) {
      console.log(`🔁 Returning cached match: ${matchId}`);
      return res.json(cached.data);
    }

    console.log(`🌐 Fetching from API: ${matchId}`);
    const response = await fetch(
      `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    );
    const data = await response.json();

    await db.collection('matchData').insertOne({ matchId, data });

    res.json(data);
  } catch (err) {
    console.error('❌ Match fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🆕 Route: Get Summoner-v4 info (to get encryptedSummonerId from puuid)
app.get('/api/summoner-id/:puuid', async (req, res) => {
  const { puuid } = req.params;
  try {
    const response = await fetch(`https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });
    const data = await response.json();
    res.json(data); // contains .id = encryptedSummonerId
  } catch (err) {
    console.error("❌ Summoner ID fetch error:", err.message);
    res.status(500).json({ error: 'Failed to fetch summoner ID' });
  }
});

// 🆕 Route: Get ranked info for a summoner by encryptedSummonerId
app.get('/api/ranked/:encryptedSummonerId', async (req, res) => {
  const { encryptedSummonerId } = req.params;
  try {
    // NA region for this dashboard
    const url = `https://na1.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`;
    const response = await fetch(url, {
      headers: { 'X-Riot-Token': process.env.RIOT_API_KEY }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch ranked data' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Ranked fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Route: Get win probability for champion matchup
 * Uses pre-aggregated statistics from MongoDB instead of ML model
 */
app.post('/api/predict', async (req, res) => {
  console.log('🔮 /api/predict endpoint called');
  let { position, champion_A, champion_B } = req.body;
  console.log('➡️ Received from frontend:', { position, champion_A, champion_B });

  if (!position || !champion_A || !champion_B) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const normalizedPosition = laneMap[position.trim().toLowerCase()];
  console.log('🔄 Normalized position:', normalizedPosition);
  if (!normalizedPosition) {
    console.log('❌ Invalid position value:', position);
    return res.status(400).json({ error: 'Invalid position value' });
  }

  champion_A = normalizeChampion(champion_A.trim());
  champion_B = normalizeChampion(champion_B.trim());
  console.log('🔄 Normalized champions:', { champion_A, champion_B });

  try {
    const query = [
      {
        $match: {
          position: normalizedPosition,
          $or: [
            { championA: champion_A, championB: champion_B },
            { championA: champion_B, championB: champion_A }
          ]
        }
      },
      {
        $project: {
          _id: 0,
          probability: {
            $cond: [
              { $eq: ["$gamesPlayed", 0] },
              0.5,
              {
                $cond: [
                  { $eq: ["$championA", champion_A] },
                  { $divide: ["$winsA", "$gamesPlayed"] },
                  { $subtract: [1, { $divide: ["$winsA", "$gamesPlayed"] }] }
                ]
              }
            ]
          }
        }
      }
    ];
    //console.log('🗄️ MongoDB aggregate query:', JSON.stringify(query, null, 2));
    const result = await db.collection('matchupStats').aggregate(query).toArray();
    console.log('📦 MongoDB result:', result);

    if (result.length === 0) {
      console.log('❌ Matchup not found in DB');
      return res.status(404).json({ error: 'Matchup not found' });
    }

    console.log('✅ Returning probability:', result[0].probability);
    res.json({ probability: result[0].probability });
  } catch (err) {
    console.error('Error in /api/predict:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve runeLookup.json and other data files
app.use(
  "/data",
  express.static(path.join(__dirname, "client/assets/data"))
);

// Serve champion.json and other champion files
app.use(
  "/champions",
  express.static(path.join(__dirname, "client/assets/champions"))
);

// User signup
app.post('/api/signup', async (req, res) => {
  try {
    const { email, pw } = req.body;
    if (!email || !pw || pw.length < 8) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const users = usersCollection();
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(pw, 10);
    const user = {
      email,
      passwordHash,
      createdAt: new Date()
    };
    const result = await users.insertOne(user);
    const token = jwt.sign(
      { email, id: result.insertedId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '3m' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, pw } = req.body;
    if (!email || !pw) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const users = usersCollection();
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(pw, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { email, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '3m' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// connect to MongoDB, then start Express
async function start() {
  try {
    await client.connect();
    db = client.db('LoLmatchups');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    app.listen(PORT, () => console.log(`🟢 Server on ${PORT}`));
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}
start();
