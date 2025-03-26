const { v4: uuidv4 } = require('uuid');
const { getAllMaps } = require('../utils/mapData');
const Match = require('./schemas/Match');

// 内存中存储活跃的比赛
const activeMatches = {};

// 创建新比赛
async function createMatch(team1Name, team2Name, matchFormat = 'bo3', team1Logo = '', team2Logo = '') {
  const matchId = uuidv4();
  
  // 根据比赛格式设置预期的禁用和选择次数
  let expectedBans, expectedPicks, firstTeamPicks;
  
  switch(matchFormat) {
    case 'bo1':
      expectedBans = 6; // 每队禁3张
      expectedPicks = 0; // BO1没有选择阶段，剩下一张作为决胜图
      firstTeamPicks = 0; 
      break;
    case 'bo5':
      expectedBans = 2; // 每队禁1张
      expectedPicks = 4; // 两队各选2张，最后一张是决胜局
      firstTeamPicks = 1; // 先各选1张，再各禁1张，再各选1张
      break;
    case 'bo3':
    default:
      expectedBans = 4; // 两队各禁2张
      expectedPicks = 3; // 两队各选1张，最后一张是决胜局
      firstTeamPicks = 1; // 每队先选1张
      matchFormat = 'bo3';
      break;
  }
  
  const matchData = {
    id: matchId,
    team1: {
      name: team1Name,
      logo: team1Logo,
      bans: [],
      picks: []
    },
    team2: {
      name: team2Name,
      logo: team2Logo,
      bans: [],
      picks: []
    },
    availableMaps: getAllMaps(),
    currentTurn: 'team1', // 首先轮到team1
    currentAction: matchFormat === 'bo5' ? 'pick' : 'ban',  // BO5先pick，其他先ban
    status: 'created',
    createdAt: new Date(),
    history: [],
    format: matchFormat,
    expectedBans,
    expectedPicks,
    firstTeamPicks,
    // 添加阶段跟踪字段，用于不同比赛模式的流程
    phase: matchFormat === 'bo5' ? 'firstPick' : 'firstBan'
  };

  try {
    const match = await Match.create(matchData);
    return match.toObject();
  } catch (err) {
    console.error('创建比赛失败:', err);
    throw err;
  }
}

// 获取比赛
async function getMatch(matchId) {
  try {
    return await Match.findOne({ id: matchId });
  } catch (err) {
    console.error('获取比赛失败:', err);
    throw err;
  }
}

// 获取所有活跃比赛
async function getActiveMatches() {
  try {
    return await Match.find({ status: { $ne: 'deleted' } });
  } catch (err) {
    console.error('获取活跃比赛失败:', err);
    throw err;
  }
}

// 禁用地图
async function banMap(matchId, team, mapId) {
  try {
    const match = await Match.findOne({ id: matchId });
    if (!match) return null;

    if (match.currentTurn !== team || match.currentAction !== 'ban') {
      return { error: '不是该队伍的禁用回合' };
    }

    // 检查地图是否可用
    const mapIndex = match.availableMaps.findIndex(m => m.id === mapId);
    if (mapIndex === -1) {
      return { error: '该地图不可用' };
    }
    
    // 移除地图并记录
    const bannedMap = match.availableMaps.splice(mapIndex, 1)[0];
    match[team].bans.push(bannedMap);
    
    // 记录历史
    match.history.push({
      team,
      action: 'ban',
      map: bannedMap,
      phase: match.phase,
      timestamp: new Date()
    });
    
    // 切换回合
    match.currentTurn = match.currentTurn === 'team1' ? 'team2' : 'team1';
    
    // 根据不同比赛模式处理阶段切换
    if (match.format === 'bo3') {
      // BO3的多阶段ban-pick流程
      const totalBans = match.team1.bans.length + match.team2.bans.length;
      
      // 第一阶段ban结束后，切换到pick阶段
      if (match.phase === 'firstBan' && totalBans === 2) {
        match.currentAction = 'pick';
        match.phase = 'pick';
      }
      // 如果是第二阶段ban，且所有ban完成，比赛结束，设置决胜图
      else if (match.phase === 'secondBan' && totalBans === 4) {
        match.status = 'completed';
        
        // 确保只有一张决胜图
        if (match.availableMaps.length >= 1) {
          // 如果有多张地图剩余，选择第一张作为决胜图
          match.decider = match.availableMaps[0];
          
          // 记录决胜图历史
          match.history.push({
            action: 'decider',
            map: match.decider,
            phase: 'decider',
            timestamp: new Date()
          });
          
          // 清空可用地图列表，确保不需要再选择
          match.availableMaps = [];
          
          // 确保当前操作不再是ban或pick
          match.currentAction = 'completed';
        }
      }
    } else if (match.format === 'bo1') {
      // BO1的处理：如果ban完所有地图（6张），剩下1张作为决胜图
      if (match.team1.bans.length + match.team2.bans.length >= match.expectedBans) {
        match.status = 'completed';
        
        if (match.availableMaps.length === 1) {
          match.decider = match.availableMaps[0];
          
          // 记录决胜图历史
          match.history.push({
            action: 'decider',
            map: match.decider,
            phase: 'decider',
            timestamp: new Date()
          });
          
          // 清空可用地图列表
          match.availableMaps = [];
          
          // 设置比赛完成状态
          match.currentAction = 'completed';
        }
      }
    } else if (match.format === 'bo5') {
      // BO5的处理：第二阶段是ban
      if (match.phase === 'ban' && match.team1.bans.length + match.team2.bans.length >= match.expectedBans) {
        match.currentAction = 'pick';
        match.phase = 'secondPick';
      }
    }
    
    // 保存更改
    await match.save();
    return match.toObject();
  } catch (err) {
    console.error('禁用地图失败:', err);
    throw err;
  }
}

