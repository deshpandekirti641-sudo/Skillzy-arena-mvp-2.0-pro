const express = require('express');
const router = express.Router();

// Sample game route
router.get('/', (req, res) => {
  res.json({
    games: [
      { id: 1, name: 'Chess', status: 'available' },
      { id: 2, name: 'Snake & Ladder', status: 'available' },
      { id: 3, name: 'Carrom', status: 'coming_soon' }
    ]
  });
});

module.exports = router;
