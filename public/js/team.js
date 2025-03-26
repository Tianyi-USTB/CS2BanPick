document.addEventListener('DOMContentLoaded', function() {
  // 确定当前队伍
  const isTeam1 = window.location.pathname.includes('/team1/');
  const team = isTeam1 ? 'team1' : 'team2';
  
  // 获取比赛ID
  const matchId = window.location.pathname.split('/').pop();
  
  // 修改 Socket.IO 连接配置
  const socket = io({
    transports: ['polling', 'websocket'],
    path: '/socket.io',
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO 连接错误:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO 断开连接:', reason);
  });
  
  // 获取DOM元素
  const teamNameElement = document.getElementById('teamName');
  const currentTurnElement = document.getElementById('currentTurn').querySelector('span');
  const currentActionElement = document.getElementById('currentAction').querySelector('span');
  const availableMapsContainer = document.getElementById('availableMaps');
  const bannedMapsContainer = document.getElementById('bannedMaps');
  const pickedMapsContainer = document.getElementById('pickedMaps');
  
  // 预加载的图片对象存储
  const preloadedImages = {};
  
  // 预加载所有地图和队伍logo图片
  function preloadImages() {
    // 创建隐藏的预加载区域
    const preloadArea = document.createElement('div');
    preloadArea.style.position = 'absolute';
    preloadArea.style.width = '1px';
    preloadArea.style.height = '1px';
    preloadArea.style.overflow = 'hidden';
    preloadArea.style.opacity = '0';
    preloadArea.style.pointerEvents = 'none';
    document.body.appendChild(preloadArea);
    
    // 先获取比赛数据以获取队伍logo
    fetch(`/api/match/${matchId}`)
      .then(response => response.json())
      .then(match => {
        // 预加载队伍logo
        if (match.team1.logo) {
          const logoImg = new Image();
          logoImg.src = match.team1.logo;
          preloadedImages['team1_logo'] = logoImg;
          preloadArea.appendChild(logoImg);
        }
        
        if (match.team2.logo) {
          const logoImg = new Image();
          logoImg.src = match.team2.logo;
          preloadedImages['team2_logo'] = logoImg;
          preloadArea.appendChild(logoImg);
        }
      })
      .catch(error => {
        console.error('预加载队伍logo出错:', error);
      });
    
    // 获取所有可能的地图数据并预加载
    fetch('/api/match/maps')
      .then(response => response.json())
      .then(maps => {
        // 确保maps是数组
        if (!Array.isArray(maps)) {
          console.error('预加载地图错误: 返回的不是数组数据', maps);
          return;
        }
        
        // 遍历所有地图预加载图片
        maps.forEach(map => {
          // 预加载地图图片
          const img = new Image();
          img.src = map.image;
          preloadedImages[map.id] = img;
          preloadArea.appendChild(img);
          
          // 预加载地图logo
          if (map.logo) {
            const logoImg = new Image();
            logoImg.src = map.logo;
            preloadedImages[map.id + '_logo'] = logoImg;
            preloadArea.appendChild(logoImg);
          }
        });
        
        console.log(`预加载了 ${Object.keys(preloadedImages).length} 张图片`);
      })
      .catch(error => {
        console.error('预加载地图图片时出错:', error);
      });
  }
  
  // 立即开始预加载图片
  preloadImages();
  
  // 加入比赛房间
  socket.emit('joinMatch', matchId);
  
  // 获取比赛数据
  fetchMatchData();
  
  // 监听比赛更新
  socket.on('matchUpdated', (match) => {
    updateUI(match);
  });
  
  // 禁用地图
  function banMap(mapId) {
    fetch(`/api/match/${matchId}/ban`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ team, mapId })
    })
    .then(response => response.json())
    .then(result => {
      if (result.error) {
        alert(result.error);
      } else {
        // 广播禁用地图事件
        socket.emit('banMap', {
          matchId,
          team,
          map: result.availableMaps.find(m => m.id === mapId) || 
               result[team].bans[result[team].bans.length - 1]
        });
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('禁用地图操作失败');
    });
  }
  
  // 选择地图
  function pickMap(mapId) {
    fetch(`/api/match/${matchId}/pick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ team, mapId })
    })
    .then(response => response.json())
    .then(result => {
      if (result.error) {
        alert(result.error);
      } else {
        // 广播选择地图事件
        socket.emit('pickMap', {
          matchId,
          team,
          map: result.availableMaps.find(m => m.id === mapId) || 
               result[team].picks[result[team].picks.length - 1]
        });
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('选择地图操作失败');
    });
  }
  
  // 获取比赛数据
  function fetchMatchData() {
    fetch(`/api/match/${matchId}`)
      .then(response => response.json())
      .then(match => {
        updateUI(match);
      })
      .catch(error => {
        console.error('Error:', error);
        alert('加载比赛数据出错');
      });
  }
  
  // 更新UI
  function updateUI(match) {
    // 更新队伍名称
    teamNameElement.textContent = match[team].name;
    
    // 更新当前回合和操作
    const currentTeamName = match.currentTurn === 'team1' ? match.team1.name : match.team2.name;
    currentTurnElement.textContent = currentTeamName;
    currentActionElement.textContent = match.currentAction === 'ban' ? '禁用地图' : '选择地图';
    
    // 更新可用地图
    renderAvailableMaps(match);
    
    // 更新已禁用地图
    renderTeamMaps(match[team].bans, bannedMapsContainer, 'ban');
    
    // 更新已选择地图
    renderTeamMaps(match[team].picks, pickedMapsContainer, 'pick');
  }
  
  // 渲染可用地图
  function renderAvailableMaps(match) {
    availableMapsContainer.innerHTML = '';
    
    // 检查是否轮到当前队伍
    const isMyTurn = match.currentTurn === team;
    
    match.availableMaps.forEach(map => {
      const mapElement = document.createElement('div');
      mapElement.className = `map-item ${isMyTurn ? 'active' : 'inactive'}`;
      
      mapElement.innerHTML = `
        <div class="map-image">
          <img src="${map.image}" alt="${map.displayName}">
        </div>
        <div class="map-info">
          <div class="map-name">${map.displayName}</div>
        </div>
      `;
      
      // 如果是当前队伍的回合，添加点击事件
      if (isMyTurn) {
        mapElement.addEventListener('click', () => {
          if (match.currentAction === 'ban') {
            banMap(map.id);
          } else if (match.currentAction === 'pick') {
            pickMap(map.id);
          }
        });
      }
      
      availableMapsContainer.appendChild(mapElement);
    });
    
    // 如果没有可用地图或不是当前队伍的回合，显示提示
    if (match.availableMaps.length === 0 || !isMyTurn) {
      const message = match.availableMaps.length === 0 ? 
        '选图阶段已完成' : 
        `等待 ${match.currentTurn === 'team1' ? match.team1.name : match.team2.name} ${match.currentAction === 'ban' ? '禁用' : '选择'}地图`;
      
      const messageElement = document.createElement('div');
      messageElement.className = 'maps-message';
      messageElement.textContent = message;
      
      availableMapsContainer.appendChild(messageElement);
    }
  }
  
  // 渲染队伍地图（已禁用/已选择）
  function renderTeamMaps(maps, container, type) {
    container.innerHTML = '';
    
    if (maps.length === 0) {
      const messageElement = document.createElement('div');
      messageElement.className = 'maps-message';
      messageElement.textContent = type === 'ban' ? '尚未禁用地图' : '尚未选择地图';
      container.appendChild(messageElement);
      return;
    }
    
    maps.forEach(map => {
      const mapElement = document.createElement('div');
      mapElement.className = `map-item ${type}`;
      
      mapElement.innerHTML = `
        <div class="map-image">
          <img src="${map.image}" alt="${map.displayName}">
        </div>
        <div class="map-info">
          <div class="map-name">${map.displayName}</div>
        </div>
      `;
      
      container.appendChild(mapElement);
    });
  }
  
  // 添加阵营选择弹窗
  const sideSelectionModal = document.createElement('div');
  sideSelectionModal.className = 'side-selection-modal';
  sideSelectionModal.innerHTML = `
    <div class="side-selection-content">
      <h3>请选择阵营</h3>
      <p id="sideSelectionMapName"></p>
      <div class="side-buttons">
        <button id="selectT" class="side-button t-side">恐怖分子 (T)</button>
        <button id="selectCT" class="side-button ct-side">反恐精英 (CT)</button>
      </div>
    </div>
  `;
  document.body.appendChild(sideSelectionModal);
  
  // 阵营选择按钮事件
  document.getElementById('selectT').addEventListener('click', () => {
    selectSide('T');
  });
  
  document.getElementById('selectCT').addEventListener('click', () => {
    selectSide('CT');
  });
  
  // 选择阵营
  function selectSide(side) {
    const selectedMap = sideSelectionModal.dataset.mapId;
    const pickedByTeam = sideSelectionModal.dataset.pickedByTeam;
    
    console.log(`正在选择阵营... 地图ID: ${selectedMap}, 阵营: ${side}, 选图队伍: ${pickedByTeam}`);
    
    fetch(`/api/match/${matchId}/selectSide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        team, 
        mapId: selectedMap,
        side: side,
        pickedByTeam
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}`);
      }
      return response.json();
    })
    .then(result => {
      if (result.error) {
        console.error('选择阵营错误:', result.error);
        alert('选择阵营失败: ' + result.error);
      } else {
        console.log('阵营选择成功');
        // 广播阵营选择事件
        socket.emit('sideSelected', {
          matchId,
          team,
          mapId: selectedMap,
          side: side,
          pickedByTeam
        });
        
        // 隐藏弹窗
        sideSelectionModal.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('选择阵营操作失败:', error);
      alert('选择阵营操作失败，请查看控制台了解详情');
    });
  }
  
  // 监听对方选择地图事件，显示阵营选择弹窗
  socket.on('mapPicked', (data) => {
    if (data.team !== team) { // 修改条件：只要是对方队伍选择的地图，就显示选择阵营弹窗
      console.log(`收到地图选择事件，显示阵营选择弹窗. 地图: ${data.map.displayName}, 队伍: ${data.team}`);
      sideSelectionModal.style.display = 'flex';
      sideSelectionModal.dataset.mapId = data.map.id;
      sideSelectionModal.dataset.pickedByTeam = data.team;
      document.getElementById('sideSelectionMapName').textContent = `地图: ${data.map.displayName}`;
    }
  });
});