// 选择地图
async function pickMap(matchId, team, mapId) {
  try {
    const match = await Match.findOne({ id: matchId });
    if (!match) return null;
    
    if (match.currentTurn !== team || match.currentAction !== 'pick') {
      return { error: '不是该队伍的选择回合' };
    }
    
    // 检查地图是否可用
    const mapIndex = match.availableMaps.findIndex(m => m.id === mapId);
    if (mapIndex === -1) {
      return { error: '该地图不可用' };
    }
    
    // 移除地图并记录
    const pickedMap = match.availableMaps.splice(mapIndex, 1)[0];
    match[team].picks.push(pickedMap);
    
    // 记录历史
    match.history.push({
      team,
      action: 'pick',
      map: pickedMap,
      phase: match.phase,
      timestamp: new Date()
    });
    
    // 切换回合
    match.currentTurn = match.currentTurn === 'team1' ? 'team2' : 'team1';
    
    // 根据不同比赛格式处理阶段变化
    if (match.format === 'bo3') {
      // BO3特殊处理：pick阶段结束后切换到第二ban阶段
      const totalPicks = match.team1.picks.length + match.team2.picks.length;
      if (match.phase === 'pick' && totalPicks === 2) {
        match.currentAction = 'ban';
        match.phase = 'secondBan';
      }
    } else if (match.format === 'bo5') {
      // BO5特殊处理
      const totalPicks = match.team1.picks.length + match.team2.picks.length;
      
      if (match.phase === 'firstPick' && totalPicks === 2) {
        // 从第一阶段选择转到禁用阶段
        match.currentAction = 'ban';
        match.phase = 'ban';
      } else if (match.phase === 'secondPick' && totalPicks === 4) {
        // 第二阶段选择结束后，设置决胜图
        match.status = 'completed';
        
        if (match.availableMaps.length === 1) {
          match.decider = match.availableMaps[0];
          
          // 记录决胜图历史
          match.history.push({
            action: 'decider',
            map: match.decider,
            phase: 'decider',
            timestamp: new Date()
          });
          
          // 清空可用地图列表
          match.availableMaps = [];
          
          // 设置比赛完成状态
          match.currentAction = 'completed';
        }
      }
    }
    
    // 保存更改
    await match.save();
    return match.toObject();
    
  } catch (err) {
    console.error('选择地图失败:', err);
    throw err;
  }
}

// 新增：选择阵营
async function selectSide(matchId, team, mapId, side, pickedByTeam) {
  const match = await Match.findOne({ id: matchId });
  try{
  if (!match) return null;
  
  // 首先在选择方的picks中查找
  let map = match[pickedByTeam].picks.find(m => m.id === mapId);
  
  // 如果没找到，尝试在历史记录中查找
  if (!map) {
    const historyEntry = match.history.find(entry => 
      entry.map && entry.map.id === mapId && entry.action === 'pick'
    );
    
    if (historyEntry) {
      map = historyEntry.map;
    }
  }
  
  // 如果仍然没找到，检查所有选择的地图
  if (!map) {
    if (match.team1.picks.length > 0 || match.team2.picks.length > 0) {
      // 检查team1的picks
      map = match.team1.picks.find(m => m.id === mapId);
      
      // 如果team1中没找到，检查team2的picks
      if (!map) {
        map = match.team2.picks.find(m => m.id === mapId);
      }
    }
  }
  
  if (!map) {
    return { error: '地图未找到，ID: ' + mapId };
  }
  
  // 确保map对象有sides属性
  if (!map.sides) {
    map.sides = {};
  }
  
  // 记录阵营选择
  map.sides[pickedByTeam] = side === 'CT' ? 'T' : 'CT'; // 选择的阵营的对立方
  map.sides[team] = side;
  
  // 记录历史
  match.history.push({
    team,
    action: 'selectSide',
    map: map,
    side: side,
    pickedByTeam,
    timestamp: new Date()
  });
  
  console.log(`阵营选择成功 - 地图: ${map.displayName}, 队伍: ${team}, 选择阵营: ${side}`);
      await match.save();
      return match.toObject();
      
    } catch (err) {
      console.error('选择地图失败:', err);
      throw err;
    }
}

// 删除比赛
async function deleteMatch(matchId) {
  try {
    const result = await Match.findOneAndUpdate(
      { id: matchId },
      { status: 'deleted' },
      { new: true }
    );
    return result ? { success: true } : { error: '比赛未找到' };
  } catch (err) {
    console.error('删除比赛失败:', err);
    throw err;
  }
}

// 删除所有比赛
async function deleteAllMatches() {
  try {
    const result = await Match.updateMany(
      {},
      { status: 'deleted' }
    );
    return { success: true, count: result.modifiedCount };
  } catch (err) {
    console.error('删除所有比赛失败:', err);
    throw err;
  }
}

module.exports = {
  createMatch,
  getMatch,
  getActiveMatches,
  banMap,
  pickMap,
  selectSide,
  deleteMatch,
  deleteAllMatches
};
