const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  team1: {
    name: String,
    logo: String,
    bans: [{
      id: String,
      name: String,
      displayName: String,
      image: String,
      logo: String
    }],
    picks: [{
      id: String,
      name: String,
      displayName: String,
      image: String,
      logo: String,
      sides: {
        type: Map,
        of: String
      }
    }]
  },
  team2: {
    name: String,
    logo: String,
    bans: [{
      id: String,
      name: String,
      displayName: String,
      image: String,
      logo: String
    }],
    picks: [{
      id: String,
      name: String,
      displayName: String,
      image: String,
      logo: String,
      sides: {
        type: Map,
        of: String
      }
    }]
  },
  availableMaps: [{
    id: String,
    name: String,
    displayName: String,
    image: String,
    logo: String
  }],
  currentTurn: String,
  currentAction: String,
  status: String,
  createdAt: Date,
  history: [{
    team: String,
    action: String,
    map: {
      id: String,
      name: String,
      displayName: String,
      image: String,
      logo: String
    },
    phase: String,
    timestamp: Date,
    side: String,
    pickedByTeam: String
  }],
  format: String,
  expectedBans: Number,
  expectedPicks: Number,
  firstTeamPicks: Number,
  phase: String,
  decider: {
    id: String,
    name: String,
    displayName: String,
    image: String,
    logo: String,
    sides: {
      type: Map,
      of: String
    }
  }
});

module.exports = mongoose.model('Match', MatchSchema);
