const express = require('express');
const router = express.Router();
const { 
  createMatch, 
  getMatch, 
  getActiveMatches, 
  banMap, 
  pickMap,
  selectSide,
  deleteMatch,
  deleteAllMatches
} = require('../models/match');
const { getAllMaps } = require('../utils/mapData');

// 创建新比赛
router.post('/create', async (req, res) => {
  try {
    const { team1Name, team1Logo, team2Name, team2Logo, format } = req.body;
    
    if (!team1Name || !team2Name) {
      return res.status(400).json({ error: '需要提供两个队伍的名称' });
    }
    
    const match = await createMatch(team1Name, team2Name, format, team1Logo, team2Logo);
    res.status(201).json(match);
  } catch (err) {
    console.error('创建比赛失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取比赛详情
router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await getMatch(matchId);
    
    if (!match) {
      return res.status(404).json({ error: '比赛未找到' });
    }
    
    res.json(match);
  } catch (err) {
    console.error('获取比赛失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有活跃比赛
router.get('/', async (req, res) => {
  try {
    const matches = await getActiveMatches();
    res.json(matches);
  } catch (err) {
    console.error('获取活跃比赛失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 禁用地图
router.post('/:matchId/ban', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, mapId } = req.body;
    
    if (!team || !mapId) {
      return res.status(400).json({ error: '需要提供队伍和地图ID' });
    }
    
    const result = await banMap(matchId, team, mapId);
    
    if (!result) {
      return res.status(404).json({ error: '比赛未找到' });
    }
    
    if (result.error) {
      return res.status(400).json(result);
    }
    
    // 通过Socket.io广播更新
    req.app.get('io').to(matchId).emit('matchUpdated', result);
    
    res.json(result);
  } catch (err) {
    console.error('禁用地图失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 选择地图
router.post('/:matchId/pick', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, mapId } = req.body;
    
    if (!team || !mapId) {
      return res.status(400).json({ error: '需要提供队伍和地图ID' });
    }
    
    const result = await pickMap(matchId, team, mapId);
    
    if (!result) {
      return res.status(404).json({ error: '比赛未找到' });
    }
    
    if (result.error) {
      return res.status(400).json(result);
    }
    
    // 通过Socket.io广播更新
    req.app.get('io').to(matchId).emit('matchUpdated', result);
    
    res.json(result);
  } catch (err) {
    console.error('选择地图失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 选择阵营
router.post('/:matchId/selectSide', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { team, mapId, side, pickedByTeam } = req.body;
    
    if (!team || !mapId || !side || !pickedByTeam) {
      return res.status(400).json({ error: '需要提供队伍、地图ID、阵营和选图队伍' });
    }
    
    const result = await selectSide(matchId, team, mapId, side, pickedByTeam);
    
    if (!result) {
      return res.status(404).json({ error: '比赛未找到' });
    }
    
    if (result.error) {
      return res.status(400).json(result);
    }
    
    // 通过Socket.io广播更新
    req.app.get('io').to(matchId).emit('matchUpdated', result);
    
    res.json(result);
  } catch (err) {
    console.error('选择阵营失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有可用地图（用于预加载图片）
router.get('/maps', (req, res) => {
  res.json(getAllMaps());
});

// 删除单个比赛
router.delete('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await deleteMatch(matchId);
    
    if (result.error) {
      return res.status(404).json(result);
    }
    
    // 通过Socket.io广播比赛已删除
    req.app.get('io').to(matchId).emit('matchDeleted', { matchId });
    
    res.json({ success: true, message: '比赛已删除' });
  } catch (err) {
    console.error('删除比赛失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除所有比赛
router.delete('/', async (req, res) => {
  try {
    const result = await deleteAllMatches();
    
    // 通过Socket.io广播所有比赛已删除
    req.app.get('io').emit('allMatchesDeleted');
    
    res.json({ success: true, message: '所有比赛已删除', count: result.count });
  } catch (err) {
    console.error('删除所有比赛失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
