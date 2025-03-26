const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const matchRoutes = require('./routes/match');
const { getActiveMatches } = require('./models/match');
const connectDB = require('./config/database');

const app = express();
const server = http.createServer(app);
//const io = socketIO(server);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['polling', 'websocket']
});

// 连接数据库
connectDB();

// 中间件
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 设置io实例为应用的属性，以便在routes中访问
app.set('io', io);

// 路由
app.use('/api/match', matchRoutes);

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

app.get('/team1/:matchId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/team1.html'));
});

app.get('/team2/:matchId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/team2.html'));
});

app.get('/audience/:matchId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/audience.html'));
});

// 添加OBS页面路由
app.get('/obs/:matchId', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/obs.html'));
});

// Socket.io处理
io.on('connection', (socket) => {
  console.log('新连接: ' + socket.id);
  
  socket.on('joinMatch', (matchId) => {
    socket.join(matchId);
    console.log(`Socket ${socket.id} 加入比赛房间 ${matchId}`);
  });

  socket.on('banMap', (data) => {
    // 处理禁用地图操作
    io.to(data.matchId).emit('mapBanned', data);
  });

  socket.on('pickMap', (data) => {
    // 处理选择地图操作
    io.to(data.matchId).emit('mapPicked', data);
  });
  
  // 新增：处理阵营选择
  socket.on('sideSelected', (data) => {
    // 广播阵营选择事件
    io.to(data.matchId).emit('sideSelected', data);
  });

  socket.on('disconnect', () => {
    console.log('连接断开: ' + socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 7355;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
