const { v4: uuidv4 } = require('uuid');
const { getAllMaps } = require('../utils/mapData');

// 内存中存储活跃的比赛
const activeMatches = {};

// 创建新比赛
function createMatch(team1Name, team2Name, matchFormat = 'bo3', team1Logo = '', team2Logo = '') {
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
  
  const match = {
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
  
  activeMatches[matchId] = match;
  return match;
}

// 获取比赛
function getMatch(matchId) {
  return activeMatches[matchId];
}

// 获取所有活跃比赛
function getActiveMatches() {
  return Object.values(activeMatches);
}

// 禁用地图
function banMap(matchId, team, mapId) {
  const match = activeMatches[matchId];
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
  
  return match;
}

// 选择地图
function pickMap(matchId, team, mapId) {
  const match = activeMatches[matchId];
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
  
  return match;
}

// 新增：选择阵营
function selectSide(matchId, team, mapId, side, pickedByTeam) {
  const match = activeMatches[matchId];
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
  
  return match;
}

// 删除比赛
function deleteMatch(matchId) {
  if (!activeMatches[matchId]) {
    return { error: '比赛未找到' };
  }
  
  delete activeMatches[matchId];
  return { success: true };
}

// 删除所有比赛
function deleteAllMatches() {
  const count = Object.keys(activeMatches).length;
  
  // 清空对象
  for (const key in activeMatches) {
    delete activeMatches[key];
  }
  
  return { success: true, count };
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
