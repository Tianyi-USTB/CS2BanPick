document.addEventListener('DOMContentLoaded', function() {
  const socket = io();
  const createMatchForm = document.getElementById('createMatchForm');
  const team1NameInput = document.getElementById('team1Name');
  const team1LogoInput = document.getElementById('team1Logo');
  const team2NameInput = document.getElementById('team2Name');
  const team2LogoInput = document.getElementById('team2Logo');
  const matchFormatSelect = document.getElementById('matchFormat');
  const matchesList = document.getElementById('matchesList');
  
  // 加载活跃比赛
  loadActiveMatches();
  
  // 创建比赛表单提交
  createMatchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const team1Name = team1NameInput.value.trim();
    const team1Logo = team1LogoInput.value.trim();
    const team2Name = team2NameInput.value.trim();
    const team2Logo = team2LogoInput.value.trim();
    const format = matchFormatSelect.value;
    
    if (!team1Name || !team2Name) {
      alert('请输入两个队伍的名称');
      return;
    }
    
    fetch('/api/match/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        team1Name, 
        team1Logo, 
        team2Name, 
        team2Logo, 
        format 
      })
    })
    .then(response => response.json())
    .then(match => {
      // 清空表单
      team1NameInput.value = '';
      team1LogoInput.value = '';
      team2NameInput.value = '';
      team2LogoInput.value = '';
      
      // 显示新创建的比赛
      loadActiveMatches();
      
      // 通知用户成功创建
      alert(`比赛创建成功! 比赛ID: ${match.id}\n比赛模式: ${format.toUpperCase()}`);
    })
    .catch(error => {
      console.error('Error:', error);
      alert('创建比赛失败');
    });
  });
  
  // 加载活跃比赛列表
  function loadActiveMatches() {
    fetch('/api/match')
      .then(response => response.json())
      .then(matches => {
        matchesList.innerHTML = '';
        
        if (matches.length === 0) {
          matchesList.innerHTML = '<p>当前没有活跃的比赛</p>';
          return;
        }
        
        matches.forEach(match => {
          const matchElement = document.createElement('div');
          matchElement.className = 'match-item';
          
          // 比赛状态CSS类
          const statusClass = match.status === 'completed' ? 'status-completed' : 'status-active';
          
          matchElement.innerHTML = `
            <div class="match-header">
              <div class="match-teams">${match.team1.name} vs ${match.team2.name}</div>
              <div class="match-format">${match.format.toUpperCase()}</div>
              <div class="match-status ${statusClass}">${match.status === 'completed' ? '已完成' : '进行中'}</div>
            </div>
            
            <div class="match-id">比赛ID: ${match.id}</div>
            <div class="match-date">创建时间: ${new Date(match.createdAt).toLocaleString()}</div>
            
            <div class="match-links">
              <h4>链接:</h4>
              <div class="links-grid">
                <a href="/team1/${match.id}" target="_blank" class="link">队伍1页面</a>
                <a href="/team2/${match.id}" target="_blank" class="link">队伍2页面</a>
                <a href="/audience/${match.id}" target="_blank" class="link">观众页面</a>
                <a href="/obs/${match.id}" target="_blank" class="link">OBS直播源 (透明背景)</a>
              </div>
            </div>
            
            <div class="match-details">
              <div class="detail-item">
                <span class="detail-label">当前回合:</span>
                <span class="detail-value">${match.currentTurn === 'team1' ? match.team1.name : match.team2.name}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前操作:</span>
                <span class="detail-value">${match.currentAction === 'ban' ? '禁用地图' : '选择地图'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前阶段:</span>
                <span class="detail-value">${match.phase === 'firstBan' ? '第一轮Ban' : match.phase === 'pick' ? '选择阶段' : match.phase === 'secondBan' ? '第二轮Ban' : '决胜局'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">可用地图:</span>
                <span class="detail-value">${match.availableMaps.length}张</span>
              </div>
            </div>
          `;
          
          matchesList.appendChild(matchElement);
        });
      })
      .catch(error => {
        console.error('Error:', error);
        matchesList.innerHTML = '<p>加载比赛失败</p>';
      });
  }
  
  // 每10秒刷新一次比赛列表
  setInterval(loadActiveMatches, 10000);
});
