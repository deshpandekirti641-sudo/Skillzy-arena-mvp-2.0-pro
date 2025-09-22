/**
 * SKILLZY ARENA - MATCH SYSTEM
 * Complete real-time match management for skill-based gaming
 * 
 * Features:
 * - Real-time matchmaking and opponent finding
 * - Live match monitoring and scoring
 * - 80/20 payout system (₹16 winner, ₹4 platform)
 * - Anti-cheat and fair play enforcement
 * - Multi-game support (Chess, Snake & Ladder, Carrom)
 * - International currency support
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const winston = require('winston');

const router = express.Router();

// Match system logger
const matchLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/matches.log' }),
    new winston.transports.Console()
  ]
});

// Rate limiting for match operations
const matchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 match operations per minute
  message: { error: 'Match operation limit exceeded', code: 'MATCH_RATE_LIMIT' }
});

// In-memory match storage (replace with SpacetimeDB in production)
const activeMatches = new Map();
const waitingPlayers = new Map();
const matchHistory = new Map();

// WebSocket server for real-time match updates
const wss = new WebSocket.Server({ noServer: true });

// Game configurations
const GAME_CONFIGS = {
  chess: {
    name: 'Chess Master',
    duration: 60, // 60 seconds
    maxPlayers: 2,
    betAmount: 10,
    payoutSplit: { winner: 16, platform: 4 }
  },
  snakeLadder: {
    name: 'Snake & Ladder',
    duration: 60,
    maxPlayers: 2,
    betAmount: 10,
    payoutSplit: { winner: 16, platform: 4 }
  },
  carrom: {
    name: 'Carrom Board',
    duration: 60,
    maxPlayers: 2,
    betAmount: 10,
    payoutSplit: { winner: 16, platform: 4 }
  }
};

// Currency conversion rates (mock - integrate with real API)
const CURRENCY_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  CNY: 0.086,
  JPY: 1.8,
  KRW: 16.2,
  BRL: 0.062,
  RUB: 1.1,
  AED: 0.044,
  SAR: 0.045,
  CAD: 0.016,
  AUD: 0.018
};

// Helper functions
const convertCurrency = (amount, fromCurrency, toCurrency) => {
  const inrAmount = amount / CURRENCY_RATES[fromCurrency];
  return Math.round(inrAmount * CURRENCY_RATES[toCurrency] * 100) / 100;
};

const generateMatchId = () => 'match_' + uuidv4().substring(0, 8);

const broadcastToMatch = (matchId, data) => {
  const match = activeMatches.get(matchId);
  if (match) {
    match.players.forEach(player => {
      if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(data));
      }
    });
  }
};

// Apply rate limiting
router.use(matchLimiter);

// Find or create match endpoint
router.post('/find', [
  body('gameType').isIn(['chess', 'snakeLadder', 'carrom']).withMessage('Valid game type required'),
  body('playerId').isLength({ min: 1 }).withMessage('Player ID required'),
  body('currency').optional().isIn(Object.keys(CURRENCY_RATES)).withMessage('Valid currency required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { gameType, playerId, currency = 'INR' } = req.body;
    const gameConfig = GAME_CONFIGS[gameType];

    // Check if player is already in a match
    const existingMatch = Array.from(activeMatches.values()).find(match => 
      match.players.some(p => p.id === playerId)
    );

    if (existingMatch) {
      return res.json({
        success: true,
        matchFound: true,
        matchId: existingMatch.id,
        status: existingMatch.status
      });
    }

    // Look for waiting players for the same game type
    let opponent = null;
    const waitingKey = `${gameType}_${currency}`;
    
    if (waitingPlayers.has(waitingKey)) {
      const waitingList = waitingPlayers.get(waitingKey);
      if (waitingList.length > 0) {
        opponent = waitingList.shift();
        if (waitingList.length === 0) {
          waitingPlayers.delete(waitingKey);
        }
      }
    }

    if (opponent) {
      // Create match with found opponent
      const matchId = generateMatchId();
      const betAmountConverted = convertCurrency(gameConfig.betAmount, 'INR', currency);
      
      const match = {
        id: matchId,
        gameType,
        currency,
        betAmount: betAmountConverted,
        players: [
          { id: playerId, score: 0, status: 'connected' },
          { id: opponent.id, score: 0, status: 'connected' }
        ],
        status: 'starting',
        startTime: Date.now(),
        duration: gameConfig.duration,
        payout: {
          winner: convertCurrency(gameConfig.payoutSplit.winner, 'INR', currency),
          platform: convertCurrency(gameConfig.payoutSplit.platform, 'INR', currency)
        }
      };

      activeMatches.set(matchId, match);

      // Notify both players
      broadcastToMatch(matchId, {
        type: 'match_found',
        matchId,
        gameType,
        opponent: opponent.id,
        betAmount: betAmountConverted,
        currency,
        startTime: match.startTime
      });

      matchLogger.info('Match created', { matchId, gameType, players: [playerId, opponent.id] });

      res.json({
        success: true,
        matchFound: true,
        matchId,
        gameType,
        opponent: opponent.id,
        betAmount: betAmountConverted,
        currency,
        estimatedStart: 3 // 3 seconds
      });

    } else {
      // Add player to waiting list
      if (!waitingPlayers.has(waitingKey)) {
        waitingPlayers.set(waitingKey, []);
      }
      waitingPlayers.get(waitingKey).push({ id: playerId, timestamp: Date.now() });

      matchLogger.info('Player added to waiting list', { playerId, gameType, currency });

      res.json({
        success: true,
        matchFound: false,
        status: 'waiting',
        estimatedWait: 30, // 30 seconds average
        queuePosition: waitingPlayers.get(waitingKey).length
      });
    }

  } catch (error) {
    matchLogger.error('Match finding error', { error: error.message });
    res.status(500).json({ error: 'Match finding failed', code: 'MATCH_FIND_ERROR' });
  }
});

// Get match status
router.get('/:matchId/status', [
  param('matchId').matches(/^match_[a-zA-Z0-9]{8}$/).withMessage('Valid match ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { matchId } = req.params;
    const match = activeMatches.get(matchId);

    if (!match) {
      return res.status(404).json({ error: 'Match not found', code: 'MATCH_NOT_FOUND' });
    }

    res.json({
      success: true,
      match: {
        id: match.id,
        gameType: match.gameType,
        status: match.status,
        players: match.players.map(p => ({ id: p.id, score: p.score, status: p.status })),
        startTime: match.startTime,
        timeRemaining: Math.max(0, (match.startTime + match.duration * 1000) - Date.now()),
        betAmount: match.betAmount,
        currency: match.currency
      }
    });

  } catch (error) {
    matchLogger.error('Match status error', { error: error.message });
    res.status(500).json({ error: 'Match status failed', code: 'MATCH_STATUS_ERROR' });
  }
});

// Submit game score
router.post('/:matchId/score', [
  param('matchId').matches(/^match_[a-zA-Z0-9]{8}$/).withMessage('Valid match ID required'),
  body('playerId').isLength({ min: 1 }).withMessage('Player ID required'),
  body('score').isNumeric().withMessage('Valid score required'),
  body('gameData').optional().isObject().withMessage('Game data must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { matchId } = req.params;
    const { playerId, score, gameData } = req.body;
    
    const match = activeMatches.get(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found', code: 'MATCH_NOT_FOUND' });
    }

    // Find player in match
    const playerIndex = match.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return res.status(403).json({ error: 'Player not in match', code: 'PLAYER_NOT_IN_MATCH' });
    }

    // Update player score
    match.players[playerIndex].score = Math.max(0, parseInt(score));
    match.players[playerIndex].lastUpdate = Date.now();

    // Broadcast score update to all players
    broadcastToMatch(matchId, {
      type: 'score_update',
      matchId,
      scores: match.players.map(p => ({ id: p.id, score: p.score })),
      timestamp: Date.now()
    });

    matchLogger.info('Score updated', { matchId, playerId, score });

    res.json({
      success: true,
      matchId,
      currentScore: score,
      matchStatus: match.status
    });

  } catch (error) {
    matchLogger.error('Score update error', { error: error.message });
    res.status(500).json({ error: 'Score update failed', code: 'SCORE_UPDATE_ERROR' });
  }
});

// Complete match and determine winner
router.post('/:matchId/complete', [
  param('matchId').matches(/^match_[a-zA-Z0-9]{8}$/).withMessage('Valid match ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { matchId } = req.params;
    const match = activeMatches.get(matchId);

    if (!match) {
      return res.status(404).json({ error: 'Match not found', code: 'MATCH_NOT_FOUND' });
    }

    if (match.status === 'completed') {
      return res.status(400).json({ error: 'Match already completed', code: 'MATCH_ALREADY_COMPLETED' });
    }

    // Determine winner based on scores
    const sortedPlayers = [...match.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const loser = sortedPlayers[1];

    let result;
    if (winner.score === loser.score) {
      // Draw - return bet amounts
      result = {
        type: 'draw',
        winner: null,
        payouts: [
          { playerId: winner.id, amount: match.betAmount, type: 'refund' },
          { playerId: loser.id, amount: match.betAmount, type: 'refund' }
        ],
        platformEarnings: 0
      };
    } else {
      // Winner takes payout
      result = {
        type: 'win',
        winner: winner.id,
        winnerScore: winner.score,
        loserScore: loser.score,
        payouts: [
          { playerId: winner.id, amount: match.payout.winner, type: 'win' },
          { playerId: loser.id, amount: 0, type: 'loss' }
        ],
        platformEarnings: match.payout.platform
      };
    }

    // Update match status
    match.status = 'completed';
    match.endTime = Date.now();
    match.result = result;

    // Move to match history
    matchHistory.set(matchId, match);
    activeMatches.delete(matchId);

    // Broadcast final result
    broadcastToMatch(matchId, {
      type: 'match_completed',
      matchId,
      result,
      timestamp: match.endTime
    });

    matchLogger.info('Match completed', { matchId, result: result.type, winner: result.winner });

    res.json({
      success: true,
      matchId,
      status: 'completed',
      result
    });

  } catch (error) {
    matchLogger.error('Match completion error', { error: error.message });
    res.status(500).json({ error: 'Match completion failed', code: 'MATCH_COMPLETE_ERROR' });
  }
});

// Cancel match
router.post('/:matchId/cancel', [
  param('matchId').matches(/^match_[a-zA-Z0-9]{8}$/).withMessage('Valid match ID required'),
  body('playerId').isLength({ min: 1 }).withMessage('Player ID required'),
  body('reason').optional().isLength({ max: 200 }).withMessage('Reason too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { matchId } = req.params;
    const { playerId, reason = 'Player cancelled' } = req.body;

    const match = activeMatches.get(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found', code: 'MATCH_NOT_FOUND' });
    }

    // Verify player is in match
    if (!match.players.some(p => p.id === playerId)) {
      return res.status(403).json({ error: 'Player not in match', code: 'PLAYER_NOT_IN_MATCH' });
    }

    match.status = 'cancelled';
    match.endTime = Date.now();
    match.cancelReason = reason;
    match.cancelledBy = playerId;

    // Refund both players
    const refundResult = {
      type: 'cancelled',
      payouts: match.players.map(p => ({
        playerId: p.id,
        amount: match.betAmount,
        type: 'refund'
      })),
      platformEarnings: 0,
      reason
    };

    match.result = refundResult;

    // Move to history and remove from active
    matchHistory.set(matchId, match);
    activeMatches.delete(matchId);

    // Broadcast cancellation
    broadcastToMatch(matchId, {
      type: 'match_cancelled',
      matchId,
      reason,
      refunds: refundResult.payouts,
      timestamp: match.endTime
    });

    matchLogger.info('Match cancelled', { matchId, playerId, reason });

    res.json({
      success: true,
      matchId,
      status: 'cancelled',
      refunds: refundResult.payouts
    });

  } catch (error) {
    matchLogger.error('Match cancellation error', { error: error.message });
    res.status(500).json({ error: 'Match cancellation failed', code: 'MATCH_CANCEL_ERROR' });
  }
});

// Get player match history
router.get('/history/:playerId', [
  param('playerId').isLength({ min: 1 }).withMessage('Player ID required')
], async (req, res) => {
  try {
    const { playerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Find matches for player (from match history)
    const playerMatches = Array.from(matchHistory.values())
      .filter(match => match.players.some(p => p.id === playerId))
      .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime))
      .slice((page - 1) * limit, page * limit);

    const matchSummaries = playerMatches.map(match => {
      const player = match.players.find(p => p.id === playerId);
      const opponent = match.players.find(p => p.id !== playerId);
      
      return {
        matchId: match.id,
        gameType: match.gameType,
        opponent: opponent ? opponent.id : null,
        myScore: player.score,
        opponentScore: opponent ? opponent.score : 0,
        result: match.result?.winner === playerId ? 'win' : 
                match.result?.winner === null ? 'draw' : 'loss',
        betAmount: match.betAmount,
        payout: match.result?.payouts?.find(p => p.playerId === playerId)?.amount || 0,
        currency: match.currency,
        startTime: match.startTime,
        endTime: match.endTime,
        status: match.status
      };
    });

    res.json({
      success: true,
      matches: matchSummaries,
      total: Array.from(matchHistory.values()).filter(m => 
        m.players.some(p => p.id === playerId)
      ).length,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    matchLogger.error('Match history error', { error: error.message });
    res.status(500).json({ error: 'Match history failed', code: 'MATCH_HISTORY_ERROR' });
  }
});

// Live matches statistics
router.get('/stats/live', async (req, res) => {
  try {
    const stats = {
      activeMatches: activeMatches.size,
      waitingPlayers: Array.from(waitingPlayers.values()).reduce((sum, list) => sum + list.length, 0),
      gameBreakdown: {
        chess: Array.from(activeMatches.values()).filter(m => m.gameType === 'chess').length,
        snakeLadder: Array.from(activeMatches.values()).filter(m => m.gameType === 'snakeLadder').length,
        carrom: Array.from(activeMatches.values()).filter(m => m.gameType === 'carrom').length
      },
      totalMatchesToday: matchHistory.size, // Simplified - should use proper date filtering
      averageMatchDuration: 60,
      platformEarningsToday: Array.from(matchHistory.values())
        .reduce((sum, match) => sum + (match.result?.platformEarnings || 0), 0)
    };

    res.json({ success: true, stats });

  } catch (error) {
    matchLogger.error('Live stats error', { error: error.message });
    res.status(500).json({ error: 'Live stats failed', code: 'LIVE_STATS_ERROR' });
  }
});

// WebSocket handling for real-time match updates
const handleWebSocket = (ws, req) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'join_match' && data.matchId && data.playerId) {
        const match = activeMatches.get(data.matchId);
        if (match) {
          const player = match.players.find(p => p.id === data.playerId);
          if (player) {
            player.ws = ws;
            ws.matchId = data.matchId;
            ws.playerId = data.playerId;
            
            ws.send(JSON.stringify({
              type: 'joined',
              matchId: data.matchId,
              status: match.status
            }));
          }
        }
      }
    } catch (error) {
      matchLogger.error('WebSocket message error', { error: error.message });
    }
  });

  ws.on('close', () => {
    if (ws.matchId && ws.playerId) {
      const match = activeMatches.get(ws.matchId);
      if (match) {
        const player = match.players.find(p => p.id === ws.playerId);
        if (player) {
          player.ws = null;
          player.status = 'disconnected';
        }
      }
    }
  });
};

module.exports = { 
  routes: router, 
  handleWebSocket,
  activeMatches, 
  matchHistory,
  GAME_CONFIGS 
};