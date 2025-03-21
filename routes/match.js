const express = require('express');
const router = express.Router();
const { 
  createMatch, 
  getMatch, 
  getActiveMatches, 
  banMap, 
  pickMap,
  selectSide 
} = require('../models/match');
const { getAllMaps } = require('../utils/mapData');

// 创建新比赛
router.post('/create', (req, res) => {
  const { team1Name, team1Logo, team2Name, team2Logo, format } = req.body;
  
  if (!team1Name || !team2Name) {
    return res.status(400).json({ error: '需要提供两个队伍的名称' });
  }
  
  const match = createMatch(team1Name, team2Name, format, team1Logo, team2Logo);
  res.status(201).json(match);
});

// 获取比赛详情
router.get('/:matchId', (req, res) => {
  const { matchId } = req.params;
  const match = getMatch(matchId);
  
  if (!match) {
    return res.status(404).json({ error: '比赛未找到' });
  }
  
  res.json(match);
});

// 获取所有活跃比赛
router.get('/', (req, res) => {
  res.json(getActiveMatches());
});

// 禁用地图
router.post('/:matchId/ban', (req, res) => {
  const { matchId } = req.params;
  const { team, mapId } = req.body;
  
  if (!team || !mapId) {
    return res.status(400).json({ error: '需要提供队伍和地图ID' });
  }
  
  const result = banMap(matchId, team, mapId);
  
  if (!result) {
    return res.status(404).json({ error: '比赛未找到' });
  }
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  // 通过Socket.io广播更新
  req.app.get('io').to(matchId).emit('matchUpdated', result);
  
  res.json(result);
});

// 选择地图
router.post('/:matchId/pick', (req, res) => {
  const { matchId } = req.params;
  const { team, mapId } = req.body;
  
  if (!team || !mapId) {
    return res.status(400).json({ error: '需要提供队伍和地图ID' });
  }
  
  const result = pickMap(matchId, team, mapId);
  
  if (!result) {
    return res.status(404).json({ error: '比赛未找到' });
  }
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  // 通过Socket.io广播更新
  req.app.get('io').to(matchId).emit('matchUpdated', result);
  
  res.json(result);
});

// 选择阵营 - 修正函数引用和路由路径
router.post('/:matchId/selectSide', (req, res) => {
  const { matchId } = req.params;
  const { team, mapId, side, pickedByTeam } = req.body;
  
  if (!team || !mapId || !side || !pickedByTeam) {
    return res.status(400).json({ error: '需要提供队伍、地图ID、阵营和选图队伍' });
  }
  
  const result = selectSide(matchId, team, mapId, side, pickedByTeam);
  
  if (!result) {
    return res.status(404).json({ error: '比赛未找到' });
  }
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  // 通过Socket.io广播更新
  req.app.get('io').to(matchId).emit('matchUpdated', result);
  
  res.json(result);
});

// 新增：获取所有可用地图（用于预加载图片）
router.get('/maps', (req, res) => {
  res.json(getAllMaps());
});

module.exports = router;
