document.addEventListener('DOMContentLoaded', function() {
  // 获取比赛ID从URL
  const matchId = window.location.pathname.split('/').pop();
  const socket = io();
  
  // 加入比赛房间
  socket.emit('joinMatch', matchId);
  
  // 获取DOM元素
  const mapContainer = document.getElementById('mapContainer');
  const notification = document.getElementById('notification');
  const preloadArea = document.getElementById('preloadArea') || document.createElement('div');
  
  // 如果preloadArea不存在，创建一个
  if (!document.getElementById('preloadArea')) {
    preloadArea.id = 'preloadArea';
    preloadArea.style.position = 'absolute';
    preloadArea.style.width = '1px';
    preloadArea.style.height = '1px';
    preloadArea.style.overflow = 'hidden';
    preloadArea.style.opacity = '0';
    preloadArea.style.pointerEvents = 'none';
    document.body.appendChild(preloadArea);
  }
  
  // 存储队伍名称和logo
  let team1Name = '队伍1';
  let team1Logo = '';
  let team2Name = '队伍2';
  let team2Logo = '';
  
  // 预加载的图片对象存储
  const preloadedImages = {};
  
  // 预加载所有地图图片
  function preloadImages() {
    // 先获取比赛数据以获取队伍logo
    fetch(`/api/match/${matchId}`)
      .then(response => response.json())
      .then(match => {
        team1Name = match.team1.name;
        team1Logo = match.team1.logo || '';
        team2Name = match.team2.name;
        team2Logo = match.team2.logo || '';
        
        // 预加载队伍logo
        if (team1Logo) {
          const logoImg = new Image();
          logoImg.src = team1Logo;
          preloadedImages['team1_logo'] = logoImg;
          preloadArea.appendChild(logoImg);
        }
        
        if (team2Logo) {
          const logoImg = new Image();
          logoImg.src = team2Logo;
          preloadedImages['team2_logo'] = logoImg;
          preloadArea.appendChild(logoImg);
        }
      })
      .catch(error => {
        console.error('预加载队伍logo出错:', error);
      });
    
    // 获取所有可能的地图数据
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
          const img = new Image();
          img.src = map.image;
          preloadedImages[map.id] = img;
          preloadArea.appendChild(img);
          
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
  
  // 在页面加载时就预加载地图图片和队伍logo
  preloadImages();
  
  // 创建7个固定位置的地图槽
  function createMapSlots() {
    // 清空容器
    mapContainer.innerHTML = '';
    
    // 创建7个槽位
    for (let i = 0; i < 7; i++) {
      const slot = document.createElement('div');
      slot.className = 'map-slot';
      slot.id = `map-slot-${i}`;
      mapContainer.appendChild(slot);
    }
  }
  
  // 初始化创建槽位
  createMapSlots();
  
  // 记录当前显示的地图数量，用于从左到右依次分配位置
  let currentDisplayIndex = 0;
  
  // 记录已经显示过的地图ID
  const displayedMapIds = new Set();
  
  // 添加地图队列系统
  const pendingMaps = [];
  let deciderMap = null;
  
  // 缓存等待选择阵营的地图
  const awaitingSideMaps = new Map(); // 使用Map存储 mapId -> {map, action, team} 的映射
  
  // 处理地图队列的函数
  function processPendingMaps() {
    // 如果队列为空，检查是否有决胜图待显示
    if (pendingMaps.length === 0) {
      if (deciderMap && currentDisplayIndex >= 5) {  // 至少显示了6张常规地图后才显示决胜图
        renderDeciderMap(deciderMap);
        deciderMap = null;
      }
      return;
    }
    
    // 从队列取出下一个待显示的地图
    const nextMap = pendingMaps.shift();
    renderMapWithAnimation(nextMap.map, nextMap.action, nextMap.team);
    
    // 如果队列为空且有决胜图，检查是否应该显示决胜图
    if (pendingMaps.length === 0 && deciderMap && currentDisplayIndex >= 5) {
      setTimeout(() => {
        renderDeciderMap(deciderMap);
        deciderMap = null;
      }, 300); // 给最后一张常规地图一点显示时间
    }
  }
  
  // 添加地图到队列的函数
  function addMapToQueue(map, action, team) {
    // 如果是决胜图，存储但不立即显示
    if (action === 'decider') {
      deciderMap = map;
      // 如果已经显示了至少6张图且没有其他等待的地图，则可以立即显示决胜图
      if (currentDisplayIndex >= 5 && pendingMaps.length === 0) {
        setTimeout(() => {
          renderDeciderMap(map);
          deciderMap = null;
        }, 300);
      }
      return;
    }
    
    // 如果是pick操作，先缓存等待阵营选择
    if (action === 'pick') {
      awaitingSideMaps.set(map.id, {map, action, team});
      return;
    }
    
    // 其他操作（ban）直接添加到队列
    pendingMaps.push({map, action, team});
    processPendingMaps();
  }
  
  // 获取比赛数据
  fetch(`/api/match/${matchId}`)
    .then(response => response.json())
    .then(match => {
      team1Name = match.team1.name;
      team1Logo = match.team1.logo || '';
      team2Name = match.team2.name;
      team2Logo = match.team2.logo || '';
      
      // 按照历史记录顺序渲染地图
      // 确保历史记录是按照时间顺序排序的
      const sortedHistory = [...match.history].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      // 处理所有历史记录，包括ban、pick和阵营选择
      // 使用自定义处理而不是直接渲染
      const processedMapIds = new Set();
      
      // 记录每个地图的阵营信息
      const mapSidesInfo = new Map();
      
      // 先处理所有的阵营选择，构建阵营信息映射
      sortedHistory.forEach(entry => {
        if (entry.action === 'selectSide' && entry.map) {
          const mapId = entry.map.id;
          if (!mapSidesInfo.has(mapId)) {
            mapSidesInfo.set(mapId, {
              pickedByTeam: entry.pickedByTeam,
              side: entry.side,
              team: entry.team
            });
          }
        }
      });
      
      // 再处理地图操作
      sortedHistory.forEach(entry => {
        // 只处理ban和pick操作
        if ((entry.action === 'ban' || entry.action === 'pick') && 
            entry.map && !processedMapIds.has(entry.map.id)) {
          if (!displayedMapIds.has(entry.map.id)) {
            displayedMapIds.add(entry.map.id);
            processedMapIds.add(entry.map.id);
            
            const sideInfo = mapSidesInfo.get(entry.map.id);
            
            // 如果是ban操作，直接添加到队列
            if (entry.action === 'ban') {
              pendingMaps.push({
                map: entry.map,
                action: entry.action,
                team: entry.team
              });
            } 
            // 如果是pick操作，检查是否有阵营信息
            else if (entry.action === 'pick') {
              // 如果已有阵营信息，直接添加到队列并附带阵营信息
              if (sideInfo) {
                entry.map.sidesInfo = sideInfo; // 保存阵营信息到地图对象
                pendingMaps.push({
                  map: entry.map,
                  action: entry.action,
                  team: entry.team
                });
              } else {
                // 否则缓存等待阵营选择
                awaitingSideMaps.set(entry.map.id, {
                  map: entry.map,
                  action: entry.action,
                  team: entry.team
                });
              }
            }
          }
        }
      });
      
      // 开始处理地图队列
      processPendingMaps();
      
      // 如果有决胜图且还没显示过，记录但不立即显示
      if (match.decider && !displayedMapIds.has(match.decider.id)) {
        displayedMapIds.add(match.decider.id);
        deciderMap = match.decider;
        
        // 如果已经显示了至少6张常规地图，才显示决胜图
        if (currentDisplayIndex >= 5 && pendingMaps.length === 0) {
          setTimeout(() => {
            renderDeciderMap(match.decider);
            deciderMap = null;
          }, 300);
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification('加载比赛数据出错', 'error');
    });
  
  // 监听比赛更新
  socket.on('matchUpdated', (match) => {
    team1Name = match.team1.name;
    team1Logo = match.team1.logo || '';
    team2Name = match.team2.name;
    team2Logo = match.team2.logo || '';
    
    // 检查是否有新的决胜图
    if (match.decider && !displayedMapIds.has(match.decider.id)) {
      displayedMapIds.add(match.decider.id);
      deciderMap = match.decider;
      
      // 仅当已显示至少6张常规地图时才显示决胜图
      if (currentDisplayIndex >= 5 && pendingMaps.length === 0) {
        renderDeciderMap(match.decider);
        deciderMap = null;
      }
    }
  });
  
  // 监听禁用地图事件
  socket.on('mapBanned', (data) => {
    if (!displayedMapIds.has(data.map.id)) {
      displayedMapIds.add(data.map.id);
      // 添加到队列而非直接渲染
      addMapToQueue(data.map, 'ban', data.team);
    }
  });
  
  // 监听选择地图事件
  socket.on('mapPicked', (data) => {
    if (!displayedMapIds.has(data.map.id)) {
      displayedMapIds.add(data.map.id);
      // 添加到等待阵营选择的缓存
      awaitingSideMaps.set(data.map.id, {
        map: data.map,
        action: 'pick',
        team: data.team
      });
    }
  });
  
  // 监听阵营选择事件
  socket.on('sideSelected', (data) => {
    // 找到对应地图元素并更新显示
    const mapSlots = document.querySelectorAll('.map-slot');
    let mapDisplayed = false;
    
    for (let i = 0; i < mapSlots.length; i++) {
      const mapItem = mapSlots[i].querySelector('.map-item');
      if (mapItem && mapItem.dataset.mapId === data.mapId) {
        // 更新队伍显示，添加阵营信息
        updateMapWithSideInfo(mapItem, data);
        mapDisplayed = true;
        break;
      }
    }
    
    // 如果地图尚未显示但在等待队列中，现在可以显示了
    if (!mapDisplayed && awaitingSideMaps.has(data.mapId)) {
      const mapData = awaitingSideMaps.get(data.mapId);
      // 添加阵营信息到地图对象
      mapData.map.sidesInfo = {
        pickedByTeam: data.pickedByTeam,
        side: data.side,
        team: data.team
      };
      pendingMaps.push(mapData);
      awaitingSideMaps.delete(data.mapId);
      processPendingMaps();
    }
  });
  
  // 更新地图显示阵营信息
  function updateMapWithSideInfo(mapElement, data) {
    const pickedByTeam = data.pickedByTeam;
    const selectingTeam = data.team;
    
    const team1Side = pickedByTeam === 'team1' ? (data.side === 'CT' ? 'T' : 'CT') : data.side;
    const team2Side = pickedByTeam === 'team2' ? (data.side === 'CT' ? 'T' : 'CT') : data.side;
    
    // 更新地图头部信息 - 只显示头像和颜色背景，不显示队名
    const header = mapElement.querySelector('.map-header');
    header.innerHTML = `
      <div class="team-logo team1-side ${team1Side.toLowerCase()}">
        ${team1Logo ? `<img src="${team1Logo}" alt="Team 1 Logo">` : '<div class="logo-placeholder"></div>'}
      </div>
      <div class="map-name">${mapElement.dataset.mapName}</div>
      <div class="team-logo team2-side ${team2Side.toLowerCase()}">
        ${team2Logo ? `<img src="${team2Logo}" alt="Team 2 Logo">` : '<div class="logo-placeholder"></div>'}
      </div>
    `;
  }
  
  // 专门用于渲染决胜图（总是在最右侧）
  function renderDeciderMap(map) {
    // 使用最后一个槽位（第7个）
    const slotElement = document.getElementById('map-slot-6');
    
    // 如果槽位已有地图，则先清空
    if (slotElement.querySelector('.map-item')) {
      slotElement.innerHTML = '';
    }
    
    const mapElement = document.createElement('div');
    mapElement.className = 'map-item decider';
    
    mapElement.innerHTML = `
      <div class="map-header">
        <div class="team-logo placeholder-block"></div>
        <div class="map-name">${map.displayName}</div>
        <div class="team-logo placeholder-block"></div>
      </div>
      <div class="map-image">
        <img src="${map.image}" alt="${map.displayName}">
      </div>
      <div class="map-footer">
        <div class="map-action decider">决胜局</div>
      </div>
    `;
    
    slotElement.appendChild(mapElement);
    
    // 添加动画类
    setTimeout(() => {
      mapElement.classList.add('animated');
    }, 50);
  }
  
  // 渲染地图并添加动画效果 (常规地图，从左到右)
  function renderMapWithAnimation(map, action, team) {
    // 获取下一个可用槽位（从左到右），但最多只使用前6个槽位
    if (currentDisplayIndex >= 6) {
      console.warn('已达到最大显示数量');
      return;
    }
    
    const slotElement = document.getElementById(`map-slot-${currentDisplayIndex}`);
    currentDisplayIndex++; // 更新索引，确保下一个地图显示在右侧
    
    // 检查该槽位是否已有地图，如果有则跳过(不应该发生)
    if (slotElement.querySelector('.map-item')) {
      console.warn('槽位已有地图', currentDisplayIndex - 1);
      return;
    }
    
    const mapElement = document.createElement('div');
    // 设置类，确保ban操作的外框是红色，pick操作的外框是蓝色
    mapElement.className = `map-item ${action}`;
    if (team) {
      mapElement.classList.add(team);
    }
    
    // 存储地图ID和名称，用于后续更新
    mapElement.dataset.mapId = map.id;
    mapElement.dataset.mapName = map.displayName;
    
    let teamInfo = '';
    if (team) {
      const teamLogo = team === 'team1' ? team1Logo : team2Logo;
      const teamName = team === 'team1' ? team1Name : team2Name;
      
      // 根据是否有logo决定显示方式
      if (teamLogo) {
        teamInfo = `
          <div class="team-indicator">
            <img src="${teamLogo}" class="team-logo-img" alt="${teamName} Logo">
            <span>${teamName}</span>
          </div>
        `;
      } else {
        teamInfo = `
          <div class="team-indicator">
            <span>${teamName}</span>
          </div>
        `;
      }
    }
    
    // 检查是否有阵营信息
    let headerContent = '';
    if (map.sidesInfo) {
      // 如果有阵营信息，创建带阵营的头部
      const data = map.sidesInfo;
      const pickedByTeam = data.pickedByTeam;
      const team1Side = pickedByTeam === 'team1' ? (data.side === 'CT' ? 'T' : 'CT') : data.side;
      const team2Side = pickedByTeam === 'team2' ? (data.side === 'CT' ? 'T' : 'CT') : data.side;
      
      headerContent = `
        <div class="team-logo team1-side ${team1Side.toLowerCase()}">
          ${team1Logo ? `<img src="${team1Logo}" alt="Team 1 Logo">` : '<div class="logo-placeholder"></div>'}
        </div>
        <div class="map-name">${map.displayName}</div>
        <div class="team-logo team2-side ${team2Side.toLowerCase()}">
          ${team2Logo ? `<img src="${team2Logo}" alt="Team 2 Logo">` : '<div class="logo-placeholder"></div>'}
        </div>
      `;
    } else {
      // 否则创建默认头部
      headerContent = `
        <div class="team-logo ${action === 'ban' ? 'placeholder-block' : ''}"></div>
        <div class="map-name">${map.displayName}</div>
        <div class="team-logo ${action === 'ban' ? 'placeholder-block' : ''}"></div>
      `;
    }
    
    mapElement.innerHTML = `
      <div class="map-header">
        ${headerContent}
      </div>
      <div class="map-image">
        <img src="${map.image}" alt="${map.displayName}">
      </div>
      <div class="map-footer">
        <div class="map-action ${action}">
          ${action === 'ban' ? '禁用' : action === 'pick' ? '选择' : '决胜局'}
        </div>
        ${teamInfo}
      </div>
    `;
    
    slotElement.appendChild(mapElement);
    
    // 添加动画类（延迟一点以确保元素已添加到DOM）
    setTimeout(() => {
      mapElement.classList.add('animated');
    }, 50);
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
});
