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

// 修改 Socket.IO 配置
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // 添加配置以支持 Vercel
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  path: '/socket.io'
});

// 为 Vercel 环境添加特殊处理
if (process.env.VERCEL) {
  console.log('Running on Vercel...');
  
  // 添加健康检查路由
  app.get('/health', (req, res) => {
    res.send('OK');
  });
  
  // 允许 Vercel 的请求头
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
}

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

// 修改服务器启动方式
const PORT = process.env.PORT || 7355;
if (process.env.VERCEL) {
  // Vercel 环境下不需要显式监听端口
  module.exports = app;
} else {
  // 本地开发环境
  server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
};
