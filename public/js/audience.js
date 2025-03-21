document.addEventListener('DOMContentLoaded', function() {
  // 获取比赛ID从URL
  const matchId = window.location.pathname.split('/').pop();
  const socket = io();
  
  // 加入比赛房间
  socket.emit('joinMatch', matchId);
  
  // 获取DOM元素
  const team1NameElement = document.getElementById('team1Name');
  const team2NameElement = document.getElementById('team2Name');
  const matchFormatElement = document.getElementById('matchFormat');
  const bannedMapsContainer = document.getElementById('bannedMapsContainer');
  const pickedMapsContainer = document.getElementById('pickedMapsContainer');
  const deciderMapContainer = document.getElementById('deciderMapContainer');
  const notification = document.getElementById('notification');
  const currentTurn = document.getElementById('currentTurn').querySelector('.status-value');
  const currentAction = document.getElementById('currentAction').querySelector('.status-value');
  
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
  
  // 获取比赛数据
  fetch(`/api/match/${matchId}`)
    .then(response => response.json())
    .then(match => {
      updateUI(match);
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification('加载比赛数据出错', 'error');
    });
  
  // 监听比赛更新
  socket.on('matchUpdated', (match) => {
    updateUI(match);
  });
  
  // 监听禁用地图事件
  socket.on('mapBanned', (data) => {
    const teamName = data.team === 'team1' ? team1NameElement.textContent : team2NameElement.textContent;
    showNotification(`${teamName} 禁用了 ${data.map.displayName}`, 'ban');
    animateMapEntry(data.map, 'ban', data.team);
  });
  
  // 监听选择地图事件
  socket.on('mapPicked', (data) => {
    const teamName = data.team === 'team1' ? team1NameElement.textContent : team2NameElement.textContent;
    showNotification(`${teamName} 选择了 ${data.map.displayName}`, 'pick');
    animateMapEntry(data.map, 'pick', data.team);
  });
  
  // 更新UI
  function updateUI(match) {
    team1NameElement.textContent = match.team1.name;
    team2NameElement.textContent = match.team2.name;
    matchFormatElement.textContent = match.format.toUpperCase();
    
    // 更新当前回合和操作
    currentTurn.textContent = match.currentTurn === 'team1' ? match.team1.name : match.team2.name;
    currentAction.textContent = match.currentAction === 'ban' ? '禁用地图' : '选择地图';
    if (match.status === 'completed') {
      currentTurn.textContent = '已完成';
      currentAction.textContent = '比赛结束';
    }
    
    // 清空容器
    bannedMapsContainer.innerHTML = '';
    pickedMapsContainer.innerHTML = '';
    deciderMapContainer.innerHTML = '';
    
    // 渲染禁用地图
    match.team1.bans.forEach(map => {
      renderMap(map, bannedMapsContainer, 'ban', 'team1');
    });
    match.team2.bans.forEach(map => {
      renderMap(map, bannedMapsContainer, 'ban', 'team2');
    });
    
    // 渲染选择地图
    match.team1.picks.forEach(map => {
      renderMap(map, pickedMapsContainer, 'pick', 'team1');
    });
    match.team2.picks.forEach(map => {
      renderMap(map, pickedMapsContainer, 'pick', 'team2');
    });
    
    // 渲染决胜局
    if (match.decider) {
      renderMap(match.decider, deciderMapContainer, 'decider');
    }
  }
  
  // 渲染地图
  function renderMap(map, container, type, team) {
    const mapElement = document.createElement('div');
    mapElement.className = `map-item ${type}`;
    
    let teamIndicator = '';
    if (team) {
      teamIndicator = `
        <div class="team-indicator ${team}">
          ${team === 'team1' ? team1NameElement.textContent : team2NameElement.textContent}
        </div>
      `;
    }
    
    mapElement.innerHTML = `
      <div class="map-image">
        <img src="${map.image}" alt="${map.displayName}">
      </div>
      ${teamIndicator}
      <div class="map-info">
        <div class="map-logo">
          <img src="${map.logo}" alt="${map.name} Logo">
        </div>
        <div class="map-name">${map.displayName}</div>
      </div>
    `;
    
    container.appendChild(mapElement);
  }
  
  // 动画效果：地图滑入效果
  function animateMapEntry(map, type, team) {
    const container = type === 'ban' ? bannedMapsContainer : pickedMapsContainer;
    
    const mapElement = document.createElement('div');
    mapElement.className = `map-item ${type} animated`;
    
    let teamIndicator = '';
    if (team) {
      teamIndicator = `
        <div class="team-indicator ${team}">
          ${team === 'team1' ? team1NameElement.textContent : team2NameElement.textContent}
        </div>
      `;
    }
    
    mapElement.innerHTML = `
      <div class="map-image">
        <img src="${map.image}" alt="${map.displayName}">
      </div>
      ${teamIndicator}
      <div class="map-info">
        <div class="map-logo">
          <img src="${map.logo}" alt="${map.name} Logo">
        </div>
        <div class="map-name">${map.displayName}</div>
      </div>
    `;
    
    container.appendChild(mapElement);
    
    // 播放音效 (可选)
    playSound(type);
  }
  
  // 显示通知
  function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.opacity = '1';
    
    setTimeout(() => {
      notification.style.opacity = '0';
    }, 3000);
  }
  
  // 播放音效（可选实现）
  function playSound(type) {
    // 如果要添加音效，可以在这里实现
    // 例如:
    // const sound = new Audio(`/sounds/${type}.mp3`);
    // sound.play();
  }
});
