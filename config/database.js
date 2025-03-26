const mongoose = require('mongoose');

require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MongoDB连接字符串未设置');
    }

    await mongoose.connect(mongoURI);
    console.log('MongoDB连接成功');
  } catch (err) {
    console.error('MongoDB连接失败:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
